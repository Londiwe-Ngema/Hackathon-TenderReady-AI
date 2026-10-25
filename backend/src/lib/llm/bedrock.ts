import { ConverseCommand, type SystemContentBlock, type ToolInputSchema } from "@aws-sdk/client-bedrock-runtime";
import { bedrock } from "../aws";
import { env } from "../env";
import { wrapDocument } from "./messages";
import type { ChatRequest, LlmProvider, StructuredRequest } from "./types";

function systemBlocks(prompt: string, document: string): SystemContentBlock[] {
  const blocks: SystemContentBlock[] = [{ text: prompt }, { text: wrapDocument(document) }];
  if (env.promptCache) blocks.push({ cachePoint: { type: "default" } });
  return blocks;
}

/** Amazon Bedrock (Claude) via the Converse API: forced tool use for structured output, prompt caching. */
export function bedrockProvider(modelId: string): LlmProvider {
  return {
    name: "bedrock",
    modelId,
    maxDocTokens: 150_000,
    readsScannedPdfs: true,

    async structured(req: StructuredRequest) {
      const res = await bedrock.send(
        new ConverseCommand({
          modelId,
          system: systemBlocks(req.system, req.document),
          messages: [{ role: "user", content: [{ text: `${req.instruction}\nCall ${req.schemaName} with your answer.` }] }],
          toolConfig: {
            tools: [
              {
                toolSpec: {
                  name: req.schemaName,
                  description: "Record the structured result.",
                  inputSchema: { json: req.schema } as unknown as ToolInputSchema,
                },
              },
            ],
            toolChoice: { tool: { name: req.schemaName } },
          },
          inferenceConfig: { maxTokens: req.maxTokens, temperature: 0 },
        }),
      );
      console.log(JSON.stringify({ msg: "llm.structured", provider: "bedrock", usage: res.usage, stopReason: res.stopReason }));
      const toolUse = res.output?.message?.content?.find((c) => c.toolUse)?.toolUse;
      if (!toolUse?.input) throw new Error(`Model did not return a structured result (stopReason=${res.stopReason})`);
      return toolUse.input;
    },

    async chat(req: ChatRequest) {
      const res = await bedrock.send(
        new ConverseCommand({
          modelId,
          system: systemBlocks(req.system, req.document),
          messages: req.messages.map((m) => ({ role: m.role, content: [{ text: m.text }] })),
          inferenceConfig: { maxTokens: req.maxTokens, temperature: req.temperature },
        }),
      );
      console.log(JSON.stringify({ msg: "llm.chat", provider: "bedrock", usage: res.usage, stopReason: res.stopReason }));
      return (res.output?.message?.content ?? []).map((c) => c.text ?? "").join("").trim();
    },
  };
}
