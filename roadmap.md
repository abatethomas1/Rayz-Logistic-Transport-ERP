# Logistics & Transport ERP

## Shared multi-company product
- [x] Switch existing screen/authentication adapters to Django, add company context and verify officer/manager posting and company switching locally
- [ ] Save to https://github.com/abatethomas1/Rayz-Logistic-Transport-ERP on a review branch (user changed target from rayztechn26 repo) — needs a GitHub connection with write access to that repository
- [x] Verify local Django configuration with restricted PostgreSQL runtime credentials, 56 backend tests, 62 frontend tests and signed-in browser checks
- [x] Review existing authorization, record identifiers, reports and directory boundaries
- [x] Record product ownership and prepare the company-isolation implementation design
- [x] Confirm backend hosting — externally hosted Django selected
- [x] Prepare Railway deployment files and instructions for PostgreSQL, private storage and separate runtime/migration credentials
- [x] Prepare the external Django API foundation, PostgreSQL migrations and automated company-isolation tests
- [ ] Deploy Django on Railway — blocked by unavailable Railway account/service access and production configuration
- [x] Implement protected company memberships, separate platform/company administration and company configuration in the external service
- [x] Protect foundation APIs, direct URLs, searches, reports/exports, private documents and export jobs
- [x] Create Base, SAT and Yangtze automated test fixtures and run cross-company denial tests against local PostgreSQL
- [ ] Complete production cutover and remaining domain/ledger parity — blocked by verified account migration, confirmed legacy company ownership and production configuration; local adapters are connected, see backend/README.md for remaining gaps

## Original workspace
- [x] Apply confirmed company name: Rayz Logistic and Transport
- [x] Architecture, sitemap, roles, entities, workflows and proposed APIs
- [x] Design system and shared role-aware workspace
- [x] Owner overview and operation list/detail/create
- [x] Logistics stages, charges, local services and approvals
- [x] Dispatch, assignments, trip detail and fleet
- [x] Finance, invoices, partial payments, payables and rate cards
- [x] Customers, documents, activity and reports/exports
- [x] Rule tests and desktop/mobile end-to-end verification

## Three-level navigation
- [x] Navigation sitemap and desktop/mobile layout samples
- [x] Core menus, submodule navigation and contextual category/status tabs
- [x] Shared operation entry, department detail tabs and remembered filters
- [x] Verify navigation, role previews and filtered records on desktop/mobile

## Department roles and approvals
- [x] Assigned officer access, department managers and separation of duties
- [x] Draft/edit/delete/submit/return workflow and auditable approval queues
- [x] Update printable views and proposed backend authorization design
- [x] Verify officer creation/submission and manager approval, tests and mobile layout

## Permanent staff workspace
- [x] Enable Lovable Cloud
- [x] Staff profiles and real sign-in/sign-out/password recovery
- [x] Permanent operations, costs, trips, invoices and work history
- [x] Enforced assigned-officer and manager approval permissions
- [x] Verify permanent signed-in workflows and permission denials
- [x] Verify activated first administrator for rayztechn26@gmail.com
- [x] Professional PDF and Excel exports for filtered reports
- [x] Apply uploaded staff-role landing pages and invitation-based account setup; do not share staff passwords

## Production ERP brief and GitHub
- [x] Inspect current permanent implementation against the uploaded backend brief
- [x] Propose architecture, relationships, permission matrix and implementation stages
- [x] Confirm supported implementation instead of separately hosted Django — plan approved
- [x] Preserve live records and establish regression baseline
- [x] Permanent configurable master data and additive relational migration
- [ ] Complete logistics, freight, dispatch, trips and private document workflows
- [ ] Complete financial ledger, advances, currency snapshots and transactional corrections
- [x] Apply confirmed whole-ETB conversion rounding without changing historical original amounts or rates
- [x] Display monetary amounts with separators and two decimal places, matching 1,000,000.00
- [x] Implement unapplied customer advances and explicit Finance-selected allocation actions
- [x] Implement independent Finance Manager / General Manager reversal authorization and compensating entries
- [x] Apply tax-free invoices and operation-scoped container uniqueness with reuse across shipments
- [ ] Authorized versioned REST resources and complete reports
- [ ] Verify signed-in production flows and document deployment/backup requirements
- [ ] Connect GitHub sync — user must connect a new repository in Project settings; existing repository cannot be linked
- [ ] Confirm invoice numbering convention — user supplied amount format, not invoice identifiers
- [ ] Complete outstanding acceptance and capability gaps listed in docs/production-status.md; not production-complete yet
