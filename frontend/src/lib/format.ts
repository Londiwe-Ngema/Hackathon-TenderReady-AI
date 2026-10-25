const dateFmt = new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Johannesburg",
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateTimeFmt.format(d);
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

export function closingLabel(iso: string | null | undefined): { text: string; tone: "red" | "amber" | "slate" } {
  const d = daysUntil(iso);
  if (d === null) return { text: "Closing date not found", tone: "slate" };
  if (d < 0) return { text: "Closed", tone: "slate" };
  if (d === 0) return { text: "Closes today", tone: "red" };
  if (d <= 7) return { text: `Closes in ${d} day${d === 1 ? "" : "s"}`, tone: "red" };
  if (d <= 14) return { text: `Closes in ${d} days`, tone: "amber" };
  return { text: `Closes in ${d} days`, tone: "slate" };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");
