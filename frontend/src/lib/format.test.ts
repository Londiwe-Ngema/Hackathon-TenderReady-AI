import { checklistProgress, openMandatoryCount, type ChecklistItem } from "@tenderready/shared";
import { describe, expect, it } from "vitest";
import { closingLabel, formatBytes } from "./format";

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000 + 3_600_000).toISOString();

describe("closingLabel", () => {
  it("flags urgency by days remaining", () => {
    expect(closingLabel(inDays(3))).toEqual({ text: "Closes in 4 days", tone: "red" });
    expect(closingLabel(inDays(10)).tone).toBe("amber");
    expect(closingLabel(inDays(30)).tone).toBe("slate");
    expect(closingLabel(inDays(-2)).text).toBe("Closed");
    expect(closingLabel(null).text).toBe("Closing date not found");
  });
});

describe("checklist progress", () => {
  const item = (status: ChecklistItem["status"], mandatory = true) => ({ status, mandatory }) as ChecklistItem;
  it("ignores N/A items and counts open mandatory items", () => {
    const items = [item("done"), item("todo"), item("n_a"), item("in_progress", false)];
    expect(checklistProgress(items)).toBe(33);
    expect(openMandatoryCount(items)).toBe(1);
    expect(checklistProgress([])).toBeNull();
  });
});

describe("formatBytes", () => {
  it("formats sizes", () => {
    expect(formatBytes(2_500_000)).toBe("2.4 MB");
    expect(formatBytes(2048)).toBe("2 KB");
  });
});
