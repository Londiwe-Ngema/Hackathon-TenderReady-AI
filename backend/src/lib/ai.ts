import type { AskResponse } from "@tenderready/shared";
import { ANALYSIS_TOOL_NAME, ANALYSIS_TOOL_SCHEMA, mergeAnalyses, normaliseAnalysis, type AnalysisResult } from "./analysis";
import { parseCitations } from "./citations";
import { chunkPages, estimateTokens, renderPages, selectPagesForQuestion, type PageText } from "./document-text";
import { buildTurns, llm, type ChatMessage } from "./llm";
import { ANALYSIS_CHUNK_NOTE, ANALYSIS_SYSTEM_PROMPT, ASK_SYSTEM_PROMPT } from "./prompts";

export type ChatTurn = ChatMessage;

async function analyseChunk(pages: PageText[], note: string | null, maxPage: number): Promise<AnalysisResult> {
  const raw = await llm().structured({
    system: ANALYSIS_SYSTEM_PROMPT,
    document: renderPages(pages),
    instruction: `${note ? note + "\n" : ""}Analyse the tender and record the summary, a complete compliance checklist and the disqualification risks.`,
    schemaName: ANALYSIS_TOOL_NAME,
    schema: ANALYSIS_TOOL_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 12_000,
  });
  return normaliseAnalysis(raw, maxPage);
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
  const limit = llm().maxDocTokens;
  const full = renderPages(pages);
  const document = estimateTokens(full) <= limit ? full : renderPages(selectPagesForQuestion(pages, question, limit));
  const answer = await llm().chat({
    system: ASK_SYSTEM_PROMPT,
    document,
    messages: buildTurns(history, question),
    maxTokens: 1_500,
    temperature: 0.2,
  });
  return { answer, citations: parseCitations(answer, pages) };
}
