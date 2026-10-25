import type { AskResponse } from "@tenderready/shared";
import { ANALYSIS_PARTS, mergeAnalyses, normaliseAnalysis, type AnalysisResult } from "./analysis";
import { parseCitations } from "./citations";
import { chunkPages, estimateTokens, renderPages, selectPagesForQuestion, type PageText } from "./document-text";
import { buildTurns, llm, type ChatMessage } from "./llm";
import { ANALYSIS_CHUNK_NOTE, ANALYSIS_SYSTEM_PROMPT, ASK_SYSTEM_PROMPT } from "./prompts";

export type ChatTurn = ChatMessage;

/** Q&A only sends the pages most relevant to the question (plus page 1), keeping answers fast and cheap. */
export const QA_CONTEXT_TOKENS = 12_000;

async function analyseChunk(pages: PageText[], note: string | null, maxPage: number): Promise<AnalysisResult> {
  const document = renderPages(pages);
  const results = await Promise.all(
    ANALYSIS_PARTS.map((part) =>
      llm().structured({
        system: ANALYSIS_SYSTEM_PROMPT,
        document,
        instruction: `${note ? note + "\n" : ""}${part.instruction}`,
        schemaName: part.schemaName,
        schema: part.schema,
        maxTokens: part.maxTokens,
      }),
    ),
  );
  const field = (i: number, key: string) => (results[i] as Record<string, unknown> | null)?.[key];
  return normaliseAnalysis({ summary: field(0, "summary"), checklist: field(1, "checklist"), risks: field(2, "risks") }, maxPage);
}

export async function analyseTender(pages: PageText[]): Promise<AnalysisResult> {
  const maxPage = pages.length;
  const limit = llm().maxDocTokens;
  if (estimateTokens(renderPages(pages)) <= limit) return analyseChunk(pages, null, maxPage);

  const chunks = chunkPages(pages, limit * 0.8);
  const parts: AnalysisResult[] = [];
  for (const [i, chunk] of chunks.entries()) {
    const note = ANALYSIS_CHUNK_NOTE(i + 1, chunks.length, chunk[0].page, chunk[chunk.length - 1].page);
    parts.push(await analyseChunk(chunk, note, maxPage));
  }
  return mergeAnalyses(parts);
}

export async function askTender(pages: PageText[], question: string, history: ChatTurn[] = []): Promise<AskResponse> {
  const full = renderPages(pages);
  // Follow-ups ("and when is it?") borrow terms from the previous question when picking pages.
  const previous = [...history].reverse().find((t) => t.role === "user")?.text ?? "";
  const document =
    estimateTokens(full) <= QA_CONTEXT_TOKENS
      ? full
      : renderPages(selectPagesForQuestion(pages, `${question} ${previous}`, QA_CONTEXT_TOKENS));
  const answer = await llm().chat({
    system: ASK_SYSTEM_PROMPT,
    document,
    messages: buildTurns(history, question),
    maxTokens: 1_500,
    temperature: 0.2,
  });
  return { answer, citations: parseCitations(answer, pages) };
}
