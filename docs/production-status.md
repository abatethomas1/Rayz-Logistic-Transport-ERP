# Production ERP implementation status

## Current local Django migration status

The existing ERP screens now call the Django API exclusively for sign-in, workspace records, staff profiles/assignments, directories, reports and private documents. HttpOnly token cookies and membership-verified company selection replace browser Cloud sessions. The old Cloud data and accounts remain untouched; legacy ownership/account import is still required before real company use.

Local checks passed: 56 PostgreSQL Django tests and 62 frontend tests; real officer submission, independent manager approval, posting and refresh read-back through the UI; Base-to-SAT company switching with cache clearing; mobile layout without page overflow. API tests cover FX rounding, tax-free sequence invoices, advance allocation, cash reversal, proof-of-delivery completion, invitations/reset and foreign document denial.

**Not production-complete:** dedicated relational ledger/domain parity, correction and general payable/allocated-credit reversal actions, concurrent settlement/load acceptance, production account/data import, hosted mail and deployment remain outstanding. Railway deployment is deferred by the user. Saving to the requested GitHub repository is blocked by available connections lacking write access. Frontend server configuration uses `DJANGO_API_URL`; local fallback is `http://127.0.0.1:8091`.

The sections below retain the historical Cloud/foundation acceptance record; their pre-cutover configuration/API notes are superseded by the current update and `backend/README.md`.

## External multi-company Django foundation

The user selected a shared Django REST Framework/PostgreSQL product on Railway. Source, migrations, company memberships/configuration, separate platform/company administrators, company-scoped resource APIs, private documents and PDF/Excel reports/export jobs now exist in `backend/`. The Base, SAT and Yangtze test fixtures passed 28 PostgreSQL-backed tests, including restricted-role row security and authenticated cross-company denials. Existing frontend tests remain green.

This external service has not been deployed or connected to the existing preview. The existing Cloud data remains untouched and single-company. The new resource envelope is a company-isolation foundation, not a completed port of all operational and financial posting rules. Railway access/configuration, account/data migration, dedicated domain/ledger services and frontend cutover remain required; see `backend/README.md` and `docs/shared-product-architecture.md`. Do not advertise the current preview as multi-company.

## Delivered in this upgrade

- Permanent customer, truck and port directories, configurable reference records, and authorized directory editing.
- Additive relational operation, stage, freight, task, request, trip, cost, rate, invoice, advance, allocation and reversal tables, preserving the existing record projection contracts.
- Independent department approval followed by transactional operational posting; selected-freight readiness, dependency links, truck capacity, availability and request-count safeguards.
- Private document uploads, metadata finalization, authorization and byte downloads; posted supporting files are not overwritten.
- Whole-ETB foreign-currency posting with original amount, exact rate, source/date and converted snapshot; historical conversion readers retain existing values.
- Customer advances retained as unapplied credit, explicit approved invoice allocations, and compensating cash reversals approved only by independent Finance Manager / General Manager.
- Tax-free invoice headers and lines; current stable invoice identifiers retained until a numbering convention is supplied.
- Server-authorized report rows with matching PDF and Excel output; amount display uses `1,000,000.00`.
- Authenticated `/api/v1/` list/detail resources and explicit action endpoints, with pagination and structured errors.

## Verification completed

- Live baseline contained zero operations/work/assignments/audit entries and one staff role. Existing company records were not replaced or populated with demo transactions.
- Real administrator session opened configuration.
- Temporary general-management account created a customer and a two-container operation through the UI; both persisted after refresh and read back through the authenticated API.
- Assigned logistics officer created and submitted a stage through the UI; independent management approved it through the UI; officer posted and read it back.
- Direct officer approval, manager self-approval, repeated posting and cross-department report requests were rejected.
- Private document bytes uploaded through the UI, persisted, downloaded, and matched the original file contents.
- Approved foreign bill posted `10 USD × 132.56 = 1,326 ETB` and retained the original values.
- PDF and Excel downloaded from an authorized finance report; PDF page and workbook structure inspected. Mobile report had no page overflow.
- 61 focused unit tests passed before final documentation, covering existing workflows plus confirmed conversion, tax, advance availability, reversal authority and freight readiness rules.

## Not yet a complete production acceptance

Advance allocation, partial-payment/settlement concurrency, reversal execution, full trip delivery and cross-user document denial have code paths but still need a complete end-to-end acceptance run. General supplier payable settlement beyond trip payables, allocations reversal, line-item invoice editing, separate driver/trailer management, full document proof-of-delivery linkage, and general operational correction/void posting remain incomplete. Some main workspace reads retain 1,000-row bounds; REST and report coverage must be load-tested before larger company datasets.

Cash collection summaries in legacy workspace views still derive from invoice paid balances; unapplied advances and compensating reversal totals require reconciliation in those views before accounting acceptance. No claim of full financial production readiness is made.

## External delivery actions

- **GitHub:** no connection made. Project settings → Git connects a newly created private repository; Lovable cannot attach the requested existing repository. Review and merge source into the existing repository separately if needed.
- **Publishing:** this app remains unpublished. Published endpoint behavior, email delivery, social sign-in round trips, backups and restore drills are not verified.
- **Invoice numbering:** the supplied `1,000,000.00` defines amount display, not numbering. Existing identifiers are preserved; a production numbering convention is still needed.

## Local setup and configuration

Install project dependencies with `bun install`, run `bun run dev`, and run tests with `bun run test`. The supported runtime is TanStack Start / React with PostgreSQL in Lovable Cloud, not Django. Apply schema changes through Lovable's database migration workflow; do not manually edit generated migration history or generated integration files.

Browser configuration uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Server handlers use `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, read inside requests. Lovable manages privileged credentials; never expose them to the browser or copy them into source. Self-hosted deployments need their own compatible auth, PostgreSQL and private storage configuration; Lovable-managed privileged keys are not exportable.

## API-to-frontend mapping

Send staff access tokens in `Authorization: Bearer <token>`. Responses are `{data, meta?}`; errors are `{error:{code,message,details?}}`. Responses are non-cacheable. Authentication/settings endpoints still use the existing auth client; `GET /api/v1/auth/me` verifies the current staff account.

| Workspace | Resources / actions |
|---|---|
| Directories | GET customers, ports, configuration, trucks; POST master-data |
| Operations | GET/POST operations; GET stages, local-tasks, freight, truck-requests, trips |
| Approval work | GET approvals; POST work; POST work/:id/submit, approve, return, edit, delete, assign, post |
| Operational lifecycle | POST operational-actions: post, stageStatus, taskStatus, tripStatus, freightClearance, dependency, assignStage |
| Finance | GET costs, cost-postings, invoices, payments, settlements, advances, allocations, reversals, rate-cards |
| Documents | GET documents; upload/finalization through authenticated document functions and private storage |
| Reports | GET reports/logistics, reports/transport, reports/finance; report server functions use the same query |
| Staff | GET users; POST users/assign; invitations through the existing authenticated invitation action |

Lists accept page, page_size (1–100), order (asc/desc), search, and applicable operation/status filters. Reports accept view, operationId, customer, status, search, from and to. Do not submit arbitrary record statuses: use explicit action commands. API contracts are documented here; a complete OpenAPI specification and external-client production verification remain outstanding.