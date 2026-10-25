import { Stack } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";

/**
 * Least-privilege Bedrock invoke permission for one model.
 * Cross-region inference profiles (e.g. "eu.anthropic...") need the profile ARN plus the underlying
 * foundation-model ARN in every region the profile can route to.
 */
export function grantBedrockInvoke(grantee: iam.IGrantable, stack: Stack, modelId: string): void {
  const isProfile = /^(eu|us|apac|global)\./.test(modelId);
  const foundationId = isProfile ? modelId.replace(/^[a-z]+\./, "") : modelId;
  const resources = [`arn:aws:bedrock:*::foundation-model/${foundationId}`];
  if (isProfile) resources.push(`arn:aws:bedrock:${stack.region}:${stack.account}:inference-profile/${modelId}`);
  grantee.grantPrincipal.addToPrincipalPolicy(
    new iam.PolicyStatement({ actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"], resources }),
  );
}
