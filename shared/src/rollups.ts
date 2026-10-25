import {
  PROCESSING_STATUSES,
  checklistProgress,
  openMandatoryCount,
  type Client,
  type ClientWithStats,
  type DashboardResponse,
  type HubProfile,
  type Tender,
  type TenderListItem,
} from "./types";

const isActive = (t: Tender, now: number) =>
  t.status !== "FAILED" && (!t.closingDate || Date.parse(t.closingDate) >= now);

/** Light tender shape for list views (drops the large summary/checklist payload). */
export function tenderListItem(t: Tender): TenderListItem {
  const { summary, checklist, risks, ...rest } = t;
  return {
    ...rest,
    title: summary?.title ?? null,
    checklistProgress: checklistProgress(checklist),
    openMandatory: openMandatoryCount(checklist),
    highRisks: (risks ?? []).filter((r) => r.severity === "high").length,
  };
}

export function clientStats(client: Client, tenders: Tender[], now = Date.now()): ClientWithStats {
  const mine = tenders.filter((t) => t.clientId === client.clientId);
  const active = mine.filter((t) => isActive(t, now));
  const upcoming = active
    .map((t) => t.closingDate)
    .filter((d): d is string => !!d)
    .sort();
  const allItems = active.flatMap((t) => t.checklist ?? []);
  return {
    ...client,
    tenderCount: mine.length,
    activeTenders: active.length,
    nextClosingDate: upcoming[0] ?? null,
    checklistProgress: checklistProgress(allItems),
    openMandatory: openMandatoryCount(allItems),
  };
}

export function buildDashboard(
  profile: HubProfile | undefined,
  clients: Client[],
  tenders: Tender[],
  now = Date.now(),
): DashboardResponse {
  const names = new Map(clients.map((c) => [c.clientId, c.name]));
  const active = tenders.filter((t) => names.has(t.clientId) && isActive(t, now));
  const weekAhead = now + 7 * 24 * 3600 * 1000;

  const upcoming = [...active]
    .sort((a, b) => {
      // Tenders with a closing date first (soonest first), then in-progress ones by recency.
      if (a.closingDate && b.closingDate) return a.closingDate.localeCompare(b.closingDate);
      if (a.closingDate) return -1;
      if (b.closingDate) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, 20)
    .map((t) => ({
      tenderId: t.tenderId,
      clientId: t.clientId,
      clientName: names.get(t.clientId),
      fileName: t.fileName,
      closingDate: t.closingDate,
      status: t.status,
      title: t.summary?.title ?? null,
      highRisks: (t.risks ?? []).filter((r) => r.severity === "high").length,
      checklistProgress: checklistProgress(t.checklist),
    }));

  return {
    hub: profile ?? null,
    stats: {
      clients: clients.length,
      activeTenders: active.length,
      closingIn7Days: active.filter((t) => t.closingDate && Date.parse(t.closingDate) <= weekAhead).length,
      openMandatory: active.reduce((n, t) => n + openMandatoryCount(t.checklist), 0),
    },
    upcoming,
  };
}

export const isProcessing = (t: Tender) => PROCESSING_STATUSES.includes(t.status);
