import type { Risk, Tender } from "@tenderready/shared";
import { ShieldAlert } from "lucide-react";
import { cx } from "../../lib/format";
import { AiNotice, Badge, EmptyState, PageRefs } from "../ui";

const ORDER: Record<Risk["severity"], number> = { high: 0, medium: 1, low: 2 };
const TONE = { high: "red", medium: "amber", low: "slate" } as const;

export function RisksTab({ tender, onOpen }: { tender: Tender; onOpen: (p: number) => void }) {
  const risks = [...(tender.risks ?? [])].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  if (!risks.length)
    return <EmptyState icon={<ShieldAlert className="h-6 w-6" />} title="No disqualification conditions detected">Still read the tender's conditions of bid carefully.</EmptyState>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        These conditions in the tender could get a bid <strong>disqualified or marked non-responsive</strong>. Go through them with the SMME before submission.
      </p>
      {risks.map((r) => (
        <article
          key={r.id}
          className={cx("card border-l-4 p-4", r.severity === "high" ? "border-l-red-500" : r.severity === "medium" ? "border-l-amber-500" : "border-l-slate-300")}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-navy-900">{r.title}</h3>
            <Badge tone={TONE[r.severity]} className="capitalize">{r.severity}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-700">{r.explanation}</p>
          {r.sourceQuote && (
            <blockquote className="mt-2 border-l-2 border-slate-300 pl-2 text-xs italic text-slate-500">From the tender: “{r.sourceQuote}”</blockquote>
          )}
          <div className="mt-2">
            <PageRefs pages={r.sourcePages} onOpen={onOpen} />
          </div>
        </article>
      ))}
      <AiNotice />
    </div>
  );
}
