import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";

export type ApiEvent = APIGatewayProxyEventV2WithJWTAuthorizer;

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`);
export const badRequest = (message: string) => new HttpError(400, message);

export function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: body === undefined ? "" : JSON.stringify(body),
  };
}

/** The hub id is the Cognito `sub` from the verified JWT — never taken from the request body or path. */
export function hubIdFrom(event: ApiEvent): string {
  const sub = event.requestContext.authorizer?.jwt?.claims?.sub;
  if (typeof sub !== "string" || !sub) throw new HttpError(401, "Unauthorised");
  return sub;
}

export function parseBody<T>(event: ApiEvent): T {
  if (!event.body) return {} as T;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    return JSON.parse(raw) as T;
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
}

export function cleanString(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, max);
  return s || undefined;
}
