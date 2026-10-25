import { Stack } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { grantBedrockInvoke } from "./bedrock";

/** Which model backend the Lambdas use. Switch with `-c aiProvider=bedrock|workers-ai` or in cdk.json. */
export interface AiConfig {
  provider: "bedrock" | "workers-ai";
  bedrockModelId: string;
  workersAiModelId: string;
  cloudflareAccountId: string;
  /** SSM SecureString parameter holding the Cloudflare API token (created outside CDK so it never lands in templates). */
  cloudflareTokenParam: string;
}

export function aiEnvironment(ai: AiConfig): Record<string, string> {
  const common = { AI_PROVIDER: ai.provider, BEDROCK_MODEL_ID: ai.bedrockModelId };
  return ai.provider === "workers-ai"
    ? { ...common, AI_MODEL_ID: ai.workersAiModelId, CF_ACCOUNT_ID: ai.cloudflareAccountId, CF_TOKEN_PARAM: ai.cloudflareTokenParam }
    : { ...common, AI_MODEL_ID: ai.bedrockModelId };
}

/** Grants exactly what the active provider needs: one Bedrock model, or read access to the token parameter. */
export function grantAi(grantee: iam.IGrantable, stack: Stack, ai: AiConfig): void {
  if (ai.provider === "bedrock") {
    grantBedrockInvoke(grantee, stack, ai.bedrockModelId);
    return;
  }
  grantee.grantPrincipal.addToPrincipalPolicy(
    new iam.PolicyStatement({
      actions: ["ssm:GetParameter"],
      resources: [`arn:aws:ssm:${stack.region}:${stack.account}:parameter${ai.cloudflareTokenParam}`],
    }),
  );
}

/** Human-readable label shown in the UI next to AI output. */
export function aiLabel(ai: AiConfig): string {
  return ai.provider === "workers-ai"
    ? `Cloudflare Workers AI (${ai.workersAiModelId.split("/").pop()})`
    : `Amazon Bedrock (${ai.bedrockModelId})`;
}
