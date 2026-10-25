import type { TenderStatus } from "@tenderready/shared";
import { Check, Loader2 } from "lucide-react";
import { cx } from "../lib/format";

const STEPS: Array<{ label: string; detail: string; statuses: TenderStatus[] }> = [
  { label: "Upload", detail: "PDF stored in private, encrypted S3 storage", statuses: ["UPLOADING"] },
  { label: "Text extraction", detail: "Text read from the PDF; scanned pages are transcribed by Claude on Amazon Bedrock", statuses: ["UPLOADED", "EXTRACTING"] },
  { label: "AI analysis", detail: "Amazon Bedrock identifies requirements, dates and risks", statuses: ["ANALYSING"] },
  { label: "Summary & checklist", detail: "Results saved and ready to review", statuses: ["READY"] },
];

/** Progress indicator driven by the real backend pipeline status. */
export function AnalysisStepper({ status, pageCount }: { status: TenderStatus; pageCount?: number }) {
  const current = STEPS.findIndex((s) => s.statuses.includes(status));
  return (
    <div className="card p-6">
      <h2 className="font-semibold text-navy-900">Analysing tender…</h2>
      <p className="mb-6 text-sm text-slate-500">
        This usually takes 1 to 3 minutes, depending on the length of the document{pageCount ? ` (${pageCount} pages)` : ""}. You can leave this page; the
        analysis continues in the background.
      </p>
      <ol className="space-y-5">
        {STEPS.map((s, i) => {
          const done = i < current || status === "READY";
          const active = i === current && status !== "READY";
          return (
            <li key={s.label} className="flex gap-4">
              <span
                className={cx(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  done ? "bg-ok-500 text-white" : active ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : i + 1}
              </span>
              <div>
                <p className={cx("font-medium", done || active ? "text-navy-900" : "text-slate-400")}>{s.label}</p>
                <p className="text-sm text-slate-500">{s.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
