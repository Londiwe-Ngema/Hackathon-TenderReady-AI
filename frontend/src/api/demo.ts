import {
  buildDashboard,
  clientStats,
  tenderListItem,
  type Client,
  type HubProfile,
  type Tender,
  type TenderStatus,
} from "@tenderready/shared";
import { DEMO_ANSWERS, demoClients, demoHub, demoTenders, solarAnalysis } from "./fixtures";
import { ApiError, type Api } from "./types";

/**
 * In-browser simulated backend. Used for the backup demo and local UI development.
 * Everything it returns is clearly labelled as simulated in the UI.
 */
interface DemoState {
  hub: HubProfile | null;
  clients: Client[];
  tenders: Tender[];
}

const KEY = "tenderready.demoState";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function load(): DemoState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    /* ignore */
  }
  return { hub: demoHub, clients: demoClients, tenders: demoTenders() };
}

let state = load();
const save = () => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
};

const clone = <T>(v: T): T => structuredClone(v);

function findClient(id: string): Client {
  const c = state.clients.find((x) => x.clientId === id);
  if (!c) throw new ApiError(404, "Client not found");
  return c;
}
function findTender(id: string): Tender {
  const t = state.tenders.find((x) => x.tenderId === id);
  if (!t) throw new ApiError(404, "Tender not found");
  return t;
}

/** Simulated pipeline timeline (ms after upload) mirroring the real Step Functions states. */
const TIMELINE: Array<[number, TenderStatus]> = [
  [0, "UPLOADED"],
  [1500, "EXTRACTING"],
  [6000, "ANALYSING"],
  [11000, "READY"],
];

function advance(t: Tender): void {
  if (t.status === "READY" || t.status === "FAILED") return;
  const elapsed = Date.now() - Date.parse(t.createdAt);
  const [, status] = [...TIMELINE].reverse().find(([ms]) => elapsed >= ms) ?? TIMELINE[0];
  if (status === t.status) return;
  t.status = status;
  t.updatedAt = new Date().toISOString();
  if (status === "ANALYSING") t.pageCount = 24;
  if (status === "READY") {
    const closing = new Date(Date.now() + 9 * 86_400_000).toISOString();
    Object.assign(t, solarAnalysis(closing), { closingDate: closing, modelId: "demo-fixture" });
  }
  save();
}

export function createDemoApi(): Api {
  const tick = () => state.tenders.forEach(advance);
  return {
    async dashboard() {
      await sleep(150);
      tick();
      return buildDashboard(state.hub ?? undefined, state.clients, state.tenders);
    },
    async getHub() {
      return clone(state.hub);
    },
    async putHub(profile) {
      state.hub = profile;
      save();
      return profile;
    },
    async listClients() {
      await sleep(150);
      tick();
      return state.clients.map((c) => clientStats(c, state.tenders)).sort((a, b) => a.name.localeCompare(b.name));
    },
    async getClient(id) {
      tick();
      return clientStats(findClient(id), state.tenders);
    },
    async createClient(input) {
      if (!input.name?.trim()) throw new ApiError(400, "Client name is required");
      const client: Client = { ...input, clientId: crypto.randomUUID(), createdAt: new Date().toISOString() };
      state.clients.push(client);
      save();
      return client;
    },
    async updateClient(id, input) {
      const c = findClient(id);
      Object.assign(c, input);
      save();
      return clone(c);
    },
    async deleteClient(id) {
      findClient(id);
      state.clients = state.clients.filter((c) => c.clientId !== id);
      state.tenders = state.tenders.filter((t) => t.clientId !== id);
      save();
    },
    async listTenders(clientId) {
      tick();
      return state.tenders
        .filter((t) => t.clientId === clientId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(tenderListItem);
    },
    async uploadTender(clientId, file, onProgress) {
      const client = findClient(clientId);
      if (!/\.pdf$/i.test(file.name)) throw new ApiError(400, "Only PDF files are supported");
      for (let p = 0; p <= 100; p += 20) {
        onProgress(p);
        await sleep(120);
      }
      const now = new Date().toISOString();
      const tender: Tender = {
        tenderId: crypto.randomUUID(),
        clientId,
        clientName: client.name,
        fileName: file.name,
        status: "UPLOADED",
        createdAt: now,
        updatedAt: now,
        closingDate: null,
      };
      state.tenders.push(tender);
      save();
      return tender.tenderId;
    },
    async getTender(id) {
      const t = findTender(id);
      advance(t);
      return clone({ ...t, clientName: state.clients.find((c) => c.clientId === t.clientId)?.name });
    },
    async deleteTender(id) {
      findTender(id);
      state.tenders = state.tenders.filter((t) => t.tenderId !== id);
      save();
    },
    async documentUrl() {
      return null;
    },
    async updateChecklistItem(tenderId, itemId, patch) {
      const item = findTender(tenderId).checklist?.find((i) => i.id === itemId);
      if (!item) throw new ApiError(404, "Checklist item not found");
      if (patch.status) item.status = patch.status;
      if (patch.note !== undefined) item.note = patch.note || undefined;
      save();
      return clone(item);
    },
    async ask(tenderId, question) {
      findTender(tenderId);
      await sleep(900);
      const hit = DEMO_ANSWERS.find((a) => a.match.test(question));
      const answer =
        hit?.answer ??
        "This is not stated in the tender document. (Demo mode only answers the suggested questions. Connect the live backend for answers grounded in your own tender.)";
      const pages = [...answer.matchAll(/\[p\.(\d+)\]/g)].map((m) => Number(m[1]));
      return { answer, citations: [...new Set(pages)].sort((a, b) => a - b).map((page) => ({ page })) };
    },
  };
}

export function resetDemo(): void {
  state = { hub: demoHub, clients: demoClients, tenders: demoTenders() };
  save();
}
