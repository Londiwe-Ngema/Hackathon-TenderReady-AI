import { describe, expect, it } from "vitest";
import type { ChecklistItem, Client, Tender } from "@tenderready/shared";
import { handler } from "../src/api/handler";
import { buildDashboard, clientStats } from "@tenderready/shared";
import { parseTenderObjectKey, tenderObjectKey } from "../src/lib/keys";
import type { ApiEvent } from "../src/lib/http";

const item = (status: ChecklistItem["status"], mandatory = true): ChecklistItem => ({
  id: Math.random().toString(),
  category: "Tax",
  requirement: "x",
  mandatory,
  sourcePages: [],
  sourceQuote: null,
  origin: "document",
  status,
});

const client: Client = { clientId: "c1", name: "Ubuntu Builders", createdAt: "2026-10-01T00:00:00Z" };
const now = Date.parse("2026-10-25T00:00:00Z");
const tender = (id: string, closingDate: string | null, checklist: ChecklistItem[], status: Tender["status"] = "READY"): Tender => ({
  tenderId: id,
  clientId: "c1",
  fileName: `${id}.pdf`,
  status,
  createdAt: "2026-10-20T00:00:00Z",
  updatedAt: "2026-10-20T00:00:00Z",
  closingDate,
  checklist,
  risks: [{ id: "r1", title: "t", severity: "high", explanation: "", sourcePages: [], sourceQuote: null }],
});

describe("rollups", () => {
  const tenders = [
    tender("t1", "2026-10-28T11:00:00+02:00", [item("done"), item("todo"), item("n_a")]),
    tender("t2", "2026-12-01T11:00:00+02:00", [item("todo"), item("done", false)]),
    tender("old", "2026-09-01T11:00:00+02:00", [item("todo")]),
    tender("bad", null, [], "FAILED"),
  ];

  it("summarises a client's active tenders", () => {
    const stats = clientStats(client, tenders, now);
    expect(stats).toMatchObject({ tenderCount: 4, activeTenders: 2, nextClosingDate: "2026-10-28T11:00:00+02:00", openMandatory: 2 });
    expect(stats.checklistProgress).toBe(50);
  });

  it("builds hub dashboard stats", () => {
    const dash = buildDashboard(undefined, [client], tenders, now);
    expect(dash.stats).toEqual({ clients: 1, activeTenders: 2, closingIn7Days: 1, openMandatory: 2 });
    expect(dash.upcoming.map((u) => u.tenderId)).toEqual(["t1", "t2"]);
    expect(dash.upcoming[0]).toMatchObject({ clientName: "Ubuntu Builders", highRisks: 1, checklistProgress: 50 });
  });
});

describe("keys", () => {
  it("round-trips tender object keys", () => {
    expect(parseTenderObjectKey(tenderObjectKey("hub-1", "client-2", "tender-3"))).toEqual({
      hubId: "hub-1",
      clientId: "client-2",
      tenderId: "tender-3",
    });
    expect(() => parseTenderObjectKey("hubs/x/other.pdf")).toThrow();
  });
});

describe("api handler", () => {
  const event = (routeKey: string, sub?: string) =>
    ({ routeKey, requestContext: { authorizer: sub ? { jwt: { claims: { sub } } } : undefined } }) as unknown as ApiEvent;

  it("returns 404 for unknown routes", async () => {
    expect(await handler(event("GET /nope", "u1"))).toMatchObject({ statusCode: 404 });
  });

  it("rejects requests without a verified subject", async () => {
    expect(await handler(event("GET /hub"))).toMatchObject({ statusCode: 401 });
  });
});
