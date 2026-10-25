import type { Citation } from "@tenderready/shared";
import type { PageText } from "./document-text";

const CITE_RE = /\[(?:p|pp|page|pages)\.?\s*([\d,\s–-]+)\]/gi;

/** Extracts the distinct pages cited as [p.N], [p.3, 5] or [pp.4-6] in an answer, keeping only pages that exist. */
export function parseCitations(answer: string, pages: Pick<PageText, "page" | "text">[]): Citation[] {
  const valid = new Set(pages.map((p) => p.page));
  const found = new Set<number>();
  for (const match of answer.matchAll(CITE_RE)) {
    for (const part of match[1].split(",")) {
      const [a, b] = part.split(/[–-]/).map((n) => parseInt(n.trim(), 10));
      if (Number.isNaN(a)) continue;
      const end = Number.isNaN(b) || b === undefined ? a : Math.min(b, a + 20);
      for (let p = a; p <= end; p++) if (valid.has(p)) found.add(p);
    }
  }
  return [...found]
    .sort((x, y) => x - y)
    .map((page) => {
      const text = pages.find((p) => p.page === page)?.text ?? "";
      const firstLine = text.split("\n").find((l) => l.trim() && !l.startsWith("[TABLE]") && !l.startsWith("|"));
      return { page, quote: firstLine?.slice(0, 160) };
    });
}
