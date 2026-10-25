import type { AskResponse } from "@tenderready/shared";
import { ANALYSIS_PARTS, mergeAnalyses, normaliseAnalysis, type AnalysisPart, type AnalysisResult } from "./analysis";
import { parseCitations } from "./citations";
import { chunkPages, estimateTokens, renderPages, selectPagesForQuestion, type PageText } from "./document-text";
import { buildTurns, llm, type ChatMessage } from "./llm";
import { ANALYSIS_CHUNK_NOTE, ANALYSIS_SYSTEM_PROMPT, ASK_SYSTEM_PROMPT } from "./prompts";

export type ChatTurn = ChatMessage;

/** Q&A only sends the pages most relevant to the question (plus page 1), keeping answers fast and cheap. */
export const QA_CONTEXT_TOKENS = 7_000;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Pulls one part out of a model answer, tolerating the shapes models actually return: the requested
 * key, the payload nested under the schema name, a bare array, or the summary fields at the top level.
 */
export function pickPart(raw: unknown, part: AnalysisPart): unknown {
  if (part.key !== "summary" && Array.isArray(raw)) return raw;
  if (!isObject(raw)) return undefined;
  if (raw[part.key] !== undefined) return raw[part.key];
  for (const v of Object.values(raw)) {
    if (isObject(v) && v[part.key] !== undefined) return v[part.key];
  }
  if (part.key === "summary") {
    if ("overview" in raw || "title" in raw || "closingDateText" in raw) return raw;
    return Object.values(raw).find((v) => isObject(v) && ("overview" in v || "title" in v));
  }
  return Object.values(raw).find((v) => Array.isArray(v) && v.length > 0 && isObject(v[0]));
}

const isEmptyPart = (v: unknown) => v === undefined || (Array.isArray(v) && v.length === 0);

async function runPart(part: AnalysisPart, document: string, note: string | null): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    const raw = await llm().structured({
      system: ANALYSIS_SYSTEM_PROMPT,
      document,
      instruction: `${note ? note + "\n" : ""}${part.instruction}`,
      schemaName: part.schemaName,
      schema: part.schema,
      maxTokens: part.maxTokens,
    });
    const value = pickPart(raw, part);
    // An empty checklist for a real tender is almost always a formatting slip; ask once more.
    if (!isEmptyPart(value) || part.key === "risks" || attempt === 2) return value;
    console.warn(JSON.stringify({ msg: "analysis.part-retry", part: part.key, keys: isObject(raw) ? Object.keys(raw).slice(0, 5) : typeof raw }));
  }
}

async function analyseChunk(pages: PageText[], note: string | null, maxPage: number): Promise<AnalysisResult> {
  const document = renderPages(pages);
  const [summary, checklist, risks] = await Promise.all(ANALYSIS_PARTS.map((part) => runPart(part, document, note)));
  return normaliseAnalysis({ summary, checklist, risks }, maxPage);
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
    maxTokens: 900,
    temperature: 0.2,
  });
  return { answer, citations: parseCitations(answer, pages) };
}
