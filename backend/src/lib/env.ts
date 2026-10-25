function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const env = {
  get tableName() {
    return required("TABLE_NAME");
  },
  get bucketName() {
    return required("BUCKET_NAME");
  },
  get modelId() {
    return required("BEDROCK_MODEL_ID");
  },
  get promptCache() {
    return process.env.PROMPT_CACHE !== "false";
  },
};

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
