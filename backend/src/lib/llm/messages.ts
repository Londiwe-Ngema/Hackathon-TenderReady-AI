import type { ChatMessage } from "./types";

/**
 * Normalises chat history for strict providers: keeps the last turns, starts with a user turn,
 * merges consecutive same-role turns, and ends with the new question.
 */
export function buildTurns(history: ChatMessage[], question: string, maxHistory = 6): ChatMessage[] {
  const turns = history.slice(-maxHistory).filter((t) => t.text.trim());
  while (turns.length && turns[0].role !== "user") turns.shift();
  const out: ChatMessage[] = [];
  for (const t of turns) {
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.text += `\n\n${t.text}`;
    else out.push({ ...t });
  }
  if (out.length && out[out.length - 1].role === "user") out.pop();
  out.push({ role: "user", text: question });
  return out;
}

export const wrapDocument = (document: string) => `<document>\n${document}\n</document>`;

/** Extracts a JSON value from model output that may include code fences or surrounding prose. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error("Model output did not contain valid JSON");
  }
}
