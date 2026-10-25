import { randomUUID } from "node:crypto";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { APIGatewayProxyResultV2 } from "aws-lambda";
import type {
  ChecklistItemStatus,
  Client,
  ClientInput,
  HubProfile,
  Tender,
  UploadResponse,
} from "@tenderready/shared";
import { s3 } from "../lib/aws";
import { askTender, type ChatTurn } from "../lib/ai";
import * as db from "../lib/db";
import { loadExtracted } from "../lib/docstore";
import { MAX_UPLOAD_BYTES, env } from "../lib/env";
import {
  HttpError,
  badRequest,
  cleanString,
  hubIdFrom,
  json,
  notFound,
  parseBody,
  type ApiEvent,
} from "../lib/http";
import { clientPrefix, clientSk, extractedObjectKey, tenderObjectKey, tenderSk } from "../lib/keys";
import { buildDashboard, clientStats, tenderListItem } from "@tenderready/shared";
import type { RouteKey } from "./routes";

type Ctx = { hubId: string; event: ApiEvent; params: Record<string, string> };
type Handler = (ctx: Ctx) => Promise<APIGatewayProxyResultV2>;

const CLIENT_FIELDS = [
  "name",
  "regNo",
  "csdNumber",
  "bbbeeLevel",
  "cidbGrade",
  "sector",
  "contactName",
  "contactEmail",
] as const satisfies readonly (keyof ClientInput)[];

function clientInput(body: Record<string, unknown>): ClientInput {
  const input = Object.fromEntries(CLIENT_FIELDS.map((f) => [f, cleanString(body[f])])) as ClientInput;
  if (!input.name) throw badRequest("Client name is required");
  return input;
}

async function requireClient(hubId: string, clientId: string): Promise<Client> {
  const client = await db.getClient(hubId, clientId);
  if (!client) throw notFound("Client");
  return client;
}

async function requireTender(hubId: string, tenderId: string): Promise<Tender> {
  const tender = await db.getTender(hubId, tenderId);
  if (!tender) throw notFound("Tender");
  return tender;
}

async function deleteS3Prefix(prefix: string): Promise<void> {
  let ContinuationToken: string | undefined;
  do {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: env.bucketName, Prefix: prefix, ContinuationToken }));
    const keys = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
    if (keys.length) await s3.send(new DeleteObjectsCommand({ Bucket: env.bucketName, Delete: { Objects: keys } }));
    ContinuationToken = list.NextContinuationToken;
  } while (ContinuationToken);
}

const CHECKLIST_STATUSES: ChecklistItemStatus[] = ["todo", "in_progress", "done", "n_a"];

const handlers: Record<RouteKey, Handler> = {
  "GET /dashboard": async ({ hubId }) => {
    const { profile, clients, tenders } = await db.loadHub(hubId);
    return json(200, buildDashboard(profile, clients, tenders));
  },

  "GET /hub": async ({ hubId }) => json(200, (await db.getHubProfile(hubId)) ?? null),

  "PUT /hub": async ({ hubId, event }) => {
    const body = parseBody<Record<string, unknown>>(event);
    const profile: HubProfile = {
      hubName: cleanString(body.hubName) ?? "",
      advisorName: cleanString(body.advisorName) ?? "",
    };
    if (!profile.hubName) throw badRequest("Hub name is required");
    await db.putHubProfile(hubId, profile);
    return json(200, profile);
  },

  "GET /clients": async ({ hubId }) => {
    const { clients, tenders } = await db.loadHub(hubId);
    const rows = clients.map((c) => clientStats(c, tenders)).sort((a, b) => a.name.localeCompare(b.name));
    return json(200, rows);
  },

  "POST /clients": async ({ hubId, event }) => {
    const client: Client = {
      ...clientInput(parseBody(event)),
      clientId: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await db.putClient(hubId, client);
    return json(201, client);
  },

  "GET /clients/{clientId}": async ({ hubId, params }) => {
    const client = await requireClient(hubId, params.clientId);
    const { tenders } = await db.loadHub(hubId);
    return json(200, clientStats(client, tenders));
  },

  "PUT /clients/{clientId}": async ({ hubId, params, event }) => {
    const existing = await requireClient(hubId, params.clientId);
    const updated: Client = { ...existing, ...clientInput(parseBody(event)) };
    await db.putClient(hubId, updated);
    return json(200, updated);
  },

  "DELETE /clients/{clientId}": async ({ hubId, params }) => {
    await requireClient(hubId, params.clientId);
    const { tenders } = await db.loadHub(hubId);
    const mine = tenders.filter((t) => t.clientId === params.clientId);
    await deleteS3Prefix(clientPrefix(hubId, params.clientId));
    for (const t of mine) await deleteS3Prefix(extractedObjectKey(hubId, t.tenderId));
    await db.deleteItems(hubId, [...mine.map((t) => tenderSk(t.tenderId)), clientSk(params.clientId)]);
    return json(204, undefined);
  },

  "GET /clients/{clientId}/tenders": async ({ hubId, params }) => {
    await requireClient(hubId, params.clientId);
    const { tenders } = await db.loadHub(hubId);
    const rows = tenders
      .filter((t) => t.clientId === params.clientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(tenderListItem);
    return json(200, rows);
  },

  "POST /clients/{clientId}/tenders": async ({ hubId, params, event }) => {
    const client = await requireClient(hubId, params.clientId);
    const body = parseBody<{ fileName?: unknown; size?: unknown }>(event);
    const fileName = cleanString(body.fileName, 255);
    const size = Number(body.size);
    if (!fileName || !/\.pdf$/i.test(fileName)) throw badRequest("Only PDF files are supported");
    if (!Number.isInteger(size) || size <= 0) throw badRequest("File size is required");
    if (size > MAX_UPLOAD_BYTES) throw badRequest(`PDF must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller`);

    const now = new Date().toISOString();
    const tender: Tender = {
      tenderId: randomUUID(),
      clientId: client.clientId,
      clientName: client.name,
      fileName,
      status: "UPLOADING",
      createdAt: now,
      updatedAt: now,
      closingDate: null,
    };
    await db.putTender(hubId, tender);

    // ContentLength + ContentType are signed, so the browser can only upload exactly this PDF.
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: env.bucketName,
        Key: tenderObjectKey(hubId, client.clientId, tender.tenderId),
        ContentType: "application/pdf",
        ContentLength: size,
      }),
      { expiresIn: 300 },
    );
    return json(201, { tenderId: tender.tenderId, uploadUrl } satisfies UploadResponse);
  },

  "GET /tenders/{tenderId}": async ({ hubId, params }) => json(200, await requireTender(hubId, params.tenderId)),

  "DELETE /tenders/{tenderId}": async ({ hubId, params }) => {
    const tender = await requireTender(hubId, params.tenderId);
    await deleteS3Prefix(tenderObjectKey(hubId, tender.clientId, tender.tenderId));
    await deleteS3Prefix(extractedObjectKey(hubId, tender.tenderId));
    await db.deleteTender(hubId, tender.tenderId);
    return json(204, undefined);
  },

  "GET /tenders/{tenderId}/document": async ({ hubId, params }) => {
    const tender = await requireTender(hubId, params.tenderId);
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: env.bucketName,
        Key: tenderObjectKey(hubId, tender.clientId, tender.tenderId),
        ResponseContentType: "application/pdf",
        ResponseContentDisposition: "inline",
      }),
      { expiresIn: 600 },
    );
    return json(200, { url });
  },

  "PATCH /tenders/{tenderId}/checklist/{itemId}": async ({ hubId, params, event }) => {
    const body = parseBody<{ status?: unknown; note?: unknown }>(event);
    if (body.status !== undefined && !CHECKLIST_STATUSES.includes(body.status as ChecklistItemStatus))
      throw badRequest("Invalid checklist status");

    // Optimistic concurrency on updatedAt; retry once if a pipeline/status write raced us.
    for (let attempt = 0; attempt < 2; attempt++) {
      const tender = await requireTender(hubId, params.tenderId);
      const item = tender.checklist?.find((i) => i.id === params.itemId);
      if (!item) throw notFound("Checklist item");
      if (body.status !== undefined) item.status = body.status as ChecklistItemStatus;
      if (body.note !== undefined) item.note = cleanString(body.note, 1000);
      const previous = tender.updatedAt;
      tender.updatedAt = new Date().toISOString();
      try {
        await db.putTender(hubId, tender, previous);
        return json(200, item);
      } catch (err) {
        if ((err as Error).name !== "ConditionalCheckFailedException" || attempt === 1) throw err;
      }
    }
    throw new HttpError(409, "Checklist was updated elsewhere, please retry");
  },

  "POST /tenders/{tenderId}/ask": async ({ hubId, params, event }) => {
    const body = parseBody<{ question?: unknown; history?: unknown }>(event);
    const question = cleanString(body.question, 1000);
    if (!question) throw badRequest("Question is required");
    const tender = await requireTender(hubId, params.tenderId);
    if (tender.status !== "READY") throw new HttpError(409, "The tender is still being analysed");

    const history: ChatTurn[] = Array.isArray(body.history)
      ? body.history
          .filter(
            (t): t is ChatTurn =>
              !!t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string",
          )
          .map((t) => ({ role: t.role, text: t.text.slice(0, 4000) }))
      : [];

    const doc = await loadExtracted(hubId, tender.tenderId);
    return json(200, await askTender(doc.pages, question, history));
  },
};

export async function handler(event: ApiEvent): Promise<APIGatewayProxyResultV2> {
  const route = handlers[event.routeKey as RouteKey];
  try {
    if (!route) throw notFound("Route");
    const hubId = hubIdFrom(event);
    return await route({ hubId, event, params: (event.pathParameters ?? {}) as Record<string, string> });
  } catch (err) {
    if (err instanceof HttpError) return json(err.statusCode, { message: err.message });
    // Log identifiers and error type only — never request bodies or document content.
    console.error(JSON.stringify({ msg: "api.error", route: event.routeKey, error: (err as Error).name, detail: (err as Error).message }));
    return json(500, { message: "Something went wrong. Please try again." });
  }
}
