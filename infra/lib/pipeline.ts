import { Duration, Stack } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";
import { grantBedrockInvoke } from "./bedrock";
import { TsFunction, backendEntry } from "./fn";

export interface PipelineProps {
  bucket: s3.Bucket;
  table: dynamodb.TableV2;
  modelId: string;
}

/**
 * S3 upload → EventBridge → Step Functions:
 * extract page text (PDF text layer, Claude transcription for scanned pages) → Bedrock analysis → DynamoDB.
 */
export class Pipeline extends Construct {
  readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: PipelineProps) {
    super(scope, id);
    const { bucket, table, modelId } = props;
    const environment = { TABLE_NAME: table.tableName, BUCKET_NAME: bucket.bucketName, BEDROCK_MODEL_ID: modelId };
    const entry = backendEntry("pipeline/handlers.ts");
    const fn = (name: string, handler: string, extra: Partial<ConstructorParameters<typeof TsFunction>[2]> = {}) =>
      new TsFunction(this, name, { entry, handler, environment, description: `TenderReady pipeline: ${handler}`, ...extra });

    const startFn = fn("Start", "start");
    const extractFn = fn("Extract", "extract", { memorySize: 2048, timeout: Duration.minutes(10) });
    const analyseFn = fn("Analyse", "analyse", { memorySize: 1024, timeout: Duration.minutes(15) });
    const failFn = fn("Fail", "fail");

    for (const f of [startFn, extractFn, analyseFn, failFn]) table.grantReadWriteData(f);
    bucket.grantRead(extractFn, "hubs/*");
    bucket.grantWrite(extractFn, "extracted/*");
    bucket.grantRead(analyseFn, "extracted/*");
    // extract: Claude transcribes scanned pages; analyse: structured tender analysis
    grantBedrockInvoke(extractFn, Stack.of(this), modelId);
    grantBedrockInvoke(analyseFn, Stack.of(this), modelId);

    const throttling = ["ThrottlingException", "ServiceUnavailableException", "ServiceQuotaExceededException", "ModelNotReadyException"];
    const invoke = (name: string, f: TsFunction) =>
      new tasks.LambdaInvoke(this, name, { lambdaFunction: f, payloadResponseOnly: true }).addRetry({
        errors: throttling,
        interval: Duration.seconds(10),
        maxAttempts: 4,
        backoffRate: 2,
      });

    const failed = new sfn.Fail(this, "AnalysisFailed");
    const markFailed = new tasks.LambdaInvoke(this, "Mark tender FAILED", { lambdaFunction: failFn, payloadResponseOnly: true, resultPath: sfn.JsonPath.DISCARD }).next(failed);
    const withCatch = (task: sfn.TaskStateBase) => task.addCatch(markFailed, { resultPath: "$.error" });

    const definition = withCatch(invoke("Mark extracting", startFn))
      .next(withCatch(invoke("Extract text (PDF text layer + Claude for scans)", extractFn)))
      .next(withCatch(invoke("Analyse with Bedrock", analyseFn)))
      .next(new sfn.Succeed(this, "Ready"));

    this.stateMachine = new sfn.StateMachine(this, "AnalyseTender", {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: Duration.minutes(30),
      tracingEnabled: true,
      logs: {
        destination: new logs.LogGroup(this, "StateMachineLogs", { retention: logs.RetentionDays.TWO_WEEKS }),
        level: sfn.LogLevel.ERROR,
        includeExecutionData: false, // keep identifiers and errors only
      },
    });

    new events.Rule(this, "TenderUploaded", {
      description: "Start analysis when a tender PDF lands in the bucket",
      eventPattern: {
        source: ["aws.s3"],
        detailType: ["Object Created"],
        detail: { bucket: { name: [bucket.bucketName] }, object: { key: [{ prefix: "hubs/" }] } },
      },
      targets: [new targets.SfnStateMachine(this.stateMachine)],
    });

    new cloudwatch.Alarm(this, "FailedAnalyses", {
      alarmDescription: "One or more tender analyses failed",
      metric: this.stateMachine.metricFailed({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
}
