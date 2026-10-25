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

/**
 * Recovers a JSON answer that was cut off by the output-token limit: keeps everything up to the last
 * complete array element and closes the open brackets. Returns undefined if nothing usable remains.
 */
export function salvageTruncatedJson(text: string): unknown {
  const start = text.indexOf("{");
  if (start < 0) return undefined;
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let best: { end: number; open: string[] } | undefined;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      stack.pop();
      // An element inside an array just finished: a safe place to cut.
      if (stack[stack.length - 1] === "[") best = { end: i + 1, open: [...stack] };
      if (stack.length === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  if (!best) return undefined;
  const closers = best.open
    .reverse()
    .map((b) => (b === "[" ? "]" : "}"))
    .join("");
  try {
    return JSON.parse(text.slice(start, best.end) + closers);
  } catch {
    return undefined;
  }
}
