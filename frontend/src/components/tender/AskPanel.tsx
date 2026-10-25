import type { Citation, Tender } from "@tenderready/shared";
import { Bot, Send, User } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, type ChatTurn } from "../../api";
import { demoMode } from "../../lib/config";
import { cx } from "../../lib/format";
import { AiNotice, PageRefs, SimulatedLabel } from "../ui";

const SUGGESTED = [
  "What documents do I need to submit?",
  "Is there a compulsory briefing session? When and where?",
  "What could get this bid disqualified?",
  "How will bids be evaluated and scored?",
  "What experience or references must the company show?",
  "What are the key dates and deadlines?",
];

interface Message extends ChatTurn {
  citations?: Citation[];
  error?: boolean;
}

/** Renders **bold** and [p.N] citations inline. */
function inline(text: string, onOpen: (p: number) => void): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[(?:p|pp)\.\s*[\d,\s–-]+\])/g).map((part, i) => {
    if (/^\*\*.+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const cite = /^\[(?:p|pp)\.\s*([\d,\s–-]+)\]$/.exec(part);
    if (cite) {
      const pages = cite[1].split(/[,–-]/).map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n));
      return <PageRefs key={i} pages={pages} onOpen={onOpen} />;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Minimal markdown: paragraphs, bullet and numbered lists. */
function Answer({ text, onOpen }: { text: string; onOpen: (p: number) => void }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={cx("space-y-1 pl-5", list.ordered ? "list-decimal" : "list-disc")}>
        {list.items.map((it, i) => <li key={i}>{inline(it, onOpen)}</li>)}
      </Tag>,
    );
    list = null;
  };
  for (const line of text.split("\n")) {
    const bullet = /^\s*[-*•]\s+(.*)/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)/.exec(line);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
    } else {
      flush();
      if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line, onOpen)}</p>);
    }
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

export function AskPanel({ tender, onOpen }: { tender: Tender; onOpen: (p: number) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [messages, busy]);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    const history: ChatTurn[] = messages.filter((m) => !m.error).map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "user", text }]);
    setQuestion("");
    setBusy(true);
    try {
      const res = await api().ask(tender.tenderId, text, history);
      setMessages((m) => [...m, { role: "assistant", text: res.answer, citations: res.citations }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: err instanceof Error ? err.message : "Something went wrong.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="font-semibold text-navy-900">Ask TenderReady</h3>
          <p className="text-xs text-slate-500">Answers come only from this tender document and cite the pages they are based on.</p>
        </div>
        {demoMode && <SimulatedLabel>Simulated answers (demo)</SimulatedLabel>}
      </div>

      <div className="max-h-[60vh] min-h-64 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div>
            <p className="mb-3 text-sm text-slate-600">Try one of these questions:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-left text-sm text-brand-700 hover:bg-brand-100">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cx("flex gap-3", m.role === "user" && "flex-row-reverse")}>
            <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", m.role === "user" ? "bg-navy-900 text-white" : "bg-brand-50 text-brand-600")}>
              {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </span>
            <div
              className={cx(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user" ? "bg-navy-900 text-white" : m.error ? "bg-red-50 text-red-800" : "bg-slate-100 text-slate-800",
              )}
            >
              {m.role === "user" ? m.text : <Answer text={m.text} onOpen={onOpen} />}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-slate-200 pt-2 text-xs text-slate-500">
                  Sources: <PageRefs pages={m.citations.map((c) => c.page)} onOpen={onOpen} />
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Bot className="h-4 w-4" /></span>
            <div className="flex items-center gap-1 rounded-2xl bg-slate-100 px-4 py-3" aria-label="Thinking">
              {[0, 150, 300].map((d) => (
                <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={end} />
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-slate-100 p-3">
        <input
          className="input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about requirements, dates, evaluation…"
          aria-label="Your question"
          maxLength={1000}
        />
        <button className="btn-primary" disabled={busy || !question.trim()} aria-label="Send question">
          <Send className="h-4 w-4" />
        </button>
      </form>
      <div className="px-3 pb-3">
        <AiNotice />
      </div>
    </div>
  );
}
