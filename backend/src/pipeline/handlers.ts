import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../lib/aws";
import { analyseTender } from "../lib/bedrock";
import * as db from "../lib/db";
import { loadExtracted, saveExtracted } from "../lib/docstore";
import { env } from "../lib/env";
import { UserFacingError } from "../lib/errors";
import { parseTenderObjectKey, type TenderRef } from "../lib/keys";
import { extractPdf } from "../lib/pdf";

/** Step Functions state passed between pipeline steps. Contains identifiers only, never document content. */
export interface PipelineState extends TenderRef {
  key: string;
  pageCount?: number;
}

const log = (msg: string, state: Partial<PipelineState>, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ msg, tenderId: state.tenderId, ...extra }));

async function readPdf(key: string): Promise<Uint8Array> {
  const res = await s3.send(new GetObjectCommand({ Bucket: env.bucketName, Key: key }));
  return res.Body!.transformToByteArray();
}

/** Step 1: mark the tender as extracting. Input is the S3 "Object Created" EventBridge event. */
export async function start(event: { detail: { object: { key: string } } }): Promise<PipelineState> {
  const key = event.detail.object.key;
  const state: PipelineState = { ...parseTenderObjectKey(key), key };
  log("pipeline.start", state);
  await db.setTenderStatus(state.hubId, state.tenderId, "EXTRACTING");
  return state;
}

/**
 * Step 2: extract page-tagged text. Digital pages use the PDF text layer; scanned pages are
 * transcribed by Claude on Bedrock. (Amazon Textract is not offered in eu-north-1.)
 */
export async function extract(state: PipelineState): Promise<PipelineState> {
  const bytes = await readPdf(state.key);
  if (new TextDecoder("latin1").decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new UserFacingError("The uploaded file is not a valid PDF.");
  }

  let doc;
  try {
    doc = await extractPdf(bytes);
  } catch (err) {
    if (err instanceof UserFacingError) throw err;
    const name = (err as Error).name;
    if (name === "PasswordException") throw new UserFacingError("This PDF is password protected. Please upload an unlocked copy.");
    if (name === "InvalidPDFException") throw new UserFacingError("This PDF appears to be damaged and could not be read.");
    throw err;
  }

  const chars = doc.pages.reduce((n, p) => n + p.text.length, 0);
  log("pipeline.extracted", state, { pages: doc.pageCount, ocrPages: doc.ocrPages.length, chars });
  if (chars < 200) {
    throw new UserFacingError("Very little text could be read from this PDF. It may be blank or of very poor scan quality.");
  }
  await saveExtracted(state.hubId, state.tenderId, doc);
  await db.setTenderStatus(state.hubId, state.tenderId, "ANALYSING", { pageCount: doc.pageCount });
  return { ...state, pageCount: doc.pageCount };
}

/** Step 3: run the Bedrock analysis and persist summary, checklist and risks. */
export async function analyse(state: PipelineState): Promise<PipelineState> {
  const doc = await loadExtracted(state.hubId, state.tenderId);
  const result = await analyseTender(doc.pages);
  await db.saveAnalysis(state.hubId, state.tenderId, {
    ...result,
    closingDate: result.summary.closingDateTime,
    modelId: env.modelId,
  });
  log("pipeline.analysed", state, { checklist: result.checklist.length, risks: result.risks.length });
  return state;
}

/** Catch handler: mark the tender FAILED with a reason the advisor can act on. */
export async function fail(input: {
  detail?: { object?: { key?: string } };
  key?: string;
  error?: { Error?: string; Cause?: string };
}): Promise<void> {
  const key = input.key ?? input.detail?.object?.key;
  if (!key) return;
  const ref = parseTenderObjectKey(key);
  let reason = "Analysis failed. Please try uploading the tender again.";
  try {
    const cause = JSON.parse(input.error?.Cause ?? "{}") as { errorType?: string; errorMessage?: string };
    if (cause.errorType === "UserFacingError" && cause.errorMessage) reason = cause.errorMessage;
    else if (input.error?.Error === "States.Timeout") reason = "Analysis took too long. Large tenders may need to be split.";
    else if (cause.errorType === "AccessDeniedException") reason = "The AI service is not available for this account yet. Please try again later.";
  } catch {
    /* keep default reason */
  }
  console.error(JSON.stringify({ msg: "pipeline.failed", tenderId: ref.tenderId, error: input.error?.Error }));
  await db.setTenderStatus(ref.hubId, ref.tenderId, "FAILED", { statusReason: reason }).catch(() => undefined);
}
