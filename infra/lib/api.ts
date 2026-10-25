import { CfnOutput, Duration, Stack } from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { ROUTES } from "../../backend/src/api/routes";
import { aiEnvironment, grantAi, type AiConfig } from "./ai-config";
import { TsFunction, backendEntry } from "./fn";

export interface ApiProps {
  bucket: s3.Bucket;
  table: dynamodb.TableV2;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  ai: AiConfig;
  allowedOrigins: string[];
}

/** HTTP API with a Cognito JWT authorizer in front of a single router Lambda. */
export class Api extends Construct {
  readonly httpApi: apigw.HttpApi;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);
    const fn = new TsFunction(this, "Handler", {
      entry: backendEntry("api/handler.ts"),
      description: "TenderReady REST API",
      memorySize: 1024,
      timeout: Duration.seconds(29), // API Gateway integration limit; Q&A is the slowest route
      environment: {
        TABLE_NAME: props.table.tableName,
        BUCKET_NAME: props.bucket.bucketName,
        ...aiEnvironment(props.ai),
        AI_TIMEOUT_MS: "25000", // answer inside API Gateway's 30 s integration limit
      },
    });
    props.table.grantReadWriteData(fn);
    props.bucket.grantReadWrite(fn); // presigned PUT/GET of tender PDFs, read extracted text
    props.bucket.grantDelete(fn);
    grantAi(fn, Stack.of(this), props.ai);

    this.httpApi = new apigw.HttpApi(this, "HttpApi", {
      apiName: "tenderready",
      corsPreflight: {
        allowOrigins: props.allowedOrigins,
        allowMethods: [apigw.CorsHttpMethod.ANY],
        allowHeaders: ["authorization", "content-type"],
        maxAge: Duration.hours(1),
      },
      defaultAuthorizer: new HttpUserPoolAuthorizer("Cognito", props.userPool, {
        userPoolClients: [props.userPoolClient],
      }),
    });

    const integration = new HttpLambdaIntegration("Router", fn);
    for (const route of ROUTES) {
      const [method, path] = route.split(" ");
      this.httpApi.addRoutes({ path, methods: [method as apigw.HttpMethod], integration });
    }

    const stage = this.httpApi.defaultStage!.node.defaultChild as apigw.CfnStage;
    stage.defaultRouteSettings = { throttlingBurstLimit: 50, throttlingRateLimit: 20 };

    new CfnOutput(this, "ApiUrl", { value: this.httpApi.apiEndpoint });
  }
}
