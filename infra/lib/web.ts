import * as fs from "node:fs";
import * as path from "node:path";
import { Annotations, RemovalPolicy } from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { REPO_ROOT } from "./fn";

/** Private S3 bucket behind CloudFront (OAC) serving the React SPA. */
export class Web extends Construct {
  readonly distribution: cloudfront.Distribution;
  readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.bucket = new s3.Bucket(this, "Site", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.distribution = new cloudfront.Distribution(this, "Cdn", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      // SPA routing: unknown paths fall back to index.html
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: "/index.html",
      })),
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL, // includes the Johannesburg edge
    });
  }

  get url(): string {
    return `https://${this.distribution.distributionDomainName}`;
  }

  /** Uploads the built SPA plus a runtime config.json (API URL, Cognito ids). */
  deploy(config: Record<string, string>): void {
    const dist = path.join(REPO_ROOT, "frontend/dist");
    const sources = [s3deploy.Source.jsonData("config.json", config)];
    if (fs.existsSync(path.join(dist, "index.html"))) sources.unshift(s3deploy.Source.asset(dist));
    else Annotations.of(this).addWarning("frontend/dist not found — run `pnpm --filter frontend build` before deploying.");

    new s3deploy.BucketDeployment(this, "Deploy", {
      sources,
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ["/index.html", "/config.json"],
      memoryLimit: 512,
    });
  }
}
