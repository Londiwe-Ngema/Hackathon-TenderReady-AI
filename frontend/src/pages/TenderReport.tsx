import { PROCESSING_STATUSES, openMandatoryCount } from "@tenderready/shared";
import { AlertOctagon, ArrowLeft, ExternalLink, FileText, Printer } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AnalysisStepper } from "../components/AnalysisStepper";
import { AskPanel } from "../components/tender/AskPanel";
import { ChecklistTab } from "../components/tender/ChecklistTab";
import { RisksTab } from "../components/tender/RisksTab";
import { SummaryTab } from "../components/tender/SummaryTab";
import { useSourceOpener } from "../components/tender/useSourceOpener";
import { ErrorBox, PageHeader, Spinner, StatusBadge } from "../components/ui";
import { cx, formatDate } from "../lib/format";
import { useTender } from "../lib/queries";

type Tab = "summary" | "checklist" | "risks" | "ask";

export function TenderReport() {
  const { tenderId = "" } = useParams();
  const q = useTender(tenderId);
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "summary";
  const { open, notice } = useSourceOpener(tenderId);

  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const t = q.data;
  const processing = PROCESSING_STATUSES.includes(t.status);

  const tabs: Array<{ id: Tab; label: ReactNode }> = [
    { id: "summary", label: "Summary" },
    {
      id: "checklist",
      label: (
        <>
          Compliance checklist
          {openMandatoryCount(t.checklist) > 0 && (
            <span className="ml-1.5 bg-accent-500 px-1.5 text-[11px] text-white">{openMandatoryCount(t.checklist)}</span>
          )}
        </>
      ),
    },
    {
      id: "risks",
      label: (
        <>
          Disqualification risks
          {(t.risks?.filter((r) => r.severity === "high").length ?? 0) > 0 && (
            <span className="ml-1.5 bg-red-700 px-1.5 text-[11px] text-white">{t.risks!.filter((r) => r.severity === "high").length}</span>
          )}
        </>
      ),
    },
    { id: "ask", label: "Ask TenderReady" },
  ];

  return (
    <>
      <PageHeader
        back={
          <Link to={`/clients/${t.clientId}`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
            <ArrowLeft className="h-4 w-4" /> {t.clientName ?? "Back to client"}
          </Link>
        }
        title={t.summary?.title ?? t.fileName}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {t.summary?.reference && <span className="font-mono text-xs">{t.summary.reference}</span>}
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> {t.fileName}
              {t.pageCount ? ` · ${t.pageCount} pages` : ""}
            </span>
            <span>Uploaded {formatDate(t.createdAt)}</span>
            <StatusBadge status={t.status} />
          </span>
        }
        actions={
          t.status === "READY" && (
            <>
              <button className="btn-secondary" onClick={() => open()}>
                <ExternalLink className="h-4 w-4" /> Original PDF
              </button>
              <Link className="btn-primary" to={`/tenders/${t.tenderId}/pack`}>
                <Printer className="h-4 w-4" /> Compliance pack
              </Link>
            </>
          )
        }
      />

      {notice && (
        <div className="mb-4 border-l-4 border-accent-500 bg-navy-900 px-4 py-2 text-sm text-white" role="status">
          {notice}
        </div>
      )}

      {processing && <AnalysisStepper status={t.status} pageCount={t.pageCount} />}

      {t.status === "FAILED" && (
        <div className="card flex gap-3 border-red-200 bg-red-50 p-5 text-red-800" role="alert">
          <AlertOctagon className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">We couldn't analyse this tender</p>
            <p className="mt-1 text-sm">{t.statusReason ?? "An unexpected error occurred."}</p>
            <Link to={`/clients/${t.clientId}`} className="btn-secondary mt-3">
              Upload another copy
            </Link>
          </div>
        </div>
      )}

      {t.status === "READY" && t.summary && (
        <>
          <div className="no-print -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex min-w-max gap-1 border-b border-slate-200" role="tablist">
              {tabs.map((x) => (
                <button
                  key={x.id}
                  role="tab"
                  aria-selected={tab === x.id}
                  onClick={() => setParams({ tab: x.id }, { replace: true })}
                  className={cx(
                    "-mb-px flex items-center border-b-[3px] px-4 py-3 font-nav text-[13px] font-bold uppercase tracking-wide transition",
                    tab === x.id ? "border-accent-500 text-brand-600" : "border-transparent text-navy-900 hover:text-accent-500",
                  )}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          {tab === "summary" && <SummaryTab tender={t} onOpen={open} />}
          {tab === "checklist" && <ChecklistTab tender={t} onOpen={open} />}
          {tab === "risks" && <RisksTab tender={t} onOpen={open} />}
          {tab === "ask" && <AskPanel tender={t} onOpen={open} />}
        </>
      )}
    </>
  );
}
