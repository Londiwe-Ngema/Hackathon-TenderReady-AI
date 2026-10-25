export type TenderStatus = "UPLOADING" | "UPLOADED" | "EXTRACTING" | "ANALYSING" | "READY" | "FAILED";

export const PROCESSING_STATUSES: TenderStatus[] = ["UPLOADING", "UPLOADED", "EXTRACTING", "ANALYSING"];

export interface HubProfile {
  hubName: string;
  advisorName: string;
}

export interface Client {
  clientId: string;
  name: string;
  regNo?: string;
  csdNumber?: string;
  bbbeeLevel?: string;
  cidbGrade?: string;
  sector?: string;
  contactName?: string;
  contactEmail?: string;
  createdAt: string;
}

export interface ClientWithStats extends Client {
  tenderCount: number;
  activeTenders: number;
  nextClosingDate: string | null;
  checklistProgress: number | null; // 0-100, checklist completion only — never award probability
  openMandatory: number;
}

export type ClientInput = Omit<Client, "clientId" | "createdAt">;

export interface Briefing {
  compulsory: boolean | null;
  dateTime: string | null;
  venue: string | null;
}

export interface TenderSummary {
  title: string | null;
  reference: string | null;
  issuingEntity: string | null;
  closingDateTime: string | null; // ISO 8601 where possible
  closingDateText: string | null; // as written in the tender
  briefing: Briefing;
  contractDuration: string | null;
  validityPeriod: string | null;
  submissionMethod: string | null;
  submissionAddress: string | null;
  evaluation: {
    preferenceSystem: string | null; // e.g. 80/20, 90/10
    functionalityThreshold: string | null;
    criteria: string[];
  };
  overview: string;
  sourcePages: Record<string, number[]>; // field name -> pages
}

export const CHECKLIST_CATEGORIES = [
  "Registration",
  "Tax",
  "B-BBEE",
  "SBD/MBD Forms",
  "Pricing",
  "Experience & References",
  "Technical",
  "Declarations",
  "Other",
] as const;
export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number];

export type ChecklistItemStatus = "todo" | "in_progress" | "done" | "n_a";

export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  requirement: string;
  mandatory: boolean;
  sourcePages: number[];
  sourceQuote: string | null;
  origin: "document" | "common_sa_practice";
  status: ChecklistItemStatus;
  note?: string;
}

export interface Risk {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  explanation: string;
  sourcePages: number[];
  sourceQuote: string | null;
}

export interface Tender {
  tenderId: string;
  clientId: string;
  clientName?: string;
  fileName: string;
  pageCount?: number;
  status: TenderStatus;
  statusReason?: string;
  createdAt: string;
  updatedAt: string;
  closingDate: string | null;
  summary?: TenderSummary;
  checklist?: ChecklistItem[];
  risks?: Risk[];
  modelId?: string;
}

export interface Citation {
  page: number;
  quote?: string;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
}

export interface UploadResponse {
  tenderId: string;
  uploadUrl: string;
}

export interface DashboardResponse {
  hub: HubProfile | null;
  stats: {
    clients: number;
    activeTenders: number;
    closingIn7Days: number;
    openMandatory: number;
  };
  upcoming: Array<Pick<Tender, "tenderId" | "clientId" | "clientName" | "fileName" | "closingDate" | "status"> & {
    title: string | null;
    highRisks: number;
    checklistProgress: number | null;
  }>;
}

export function checklistProgress(items: ChecklistItem[] | undefined): number | null {
  if (!items || items.length === 0) return null;
  const relevant = items.filter((i) => i.status !== "n_a");
  if (relevant.length === 0) return 100;
  return Math.round((relevant.filter((i) => i.status === "done").length / relevant.length) * 100);
}

export function openMandatoryCount(items: ChecklistItem[] | undefined): number {
  return (items ?? []).filter((i) => i.mandatory && i.status !== "done" && i.status !== "n_a").length;
}

export interface TenderListItem extends Omit<Tender, "summary" | "checklist" | "risks"> {
  title: string | null;
  checklistProgress: number | null;
  openMandatory: number;
  highRisks: number;
}
