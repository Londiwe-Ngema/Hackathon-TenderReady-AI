import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { chunkPages, renderPages, selectPagesForQuestion } from "../src/lib/document-text";
import { batchPages, extractTextLayer, parseTranscription, scannedPages } from "../src/lib/pdf";

async function samplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  page.drawText("RFQ 12/2026 Supply of office furniture", { x: 50, y: 780, size: 14, font });
  page.drawText("Closing date: 15 November 2026 at 11:00. A compulsory briefing will be held.", { x: 50, y: 750, size: 10, font });
  doc.addPage([595, 842]); // image-only / blank page stands in for a scan
  return doc.save();
}

describe("PDF text layer", () => {
  it("extracts text per page and flags pages without a text layer for transcription", async () => {
    const pages = await extractTextLayer(await samplePdf());
    expect(pages).toHaveLength(2);
    expect(pages[0].text).toContain("Closing date: 15 November 2026");
    expect(scannedPages(pages)).toEqual([2]);
    expect(renderPages(pages)).toContain('<page number="2">');
  });

  it("parses page-tagged transcriptions and keeps only expected pages", () => {
    const out = parseTranscription('<page number="3">Hello\n\n\n world</page><page number="9">x</page>', [3, 4]);
    expect(out).toEqual([
      { page: 3, text: "Hello\n\nworld" },
      { page: 4, text: "" },
    ]);
  });

  it("batches scanned pages", () => {
    expect(batchPages([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });
});

describe("chunking and page selection", () => {
  const pages = [
    { page: 1, text: "a".repeat(400) },
    { page: 2, text: "compulsory briefing session at the municipal offices" },
    { page: 3, text: "b".repeat(400) },
  ];

  it("splits pages into token-bounded chunks", () => {
    expect(chunkPages(pages, 150).map((c) => c.map((p) => p.page))).toEqual([[1, 2], [3]]);
  });

  it("prefers pages that mention the question terms", () => {
    const picked = selectPagesForQuestion(pages, "Is there a compulsory briefing?", 50);
    expect(picked.map((p) => p.page)).toContain(2);
    expect(picked.map((p) => p.page)).not.toContain(1);
  });
});
