#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { TenderReadyStack } from "../lib/tenderready-stack";

const app = new App();
const region = app.node.tryGetContext("region") ?? "eu-north-1";

new TenderReadyStack(app, "TenderReady", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region },
  modelId: app.node.getContext("modelId"),
  description: "TenderReady AI — digital compliance officer for SMME hubs (AWS AI Hackathon 2026)",
});
