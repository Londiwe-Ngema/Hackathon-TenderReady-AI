import { Building2, ChevronRight, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ClientForm } from "../components/ClientForm";
import { Badge, EmptyState, ErrorBox, Modal, PageHeader, ProgressBar, Spinner } from "../components/ui";
import { closingLabel } from "../lib/format";
import { useClients } from "../lib/queries";

export function Clients() {
  const q = useClients();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const adding = params.get("new") === "1";
  const setAdding = (v: boolean) => setParams(v ? { new: "1" } : {});

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter((c) => !s || [c.name, c.sector, c.csdNumber, c.contactName].some((v) => v?.toLowerCase().includes(s)));
  }, [q.data, search]);

  return (
    <>
      <PageHeader
        title="SMME clients"
        subtitle="The businesses your hub is helping to bid."
        actions={
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add client
          </button>
        }
      />
      <Modal open={adding} onClose={() => setAdding(false)} title="Add SMME client">
        <ClientForm onSaved={(c) => navigate(`/clients/${c.clientId}`)} />
      </Modal>

      {q.isPending ? (
        <Spinner />
      ) : q.isError ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Add your first SMME client"
          action={
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add client
            </button>
          }
        >
          Each client gets their own tender workspace with compliance checklists and a printable compliance pack.
        </EmptyState>
      ) : (
        <>
          <div className="relative mb-4 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search clients" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((c) => {
              const closing = closingLabel(c.nextClosingDate);
              return (
                <Link key={c.clientId} to={`/clients/${c.clientId}`} className="card group flex flex-col gap-3 p-4 transition hover:border-brand-600">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy-900">{c.name}</p>
                      <p className="truncate text-sm text-slate-500">{[c.sector, c.bbbeeLevel].filter(Boolean).join(" · ") || "No profile details yet"}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-brand-600" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="blue">{c.activeTenders} active tender{c.activeTenders === 1 ? "" : "s"}</Badge>
                    {c.nextClosingDate && <Badge tone={closing.tone}>{closing.text}</Badge>}
                    {c.openMandatory > 0 && <Badge tone="amber">{c.openMandatory} mandatory open</Badge>}
                    {!c.csdNumber && <Badge tone="slate">No CSD no. on file</Badge>}
                  </div>
                  {c.checklistProgress !== null && (
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-slate-500">
                        <span>Checklist progress (active tenders)</span>
                        <span className="tabular-nums">{c.checklistProgress}%</span>
                      </div>
                      <ProgressBar value={c.checklistProgress} />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
          {rows.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No clients match “{search}”.</p>}
        </>
      )}
    </>
  );
}
