# Demo script (about 7 minutes)

**Before you start:** sign in on the deployed site, with one client already created and the sample tender analysed (it takes 1–3 minutes). Keep a second browser tab open on `https://<site>/?demo=1` as a backup.

1. **Problem (30 s).** Tender packs run to 50+ pages. One missed compulsory briefing or unsigned SBD form and the bid is disqualified. Hub advisors support dozens of SMMEs with very little time each.
2. **Solution (30 s).** TenderReady is a digital compliance officer *for the hub*. One advisor uses it to prepare many SMMEs.
3. **Hub dashboard.** Point out the portfolio tiles (clients, active tenders, closing in 7 days, open mandatory items) and the deadline list across all clients.
4. **Add a client.** Show the compliance profile fields (CSD, B-BBEE, CIDB).
5. **Upload a tender.** Drag the sample PDF in, show the selected file and upload progress, then the stepper (Uploaded → Extracting text → AI analysis → Ready). Optionally show the Step Functions execution graph in the AWS console.
6. **Summary.** Show the closing date, the compulsory briefing and the evaluation. Click a `p.N` chip to open the original PDF at that page ("verify against the source").
7. **Compliance checklist.** Show the categories, mandatory flags, verbatim quotes, and an item marked "General SA practice, not stated in this tender". Tick items and add a note. Explain that progress shows preparation, not eligibility.
8. **Disqualification risks.** Show the high-severity traps with their source quotes.
9. **Ask TenderReady.** Ask "What documents do I need to submit?" and show the cited pages. Then ask something the tender doesn't cover and show that it answers "not stated in the tender".
10. **Compliance pack.** Print or save as PDF. This is what the advisor hands to the SMME: the force multiplier.
11. **Architecture (1 min).** Mention that the AI currently runs on Cloudflare Workers AI because the hackathon account has no Bedrock quota, and that switching back is one line. Walk through `docs/architecture.md`: Cognito → API GW → Lambda → DynamoDB/S3, then EventBridge → Step Functions → PDF extraction (Claude for scans) → Bedrock. Explain why there is no Textract: the organisation only allows eu-north-1, where Textract is not offered. Cover security (private S3, JWT, least-privilege IAM, no document text in logs) and responsible AI (citations, labels, no award predictions).
12. **Status (30 s).** Walk through `docs/status.md`: completed, simulated and outstanding.

**Backup:** if AWS or the network fails, switch to the `?demo=1` tab. It runs the same journey with fictional data, and the banner shows it is simulated.
