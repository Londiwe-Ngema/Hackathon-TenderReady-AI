# Project status: Monday progress presentation

Status key: ✅ completed · 🟡 simulated or partly done · ⏳ outstanding.

## Completed ✅

| Area | What exists | Where |
|---|---|---|
| Frontend (all screens) | Login/sign-up/verify, hub dashboard, clients list + add/edit/delete, client detail + PDF upload, analysis progress stepper, tender report (Summary, Compliance checklist, Disqualification risks, Ask TenderReady), printable Compliance Pack, hub settings. Responsive from 390 px mobile to desktop. | `frontend/src` |
| Auth | Cognito user pool (email sign-in, verification, password policy). The JWT authorizer on API Gateway takes the hub id from the token `sub`. | `infra/lib/auth.ts`, `frontend/src/lib/auth.ts` |
| API | 15 routes on one Lambda router: clients CRUD, presigned upload/download, tender status, checklist PATCH with optimistic locking, Q&A | `backend/src/api` |
| Pipeline | S3 → EventBridge → Step Functions: PDF validation, page text from the PDF text layer (pdf.js), Claude transcription of scanned pages, Bedrock structured analysis, FAILED handling with readable reasons. Textract was replaced because it is not offered in eu-north-1, the only region the organisation allows. | `backend/src/pipeline`, `infra/lib/pipeline.ts` |
| AI | Forced tool-use JSON schema for analysis, South African procurement prompt, grounding rules, schema normalisation, long-document chunk and merge, document-grounded Q&A with validated `[p.N]` citations | `backend/src/lib/{prompts,analysis,bedrock,citations}.ts` |
| Infrastructure as code | One CDK stack in eu-north-1: S3 (private, SSE, TLS-only, 90-day expiry), DynamoDB, Cognito, HTTP API, Lambdas (Node 22 arm64), Step Functions, EventBridge, CloudFront + OAC, CloudWatch alarm, least-privilege IAM | `infra/` |
| Tests | 15 backend + 3 frontend unit tests: PDF text extraction (real generated PDF), scan detection, transcription parsing, chunking, analysis normalisation and merge, citations, rollups, key parsing, auth/routing. An end-to-end UI journey was run in headless Chromium on desktop and mobile with 0 console errors. | `backend/test` |
| Docs | Architecture diagram, demo script, this status page | `docs/` |

## Simulated 🟡 (clearly labelled in the UI)

- **Demo mode (`?demo=1`).** An in-browser simulated backend using fictional South African tenders. Every page shows a yellow banner, and Ask answers carry a "Simulated answers (demo)" badge. It is used automatically when no deployed `config.json` exists. This is the **backup demo**.
- **Document readiness (stretch goal).** The client document vault is captured by hand and stored only in the browser. Coverage is matched by keyword and is not AI-verified. The page is labelled "Preview, simulated".

## Outstanding ⏳

1. **Live AI on AWS.** The stack is deployed to eu-north-1, but Bedrock calls are blocked until AWS finishes verifying the new account. Once that clears, check that the organisation's region policy allows the EU cross-region inference profile, then test with a real tender.
2. Test on a long real tender: accuracy of dates and requirements, processing time and cost per document.
3. Bedrock Guardrails (PII and denied topics) on the Q&A route.
4. Official AWS Pricing Calculator export (see the proposal, section 6.1).
5. Multi-advisor hub organisations (invite colleagues, roles), plus e-mail or WhatsApp delivery of compliance packs to SMMEs.
6. Knowledge Base / vector retrieval for very long tender packs with addenda.
