import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { env } from "../env";
import { UserFacingError } from "../errors";
import { extractJson, salvageTruncatedJson, wrapDocument } from "./messages";
import type { ChatMessage, ChatRequest, LlmProvider, StructuredRequest } from "./types";

const ssm = new SSMClient({});
let cachedToken: string | undefined;

/** The Cloudflare API token lives in SSM Parameter Store (SecureString) and is cached per Lambda container. */
async function apiToken(): Promise<string> {
  if (!cachedToken) {
    const res = await ssm.send(new GetParameterCommand({ Name: env.cloudflareTokenParam, WithDecryption: true }));
    cachedToken = res.Parameter?.Value;
    if (!cachedToken) throw new Error("Cloudflare API token parameter is empty");
  }
  return cachedToken;
}

interface CompletionResponse {
  choices?: Array<{ message?: { content?: string | null; reasoning_content?: string | null }; finish_reason?: string }>;
  usage?: unknown;
}

class WorkersAiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    // Step Functions retries ThrottlingException with backoff.
    this.name =
      status === 429
        ? "ThrottlingException"
        : status === 408
          ? "ModelTimeoutError" // Cloudflare stopped a long generation (error 3046); retried once by Step Functions
          : status >= 500
            ? "ServiceUnavailableException"
            : "WorkersAiError";
  }
}

const DAILY_LIMIT_RE = /neuron|daily|allocation|free tier|4006/i;

/** Per-request timeout. The API Lambda sets AI_TIMEOUT_MS to stay inside API Gateway's 30 s limit. */
function timeoutMs(): number {
  return process.env.AI_TIMEOUT_MS ? Number(process.env.AI_TIMEOUT_MS) : 280_000;
}

async function complete(body: Record<string, unknown>): Promise<CompletionResponse> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.cloudflareAccountId}/ai/v1/chat/completions`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${await apiToken()}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs()),
    });
  } catch (err) {
    if ((err as Error).name === "TimeoutError") throw new UserFacingError("The AI service took too long to respond. Please try again.");
    throw err;
  }
  if (!res.ok) {
    const text = (await res.text()).slice(0, 500);
    if (res.status === 429 && DAILY_LIMIT_RE.test(text)) {
      throw new UserFacingError("Today's free AI allowance has been used up. Please try again after 02:00 (SAST).");
    }
    if (res.status === 401 || res.status === 403) {
      console.error(JSON.stringify({ msg: "workers-ai.auth", status: res.status, detail: text }));
      throw new UserFacingError("The AI service rejected our credentials. Please contact the TenderReady team.");
    }
    throw new WorkersAiError(res.status, `Workers AI request failed (${res.status}): ${text}`);
  }
  return (await res.json()) as CompletionResponse;
}

function outputText(res: CompletionResponse): string {
  const msg = res.choices?.[0]?.message;
  return (msg?.content ?? "").trim();
}

/** Per-model request options: keep reasoning short so answers fit the API's time limit and the free allowance. */
export function modelOptions(modelId: string): Record<string, unknown> {
  if (modelId.includes("gpt-oss")) return { reasoning_effort: "low" };
  if (modelId.includes("glm")) return { chat_template_kwargs: { enable_thinking: false } };
  return {};
}

/**
 * Cloudflare Workers AI through its OpenAI-compatible REST endpoint. Used while the hackathon AWS
 * account has no Bedrock quota. Text-only: scanned PDF pages cannot be transcribed with this provider.
 */
export function workersAiProvider(modelId: string): LlmProvider {
  const messages = (system: string, document: string, turns: ChatMessage[]) => [
    { role: "system", content: `${system}\n\n${wrapDocument(document)}` },
    ...turns.map((t) => ({ role: t.role, content: t.text })),
  ];

  return {
    name: "workers-ai",
    modelId,
    // ~128k-token context models; leave room for the prompt and the JSON output.
    maxDocTokens: 90_000,
    readsScannedPdfs: false,

    async structured(req: StructuredRequest) {
      const base = {
        ...modelOptions(modelId),
        model: modelId,
        max_tokens: req.maxTokens,
        temperature: 0,
      };
      // Plain JSON mode with the schema in the prompt. Strict json_schema (guided decoding) made the model
      // pad answers with endless whitespace until it hit the output limit on long tenders.
      const prompt = `${req.instruction}\nRespond with a single JSON object that matches this JSON schema ("${req.schemaName}"). Output JSON only, no prose.\n${JSON.stringify(req.schema)}`;
      const msgs = messages(req.system, req.document, [{ role: "user", text: prompt }]);
      let res: CompletionResponse;
      try {
        res = await complete({ ...base, messages: msgs, response_format: { type: "json_object" } });
      } catch (err) {
        // Models without JSON mode: ask without a format constraint and parse the JSON out of the text.
        if (!(err instanceof WorkersAiError) || err.status !== 400) throw err;
        console.warn(JSON.stringify({ msg: "workers-ai.json-mode-fallback", detail: err.message.slice(0, 200) }));
        res = await complete({ ...base, messages: msgs });
      }
      console.log(JSON.stringify({ msg: "llm.structured", provider: "workers-ai", model: modelId, usage: res.usage, finish: res.choices?.[0]?.finish_reason }));
      const text = outputText(res);
      const finish = res.choices?.[0]?.finish_reason;
      if (!text) throw new Error(`Model returned no content (finish_reason=${finish})`);
      if (finish === "length") {
        // Output limit reached: keep the complete items rather than failing the whole tender.
        const salvaged = salvageTruncatedJson(text);
        console.warn(JSON.stringify({ msg: "workers-ai.truncated", schema: req.schemaName, salvaged: salvaged !== undefined }));
        if (salvaged !== undefined) return salvaged;
      }
      return extractJson(text);
    },

    async chat(req: ChatRequest) {
      const res = await complete({
        ...modelOptions(modelId),
        model: modelId,
        max_tokens: req.maxTokens,
        temperature: req.temperature,
        messages: messages(req.system, req.document, req.messages),
      });
      console.log(JSON.stringify({ msg: "llm.chat", provider: "workers-ai", model: modelId, usage: res.usage, finish: res.choices?.[0]?.finish_reason }));
      return outputText(res);
    },
  };
}
