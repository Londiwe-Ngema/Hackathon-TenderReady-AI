import { env } from "../env";
import { bedrockProvider } from "./bedrock";
import type { LlmProvider } from "./types";
import { workersAiProvider } from "./workers-ai";

export type { ChatMessage, LlmProvider } from "./types";
export { buildTurns } from "./messages";

let instance: LlmProvider | undefined;

/** The configured AI backend (AI_PROVIDER = bedrock | workers-ai). */
export function llm(): LlmProvider {
  instance ??= env.aiProvider === "workers-ai" ? workersAiProvider(env.modelId) : bedrockProvider(env.modelId);
  return instance;
}
