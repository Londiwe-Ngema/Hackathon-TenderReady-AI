export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface StructuredRequest {
  system: string;
  document: string;
  instruction: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}

export interface ChatRequest {
  system: string;
  document: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
}

/** A text-generation backend. The document is passed separately so providers can cache or place it optimally. */
export interface LlmProvider {
  readonly name: "bedrock" | "workers-ai";
  readonly modelId: string;
  /** Documents larger than this (estimated tokens) are chunked for analysis or narrowed for Q&A. */
  readonly maxDocTokens: number;
  /** Whether scanned (image-only) PDF pages can be transcribed with this provider. */
  readonly readsScannedPdfs: boolean;
  structured(req: StructuredRequest): Promise<unknown>;
  chat(req: ChatRequest): Promise<string>;
}
