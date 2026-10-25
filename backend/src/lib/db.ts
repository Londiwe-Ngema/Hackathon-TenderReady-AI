import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Client, HubProfile, Tender, TenderStatus } from "@tenderready/shared";
import { ddb } from "./aws";
import { env } from "./env";
import { PROFILE_SK, clientSk, hubPk, tenderSk } from "./keys";

type Item = Record<string, unknown>;

function strip<T>(item: Item | undefined): T | undefined {
  if (!item) return undefined;
  const { PK: _pk, SK: _sk, entity: _entity, ...rest } = item;
  return rest as T;
}

export async function getHubProfile(hubId: string): Promise<HubProfile | undefined> {
  const res = await ddb.send(new GetCommand({ TableName: env.tableName, Key: { PK: hubPk(hubId), SK: PROFILE_SK } }));
  return strip<HubProfile>(res.Item);
}

export async function putHubProfile(hubId: string, profile: HubProfile): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: env.tableName,
      Item: { PK: hubPk(hubId), SK: PROFILE_SK, entity: "hub", ...profile },
    }),
  );
}

/** Loads everything in a hub partition (profile, clients, tenders). Hub partitions are small at MVP scale. */
export async function loadHub(hubId: string): Promise<{ profile?: HubProfile; clients: Client[]; tenders: Tender[] }> {
  const items: Item[] = [];
  let ExclusiveStartKey: Item | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: env.tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": hubPk(hubId) },
        ExclusiveStartKey,
      }),
    );
    items.push(...(res.Items ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return {
    profile: strip<HubProfile>(items.find((i) => i.entity === "hub")),
    clients: items.filter((i) => i.entity === "client").map((i) => strip<Client>(i)!),
    tenders: items.filter((i) => i.entity === "tender").map((i) => strip<Tender>(i)!),
  };
}

export async function getClient(hubId: string, clientId: string): Promise<Client | undefined> {
  const res = await ddb.send(
    new GetCommand({ TableName: env.tableName, Key: { PK: hubPk(hubId), SK: clientSk(clientId) } }),
  );
  return strip<Client>(res.Item);
}

export async function putClient(hubId: string, client: Client): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: env.tableName,
      Item: { PK: hubPk(hubId), SK: clientSk(client.clientId), entity: "client", ...client },
    }),
  );
}

export async function deleteItems(hubId: string, sks: string[]): Promise<void> {
  for (let i = 0; i < sks.length; i += 25) {
    const chunk = sks.slice(i, i + 25);
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [env.tableName]: chunk.map((SK) => ({ DeleteRequest: { Key: { PK: hubPk(hubId), SK } } })),
        },
      }),
    );
  }
}

export async function getTender(hubId: string, tenderId: string): Promise<Tender | undefined> {
  const res = await ddb.send(
    new GetCommand({ TableName: env.tableName, Key: { PK: hubPk(hubId), SK: tenderSk(tenderId) } }),
  );
  return strip<Tender>(res.Item);
}

export async function putTender(hubId: string, tender: Tender, expectedUpdatedAt?: string): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: env.tableName,
      Item: { PK: hubPk(hubId), SK: tenderSk(tender.tenderId), entity: "tender", ...tender },
      ...(expectedUpdatedAt
        ? { ConditionExpression: "updatedAt = :u", ExpressionAttributeValues: { ":u": expectedUpdatedAt } }
        : {}),
    }),
  );
}

export async function deleteTender(hubId: string, tenderId: string): Promise<void> {
  await ddb.send(new DeleteCommand({ TableName: env.tableName, Key: { PK: hubPk(hubId), SK: tenderSk(tenderId) } }));
}

/** Pipeline status update. Only touches status fields so it never clobbers advisor checklist edits. */
export async function setTenderStatus(
  hubId: string,
  tenderId: string,
  status: TenderStatus,
  extra: Partial<Pick<Tender, "statusReason" | "pageCount">> = {},
): Promise<void> {
  const names: Record<string, string> = { "#s": "status", "#u": "updatedAt" };
  const values: Record<string, unknown> = { ":s": status, ":u": new Date().toISOString() };
  const sets = ["#s = :s", "#u = :u"];
  for (const [k, v] of Object.entries(extra)) {
    names[`#${k}`] = k;
    values[`:${k}`] = v;
    sets.push(`#${k} = :${k}`);
  }
  await ddb.send(
    new UpdateCommand({
      TableName: env.tableName,
      Key: { PK: hubPk(hubId), SK: tenderSk(tenderId) },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ConditionExpression: "attribute_exists(PK)",
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

export async function saveAnalysis(
  hubId: string,
  tenderId: string,
  analysis: Pick<Tender, "summary" | "checklist" | "risks" | "closingDate" | "modelId">,
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: env.tableName,
      Key: { PK: hubPk(hubId), SK: tenderSk(tenderId) },
      UpdateExpression:
        "SET #s = :s, updatedAt = :u, summary = :summary, checklist = :checklist, risks = :risks, closingDate = :closing, modelId = :model REMOVE statusReason",
      ConditionExpression: "attribute_exists(PK)",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":s": "READY",
        ":u": new Date().toISOString(),
        ":summary": analysis.summary,
        ":checklist": analysis.checklist,
        ":risks": analysis.risks,
        ":closing": analysis.closingDate,
        ":model": analysis.modelId,
      },
    }),
  );
}
