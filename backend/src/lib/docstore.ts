import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "./aws";
import { env } from "./env";
import { extractedObjectKey } from "./keys";
import type { ExtractedDocument } from "./document-text";

export async function saveExtracted(hubId: string, tenderId: string, doc: ExtractedDocument): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.bucketName,
      Key: extractedObjectKey(hubId, tenderId),
      Body: JSON.stringify(doc),
      ContentType: "application/json",
    }),
  );
}

export async function loadExtracted(hubId: string, tenderId: string): Promise<ExtractedDocument> {
  const res = await s3.send(new GetObjectCommand({ Bucket: env.bucketName, Key: extractedObjectKey(hubId, tenderId) }));
  return JSON.parse(await res.Body!.transformToString()) as ExtractedDocument;
}
