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

/**
 * Picks the pages most relevant to a question within a token budget. Terms are weighted by rarity
 * (words on every page, like "tender", count for little). Page 1 is always included because it
 * usually carries the title, reference and closing details. If few pages match, the earliest
 * pages fill the remaining budget.
 */
export function selectPagesForQuestion(pages: PageText[], question: string, maxTokens: number): PageText[] {
  const terms = [
    ...new Set(
      question
        .toLowerCase()
        .split(/[^a-z0-9-]+/)
        .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
    ),
  ];
  const lowered = pages.map((p) => p.text.toLowerCase());
  const weight = new Map(
    terms.map((t) => {
      const df = lowered.filter((text) => text.includes(t)).length;
      return [t, df === 0 ? 0 : Math.log(1 + pages.length / df)];
    }),
  );
  const scored = pages.map((p, i) => ({
    p,
    score: terms.reduce((s, t) => s + Math.min(lowered[i].split(t).length - 1, 5) * (weight.get(t) ?? 0), 0),
  }));

  const picked = new Map<number, PageText>();
  let size = 0;
  const add = (p: PageText) => {
    const t = estimateTokens(p.text);
    if (picked.has(p.page) || size + t > maxTokens) return;
    picked.set(p.page, p);
    size += t;
  };
  if (pages[0]) add(pages[0]);
  for (const { p } of scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.p.page - b.p.page)) add(p);
  if (picked.size < 4) for (const p of pages) add(p);
  return [...picked.values()].sort((a, b) => a.page - b.page);
}

const PAGE_NUMBER_LINE = /^(page\s*)?-?\s*\d{1,4}\s*(of|\/)?\s*\d{0,4}\s*-?$/i;

/**
 * Removes boilerplate that repeats on most pages (letterheads, "Strictly Confidential", company
 * registration footers) and bare page-number lines. The first occurrence is kept on page 1 so the
 * content isn't lost, only its repetition.
 */
export function stripRepeatedLines(pages: PageText[]): PageText[] {
  const withText = pages.filter((p) => p.text.trim());
  if (withText.length < 4) return pages;
  const counts = new Map<string, number>();
  for (const p of withText) {
    for (const line of new Set(p.text.split("\n").map((l) => l.trim()))) {
      if (line.length > 3 && !line.startsWith("|") && !line.startsWith("[TABLE")) counts.set(line, (counts.get(line) ?? 0) + 1);
    }
  }
  const threshold = Math.max(3, Math.ceil(withText.length * 0.5));
  const repeated = new Set([...counts].filter(([, c]) => c >= threshold).map(([l]) => l));
  return pages.map((p) => {
    const lines = p.text.split("\n").filter((raw) => {
      const line = raw.trim();
      if (PAGE_NUMBER_LINE.test(line)) return false;
      return !(repeated.has(line) && p.page !== withText[0].page);
    });
    return { page: p.page, text: lines.join("\n").trim() };
  });
}
