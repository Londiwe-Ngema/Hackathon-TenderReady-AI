import type {
  AskResponse,
  ChecklistItem,
  ChecklistItemStatus,
  Client,
  ClientInput,
  ClientWithStats,
  DashboardResponse,
  HubProfile,
  Tender,
  TenderListItem,
} from "@tenderready/shared";

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface Api {
  dashboard(): Promise<DashboardResponse>;
  getHub(): Promise<HubProfile | null>;
  putHub(profile: HubProfile): Promise<HubProfile>;
  listClients(): Promise<ClientWithStats[]>;
  getClient(clientId: string): Promise<ClientWithStats>;
  createClient(input: ClientInput): Promise<Client>;
  updateClient(clientId: string, input: ClientInput): Promise<Client>;
  deleteClient(clientId: string): Promise<void>;
  listTenders(clientId: string): Promise<TenderListItem[]>;
  uploadTender(clientId: string, file: File, onProgress: (pct: number) => void): Promise<string>;
  getTender(tenderId: string): Promise<Tender>;
  deleteTender(tenderId: string): Promise<void>;
  documentUrl(tenderId: string): Promise<string | null>;
  updateChecklistItem(
    tenderId: string,
    itemId: string,
    patch: { status?: ChecklistItemStatus; note?: string },
  ): Promise<ChecklistItem>;
  ask(tenderId: string, question: string, history: ChatTurn[]): Promise<AskResponse>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
