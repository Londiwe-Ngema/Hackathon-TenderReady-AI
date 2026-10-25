import {
  ConverseCommand,
  type ContentBlock,
  type Message,
  type SystemContentBlock,
  type ToolInputSchema,
} from "@aws-sdk/client-bedrock-runtime";
import type { AskResponse } from "@tenderready/shared";
import { bedrock } from "./aws";
import { env } from "./env";
import {
  ANALYSIS_TOOL_NAME,
  ANALYSIS_TOOL_SCHEMA,
  mergeAnalyses,
  normaliseAnalysis,
  type AnalysisResult,
} from "./analysis";
import { parseCitations } from "./citations";
import { ANALYSIS_CHUNK_NOTE, ANALYSIS_SYSTEM_PROMPT, ASK_SYSTEM_PROMPT } from "./prompts";
import { chunkPages, estimateTokens, renderPages, selectPagesForQuestion, type PageText } from "./document-text";

/** Above this the document is split (analysis) or narrowed to relevant pages (Q&A). */
export const MAX_DOC_TOKENS = 150_000;

function systemBlocks(prompt: string, document: string): SystemContentBlock[] {
  const blocks: SystemContentBlock[] = [{ text: prompt }, { text: `<document>\n${document}\n</document>` }];
  if (env.promptCache) blocks.push({ cachePoint: { type: "default" } });
  return blocks;
}

async function analyseChunk(pages: PageText[], note: string | null, maxPage: number): Promise<AnalysisResult> {
  const res = await bedrock.send(
    new ConverseCommand({
      modelId: env.modelId,
      system: systemBlocks(ANALYSIS_SYSTEM_PROMPT, renderPages(pages)),
      messages: [
        {
          role: "user",
          content: [
            {
              text: `${note ? note + "\n" : ""}Analyse the tender and call ${ANALYSIS_TOOL_NAME} with the summary, a complete compliance checklist and the disqualification risks.`,
            },
          ],
        },
      ],
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: ANALYSIS_TOOL_NAME,
              description: "Record the structured tender analysis.",
              inputSchema: { json: ANALYSIS_TOOL_SCHEMA } as unknown as ToolInputSchema,
            },
          },
        ],
        toolChoice: { tool: { name: ANALYSIS_TOOL_NAME } },
      },
      inferenceConfig: { maxTokens: 12_000, temperature: 0 },
    }),
  );
  const toolUse = res.output?.message?.content?.find((c) => c.toolUse)?.toolUse;
  if (!toolUse?.input) throw new Error(`Model did not return a structured analysis (stopReason=${res.stopReason})`);
  console.log(JSON.stringify({ msg: "bedrock.analyse", usage: res.usage, stopReason: res.stopReason }));
  return normaliseAnalysis(toolUse.input, maxPage);
}

export async function analyseTender(pages: PageText[]): Promise<AnalysisResult> {
  const maxPage = pages.length;
  const total = estimateTokens(renderPages(pages));
  if (total <= MAX_DOC_TOKENS) return analyseChunk(pages, null, maxPage);

  const chunks = chunkPages(pages, MAX_DOC_TOKENS * 0.8);
  const parts: AnalysisResult[] = [];
  for (const [i, chunk] of chunks.entries()) {
    const note = ANALYSIS_CHUNK_NOTE(i + 1, chunks.length, chunk[0].page, chunk[chunk.length - 1].page);
    parts.push(await analyseChunk(chunk, note, maxPage));
  }
  return mergeAnalyses(parts);
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export async function askTender(pages: PageText[], question: string, history: ChatTurn[] = []): Promise<AskResponse> {
  const full = renderPages(pages);
  const context =
    estimateTokens(full) <= MAX_DOC_TOKENS ? full : renderPages(selectPagesForQuestion(pages, question, MAX_DOC_TOKENS));

  // Bedrock requires alternating roles starting with "user".
  const turns = history.slice(-6).filter((t) => t.text.trim());
  while (turns.length && turns[0].role !== "user") turns.shift();
  const messages: Message[] = [];
  for (const t of turns) {
    const last = messages[messages.length - 1];
    if (last && last.role === t.role) (last.content as ContentBlock[]).push({ text: t.text });
    else messages.push({ role: t.role, content: [{ text: t.text }] });
  }
  if (messages.length && messages[messages.length - 1].role === "user") messages.pop();
  messages.push({ role: "user", content: [{ text: question }] });

  const res = await bedrock.send(
    new ConverseCommand({
      modelId: env.modelId,
      system: systemBlocks(ASK_SYSTEM_PROMPT, context),
      messages,
      inferenceConfig: { maxTokens: 1_500, temperature: 0.2 },
    }),
  );
  console.log(JSON.stringify({ msg: "bedrock.ask", usage: res.usage, stopReason: res.stopReason }));
  const answer = (res.output?.message?.content ?? [])
    .map((c) => c.text ?? "")
    .join("")
    .trim();
  return { answer, citations: parseCitations(answer, pages) };
}
