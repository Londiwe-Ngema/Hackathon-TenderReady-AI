import { describe, expect, it, vi } from "vitest";
import { selectPagesForQuestion, stripRepeatedLines } from "../src/lib/document-text";
import { salvageTruncatedJson } from "../src/lib/llm/messages";

describe("salvageTruncatedJson", () => {
  it("keeps complete array items from an answer cut off mid-item", () => {
    const cut = '{"checklist":[{"requirement":"CSD","sourcePages":[2]},{"requirement":"TCS PIN","sourcePages":[2]},{"requirement":"MBD 1 and \\"MBD';
    expect(salvageTruncatedJson(cut)).toEqual({
      checklist: [
        { requirement: "CSD", sourcePages: [2] },
        { requirement: "TCS PIN", sourcePages: [2] },
      ],
    });
  });

  it("returns complete JSON as-is and gives up when nothing is complete", () => {
    expect(salvageTruncatedJson('noise {"a":[1,2]} trailing')).toEqual({ a: [1, 2] });
    expect(salvageTruncatedJson('{"checklist":[{"requirement":"CS')).toBeUndefined();
  });
});

describe("stripRepeatedLines", () => {
  const page = (n: number, body: string) => ({ page: n, text: `ACME MUNICIPALITY\nStrictly Confidential\n${body}\nPage ${n} of 6` });
  const pages = [1, 2, 3, 4, 5, 6].map((n) => page(n, `Unique content ${n}`));

  it("removes headers repeated on most pages and page-number lines, keeping them once on page 1", () => {
    const out = stripRepeatedLines(pages);
    expect(out[0].text).toBe("ACME MUNICIPALITY\nStrictly Confidential\nUnique content 1");
    expect(out[3].text).toBe("Unique content 4");
  });

  it("leaves short documents alone", () => {
    expect(stripRepeatedLines(pages.slice(0, 3))).toEqual(pages.slice(0, 3));
  });
});

describe("selectPagesForQuestion", () => {
  const pages = Array.from({ length: 30 }, (_, i) => ({
    page: i + 1,
    text: `tender tender tender page ${i + 1} ` + (i === 17 ? "the compulsory briefing session is at the civic centre" : "general conditions apply"),
  }));

  it("always includes page 1 and ranks pages by rare question terms", () => {
    const picked = selectPagesForQuestion(pages, "Where is the compulsory briefing for this tender?", 60).map((p) => p.page);
    expect(picked).toContain(1);
    expect(picked).toContain(18);
    expect(picked.length).toBeLessThan(30);
  });

  it("falls back to the earliest pages when nothing matches", () => {
    expect(selectPagesForQuestion(pages, "zzz qqq", 60).map((p) => p.page).slice(0, 3)).toEqual([1, 2, 3]);
  });
});

describe("analyseTender", () => {
  it("runs summary, checklist and risks as separate bounded calls and combines them", async () => {
    const structured = vi.fn(async (req: { schemaName: string; maxTokens: number }) => {
      if (req.schemaName === "record_tender_summary") return { summary: { title: "RFQ 1", overview: "o" } };
      if (req.schemaName === "record_compliance_checklist")
        return { checklist: [{ category: "Tax", requirement: "TCS PIN", mandatory: true, sourcePages: [1], origin: "document" }] };
      return { risks: [{ title: "Late bid", severity: "high", explanation: "x", sourcePages: [1] }] };
    });
    vi.resetModules();
    vi.doMock("../src/lib/llm", () => ({
      llm: () => ({ name: "workers-ai", modelId: "m", maxDocTokens: 90_000, readsScannedPdfs: false, structured, chat: vi.fn() }),
      buildTurns: vi.fn(),
    }));
    const { analyseTender } = await import("../src/lib/ai");
    const result = await analyseTender([{ page: 1, text: "Tender text" }]);
    expect(structured).toHaveBeenCalledTimes(3);
    expect(Math.max(...structured.mock.calls.map(([r]) => r.maxTokens))).toBeLessThanOrEqual(8_000);
    expect(result.summary.title).toBe("RFQ 1");
    expect(result.checklist[0].requirement).toBe("TCS PIN");
    expect(result.risks[0].title).toBe("Late bid");
    vi.doUnmock("../src/lib/llm");
  });
});

describe("pickPart", async () => {
  const { ANALYSIS_PARTS } = await import("../src/lib/analysis");
  const { pickPart } = await import("../src/lib/ai");
  const [summary, checklist] = ANALYSIS_PARTS;
  const items = [{ requirement: "CSD" }];

  it("accepts the requested key, a nested schema-name wrapper, a bare array or another array key", () => {
    expect(pickPart({ checklist: items }, checklist)).toEqual(items);
    expect(pickPart({ record_compliance_checklist: { checklist: items } }, checklist)).toEqual(items);
    expect(pickPart(items, checklist)).toEqual(items);
    expect(pickPart({ items }, checklist)).toEqual(items);
  });

  it("accepts summary fields at the top level or wrapped", () => {
    expect(pickPart({ title: "T", overview: "o" }, summary)).toEqual({ title: "T", overview: "o" });
    expect(pickPart({ tender_summary: { title: "T" } }, summary)).toEqual({ title: "T" });
    expect(pickPart({ nothing: 1 }, checklist)).toBeUndefined();
  });
});
