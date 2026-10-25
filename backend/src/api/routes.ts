/** Route keys exposed by the HTTP API. Shared with the CDK stack so infra and handler cannot drift. */
export const ROUTES = [
  "GET /dashboard",
  "GET /hub",
  "PUT /hub",
  "GET /clients",
  "POST /clients",
  "GET /clients/{clientId}",
  "PUT /clients/{clientId}",
  "DELETE /clients/{clientId}",
  "GET /clients/{clientId}/tenders",
  "POST /clients/{clientId}/tenders",
  "GET /tenders/{tenderId}",
  "DELETE /tenders/{tenderId}",
  "GET /tenders/{tenderId}/document",
  "PATCH /tenders/{tenderId}/checklist/{itemId}",
  "POST /tenders/{tenderId}/ask",
] as const;

export type RouteKey = (typeof ROUTES)[number];
