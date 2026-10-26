import type { TenderStatus } from "@tenderready/shared";
import { AlertTriangle, Bot, FileText, Loader2, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { aiLabel } from "../lib/config";
import { cx } from "../lib/format";

export function Logo({ light = false, size = "md" }: { light?: boolean; size?: "md" | "lg" }) {
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 32 32" className={size === "lg" ? "h-11 w-11" : "h-9 w-9"} aria-hidden>
        <rect width="32" height="32" fill={light ? "#ffffff" : "#00727d"} />
        <path d="M9 7h11l4 4v14H9z" fill={light ? "#00727d" : "#ffffff"} />
        <path d="M12.5 17.5l2.5 2.5 5-5" stroke="#ff9900" strokeWidth="2.6" fill="none" strokeLinecap="square" />
      </svg>
      <div className="leading-none">
        <span className={cx("block font-heading font-medium uppercase tracking-wide", size === "lg" ? "text-[28px]" : "text-[22px]", light ? "text-white" : "text-navy-900")}>
          Tender<span className={light ? "text-accent-500" : "text-brand-600"}>Ready</span>
        </span>
        <span className={cx("mt-1 block font-nav text-[10px] font-medium uppercase tracking-[0.18em]", light ? "text-white/70" : "text-slate-500")}>
          SMME tender compliance
        </span>
      </div>
    </div>
  );
}

type Tone = "slate" | "blue" | "green" | "amber" | "red";
const toneClasses: Record<Tone, string> = {
  slate: "bg-[#f5f5f5] text-slate-700 ring-[#dfe3e4]",
  blue: "bg-brand-50 text-brand-700 ring-brand-100",
  green: "bg-ok-50 text-ok-600 ring-green-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
};

export function Badge({ tone = "slate", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 px-2 py-0.5 font-nav text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset", toneClasses[tone], className)}>
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
    <div className="flex items-start gap-2 border-l-4 border-brand-600 bg-brand-50 px-3 py-2 text-xs text-brand-700">
      <Bot className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <strong>AI-generated. Verify against the original tender document.</strong> TenderReady supports bid preparation. It does not
        guarantee eligibility, compliance or award. <span className="opacity-75">Generated with {aiLabel()}.</span>
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
  const color = v >= 100 ? "bg-ok-500" : v >= 50 ? "bg-brand-500" : "bg-accent-500";
  return (
    <div className="w-full">
      <div className="h-2 overflow-hidden bg-[#e4e8ea]" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Checklist progress"}>
        <div className={cx("h-full transition-all", color)} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

const toneRule: Record<Tone, string> = {
  slate: "border-t-slate-400",
  blue: "border-t-brand-600",
  green: "border-t-ok-500",
  amber: "border-t-accent-500",
  red: "border-t-red-600",
};

export function StatTile({ label, value, icon, tone = "slate", hint }: { label: string; value: ReactNode; icon: ReactNode; tone?: Tone; hint?: string }) {
  return (
    <div className={cx("card border-t-4 p-4", toneRule[tone])}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-nav text-xs font-bold uppercase tracking-wide text-navy-900">{label}</p>
        <span className="text-slate-400">{icon}</span>
      </div>
      <p className="mt-3 font-heading text-4xl font-normal tabular-nums text-navy-900">{value}</p>
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
    <div className="card flex flex-col items-start gap-3 border-l-4 border-red-700 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between" role="alert">
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
      <div className="mb-3 bg-brand-600 p-3 text-white">{icon ?? <FileText className="h-6 w-6" />}</div>
      <h3 className="font-bold uppercase tracking-wide text-navy-900">{title}</h3>
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
        className="max-h-[92vh] w-full overflow-y-auto border-t-4 border-accent-500 bg-white shadow-[0_0_20px_rgba(21,47,95,0.2)] sm:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[#dfe3e4] bg-white px-5 py-4">
          <h2 className="text-lg uppercase text-navy-900">{title}</h2>
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
          className="bg-[#f5f5f5] px-1.5 py-0.5 font-mono text-[11px] text-slate-600 ring-1 ring-[#dfe3e4] hover:bg-brand-600 hover:text-white"
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
    <div className="mb-8 border-b border-[#dfe3e4] pb-6">
      {back}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="title-rule text-[26px] leading-tight text-navy-900">{title}</h1>
          {subtitle && <div className="mt-3 text-sm text-[#555555]">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
