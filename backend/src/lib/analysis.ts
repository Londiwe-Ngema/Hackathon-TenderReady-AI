import {
  CHECKLIST_CATEGORIES,
  type ChecklistCategory,
  type ChecklistItem,
  type Risk,
  type TenderSummary,
} from "@tenderready/shared";

export const MAX_CHECKLIST_ITEMS = 40;
export const MAX_RISKS = 12;
const MAX_QUOTE = 200;

const nullableString = { type: ["string", "null"] };
const pages = { type: "array", items: { type: "integer" } };
const quote = { type: ["string", "null"], maxLength: MAX_QUOTE };

const SUMMARY_SCHEMA = {
  type: "object",
  required: [
    "title",
    "reference",
    "issuingEntity",
    "closingDateText",
    "closingDateTime",
    "briefing",
    "contractDuration",
    "validityPeriod",
    "submissionMethod",
    "submissionAddress",
    "evaluation",
    "overview",
    "sourcePages",
  ],
  properties: {
    title: nullableString,
    reference: nullableString,
    issuingEntity: nullableString,
    closingDateText: nullableString,
    closingDateTime: { ...nullableString, description: "ISO 8601 with +02:00 offset, or null" },
    briefing: {
      type: "object",
      required: ["compulsory", "dateTime", "venue"],
      properties: {
        compulsory: { type: ["boolean", "null"] },
        dateTime: nullableString,
        venue: nullableString,
      },
    },
    contractDuration: nullableString,
    validityPeriod: nullableString,
    submissionMethod: nullableString,
    submissionAddress: nullableString,
    evaluation: {
      type: "object",
      required: ["preferenceSystem", "functionalityThreshold", "criteria"],
      properties: {
        preferenceSystem: nullableString,
        functionalityThreshold: nullableString,
        criteria: { type: "array", items: { type: "string" }, maxItems: 10 },
      },
    },
    overview: { type: "string", maxLength: 1200 },
    sourcePages: {
      type: "object",
      description: 'Map of summary field name to the pages it was found on, e.g. {"closingDateText":[1]}',
      additionalProperties: pages,
    },
  },
};

const CHECKLIST_ITEM_SCHEMA = {
  type: "object",
  required: ["category", "requirement", "mandatory", "sourcePages", "sourceQuote", "origin"],
  properties: {
    category: { type: "string", enum: [...CHECKLIST_CATEGORIES] },
    requirement: { type: "string", maxLength: 250 },
    mandatory: { type: "boolean" },
    sourcePages: pages,
    sourceQuote: quote,
    origin: { type: "string", enum: ["document", "common_sa_practice"] },
  },
};

const RISK_ITEM_SCHEMA = {
  type: "object",
  required: ["title", "severity", "explanation", "sourcePages", "sourceQuote"],
  properties: {
    title: { type: "string", maxLength: 120 },
    severity: { type: "string", enum: ["high", "medium", "low"] },
    explanation: { type: "string", maxLength: 400 },
    sourcePages: pages,
    sourceQuote: quote,
  },
};

export interface AnalysisPart {
  key: "summary" | "checklist" | "risks";
  schemaName: string;
  schema: Record<string, unknown>;
  instruction: string;
  maxTokens: number;
}

/**
 * The analysis is split into three independent calls that run in parallel. Each has a small, bounded
 * output, so long tenders can't produce one oversized answer that is cut off or times out.
 */
export const ANALYSIS_PARTS: AnalysisPart[] = [
  {
    key: "summary",
    schemaName: "record_tender_summary",
    schema: { type: "object", required: ["summary"], properties: { summary: SUMMARY_SCHEMA } },
    instruction: "Record the tender summary: key details, the evaluation approach and a plain-language overview.",
    maxTokens: 3_000,
  },
  {
    key: "checklist",
    schemaName: "record_compliance_checklist",
    schema: {
      type: "object",
      required: ["checklist"],
      properties: { checklist: { type: "array", items: CHECKLIST_ITEM_SCHEMA, maxItems: MAX_CHECKLIST_ITEMS } },
    },
    instruction: `Record the compliance checklist: every document, form, registration or action a bidder must provide or complete. Combine closely related items so there are at most ${MAX_CHECKLIST_ITEMS} items, list mandatory items first, and keep each sourceQuote under ${MAX_QUOTE} characters.`,
    maxTokens: 8_000,
  },
  {
    key: "risks",
    schemaName: "record_disqualification_risks",
    schema: {
      type: "object",
      required: ["risks"],
      properties: { risks: { type: "array", items: RISK_ITEM_SCHEMA, maxItems: MAX_RISKS } },
    },
    instruction: `Record the conditions that could get a bid disqualified or marked non-responsive. At most ${MAX_RISKS} risks, most severe first, each sourceQuote under ${MAX_QUOTE} characters.`,
    maxTokens: 3_000,
  },
];

export interface AnalysisResult {
  summary: TenderSummary;
  checklist: ChecklistItem[];
  risks: Risk[];
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const pageList = (v: unknown): number[] =>
  Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b) : [];
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

function category(v: unknown): ChecklistCategory {
  return (CHECKLIST_CATEGORIES as readonly string[]).includes(v as string) ? (v as ChecklistCategory) : "Other";
}

function isoOrNull(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  return Number.isNaN(Date.parse(s)) ? null : s;
}

/** Validates and normalises raw tool output from the model into our domain types. Defensive: models can omit fields. */
export function normaliseAnalysis(raw: unknown, maxPage: number): AnalysisResult {
  const r = obj(raw);
  const s = obj(r.summary);
  const briefing = obj(s.briefing);
  const evaluation = obj(s.evaluation);
  const clampPages = (v: unknown) => pageList(v).filter((p) => p <= maxPage);

  const sourcePages: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(obj(s.sourcePages))) sourcePages[k] = clampPages(v);

  const summary: TenderSummary = {
    title: str(s.title),
    reference: str(s.reference),
    issuingEntity: str(s.issuingEntity),
    closingDateText: str(s.closingDateText),
    closingDateTime: isoOrNull(s.closingDateTime),
    briefing: {
      compulsory: typeof briefing.compulsory === "boolean" ? briefing.compulsory : null,
      dateTime: str(briefing.dateTime),
      venue: str(briefing.venue),
    },
    contractDuration: str(s.contractDuration),
    validityPeriod: str(s.validityPeriod),
    submissionMethod: str(s.submissionMethod),
    submissionAddress: str(s.submissionAddress),
    evaluation: {
      preferenceSystem: str(evaluation.preferenceSystem),
      functionalityThreshold: str(evaluation.functionalityThreshold),
      criteria: Array.isArray(evaluation.criteria) ? evaluation.criteria.map(str).filter((c): c is string => !!c) : [],
    },
    overview: str(s.overview) ?? "",
    sourcePages,
  };

  const checklist: ChecklistItem[] = (Array.isArray(r.checklist) ? r.checklist : [])
    .slice(0, MAX_CHECKLIST_ITEMS)
    .map(obj)
    .filter((c) => str(c.requirement))
    .map((c, i) => {
      const origin = c.origin === "common_sa_practice" ? "common_sa_practice" : "document";
      return {
        id: `c${i + 1}`,
        category: category(c.category),
        requirement: str(c.requirement)!,
        mandatory: origin === "document" && c.mandatory === true,
        sourcePages: origin === "document" ? clampPages(c.sourcePages) : [],
        sourceQuote: origin === "document" ? str(c.sourceQuote) : null,
        origin,
        status: "todo",
      } satisfies ChecklistItem;
    });

  const severities = ["high", "medium", "low"] as const;
  const risks: Risk[] = (Array.isArray(r.risks) ? r.risks : [])
    .slice(0, MAX_RISKS)
    .map(obj)
    .filter((x) => str(x.title))
    .map((x, i) => ({
      id: `r${i + 1}`,
      title: str(x.title)!,
      severity: severities.includes(x.severity as never) ? (x.severity as Risk["severity"]) : "medium",
      explanation: str(x.explanation) ?? "",
      sourcePages: clampPages(x.sourcePages),
      sourceQuote: str(x.sourceQuote),
    }));

  return { summary, checklist, risks };
}

const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Merges per-chunk analyses of a long tender: first non-null summary field wins, list items are de-duplicated. */
export function mergeAnalyses(parts: AnalysisResult[]): AnalysisResult {
  if (parts.length === 1) return parts[0];
  const first = <T>(pick: (a: AnalysisResult) => T | null): T | null =>
    parts.map(pick).find((v) => v !== null && v !== undefined) ?? null;

  const summary: TenderSummary = {
    title: first((a) => a.summary.title),
    reference: first((a) => a.summary.reference),
    issuingEntity: first((a) => a.summary.issuingEntity),
    closingDateText: first((a) => a.summary.closingDateText),
    closingDateTime: first((a) => a.summary.closingDateTime),
    briefing: {
      compulsory: first((a) => a.summary.briefing.compulsory),
      dateTime: first((a) => a.summary.briefing.dateTime),
      venue: first((a) => a.summary.briefing.venue),
    },
    contractDuration: first((a) => a.summary.contractDuration),
    validityPeriod: first((a) => a.summary.validityPeriod),
    submissionMethod: first((a) => a.summary.submissionMethod),
    submissionAddress: first((a) => a.summary.submissionAddress),
    evaluation: {
      preferenceSystem: first((a) => a.summary.evaluation.preferenceSystem),
      functionalityThreshold: first((a) => a.summary.evaluation.functionalityThreshold),
      criteria: [...new Set(parts.flatMap((a) => a.summary.evaluation.criteria))],
    },
    overview: parts.map((a) => a.summary.overview).find((o) => o) ?? "",
    sourcePages: Object.assign({}, ...parts.map((a) => a.summary.sourcePages).reverse()),
  };

  const checklist = new Map<string, ChecklistItem>();
  for (const item of parts.flatMap((a) => a.checklist)) {
    const key = normKey(item.requirement);
    const existing = checklist.get(key);
    if (!existing) checklist.set(key, { ...item });
    else {
      existing.mandatory ||= item.mandatory;
      existing.sourcePages = [...new Set([...existing.sourcePages, ...item.sourcePages])].sort((a, b) => a - b);
      existing.sourceQuote ??= item.sourceQuote;
      if (item.origin === "document") existing.origin = "document";
    }
  }
  const risks = new Map<string, Risk>();
  for (const risk of parts.flatMap((a) => a.risks)) {
    const key = normKey(risk.title);
    if (!risks.has(key)) risks.set(key, { ...risk });
  }

  return {
    summary,
    checklist: [...checklist.values()].map((c, i) => ({ ...c, id: `c${i + 1}` })),
    risks: [...risks.values()].map((r, i) => ({ ...r, id: `r${i + 1}` })),
  };
}
