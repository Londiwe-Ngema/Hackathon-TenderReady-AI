# TenderReady AI

**A digital compliance officer for SMME hubs, incubators and business support centres.** AWS AI Hackathon 2026 (Praesignis × AWS).

Hub advisors upload a client's tender or RFQ PDF and get back:
- a plain-language summary (closing date, compulsory briefing, evaluation, submission rules);
- a compliance checklist they can tick off (CSD, SARS TCS, B-BBEE, SBD/MBD forms, CIDB, pricing, references), with source page references;
- a list of disqualification risks;
- document-grounded Q&A;
- a printable compliance pack to hand to the SMME.

One advisor can prepare dozens of SMMEs to submit compliant bids.

- Architecture: [`docs/architecture.md`](docs/architecture.md)
- Status (completed, simulated, outstanding): [`docs/status.md`](docs/status.md)
- Demo script: [`docs/demo-script.md`](docs/demo-script.md)

## Repo layout

| Path | What |
|---|---|
| `frontend/` | React 18 + TypeScript + Vite + Tailwind v4 SPA (Amplify Auth for Cognito, TanStack Query) |
| `backend/` | Lambda handlers: `api/` (router) and `pipeline/` (PDF extraction + Bedrock steps), plus unit tests |
| `shared/` | Domain types and rollup helpers shared by the frontend and backend |
| `infra/` | AWS CDK app (one stack, eu-north-1) |

## Run locally (demo mode, no AWS needed)

```bash
pnpm install
pnpm dev            # http://localhost:5173 (no config.json, so demo mode is used automatically)
```

Demo mode simulates the backend with fictional South African tenders and is clearly bannered. Add `?demo=1` to any deployed URL to use it as the backup demo.

## Deploy to AWS

Prerequisites: Node 22+, pnpm, AWS CLI v2, and access to the target account.

```bash
aws login --profile tenderready             # from WSL: BROWSER=/mnt/c/Windows/explorer.exe aws login --profile tenderready
export AWS_PROFILE=tenderready AWS_REGION=eu-north-1   # the hackathon organisation only allows eu-north-1
pnpm --filter @tenderready/infra cdk bootstrap        # once per account/region
pnpm deploy                                           # builds the frontend, then deploys the stack
```

Bedrock model: `eu.anthropic.claude-sonnet-5-5` (an EU cross-region inference profile; requests stay in EU regions). Amazon Textract is not available in eu-north-1, so the pipeline reads the PDF text layer in Lambda and has Claude transcribe scanned pages.

To use a different model: `pnpm --filter @tenderready/infra cdk deploy -c modelId=<inference-profile-id>`.

The stack outputs `SiteUrl` (CloudFront), `ApiUrl`, `UserPoolId` and `UserPoolClientId`. The frontend reads them at runtime from `/config.json`, which the stack writes. To run the dev server against a deployed backend, create `frontend/.env.local` with `VITE_API_URL`, `VITE_REGION`, `VITE_USER_POOL_ID` and `VITE_USER_POOL_CLIENT_ID`.

Tear down with `pnpm --filter @tenderready/infra cdk destroy`. The buckets and table are set to be deleted with the stack.

## Checks

```bash
pnpm typecheck      # all packages
pnpm test           # backend unit tests (vitest)
pnpm --filter @tenderready/infra cdk synth
```

## Responsible AI

TenderReady supports bid preparation. It does not make procurement or legal decisions.
- Every AI output is labelled and cites tender pages.
- Requirements that come from general South African practice are marked separately from the tender's own requirements.
- Progress percentages measure checklist completion only, never eligibility or chance of award.
- Tender PDFs are private, encrypted and deleted after 90 days.
- Document content is never logged.
