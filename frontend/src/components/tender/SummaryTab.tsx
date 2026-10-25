import type { Tender } from "@tenderready/shared";
import { AlertTriangle, CalendarClock, ClipboardList, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { closingLabel, formatDateTime } from "../../lib/format";
import { AiNotice, Badge, PageRefs } from "../ui";

function Field({ label, value, pages, onOpen }: { label: string; value: ReactNode; pages?: number[]; onOpen: (p: number) => void }) {
  return (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800 sm:col-span-2 sm:mt-0">
        {value ?? <span className="italic text-slate-400">Not stated in the tender</span>}
        {pages && pages.length > 0 && (
          <span className="ml-2 align-middle">
            <PageRefs pages={pages} onOpen={onOpen} />
          </span>
        )}
      </dd>
    </div>
  );
}

export function SummaryTab({ tender, onOpen }: { tender: Tender; onOpen: (p: number) => void }) {
  const s = tender.summary!;
  const src = s.sourcePages ?? {};
  const closing = closingLabel(s.closingDateTime);
  const mandatory = tender.checklist?.filter((c) => c.mandatory).length ?? 0;
  const high = tender.risks?.filter((r) => r.severity === "high").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card flex items-start gap-3 p-4">
          <CalendarClock className="mt-0.5 h-5 w-5 text-brand-600" />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Closing</p>
            <p className="font-semibold text-navy-900">{s.closingDateText ?? formatDateTime(s.closingDateTime)}</p>
            <Badge tone={closing.tone} className="mt-1">{closing.text}</Badge>
          </div>
        </div>
        <div className="card flex items-start gap-3 p-4">
          <MapPin className="mt-0.5 h-5 w-5 text-brand-600" />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Briefing session</p>
            <p className="font-semibold text-navy-900">
              {s.briefing.compulsory === true ? "Compulsory" : s.briefing.compulsory === false ? "Not compulsory" : "Not stated"}
            </p>
            {s.briefing.dateTime && <p className="text-sm text-slate-600">{s.briefing.dateTime}</p>}
          </div>
        </div>
        <div className="card flex items-start gap-3 p-4">
          <ClipboardList className="mt-0.5 h-5 w-5 text-brand-600" />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Requirements found</p>
            <p className="font-semibold text-navy-900">{mandatory} mandatory · {(tender.checklist?.length ?? 0) - mandatory} other</p>
            {high > 0 && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" /> {high} high-severity risk{high === 1 ? "" : "s"}
              </p>
            )}
          </div>
        </div>
      </div>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold text-navy-900">Plain-language overview</h3>
          <AiNotice compact />
        </div>
        <p className="text-sm leading-relaxed text-slate-700">{s.overview || "No overview was generated."}</p>
      </section>

      <section className="card px-5 py-2">
        <h3 className="pt-3 font-semibold text-navy-900">Key tender details</h3>
        <dl className="divide-y divide-slate-100">
          <Field label="Title" value={s.title} pages={src.title} onOpen={onOpen} />
          <Field label="Reference number" value={s.reference} pages={src.reference} onOpen={onOpen} />
          <Field label="Issuing entity" value={s.issuingEntity} pages={src.issuingEntity} onOpen={onOpen} />
          <Field label="Closing date & time" value={s.closingDateText} pages={src.closingDateText ?? src.closingDateTime} onOpen={onOpen} />
          <Field
            label="Briefing / site meeting"
            value={
              s.briefing.compulsory === null && !s.briefing.dateTime && !s.briefing.venue
                ? null
                : [s.briefing.compulsory ? "Compulsory" : s.briefing.compulsory === false ? "Optional" : null, s.briefing.dateTime, s.briefing.venue]
                    .filter(Boolean)
                    .join(" · ")
            }
            pages={src.briefing}
            onOpen={onOpen}
          />
          <Field label="Contract duration" value={s.contractDuration} pages={src.contractDuration} onOpen={onOpen} />
          <Field label="Bid validity" value={s.validityPeriod} pages={src.validityPeriod} onOpen={onOpen} />
          <Field label="How to submit" value={[s.submissionMethod, s.submissionAddress].filter(Boolean).join(" · ") || null} pages={src.submissionMethod} onOpen={onOpen} />
          <Field label="Preference system" value={s.evaluation.preferenceSystem} pages={src.evaluation} onOpen={onOpen} />
          <Field label="Functionality threshold" value={s.evaluation.functionalityThreshold} pages={src.evaluation} onOpen={onOpen} />
          <Field
            label="Evaluation criteria"
            value={s.evaluation.criteria.length ? <ul className="list-disc space-y-1 pl-4">{s.evaluation.criteria.map((c) => <li key={c}>{c}</li>)}</ul> : null}
            onOpen={onOpen}
          />
        </dl>
      </section>
      <AiNotice />
    </div>
  );
}
