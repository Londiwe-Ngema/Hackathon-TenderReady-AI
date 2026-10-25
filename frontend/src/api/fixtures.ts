import type { ChecklistItem, Client, HubProfile, Risk, Tender, TenderSummary } from "@tenderready/shared";

// Fictional demo data used for the offline/backup demo. Organisations and tenders are invented.

const DAY = 86_400_000;
const at = (daysFromNow: number, hour = 11) => {
  const d = new Date(Date.now() + daysFromNow * DAY);
  d.setUTCHours(hour - 2, 0, 0, 0); // SAST
  return d.toISOString().replace(".000Z", "Z");
};

export const demoHub: HubProfile = { hubName: "Ekurhuleni Enterprise Hub", advisorName: "Demo Advisor" };

export const demoClients: Client[] = [
  {
    clientId: "cl-ubuntu",
    name: "Ubuntu Solar & Electrical (Pty) Ltd",
    regNo: "2019/123456/07",
    csdNumber: "MAAA0912345",
    bbbeeLevel: "Level 1 (EME)",
    cidbGrade: "3EP",
    sector: "Electrical & renewable energy",
    contactName: "Sipho Ndlovu",
    contactEmail: "sipho@example.co.za",
    createdAt: at(-40),
  },
  {
    clientId: "cl-kasi",
    name: "Kasi Fresh Catering CC",
    regNo: "2015/045678/23",
    csdNumber: "MAAA0456789",
    bbbeeLevel: "Level 2 (QSE)",
    sector: "Catering & food services",
    contactName: "Lerato Mokoena",
    contactEmail: "lerato@example.co.za",
    createdAt: at(-32),
  },
  {
    clientId: "cl-mzansi",
    name: "Mzansi Office Supplies (Pty) Ltd",
    regNo: "2021/778899/07",
    bbbeeLevel: "Level 1 (EME)",
    sector: "Office furniture & stationery",
    contactName: "Pieter van Wyk",
    contactEmail: "pieter@example.co.za",
    createdAt: at(-20),
  },
  {
    clientId: "cl-thandeka",
    name: "Thandeka Cleaning Services",
    regNo: "2023/334455/07",
    bbbeeLevel: "Level 1 (EME)",
    sector: "Cleaning & hygiene",
    contactName: "Thandeka Dlamini",
    contactEmail: "thandeka@example.co.za",
    createdAt: at(-5),
  },
];

const item = (
  id: string,
  category: ChecklistItem["category"],
  requirement: string,
  pages: number[],
  quote: string | null,
  status: ChecklistItem["status"] = "todo",
  mandatory = true,
): ChecklistItem => ({
  id,
  category,
  requirement,
  mandatory,
  sourcePages: pages,
  sourceQuote: quote,
  origin: "document",
  status,
});

const common = (id: string, category: ChecklistItem["category"], requirement: string): ChecklistItem => ({
  id,
  category,
  requirement,
  mandatory: false,
  sourcePages: [],
  sourceQuote: null,
  origin: "common_sa_practice",
  status: "todo",
});

export function solarAnalysis(closing: string): { summary: TenderSummary; checklist: ChecklistItem[]; risks: Risk[] } {
  return {
    summary: {
      title: "Supply, Delivery and Installation of 120 Solar-Powered LED Street Lights",
      reference: "RLM/SCM/RFQ/014/2026",
      issuingEntity: "Rietfontein Local Municipality (fictional)",
      closingDateText: `${new Date(closing).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })} at 11:00`,
      closingDateTime: closing,
      briefing: {
        compulsory: true,
        dateTime: new Date(Date.parse(closing) - 4 * DAY).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) + " at 10:00",
        venue: "Municipal Technical Services Boardroom, 14 Church Street, Rietfontein",
      },
      contractDuration: "Once-off supply and installation, completion within 12 weeks of appointment, plus 12-month maintenance period",
      validityPeriod: "90 days from the closing date",
      submissionMethod: "Sealed envelope deposited in the tender box (no e-mail or fax submissions)",
      submissionAddress: "Tender Box, Ground Floor, Rietfontein Civic Centre, 1 Main Road, Rietfontein",
      evaluation: {
        preferenceSystem: "80/20 preference point system (PPPFA 2022 Regulations)",
        functionalityThreshold: "Minimum 70 out of 100 points for functionality",
        criteria: [
          "Phase 1: Administrative compliance (mandatory documents)",
          "Phase 2: Functionality — experience (40), technical specification (30), project plan (20), team (10)",
          "Phase 3: Price (80) and specific goals (20)",
        ],
      },
      overview:
        "The municipality wants a contractor to supply and install 120 solar-powered LED street lights in Wards 4 and 7, and to maintain them for 12 months. You must attend the compulsory briefing session, and your bid must reach the tender box before 11:00 on the closing date. Bids are checked for compulsory documents first, then scored on functionality (you need at least 70/100), and only then on price and B-BBEE specific goals. A CIDB grading of 3EP or higher is required.",
      sourcePages: { closingDateText: [1], briefing: [1, 4], reference: [1], evaluation: [9, 10], contractDuration: [5] },
    },
    checklist: [
      item("c1", "Registration", "Proof of registration on the Central Supplier Database (CSD) — attach CSD summary report", [6], "Bidders must be registered on the CSD and attach a CSD report not older than 30 days.", "done"),
      item("c2", "Registration", "CIDB registration at grading 3EP or higher", [6], "Only bidders with a CIDB grading of 3EP or higher will be considered.", "done"),
      item("c3", "Registration", "Company registration documents (CIPC certificate) and certified ID copies of directors", [6], "Certified copies of company registration documents and IDs of all directors.", "in_progress"),
      item("c4", "Tax", "Valid SARS Tax Compliance Status (TCS) PIN", [6], "The bidder's tax matters must be in order; provide a valid TCS PIN.", "done"),
      item("c5", "Tax", "Municipal rates and taxes clearance (not in arrears for more than 90 days)", [7], "Proof that municipal accounts of the bidder and directors are not in arrears for more than 90 days."),
      item("c6", "B-BBEE", "B-BBEE certificate or sworn affidavit (EME/QSE) to claim specific-goal points", [10], "Failure to submit proof will result in zero points for specific goals.", "done", false),
      item("c7", "SBD/MBD Forms", "MBD 1 — Invitation to bid, completed and signed", [2], "MBD 1 must be completed and signed by an authorised person."),
      item("c8", "SBD/MBD Forms", "MBD 4 — Declaration of interest", [12], "MBD 4 must be completed and signed."),
      item("c9", "SBD/MBD Forms", "MBD 6.1 — Preference points claim form", [13], "MBD 6.1 must be completed to claim preference points.", "todo", false),
      item("c10", "SBD/MBD Forms", "MBD 8 and MBD 9 — Past supply chain practices and certificate of independent bid determination", [15, 16], "MBD 8 and MBD 9 must be completed and signed."),
      item("c11", "Pricing", "Completed and signed bill of quantities / pricing schedule (no alterations, in black ink)", [18], "The pricing schedule must be completed in black ink. Correction fluid may not be used."),
      item("c12", "Experience & References", "At least 3 reference letters for similar solar/electrical installation projects in the last 5 years", [9], "Provide a minimum of three reference letters for similar work completed in the past five years.", "in_progress"),
      item("c13", "Technical", "Product datasheets and IEC certification for proposed solar LED luminaires", [8], "Attach datasheets and certificates of compliance (IEC 62124 / IEC 60598)."),
      item("c14", "Technical", "Project plan with programme showing completion within 12 weeks", [9], "A detailed project plan and programme must be submitted."),
      item("c15", "Declarations", "Signed attendance register / certificate from the compulsory briefing session", [1, 4], "Bidders who fail to attend the compulsory briefing session will be disqualified."),
      item("c16", "Declarations", "Letter of authority for the signatory (company resolution)", [2], "Proof of authority to sign the bid."),
      common("c17", "Other", "Keep a certified copy of the full submission and proof of delivery (stamped register)"),
    ],
    risks: [
      {
        id: "r1",
        title: "Not attending the compulsory briefing session",
        severity: "high",
        explanation: "The tender states that bidders who do not attend and sign the briefing register will be disqualified. Make sure a representative attends in person and signs the register.",
        sourcePages: [1, 4],
        sourceQuote: "Bidders who fail to attend the compulsory briefing session will be disqualified.",
      },
      {
        id: "r2",
        title: "Late or incorrectly submitted bid",
        severity: "high",
        explanation: "Only sealed bids in the tender box before 11:00 on the closing date are accepted. E-mailed or faxed bids will be rejected.",
        sourcePages: [1, 3],
        sourceQuote: "Late bids, and bids submitted by e-mail or fax, will not be accepted.",
      },
      {
        id: "r3",
        title: "CIDB grading below 3EP",
        severity: "high",
        explanation: "Bidders without an active CIDB 3EP (or higher) grading will not be considered. Check that the registration is active on the CIDB register before the closing date.",
        sourcePages: [6],
        sourceQuote: "Only bidders with a CIDB grading of 3EP or higher will be considered.",
      },
      {
        id: "r4",
        title: "Scoring below 70 points on functionality",
        severity: "medium",
        explanation: "Bids that score below 70/100 on functionality are not evaluated on price. Strong reference letters and a clear project plan matter.",
        sourcePages: [9],
        sourceQuote: "Bidders scoring less than 70 points for functionality will not be evaluated further.",
      },
      {
        id: "r5",
        title: "Altered pricing schedule or use of correction fluid",
        severity: "medium",
        explanation: "The pricing schedule must be completed in black ink without correction fluid; alterations must be initialled.",
        sourcePages: [18],
        sourceQuote: "Correction fluid may not be used.",
      },
      {
        id: "r6",
        title: "Municipal accounts in arrears",
        severity: "low",
        explanation: "Bidders or directors whose municipal accounts are more than 90 days in arrears may be excluded.",
        sourcePages: [7],
        sourceQuote: "not in arrears for more than 90 days",
      },
    ],
  };
}

function simpleAnalysis(
  title: string,
  reference: string,
  entity: string,
  closing: string,
  overview: string,
  extra: ChecklistItem[],
  done: string[] = [],
): { summary: TenderSummary; checklist: ChecklistItem[]; risks: Risk[] } {
  const base: ChecklistItem[] = [
    item("c1", "Registration", "Proof of CSD registration (CSD summary report)", [3], "Attach a CSD registration report."),
    item("c2", "Tax", "Valid SARS Tax Compliance Status PIN", [3], "Provide a valid TCS PIN."),
    item("c3", "SBD/MBD Forms", "SBD 1 — Invitation to bid, signed", [1], "SBD 1 must be completed and signed."),
    item("c4", "SBD/MBD Forms", "SBD 4 — Bidder's disclosure", [5], "SBD 4 must be completed."),
    item("c5", "SBD/MBD Forms", "SBD 6.1 — Preference points claim", [6], "Complete SBD 6.1 to claim points.", "todo", false),
    item("c6", "Pricing", "Completed SBD 3.1 pricing schedule (firm prices, VAT inclusive)", [4], "Prices must be firm and include VAT."),
    ...extra,
  ].map((c) => ({ ...c, status: done.includes(c.id) ? "done" : c.status }));
  return {
    summary: {
      title,
      reference,
      issuingEntity: entity,
      closingDateText: new Date(closing).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) + " at 11:00",
      closingDateTime: closing,
      briefing: { compulsory: false, dateTime: null, venue: null },
      contractDuration: "12 months",
      validityPeriod: "60 days",
      submissionMethod: "E-mail submission to the SCM unit",
      submissionAddress: null,
      evaluation: { preferenceSystem: "80/20", functionalityThreshold: null, criteria: ["Price (80)", "Specific goals (20)"] },
      overview,
      sourcePages: { closingDateText: [1] },
    },
    checklist: base,
    risks: [
      {
        id: "r1",
        title: "Unsigned SBD forms",
        severity: "high",
        explanation: "Bids with unsigned standard bidding documents will be regarded as non-responsive.",
        sourcePages: [2],
        sourceQuote: "Unsigned bids will be regarded as non-responsive.",
      },
      {
        id: "r2",
        title: "Tax matters not in order",
        severity: "medium",
        explanation: "Tax compliance is checked on CSD before award; non-compliant bidders get 7 days to fix it or are disqualified.",
        sourcePages: [3],
        sourceQuote: "Bidders whose tax matters are not in order will be given 7 working days to rectify.",
      },
    ],
  };
}

function tender(id: string, clientId: string, fileName: string, analysis: ReturnType<typeof solarAnalysis>, created: number, pageCount: number): Tender {
  return {
    tenderId: id,
    clientId,
    fileName,
    pageCount,
    status: "READY",
    createdAt: at(created),
    updatedAt: at(created),
    closingDate: analysis.summary.closingDateTime,
    ...analysis,
    modelId: "demo-fixture",
  };
}

export function demoTenders(): Tender[] {
  return [
    tender("t-solar", "cl-ubuntu", "RLM-RFQ-014-2026-Solar-Street-Lights.pdf", solarAnalysis(at(6)), -3, 24),
    tender(
      "t-nutrition",
      "cl-kasi",
      "School-Nutrition-Programme-RFQ-2026-07.pdf",
      simpleAnalysis(
        "Provision of Catering Services for the School Nutrition Programme (Cluster B)",
        "GDE/NSNP/RFQ/2026/07",
        "Provincial Department of Education (fictional)",
        at(12),
        "The department needs a caterer to prepare and deliver daily meals to 6 primary schools for 12 months. Bids are e-mailed, there is no briefing session, and bids are scored on price (80) and specific goals (20). You need a valid certificate of acceptability for food premises.",
        [item("c7", "Technical", "Certificate of Acceptability (R638) for food premises", [7], "Bidders must provide a valid Certificate of Acceptability.")],
        ["c1", "c2", "c3"],
      ),
      -6,
      16,
    ),
    tender(
      "t-furniture",
      "cl-mzansi",
      "Office-Furniture-Quotation-RFQ-118.pdf",
      simpleAnalysis(
        "Supply and Delivery of Office Furniture to the District Office",
        "RFQ 118/2026",
        "District Health Office (fictional)",
        at(20),
        "The district office wants quotes for desks, chairs and filing cabinets delivered within 30 days of the order. Quotes are e-mailed and scored on price and specific goals. Locally manufactured furniture is required under the local content rules.",
        [item("c7", "Declarations", "SBD 6.2 — Declaration of local production and content (furniture)", [8], "Local content of 85% is required for office furniture.")],
      ),
      -1,
      9,
    ),
  ];
}

export const DEMO_ANSWERS: Array<{ match: RegExp; answer: string }> = [
  {
    match: /document|submit|attach|need/i,
    answer:
      "You need to submit the following with this bid:\n\n- CSD registration report not older than 30 days [p.6]\n- CIDB registration at 3EP or higher [p.6]\n- CIPC company documents and certified IDs of directors [p.6]\n- Valid SARS Tax Compliance Status PIN [p.6]\n- Municipal rates clearance (not more than 90 days in arrears) [p.7]\n- Completed and signed MBD 1, MBD 4, MBD 6.1, MBD 8 and MBD 9 [p.2] [p.12] [p.13] [p.15]\n- Signed pricing schedule in black ink [p.18]\n- Three reference letters for similar work [p.9]\n- Product datasheets and IEC certificates [p.8]\n- Proof of attendance at the compulsory briefing [p.4]\n\nA B-BBEE certificate or sworn affidavit is needed to claim specific-goal points [p.10].",
  },
  {
    match: /brief|site|meeting/i,
    answer:
      "Yes, the briefing session is **compulsory** [p.1]. It is held at the Municipal Technical Services Boardroom, 14 Church Street, Rietfontein, at 10:00, four days before the closing date [p.4]. Bidders who do not attend and sign the attendance register will be disqualified [p.4].",
  },
  {
    match: /disqualif|reject|risk|trap/i,
    answer:
      "The tender lists these conditions that could get a bid disqualified or excluded:\n\n- Not attending the compulsory briefing session [p.4]\n- Late bids, or bids sent by e-mail or fax [p.3]\n- No CIDB grading of 3EP or higher [p.6]\n- Scoring under 70 points for functionality [p.9]\n- Using correction fluid on the pricing schedule [p.18]\n- Municipal accounts more than 90 days in arrears [p.7]",
  },
  {
    match: /evaluat|score|point|criteria/i,
    answer:
      "Evaluation happens in three phases [p.9]:\n\n1. **Administrative compliance**: all compulsory documents must be present.\n2. **Functionality** (minimum 70/100): experience 40, technical specification 30, project plan 20, team 10 [p.9].\n3. **Price and specific goals** under the 80/20 preference point system [p.10].",
  },
  {
    match: /experience|reference/i,
    answer:
      "The company must provide at least **three reference letters** for similar solar or electrical installation projects completed in the last five years [p.9]. Experience is worth 40 of the 100 functionality points [p.9].",
  },
  {
    match: /date|deadline|when|clos/i,
    answer:
      "Key dates:\n\n- **Compulsory briefing**: 10:00, four days before closing [p.4]\n- **Closing**: 11:00 on the closing date shown in the summary [p.1]\n- **Bid validity**: 90 days from closing [p.3]\n- **Completion**: within 12 weeks of appointment [p.5]",
  },
];
