# Shared Logistics & Transport ERP: company isolation

## Status and hosting decision

Rayz Technologies PLC owns the shared product. Base Logistics & Transport, SAT Logistics & Transport and Yangtze Logistics & Transport are client companies, not separate projects.

The user selected an externally hosted Django REST Framework service on Railway. The new `backend/` directory contains a company-isolated Django API foundation, PostgreSQL migrations, private file handling, reports, tests and Railway deployment configuration. Its tests create Base, SAT and Yangtze in a separate local PostgreSQL database. No existing Cloud records or policies have been changed, and no external Railway deployment or frontend cutover has occurred. The current preview remains single-company until the existing workflows, authentication and records are migrated. See `backend/README.md` for setup and explicit remaining limitations.

## Existing boundaries that require replacement

- Current role lookup uses one protected `user_roles` row per user, not company memberships. Administrator and general-manager helpers currently have workspace-wide authority.
- Directory read policies admit staff by role without company scope. Customers are keyed by name and trucks by registration globally, so adding a browser company filter would neither secure access nor allow duplicate client identifiers.
- Operation projections, approvals, transactional posting functions and relational synchronization share the current identifiers and must be migrated together.
- Workspace reads, REST resources, report queries and private document authorization all need the same verified company context. Existing department checks are necessary but insufficient for company isolation.
- The existing designated administrator is not automatically a platform administrator. Neither signup metadata nor an email supplied by a browser may grant that authority.

## Target ownership model

Use one codebase and one ordered migration set with shared PostgreSQL tables:

- **Company:** stable ID, display name, slug, active/suspended status and branding.
- **Company membership:** authenticated user, company, active status and independently managed roles; unique user/company membership.
- **Platform role:** separately protected platform-administrator assignment, not a company role. Platform administration does not imply access to customer operational records.
- **Company configuration:** module availability, charge categories, effective-dated truck rate cards, approval limits, invoice numbering and report permissions, with audit history.
- **Business records:** mandatory company ownership on operations, customer/supplier directories, staff assignments, trucks, trips, costs/bills, invoices, payments, advances, approvals, documents, audit events and report jobs.

Use stable internal identifiers for relationships. Scope business-key uniqueness to company, including customer names, truck registrations and invoice numbers. Container uniqueness remains within an operation, with reuse on later shipments. Composite company/record relationships prevent linking one company's invoice, operation, customer, payment or document to another company even if an application check is missed.

## Active company and authorization

Authenticate first. Resolve company context from an active protected membership on every request; when a user has several memberships, a selected company is only a candidate and must be revalidated. Reject missing, inactive, suspended or unauthorized membership. Never accept a company field on a create/update request as ownership authority.

The default company scope applies before list filtering, search, pagination, aggregation and export. Detail lookups query within that scope and return not-found for foreign records. Validate every related record within the same company. Preserve company-local department assignments, manager approval, no self-approval, immutable posting history and independent reversal authorization.

Company administrators cannot assign platform roles, modify another company, or approve their own work. Platform administrators can create, suspend and configure client accounts and manage designated company administrators through audited actions; ordinary customer records stay closed unless an explicit authorized support-access policy is separately established.

Disabled modules and restricted reports are enforced by the backend, not just hidden menus. Apply approval limits to posting/approval transactions, not only form validation. Lock company-local invoice sequence counters during issuance so concurrent invoices cannot receive the same number.

## Django implementation path

The implemented foundation uses company-context permissions, company-scoped querysets, validated serializers and locked approval actions in Django REST Framework. PostgreSQL row-level security protects record/document reads and writes using transaction-local context; a non-superuser, non-bypass runtime role is required. Relationship triggers reject cross-company references. Background export jobs establish fresh company authorization. Complete existing operational and ledger posting services still require migration; the current Django resource envelope is not full domain parity.

Move existing transactional rules and approval checks without weakening them. Point the existing React application at the authenticated Django API after contracts, sign-in/session handling, private storage and deployment are verified. Do not leave the old unrestricted write paths available as a bypass. External service credentials belong in deployment secrets, never source code.

## Legacy Cloud migration considerations

The existing backend is not the selected target and has not been modified for tenancy. During cutover, retire its global security-definer helpers/action functions and route all client transactions through the migrated Django service. Do not leave parallel unrestricted writes. PostgreSQL permissive policies are OR-combined, so a narrow company policy alongside an old broad one would not secure the legacy tables.

Backfill existing records only to a confirmed legacy company; do not assume Base, SAT or Yangtze owns them. Keep legacy IDs/projections synchronized while migrating readers. For global business-key collisions, add company-scoped replacement directories and switch relationships/readers before deprecating the old tables. Client-selected company context must never widen server authorization.

## Documents, exports and jobs

Store document metadata with company and operation ownership. Keep bytes private under unguessable company-bound object keys. Verify the metadata, active membership and department/report permission before upload reservation, finalization or download. Do not allow anonymous object URLs; short-lived authorized download links cannot be reissued after membership revocation. Test raw storage access as well as the app's download endpoint.

Build PDF/Excel from the same server-authorized report rows. Include only the active company's branding and settings. Export jobs persist initiating user and company, validate both at execution and download, and never accept a payload company as authority. Scope caches, deduplication keys, job queries and output storage to company. Audit mutations and privileged configuration changes without exposing another company's audit events.

## Automated acceptance matrix

Create Base, SAT and Yangtze as test fixtures, each with a company administrator, officers/managers, representative operations, invoices, approvals and a private document. Use individual test credentials, not shared passwords. Run every foreign-company denial in both directions for each pair of companies:

1. List/search excludes foreign records even when supplied with foreign operation IDs or exact customer names.
2. Direct record URLs and API reads cannot retrieve foreign records.
3. Create/update/delete cannot set foreign ownership or link foreign related records.
4. Submit/approve/return/post/allocate/reverse cannot act on foreign work; independent same-company approval succeeds.
5. Reports, PDF and Excel contain only authorized company records; disabled reports/modules are denied.
6. Upload reservation, metadata lookup, finalization, app download and raw storage download reject foreign document access.
7. Background jobs cannot execute or return files under another company; revoked membership fails both execution and download.
8. Company administrators cannot create platform administrators or manage another company's staff/settings.
9. Company-local names, truck registrations and invoice sequences can coincide without collisions; concurrent issuance remains unique per company.
10. Suspended companies, inactive memberships and tampered selected-company values are rejected.

Tests run against PostgreSQL and real Django permission/action paths, including positive same-company reads, creation, approvals, documents and exports. Explicit non-superuser tests exercise PostgreSQL row security. All three company pairs are tested in both directions for resource access/mutation, documents and report/job boundaries. These tests cover the foundation; full migrated operational posting, allocations/reversals, concurrency and final frontend acceptance remain rollout gates.

## Rollout gates

1. Django on Railway is confirmed; external account access and service secrets remain required for deployment.
2. Inventory all tables, functions, policies, storage rules and current records; confirm legacy record ownership before backfill.
3. Implement membership/configuration and company-bound business relationships with complete authorization in one coordinated release.
4. Create the three isolated test companies and pass the automated acceptance matrix.
5. Verify signed-in company administration and workflows, private documents and report exports through the UI.
6. Verify deployment, backups/restores, jobs and monitoring before enabling real client companies.