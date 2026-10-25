import { CfnOutput, Stack, Tags, type StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Api } from "./api";
import { Auth } from "./auth";
import { Data } from "./data";
import { Pipeline } from "./pipeline";
import { Web } from "./web";

export interface TenderReadyStackProps extends StackProps {
  modelId: string;
}

export class TenderReadyStack extends Stack {
  constructor(scope: Construct, id: string, props: TenderReadyStackProps) {
    super(scope, id, props);
    Tags.of(this).add("project", "tenderready");

    const web = new Web(this, "Web");
    const allowedOrigins = [web.url, "http://localhost:5173"];

    const auth = new Auth(this, "Auth");
    const data = new Data(this, "Data", { allowedOrigins });
    new Pipeline(this, "Pipeline", { bucket: data.bucket, table: data.table, modelId: props.modelId });
    const api = new Api(this, "Api", {
      bucket: data.bucket,
      table: data.table,
      userPool: auth.userPool,
      userPoolClient: auth.client,
      modelId: props.modelId,
      allowedOrigins,
    });

    const config = {
      region: this.region,
      apiUrl: api.httpApi.apiEndpoint,
      userPoolId: auth.userPool.userPoolId,
      userPoolClientId: auth.client.userPoolClientId,
    };
    web.deploy(config);

    new CfnOutput(this, "SiteUrl", { value: web.url });
    new CfnOutput(this, "UserPoolId", { value: config.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: config.userPoolClientId });
    new CfnOutput(this, "Region", { value: this.region });
  }
}
