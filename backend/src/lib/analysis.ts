import {
  CHECKLIST_CATEGORIES,
  type ChecklistCategory,
  type ChecklistItem,
  type Risk,
  type TenderSummary,
} from "@tenderready/shared";

export const ANALYSIS_TOOL_NAME = "record_tender_analysis";

const nullableString = { type: ["string", "null"] };
const pages = { type: "array", items: { type: "integer" } };

export const ANALYSIS_TOOL_SCHEMA = {
  type: "object",
  required: ["summary", "checklist", "risks"],
  properties: {
    summary: {
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
            criteria: { type: "array", items: { type: "string" } },
          },
        },
        overview: { type: "string" },
        sourcePages: {
          type: "object",
          description: "Map of summary field name to the pages it was found on, e.g. {\"closingDateText\":[1]}",
          additionalProperties: pages,
        },
      },
    },
    checklist: {
      type: "array",
      items: {
        type: "object",
        required: ["category", "requirement", "mandatory", "sourcePages", "sourceQuote", "origin"],
        properties: {
          category: { type: "string", enum: [...CHECKLIST_CATEGORIES] },
          requirement: { type: "string" },
          mandatory: { type: "boolean" },
          sourcePages: pages,
          sourceQuote: nullableString,
          origin: { type: "string", enum: ["document", "common_sa_practice"] },
        },
      },
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "severity", "explanation", "sourcePages", "sourceQuote"],
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          explanation: { type: "string" },
          sourcePages: pages,
          sourceQuote: nullableString,
        },
      },
    },
  },
} as const;

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
