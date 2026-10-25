// Single-table key helpers. The hub id is always the Cognito `sub` of the signed-in advisor.
export const hubPk = (hubId: string) => `HUB#${hubId}`;
export const PROFILE_SK = "PROFILE";
export const clientSk = (clientId: string) => `CLIENT#${clientId}`;
export const tenderSk = (tenderId: string) => `TENDER#${tenderId}`;

export const tenderObjectKey = (hubId: string, clientId: string, tenderId: string) =>
  `hubs/${hubId}/clients/${clientId}/tenders/${tenderId}.pdf`;
export const extractedObjectKey = (hubId: string, tenderId: string) => `extracted/${hubId}/${tenderId}.json`;
export const clientPrefix = (hubId: string, clientId: string) => `hubs/${hubId}/clients/${clientId}/`;

export interface TenderRef {
  hubId: string;
  clientId: string;
  tenderId: string;
}

const TENDER_KEY_RE = /^hubs\/([^/]+)\/clients\/([^/]+)\/tenders\/([^/]+)\.pdf$/;

export function parseTenderObjectKey(key: string): TenderRef {
  const match = TENDER_KEY_RE.exec(decodeURIComponent(key.replace(/\+/g, " ")));
  if (!match) throw new Error(`Unexpected tender object key: ${key}`);
  return { hubId: match[1], clientId: match[2], tenderId: match[3] };
}
