import type { TenderStatus } from "@tenderready/shared";
import { AlertTriangle, Bot, FileText, Loader2, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cx } from "../lib/format";

export function Logo({ light = false, size = "md" }: { light?: boolean; size?: "md" | "lg" }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className={size === "lg" ? "h-10 w-10" : "h-8 w-8"} aria-hidden>
        <rect width="32" height="32" rx="7" fill={light ? "#ffffff" : "#0b1f3a"} />
        <path d="M9 8h11l4 4v12H9z" fill={light ? "#0b1f3a" : "#ffffff"} />
        <path d="M12.5 17.5l2.5 2.5 5-5" stroke="#16a34a" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={cx("font-semibold tracking-tight", size === "lg" ? "text-2xl" : "text-lg", light ? "text-white" : "text-navy-900")}>
        TenderReady <span className={light ? "text-ok-500" : "text-brand-600"}>AI</span>
      </span>
    </div>
  );
}

type Tone = "slate" | "blue" | "green" | "amber" | "red";
const toneClasses: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-brand-50 text-brand-700 ring-brand-100",
  green: "bg-ok-50 text-ok-600 ring-green-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
};

export function Badge({ tone = "slate", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", toneClasses[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_LABEL: Record<TenderStatus, [string, Tone]> = {
  UPLOADING: ["Uploading", "slate"],
  UPLOADED: ["Uploaded", "blue"],
  EXTRACTING: ["Extracting text", "blue"],
  ANALYSING: ["AI analysis", "blue"],
  READY: ["Ready", "green"],
  FAILED: ["Failed", "red"],
};

export function StatusBadge({ status }: { status: TenderStatus }) {
  const [label, tone] = STATUS_LABEL[status];
  const busy = tone === "blue";
  return (
    <Badge tone={tone}>
      {busy && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </Badge>
  );
}

/** Responsible-AI label shown on every AI-generated panel. */
export function AiNotice({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <Badge tone="blue">
        <Bot className="h-3 w-3" /> AI-generated
      </Badge>
    );
  return (
    <div className="flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-700">
      <Bot className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <strong>AI-generated. Verify against the original tender document.</strong> TenderReady supports bid preparation. It does not
        guarantee eligibility, compliance or award.
      </p>
    </div>
  );
}

export function SimulatedLabel({ children = "Simulated" }: { children?: ReactNode }) {
  return (
    <Badge tone="amber">
      <AlertTriangle className="h-3 w-3" /> {children}
    </Badge>
  );
}

export function ProgressBar({ value, label }: { value: number | null; label?: string }) {
  const v = value ?? 0;
  const color = v >= 100 ? "bg-ok-500" : v >= 50 ? "bg-brand-500" : "bg-amber-500";
  return (
    <div className="w-full">
      <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Checklist progress"}>
        <div className={cx("h-full rounded-full transition-all", color)} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function StatTile({ label, value, icon, tone = "slate", hint }: { label: string; value: ReactNode; icon: ReactNode; tone?: Tone; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={cx("rounded-lg p-2 ring-1 ring-inset", toneClasses[tone])}>{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-navy-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-start gap-3 border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between" role="alert">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" /> {error instanceof Error ? error.message : "Something went wrong."}
      </span>
      {onRetry && (
        <button className="btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-brand-50 p-3 text-brand-600">{icon ?? <FileText className="h-6 w-6" />}</div>
      <h3 className="font-semibold text-navy-900">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="font-semibold text-navy-900">{title}</h2>
          <button className="btn-ghost p-1.5" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Clickable source-page references. Opens the original PDF at that page when available. */
export function PageRefs({ pages, onOpen }: { pages: number[]; onOpen?: (page: number) => void }) {
  if (!pages.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onOpen?.(p)}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 ring-1 ring-slate-200 hover:bg-brand-50 hover:text-brand-700"
          title={`Source: page ${p} of the tender`}
        >
          p.{p}
        </button>
      ))}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6">
      {back}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-navy-900">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
