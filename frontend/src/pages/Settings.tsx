import { CheckCircle2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { ErrorBox, PageHeader, Spinner } from "../components/ui";
import { useHub, useSaveHub } from "../lib/queries";

function HubForm({ compact = false }: { compact?: boolean }) {
  const hub = useHub();
  const save = useSaveHub();
  const [hubName, setHubName] = useState("");
  const [advisorName, setAdvisorName] = useState("");

  useEffect(() => {
    if (hub.data) {
      setHubName(hub.data.hubName);
      setAdvisorName(hub.data.advisorName);
    }
  }, [hub.data]);

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ hubName, advisorName });
  }

  if (hub.isPending) return <Spinner />;
  return (
    <form onSubmit={submit} className={compact ? "grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" : "space-y-4"}>
      <div>
        <label className="label" htmlFor="hubName">Hub / organisation name</label>
        <input id="hubName" className="input" value={hubName} onChange={(e) => setHubName(e.target.value)} placeholder="e.g. Soweto Enterprise Hub" required />
      </div>
      <div>
        <label className="label" htmlFor="advisorName">Advisor name</label>
        <input id="advisorName" className="input" value={advisorName} onChange={(e) => setAdvisorName(e.target.value)} placeholder="Shown on compliance packs" />
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</button>
        {save.isSuccess && !compact && (
          <span className="flex items-center gap-1 text-sm text-ok-600"><CheckCircle2 className="h-4 w-4" /> Saved</span>
        )}
      </div>
      {save.isError && <ErrorBox error={save.error} />}
    </form>
  );
}

export function HubSetupCard() {
  return (
    <div className="card mb-6 border-brand-100 bg-brand-50/50 p-5">
      <h2 className="font-semibold text-navy-900">Set up your hub</h2>
      <p className="mb-4 text-sm text-slate-600">Your hub name and advisor name appear on the compliance packs you share with SMMEs.</p>
      <HubForm compact />
    </div>
  );
}

export function Settings() {
  return (
    <>
      <PageHeader title="Hub settings" subtitle="Details shown on the compliance packs you hand to your SMME clients." />
      <div className="card max-w-xl p-6">
        <HubForm />
      </div>
      <div className="card mt-6 max-w-xl p-6 text-sm text-slate-600">
        <h2 className="mb-2 font-semibold text-navy-900">Data &amp; privacy</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Tender PDFs are stored in private, encrypted Amazon S3 storage and are deleted automatically after 90 days.</li>
          <li>Only your hub account can see the clients and tenders you add.</li>
          <li>Document content is not written to application logs.</li>
          <li>AI outputs support your review. Always check them against the original tender.</li>
        </ul>
      </div>
    </>
  );
}
