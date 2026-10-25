export interface PageText {
  page: number;
  text: string;
}

export interface ExtractedDocument {
  pageCount: number;
  pages: PageText[];
  /** Pages transcribed by the AI from page images because they had no text layer. */
  ocrPages?: number[];
}

/** Wraps each page in <page number="N"> tags so the model can cite page numbers. */
export function renderPages(pages: PageText[]): string {
  return pages.map((p) => `<page number="${p.page}">\n${p.text}\n</page>`).join("\n");
}

/** Rough token estimate (≈4 characters per token) used for chunking decisions. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkPages(pages: PageText[], maxTokens: number): PageText[][] {
  const chunks: PageText[][] = [];
  let current: PageText[] = [];
  let size = 0;
  for (const p of pages) {
    const t = estimateTokens(p.text) + 10;
    if (current.length > 0 && size + t > maxTokens) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(p);
    size += t;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

const STOPWORDS = new Set(
  "the a an and or of to in for on is are be what when where which who how do does i we our my with at by from this that any".split(
    " ",
  ),
);

/** Picks the most relevant pages for a question when the whole document does not fit in context. */
export function selectPagesForQuestion(pages: PageText[], question: string, maxTokens: number): PageText[] {
  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  const scored = pages.map((p) => {
    const lower = p.text.toLowerCase();
    const score = terms.reduce((s, t) => s + (lower.split(t).length - 1), 0);
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score || a.p.page - b.p.page);
  const picked: PageText[] = [];
  let size = 0;
  for (const { p } of scored) {
    const t = estimateTokens(p.text);
    if (size + t > maxTokens) continue;
    picked.push(p);
    size += t;
  }
  return picked.sort((a, b) => a.page - b.page);
}
