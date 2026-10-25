import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { ClientForm } from "../components/ClientForm";
import { UploadDropzone } from "../components/UploadDropzone";
import { Badge, EmptyState, ErrorBox, Modal, PageHeader, ProgressBar, Spinner, StatusBadge } from "../components/ui";
import { closingLabel, formatDate } from "../lib/format";
import { keys, useClient, useClientTenders, useDeleteClient, useDeleteTender } from "../lib/queries";

export function ClientDetail() {
  const { clientId = "" } = useParams();
  const client = useClient(clientId);
  const tenders = useClientTenders(clientId);
  const del = useDeleteClient();
  const delTender = useDeleteTender(clientId);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  if (client.isPending) return <Spinner />;
  if (client.isError) return <ErrorBox error={client.error} onRetry={() => client.refetch()} />;
  const c = client.data;

  async function upload(file: File, onProgress: (p: number) => void) {
    const tenderId = await api().uploadTender(clientId, file, onProgress);
    qc.invalidateQueries({ queryKey: keys.tenders(clientId) });
    qc.invalidateQueries({ queryKey: keys.dashboard });
    navigate(`/tenders/${tenderId}`);
  }

  const profile: Array<[string, string | undefined]> = [
    ["CIPC reg. no.", c.regNo],
    ["CSD supplier no.", c.csdNumber],
    ["B-BBEE", c.bbbeeLevel],
    ["CIDB grading", c.cidbGrade],
    ["Sector", c.sector],
    ["Contact", [c.contactName, c.contactEmail].filter(Boolean).join(" · ") || undefined],
  ];

  return (
    <>
      <PageHeader
        back={
          <Link to="/clients" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
            <ArrowLeft className="h-4 w-4" /> All clients
          </Link>
        }
        title={c.name}
        subtitle={`Client since ${formatDate(c.createdAt)}`}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </button>
            <button
              className="btn-danger"
              disabled={del.isPending}
              onClick={() => {
                if (confirm(`Delete ${c.name} and all of their tenders? This cannot be undone.`))
                  del.mutate(clientId, { onSuccess: () => navigate("/clients") });
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </>
        }
      />
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit client">
        <ClientForm client={c} onSaved={() => setEditing(false)} />
      </Modal>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card h-fit min-w-0 p-5 lg:col-span-1">
          <h2 className="mb-3 font-semibold text-navy-900">Compliance profile</h2>
          <dl className="space-y-2 text-sm">
            {profile.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="shrink-0 text-slate-500">{k}</dt>
                <dd className={v ? "min-w-0 break-words text-right font-medium text-slate-800" : "text-slate-400"}>{v ?? "Not captured"}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-navy-900">Analyse a new tender</h2>
            <UploadDropzone onUpload={upload} />
          </section>

          <section>
            <h2 className="mb-3 font-semibold text-navy-900">Tenders</h2>
            {tenders.isPending ? (
              <Spinner />
            ) : tenders.isError ? (
              <ErrorBox error={tenders.error} onRetry={() => tenders.refetch()} />
            ) : tenders.data.length === 0 ? (
              <EmptyState title="No tenders yet">Upload a tender or RFQ PDF above to generate a summary, a compliance checklist and the disqualification risks.</EmptyState>
            ) : (
              <div className="card divide-y divide-slate-100">
                {tenders.data.map((t) => {
                  const closing = closingLabel(t.closingDate);
                  return (
                    <div key={t.tenderId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <Link to={`/tenders/${t.tenderId}`} className="min-w-0 flex-1 hover:text-brand-600">
                        <p className="truncate font-medium text-navy-900">{t.title ?? t.fileName}</p>
                        <p className="truncate text-xs text-slate-500">
                          {t.fileName} · uploaded {formatDate(t.createdAt)}
                        </p>
                      </Link>
                      <div className="flex flex-wrap items-center gap-2">
                        {t.status === "READY" ? <Badge tone={closing.tone}>{closing.text}</Badge> : <StatusBadge status={t.status} />}
                        {t.openMandatory > 0 && <Badge tone="amber">{t.openMandatory} mandatory open</Badge>}
                      </div>
                      {t.checklistProgress !== null && (
                        <div className="w-full sm:w-28">
                          <ProgressBar value={t.checklistProgress} />
                        </div>
                      )}
                      <button
                        className="btn-ghost self-end p-1.5 text-slate-400 hover:text-red-600 sm:self-auto"
                        aria-label={`Delete ${t.fileName}`}
                        onClick={() => confirm(`Delete ${t.fileName}?`) && delTender.mutate(t.tenderId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
