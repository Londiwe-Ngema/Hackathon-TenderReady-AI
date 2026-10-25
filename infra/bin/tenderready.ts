#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { TenderReadyStack } from "../lib/tenderready-stack";

const app = new App();
const region = app.node.tryGetContext("region") ?? "eu-north-1";
// Pinned so a stray AWS_PROFILE can never deploy (or grant permissions) into another account.
const account = app.node.tryGetContext("account") ?? process.env.CDK_DEFAULT_ACCOUNT;

new TenderReadyStack(app, "TenderReady", {
  env: { account, region },
  ai: {
    provider: app.node.getContext("aiProvider") === "bedrock" ? "bedrock" : "workers-ai",
    bedrockModelId: app.node.getContext("bedrockModelId"),
    workersAiModelId: app.node.getContext("workersAiModelId"),
    cloudflareAccountId: app.node.getContext("cloudflareAccountId"),
    cloudflareTokenParam: app.node.getContext("cloudflareTokenParam"),
  },
  description: "TenderReady AI — digital compliance officer for SMME hubs (AWS AI Hackathon 2026)",
});
