import { CHECKLIST_CATEGORIES, checklistProgress, type ChecklistItem, type ChecklistItemStatus, type Tender } from "@tenderready/shared";
import { Check, Info, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { cx } from "../../lib/format";
import { useUpdateChecklist } from "../../lib/queries";
import { AiNotice, Badge, PageRefs, ProgressBar } from "../ui";

const STATUS_OPTIONS: Array<{ value: ChecklistItemStatus; label: string }> = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "n_a", label: "N/A" },
];

type Filter = "all" | "mandatory" | "open";

function Item({ item, tenderId, onOpen }: { item: ChecklistItem; tenderId: string; onOpen: (p: number) => void }) {
  const update = useUpdateChecklist(tenderId);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(item.note ?? "");
  const done = item.status === "done";

  return (
    <li className={cx("flex gap-3 p-4", item.status === "n_a" && "opacity-60")}>
      <button
        onClick={() => update.mutate({ itemId: item.id, status: done ? "todo" : "done" })}
        className={cx(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition",
          done ? "border-ok-500 bg-ok-500 text-white" : "border-slate-300 bg-white hover:border-brand-500",
        )}
        aria-label={done ? `Mark "${item.requirement}" as not done` : `Mark "${item.requirement}" as done`}
      >
        {done && <Check className="h-3.5 w-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cx("text-sm font-medium", done ? "text-slate-500 line-through" : "text-slate-800")}>{item.requirement}</p>
          {item.mandatory && <Badge tone="red">Mandatory</Badge>}
          {item.origin === "common_sa_practice" && (
            <Badge tone="slate">
              <Info className="h-3 w-3" /> General SA practice, not stated in this tender
            </Badge>
          )}
        </div>
        {item.sourceQuote && (
          <blockquote className="mt-1.5 border-l-2 border-slate-300 pl-2 text-xs italic text-slate-500">
            “{item.sourceQuote}”
          </blockquote>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <PageRefs pages={item.sourcePages} onOpen={onOpen} />
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
            value={item.status}
            onChange={(e) => update.mutate({ itemId: item.id, status: e.target.value as ChecklistItemStatus })}
            aria-label="Status"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600" onClick={() => setNoteOpen((v) => !v)}>
            <MessageSquarePlus className="h-3.5 w-3.5" /> {item.note ? "Edit note" : "Add note"}
          </button>
        </div>
        {item.note && !noteOpen && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">Note: {item.note}</p>}
        {noteOpen && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate({ itemId: item.id, note });
              setNoteOpen(false);
            }}
          >
            <input className="input py-1.5 text-xs" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Client to bring certified IDs on Thursday" autoFocus />
            <button className="btn-secondary px-3 py-1.5 text-xs">Save</button>
          </form>
        )}
      </div>
    </li>
  );
}

export function ChecklistTab({ tender, onOpen }: { tender: Tender; onOpen: (p: number) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const items = tender.checklist ?? [];
  const progress = checklistProgress(items) ?? 0;
  const visible = items.filter((i) =>
    filter === "mandatory" ? i.mandatory : filter === "open" ? i.status !== "done" && i.status !== "n_a" : true,
  );
  const groups = CHECKLIST_CATEGORIES.map((cat) => ({ cat, items: visible.filter((i) => i.category === cat) })).filter((g) => g.items.length);

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium text-navy-900">Preparation progress</span>
            <span className="tabular-nums text-slate-600">
              {items.filter((i) => i.status === "done").length}/{items.filter((i) => i.status !== "n_a").length} done · {progress}%
            </span>
          </div>
          <ProgressBar value={progress} />
          <p className="mt-1 text-xs text-slate-500">Tracks checklist completion only. It is not a measure of eligibility or of the chance of winning.</p>
        </div>
        <div className="flex border border-brand-600 text-sm" role="tablist" aria-label="Filter checklist">
          {(["all", "mandatory", "open"] as Filter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cx("px-3 py-1.5 font-nav text-xs font-bold uppercase tracking-wide", filter === f ? "bg-brand-600 text-white" : "bg-white text-brand-600 hover:bg-brand-50")}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.cat} className="card overflow-hidden">
          <h3 className="border-b border-[#dfe3e4] bg-brand-600 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white">
            {g.cat} <span className="font-normal text-white/75">({g.items.length})</span>
          </h3>
          <ul className="divide-y divide-slate-100">
            {g.items.map((i) => (
              <Item key={i.id} item={i} tenderId={tender.tenderId} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      ))}
      {groups.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nothing to show for this filter.</p>}
      <AiNotice />
    </div>
  );
}
