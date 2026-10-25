import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export const REPO_ROOT = path.join(__dirname, "../..");
export const backendEntry = (rel: string) => path.join(REPO_ROOT, "backend/src", rel);

export interface TsFunctionProps {
  entry: string;
  handler?: string;
  environment?: Record<string, string>;
  timeout?: Duration;
  memorySize?: number;
  description?: string;
}

/** Node 22 / arm64 Lambda bundled with esbuild, with its own 2-week log group. */
export class TsFunction extends NodejsFunction {
  constructor(scope: Construct, id: string, props: TsFunctionProps) {
    const logGroup = new logs.LogGroup(scope, `${id}Logs`, {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    super(scope, id, {
      entry: props.entry,
      handler: props.handler ?? "handler",
      description: props.description,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: props.memorySize ?? 512,
      timeout: props.timeout ?? Duration.seconds(30),
      environment: { NODE_OPTIONS: "--enable-source-maps", ...props.environment },
      logGroup,
      projectRoot: REPO_ROOT,
      depsLockFilePath: path.join(REPO_ROOT, "pnpm-lock.yaml"),
      bundling: {
        minify: true,
        sourceMap: true,
        target: "node22",
        // ESM output so pdf.js (unpdf) bundles cleanly; banner restores require() for CJS deps.
        format: OutputFormat.ESM,
        mainFields: ["module", "main"],
        banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
      },
    });
  }
}
