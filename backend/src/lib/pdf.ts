import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { PDFDocument } from "pdf-lib";
import { extractText, getDocumentProxy } from "unpdf";
import { bedrock } from "./aws";
import type { ExtractedDocument, PageText } from "./document-text";
import { env } from "./env";
import { UserFacingError } from "./errors";

/** Pages with fewer extractable characters than this are treated as scanned images. */
export const MIN_TEXT_CHARS = 40;
const OCR_BATCH_PAGES = 5;
const OCR_CONCURRENCY = 3;
export const MAX_OCR_PAGES = 120;

export function normalisePageText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function scannedPages(pages: PageText[]): number[] {
  return pages.filter((p) => p.text.replace(/\s/g, "").length < MIN_TEXT_CHARS).map((p) => p.page);
}

/** Groups page numbers into batches of consecutive-ish pages for transcription calls. */
export function batchPages(pages: number[], size = OCR_BATCH_PAGES): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < pages.length; i += size) out.push(pages.slice(i, i + size));
  return out;
}

/** Parses <page number="N">…</page> blocks out of a model transcription. */
export function parseTranscription(text: string, expected: number[]): PageText[] {
  const found = new Map<number, string>();
  for (const m of text.matchAll(/<page number="(\d+)">([\s\S]*?)<\/page>/g)) {
    const page = Number(m[1]);
    if (expected.includes(page)) found.set(page, normalisePageText(m[2]));
  }
  return expected.map((page) => ({ page, text: found.get(page) ?? "" }));
}

/** Text layer extraction for digital PDFs (pdf.js via unpdf, no OCR). */
export async function extractTextLayer(bytes: Uint8Array): Promise<PageText[]> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  return (text as string[]).map((t, i) => ({ page: i + 1, text: normalisePageText(t) }));
}

async function transcribeBatch(source: PDFDocument, pages: number[]): Promise<PageText[]> {
  const sub = await PDFDocument.create();
  const copied = await sub.copyPages(source, pages.map((p) => p - 1));
  copied.forEach((p) => sub.addPage(p));
  const data = Buffer.from(await sub.save()).toString("base64");

  const mapping = pages.map((p, i) => `PDF page ${i + 1} = original page ${p}`).join("; ");
  const res = await bedrock.send(
    new InvokeModelCommand({
      modelId: env.modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4_000 * pages.length,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
              {
                type: "text",
                text: `This PDF excerpt comes from a scanned tender document (${mapping}). Transcribe ALL visible text on every page exactly as written, in reading order. Render tables as markdown tables wrapped in [TABLE]...[/TABLE]. Mark unreadable text as [illegible]. Output only one <page number="N">...</page> block per page using the ORIGINAL page numbers. Do not summarise or add commentary.`,
              },
            ],
          },
        ],
      }),
    }),
  );
  const body = JSON.parse(new TextDecoder().decode(res.body)) as { content?: Array<{ type: string; text?: string }>; usage?: unknown };
  console.log(JSON.stringify({ msg: "bedrock.transcribe", pages: pages.length, usage: body.usage }));
  return parseTranscription((body.content ?? []).map((c) => c.text ?? "").join(""), pages);
}

/**
 * Extracts page-tagged text from a tender PDF. Digital pages use the PDF text layer; pages without
 * a text layer (scans) are transcribed by Claude on Bedrock, which reads the page images.
 */
export async function extractPdf(bytes: Uint8Array): Promise<ExtractedDocument & { ocrPages: number[] }> {
  const pages = await extractTextLayer(bytes.slice());
  const toOcr = scannedPages(pages);
  if (toOcr.length > MAX_OCR_PAGES) {
    throw new UserFacingError(
      `This scanned PDF has ${toOcr.length} image-only pages; the limit is ${MAX_OCR_PAGES}. Please upload a text-based copy or split the document.`,
    );
  }
  if (toOcr.length) {
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const batches = batchPages(toOcr);
    for (let i = 0; i < batches.length; i += OCR_CONCURRENCY) {
      const results = await Promise.all(batches.slice(i, i + OCR_CONCURRENCY).map((b) => transcribeBatch(source, b)));
      for (const r of results.flat()) pages[r.page - 1] = r;
    }
  }
  return { pageCount: pages.length, pages, ocrPages: toOcr };
}
