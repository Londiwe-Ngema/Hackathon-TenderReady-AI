import type { ChecklistItem } from "@tenderready/shared";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, EmptyState, PageHeader, ProgressBar, SimulatedLabel, Spinner } from "../components/ui";
import { daysUntil } from "../lib/format";
import { useClientTenders, useClients, useTender } from "../lib/queries";

/** Standard SMME compliance documents and the checklist wording that usually refers to them. */
const DOC_TYPES = [
  { id: "csd", label: "CSD registration report", match: /\bcsd\b|central supplier/i },
  { id: "tcs", label: "SARS Tax Compliance Status PIN", match: /\btcs\b|tax compliance|sars|tax clearance/i },
  { id: "bbbee", label: "B-BBEE certificate / sworn affidavit", match: /b-?bbee|affidavit|specific goal/i },
  { id: "cipc", label: "CIPC registration documents", match: /cipc|company registration/i },
  { id: "ids", label: "Certified director IDs", match: /\bid\b|identity|directors/i },
  { id: "cidb", label: "CIDB registration certificate", match: /cidb/i },
  { id: "rates", label: "Municipal rates clearance", match: /municipal|rates/i },
  { id: "refs", label: "Reference letters", match: /reference letter|references/i },
] as const;

type Vault = Record<string, { onFile: boolean; expiry?: string }>;
const vaultKey = (clientId: string) => `tenderready.vault.${clientId}`;

function loadVault(clientId: string): Vault {
  try {
    return JSON.parse(localStorage.getItem(vaultKey(clientId)) ?? "{}") as Vault;
  } catch {
    return {};
  }
}

function coverage(item: ChecklistItem, vault: Vault): "covered" | "expired" | "missing" | "unmatched" {
  const docs = DOC_TYPES.filter((d) => d.match.test(item.requirement));
  if (!docs.length) return "unmatched";
  const states = docs.map((d) => vault[d.id]);
  if (states.some((s) => s?.onFile && (!s.expiry || (daysUntil(s.expiry) ?? 1) >= 0))) return "covered";
  if (states.some((s) => s?.onFile)) return "expired";
  return "missing";
}

export function Readiness() {
  const clients = useClients();
  const [clientId, setClientId] = useState("");
  const [tenderId, setTenderId] = useState("");
  const tenders = useClientTenders(clientId);
  const tender = useTender(tenderId);
  const [vault, setVault] = useState<Vault>({});

  useEffect(() => {
    if (!clientId && clients.data?.length) setClientId(clients.data[0].clientId);
  }, [clients.data, clientId]);
  useEffect(() => {
    if (clientId) setVault(loadVault(clientId));
    setTenderId("");
  }, [clientId]);
  useEffect(() => {
    const ready = tenders.data?.find((t) => t.status === "READY");
    if (!tenderId && ready) setTenderId(ready.tenderId);
  }, [tenders.data, tenderId]);

  function update(id: string, patch: Partial<Vault[string]>) {
    const next = { ...vault, [id]: { onFile: vault[id]?.onFile ?? false, expiry: vault[id]?.expiry, ...patch } };
    setVault(next);
    try {
      localStorage.setItem(vaultKey(clientId), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const rows = useMemo(
    () => (tender.data?.checklist ?? []).filter((i) => i.origin === "document").map((i) => ({ item: i, state: coverage(i, vault) })),
    [tender.data, vault],
  );
  const matched = rows.filter((r) => r.state !== "unmatched");
  const pct = matched.length ? Math.round((matched.filter((r) => r.state === "covered").length / matched.length) * 100) : null;

  if (clients.isPending) return <Spinner />;
  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            Document readiness <SimulatedLabel>Preview, simulated</SimulatedLabel>
          </span>
        }
        subtitle="Compare an SMME's standard compliance documents with what a tender asks for, so you can spot gaps early."
      />
      <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
        This is a stretch feature and is not finished. The document vault is captured by hand and stored only in this browser. Nothing is
        uploaded or AI-verified yet. Readiness % means document coverage only. It does not mean the client qualifies or is likely to win.
      </p>

      {!clients.data?.length ? (
        <EmptyState title="No clients yet">Add an SMME client first.</EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card p-5">
            <label className="label" htmlFor="client">SMME client</label>
            <select id="client" className="input mb-5" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.data.map((c) => (
                <option key={c.clientId} value={c.clientId}>{c.name}</option>
              ))}
            </select>
            <h2 className="mb-3 font-semibold text-navy-900">Document vault</h2>
            <ul className="divide-y divide-slate-100">
              {DOC_TYPES.map((d) => {
                const v = vault[d.id];
                const expired = v?.expiry && (daysUntil(v.expiry) ?? 0) < 0;
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <label className="flex flex-1 items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-[var(--color-ok-500)]" checked={!!v?.onFile} onChange={(e) => update(d.id, { onFile: e.target.checked })} />
                      {d.label}
                    </label>
                    <input
                      type="date"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      value={v?.expiry ?? ""}
                      onChange={(e) => update(d.id, { expiry: e.target.value || undefined })}
                      aria-label={`${d.label} expiry date`}
                    />
                    {expired && <Badge tone="red">Expired</Badge>}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card p-5">
            <label className="label" htmlFor="tender">Compare against tender</label>
            <select id="tender" className="input mb-5" value={tenderId} onChange={(e) => setTenderId(e.target.value)}>
              <option value="">Select a tender…</option>
              {tenders.data?.filter((t) => t.status === "READY").map((t) => (
                <option key={t.tenderId} value={t.tenderId}>{t.title ?? t.fileName}</option>
              ))}
            </select>
            {tenderId && tender.data && (
              <>
                <div className="mb-4">
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-navy-900">Document coverage</span>
                    <span className="tabular-nums">{pct ?? "–"}%</span>
                  </div>
                  <ProgressBar value={pct} label="Document coverage" />
                </div>
                <ul className="space-y-2 text-sm">
                  {rows.map(({ item, state }) => (
                    <li key={item.id} className="flex items-start gap-2">
                      {state === "covered" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok-500" />
                      ) : state === "unmatched" ? (
                        <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      )}
                      <span className={state === "unmatched" ? "text-slate-500" : "text-slate-800"}>
                        {item.requirement}
                        {state === "expired" && <Badge tone="red" className="ml-2">On file but expired</Badge>}
                        {state === "missing" && item.mandatory && <Badge tone="amber" className="ml-2">Mandatory gap</Badge>}
                        {state === "unmatched" && <span className="ml-1 text-xs">(tender-specific, check manually)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
