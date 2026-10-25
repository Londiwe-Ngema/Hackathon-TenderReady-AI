import { CHECKLIST_CATEGORIES, checklistProgress } from "@tenderready/shared";
import { ArrowLeft, Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ErrorBox, Logo, Spinner } from "../components/ui";
import { formatDate } from "../lib/format";
import { useHub, useTender } from "../lib/queries";

const STATUS_TEXT = { todo: "☐ To do", in_progress: "◐ In progress", done: "☑ Done", n_a: "— N/A" } as const;

/** Printable hand-out the hub advisor gives to the SMME. Uses the browser's print-to-PDF. */
export function CompliancePack() {
  const { tenderId = "" } = useParams();
  const q = useTender(tenderId);
  const hub = useHub();
  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorBox error={q.error} />;
  const t = q.data;
  const s = t.summary;
  if (!s) return <ErrorBox error={new Error("This tender has not been analysed yet.")} />;
  const items = t.checklist ?? [];
  const pages = (p: number[]) => (p.length ? ` (p.${p.join(", ")})` : "");

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/tenders/${tenderId}?tab=checklist`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
          <ArrowLeft className="h-4 w-4" /> Back to tender
        </Link>
        <button className="btn-primary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / save as PDF
        </button>
      </div>

      <article className="card mx-auto max-w-3xl space-y-6 p-6 text-sm sm:p-10 print:max-w-none print:border-0 print:p-0">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Tender compliance pack</p>
            <h1 className="mt-1 text-xl font-semibold text-navy-900">{s.title ?? t.fileName}</h1>
            <p className="mt-1 text-slate-600">
              Prepared for <strong>{t.clientName}</strong>
              {hub.data?.hubName && <> by {hub.data.advisorName ? `${hub.data.advisorName}, ` : ""}{hub.data.hubName}</>}
            </p>
            <p className="text-xs text-slate-500">Generated {formatDate(new Date().toISOString())}</p>
          </div>
          <Logo />
        </header>

        <section>
          <h2 className="mb-2 font-semibold text-navy-900">Key details</h2>
          <table className="w-full border-collapse text-left">
            <tbody className="divide-y divide-slate-100">
              {[
                ["Reference", s.reference],
                ["Issued by", s.issuingEntity],
                ["Closing date & time", s.closingDateText],
                ["Briefing session", [s.briefing.compulsory ? "COMPULSORY" : s.briefing.compulsory === false ? "Optional" : null, s.briefing.dateTime, s.briefing.venue].filter(Boolean).join(" · ") || null],
                ["How to submit", [s.submissionMethod, s.submissionAddress].filter(Boolean).join(" · ") || null],
                ["Contract duration", s.contractDuration],
                ["Bid validity", s.validityPeriod],
                ["Evaluation", [s.evaluation.preferenceSystem, s.evaluation.functionalityThreshold].filter(Boolean).join(" · ") || null],
              ].map(([k, v]) => (
                <tr key={k}>
                  <th className="w-44 py-1.5 pr-4 align-top font-medium text-slate-500">{k}</th>
                  <td className="py-1.5 text-slate-800">{v ?? "Not stated"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-navy-900">In plain language</h2>
          <p className="leading-relaxed text-slate-700">{s.overview}</p>
        </section>

        {(t.risks?.length ?? 0) > 0 && (
          <section>
            <h2 className="mb-2 font-semibold text-red-700">⚠ Could lead to disqualification</h2>
            <ul className="space-y-1.5">
              {t.risks!.map((r) => (
                <li key={r.id}>
                  <strong className="capitalize">[{r.severity}]</strong> {r.title}: <span className="text-slate-600">{r.explanation}</span>
                  <span className="text-xs text-slate-500">{pages(r.sourcePages)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="print-break">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-semibold text-navy-900">Submission checklist</h2>
            <span className="text-xs text-slate-500">{checklistProgress(items) ?? 0}% prepared</span>
          </div>
          {CHECKLIST_CATEGORIES.filter((c) => items.some((i) => i.category === c)).map((cat) => (
            <div key={cat} className="mb-3">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{cat}</h3>
              <table className="w-full border-collapse">
                <tbody>
                  {items
                    .filter((i) => i.category === cat)
                    .map((i) => (
                      <tr key={i.id} className="border-b border-slate-100 align-top">
                        <td className="w-28 py-1.5 pr-2 text-xs text-slate-600">{STATUS_TEXT[i.status]}</td>
                        <td className="py-1.5">
                          {i.requirement}
                          {i.mandatory && <strong className="ml-1 text-red-700">(mandatory)</strong>}
                          {i.origin === "common_sa_practice" && <em className="ml-1 text-slate-500">(general practice, not stated in this tender)</em>}
                          <span className="text-xs text-slate-500">{pages(i.sourcePages)}</span>
                          {i.note && <div className="text-xs text-amber-800">Note: {i.note}</div>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>

        <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">
          This pack was generated with AI (TenderReady AI) from the tender document to support bid preparation. It may be incomplete or contain
          errors. Always check every requirement against the original tender document and any addenda. It does not guarantee eligibility,
          compliance or award.
        </footer>
      </article>
    </div>
  );
}
