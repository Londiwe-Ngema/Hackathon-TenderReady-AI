import type { Client, ClientInput } from "@tenderready/shared";
import { useState, type FormEvent } from "react";
import { useSaveClient } from "../lib/queries";
import { ErrorBox } from "./ui";

const FIELDS: Array<{ key: keyof ClientInput; label: string; placeholder?: string; type?: string; required?: boolean }> = [
  { key: "name", label: "Business name", placeholder: "e.g. Ubuntu Solar & Electrical (Pty) Ltd", required: true },
  { key: "regNo", label: "CIPC registration no.", placeholder: "2019/123456/07" },
  { key: "csdNumber", label: "CSD supplier no.", placeholder: "MAAA0123456" },
  { key: "bbbeeLevel", label: "B-BBEE status", placeholder: "Level 1 (EME)" },
  { key: "cidbGrade", label: "CIDB grading", placeholder: "e.g. 3EP (if applicable)" },
  { key: "sector", label: "Sector", placeholder: "e.g. Construction, catering, ICT" },
  { key: "contactName", label: "Contact person" },
  { key: "contactEmail", label: "Contact email", type: "email" },
];

export function ClientForm({ client, onSaved }: { client?: Client; onSaved: (c: Client) => void }) {
  const save = useSaveClient(client?.clientId);
  const [values, setValues] = useState<ClientInput>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, client?.[f.key] ?? ""])) as unknown as ClientInput,
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(values, { onSuccess: onSaved });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.key === "name" ? "sm:col-span-2" : undefined}>
            <label className="label" htmlFor={f.key}>
              {f.label}
              {f.required && <span className="text-red-600"> *</span>}
            </label>
            <input
              id={f.key}
              className="input"
              type={f.type ?? "text"}
              required={f.required}
              placeholder={f.placeholder}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {save.isError && <ErrorBox error={save.error} />}
      <div className="flex justify-end gap-2">
        <button className="btn-primary" disabled={save.isPending}>
          {save.isPending ? "Saving…" : client ? "Save changes" : "Add client"}
        </button>
      </div>
    </form>
  );
}
