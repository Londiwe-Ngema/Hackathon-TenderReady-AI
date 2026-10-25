import { describe, expect, it } from "vitest";
import { mergeAnalyses, normaliseAnalysis } from "../src/lib/analysis";
import { parseCitations } from "../src/lib/citations";

const raw = {
  summary: {
    title: "Supply of Office Furniture",
    reference: " RFQ 12/2026 ",
    closingDateText: "15 November 2026 at 11:00",
    closingDateTime: "2026-11-15T11:00:00+02:00",
    briefing: { compulsory: true, dateTime: "5 November 2026 10:00", venue: "Civic Centre" },
    evaluation: { preferenceSystem: "80/20", criteria: ["Price", "", "Specific goals"] },
    overview: "The municipality wants furniture.",
    sourcePages: { closingDateText: [1, 99] },
  },
  checklist: [
    { category: "Tax", requirement: "Valid SARS TCS PIN", mandatory: true, sourcePages: [2, 2, 50], sourceQuote: "TCS PIN", origin: "document" },
    { category: "Nonsense", requirement: "Company letterhead", mandatory: false, origin: "document" },
    { category: "Registration", requirement: "CSD registration", mandatory: true, sourcePages: [4], origin: "common_sa_practice" },
    { category: "Other", requirement: "" },
  ],
  risks: [{ title: "Missing briefing", severity: "extreme", explanation: "Bids will be rejected", sourcePages: [3] }],
};

describe("normaliseAnalysis", () => {
  const result = normaliseAnalysis(raw, 10);

  it("cleans summary fields and clamps pages to the document", () => {
    expect(result.summary.reference).toBe("RFQ 12/2026");
    expect(result.summary.issuingEntity).toBeNull();
    expect(result.summary.evaluation.criteria).toEqual(["Price", "Specific goals"]);
    expect(result.summary.sourcePages.closingDateText).toEqual([1]);
  });

  it("validates checklist categories and never marks common-practice items mandatory or sourced", () => {
    expect(result.checklist).toHaveLength(3);
    expect(result.checklist[0]).toMatchObject({ id: "c1", sourcePages: [2], status: "todo" });
    expect(result.checklist[1].category).toBe("Other");
    expect(result.checklist[2]).toMatchObject({ origin: "common_sa_practice", mandatory: false, sourcePages: [] });
  });

  it("defaults unknown risk severity", () => {
    expect(result.risks[0].severity).toBe("medium");
  });
});

describe("mergeAnalyses", () => {
  it("takes the first known summary values and de-duplicates checklist items", () => {
    const a = normaliseAnalysis(raw, 10);
    const b = normaliseAnalysis(
      {
        summary: { title: null, issuingEntity: "City of Tshwane", overview: "" },
        checklist: [{ category: "Tax", requirement: "Valid SARS TCS PIN.", mandatory: true, sourcePages: [8], origin: "document" }],
        risks: [{ title: "Late submission", severity: "high", explanation: "x" }],
      },
      10,
    );
    const merged = mergeAnalyses([a, b]);
    expect(merged.summary.title).toBe("Supply of Office Furniture");
    expect(merged.summary.issuingEntity).toBe("City of Tshwane");
    expect(merged.checklist.find((c) => c.requirement.startsWith("Valid SARS"))?.sourcePages).toEqual([2, 8]);
    expect(merged.checklist).toHaveLength(3);
    expect(merged.risks.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});

describe("parseCitations", () => {
  const pages = [1, 2, 3, 4, 5].map((page) => ({ page, text: `Heading ${page}\nbody` }));
  it("extracts single, list and range citations that exist in the document", () => {
    const answer = "Briefing is compulsory [p.3]. Submit forms [p. 2, 5] and pricing [pp.4-6]. Bogus [p.42].";
    expect(parseCitations(answer, pages).map((c) => c.page)).toEqual([2, 3, 4, 5]);
    expect(parseCitations(answer, pages)[0].quote).toBe("Heading 2");
  });
});
