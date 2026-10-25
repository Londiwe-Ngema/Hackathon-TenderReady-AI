function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export type AiProviderName = "bedrock" | "workers-ai";

export const env = {
  get tableName() {
    return required("TABLE_NAME");
  },
  get bucketName() {
    return required("BUCKET_NAME");
  },
  get aiProvider(): AiProviderName {
    return process.env.AI_PROVIDER === "workers-ai" ? "workers-ai" : "bedrock";
  },
  /** Model used by the active provider (Bedrock model/inference-profile id or Workers AI model name). */
  get modelId() {
    return required("AI_MODEL_ID");
  },
  /** Bedrock model used for transcribing scanned pages (only when the Bedrock provider is active). */
  get bedrockModelId() {
    return process.env.BEDROCK_MODEL_ID ?? required("AI_MODEL_ID");
  },
  get cloudflareAccountId() {
    return required("CF_ACCOUNT_ID");
  },
  get cloudflareTokenParam() {
    return required("CF_TOKEN_PARAM");
  },
  get promptCache() {
    return process.env.PROMPT_CACHE !== "false";
  },
};

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
