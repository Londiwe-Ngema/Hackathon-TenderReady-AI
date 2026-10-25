import { CfnOutput, Stack, Tags, type StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { aiLabel, type AiConfig } from "./ai-config";
import { Api } from "./api";
import { Auth } from "./auth";
import { Data } from "./data";
import { Pipeline } from "./pipeline";
import { Web } from "./web";

export interface TenderReadyStackProps extends StackProps {
  ai: AiConfig;
}

export class TenderReadyStack extends Stack {
  constructor(scope: Construct, id: string, props: TenderReadyStackProps) {
    super(scope, id, props);
    Tags.of(this).add("project", "tenderready");

    const web = new Web(this, "Web");
    const allowedOrigins = [web.url, "http://localhost:5173"];

    const auth = new Auth(this, "Auth");
    const data = new Data(this, "Data", { allowedOrigins });
    new Pipeline(this, "Pipeline", { bucket: data.bucket, table: data.table, ai: props.ai });
    const api = new Api(this, "Api", {
      bucket: data.bucket,
      table: data.table,
      userPool: auth.userPool,
      userPoolClient: auth.client,
      ai: props.ai,
      allowedOrigins,
    });

    const config = {
      region: this.region,
      apiUrl: api.httpApi.apiEndpoint,
      userPoolId: auth.userPool.userPoolId,
      userPoolClientId: auth.client.userPoolClientId,
      aiLabel: aiLabel(props.ai),
    };
    web.deploy(config);

    new CfnOutput(this, "SiteUrl", { value: web.url });
    new CfnOutput(this, "UserPoolId", { value: config.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: config.userPoolClientId });
    new CfnOutput(this, "Region", { value: this.region });
  }
}
