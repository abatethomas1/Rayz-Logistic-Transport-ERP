# Complete the Rayz production ERP

## Scope and platform decision

Preserve the existing React workspace, centered Logistics / Transport / Finance / Reports header, staff accounts, records, assignments, and audit history. Complete the missing operational and financial capabilities in working, tested stages.

**This plan uses the supported TanStack Start application and PostgreSQL in Lovable Cloud, not Django or Django REST Framework.** Lovable cannot host the requested Python backend. A separately hosted Django service would require a different deployment project; it will not be silently substituted or claimed as implemented here. Approving this plan selects the supported implementation below.

## Current state — inspected source

- Real sign-in, protected staff roles, permanent records, department approvals, audit entries, and transactional invoice/payment/settlement actions already exist.
- Records currently use generic JSON-backed ERP tables, not the full relational model requested in the new brief.
- Customers, trucks, drivers, and rate examples are still illustrative references.
- Approved port work, tasks, truck requests, assignments, trips, bills, and corrections lack complete operational posting paths.
- Documents currently store names, not uploaded bytes.
- There is no versioned REST API, advance-payment ledger, complete currency snapshot model, or production backup/cutover verification.
- Earlier verification covers selected workflows, not all requirements in this brief. Do not label the whole project production-ready until the acceptance checks below pass.

## Proposed architecture

```text
Existing React staff workspace
        |
Authenticated application actions + /api/v1/ REST handlers
        |
Role + assignment + lifecycle authorization
        |
Transactional PostgreSQL actions and private document storage
        |
Shared report queries, audit trail, PDF / Excel exports
```

Use one authorization and transaction layer for workspace actions and REST calls. Report queries, document downloads, print data, and exports enforce access on the server, not only through hidden buttons. REST authentication validates staff bearer tokens; no privileged credentials reach the browser.

## Entity relationship outline

| Entity group | Relationships and integrity |
|---|---|
| Staff | Existing auth identities → profiles, protected roles, department / record assignments |
| Configuration | Ports, authorities, charge categories, freight types, container sizes, currencies, and effective-dated rate cards |
| Operations | Customer → operations with unique operation numbers and stable IDs |
| Logistics | Operation → port stages and local clearance tasks → source charges and documents |
| Freight | Operation → freight items → relevant stage/task dependencies and item-specific readiness |
| Transport | Operation → truck requests → company/subcontractor assignments → trips, freight links, milestones and delivery proof |
| Fleet | Trucks → ownership/supplier; assignments reference drivers and optional trailers |
| Costs | Source charge → uniquely linked approved cost posting, with immutable original currency, rate/date/source and converted ETB snapshot |
| Receivables | Operation/customer → invoices and lines; payments → invoice allocations or unapplied advances |
| Payables | Supplier/source cost → payable → partial/full settlement allocations |
| History | Assignment, submission, decision, issue, allocation, settlement, correction, reversal and void events |

Use decimal monetary columns, nonnegative amount constraints, source uniqueness, relationship constraints, and indexes on operation/customer/assignee/status/dates and source references. Add tables and backfill compatible records without dropping or overwriting existing data. Preserve legacy identifiers and mark retired structures explicitly after switching reads/writes.

## Permission matrix

| Role | View / create / edit / submit | Approve / return | Administration |
|---|---|---|---|
| External Logistics Officer | Assigned port stages and related charges | No | No |
| Internal Logistics Officer | Assigned local tasks and related charges | No | No |
| Transport Officer / Dispatcher | Assigned requests, assignments and trips | No | No |
| Finance Officer / Accountant | Assigned finance work | No | No |
| Department Manager | Department records; assign department staff | Independent department submissions | Department assignments only |
| General Manager / Owner | Authorized company-wide work and reports | Authorized escalations; no self-approval | Existing authorized staff-management boundaries |
| System Administrator | Accounts and configuration; review legacy business-read access against the brief | No automatic business approval | Accounts and configuration |

Every action checks role, assignment and current status. Draft/Returned records may be edited within scope. Only eligible own unused drafts may be deleted. Managers cannot approve their own creation or submission; escalate instead. Returns, financial corrections and voids require reasons and audit entries.

## Implementation order

1. **Preserve and establish a baseline.** Inspect live schema/counts and representative records; verify existing staff access; document current contracts and regression tests. Do not seed illustrative transactions into live company records.
2. **Permanent master data and relational foundation.** Add configurable reference records, customers, fleet, normalized operations and record-level assignments. Backfill existing records with count/link verification and switch the related screens to permanent reads/writes.
3. **Operational workflows.** Complete port stages, local tasks, source charges, truck requests, assignments, freight-level blockers, trips and delivery milestones. Ship draft/submission/approval and separately authorized posting together, with real file upload/download permissions.
4. **Financial integrity.** Add unique approved-cost posting, decimal currency snapshots, effective-dated rates, invoice lines/issue, advance and final payments, allocations, payables, partial settlements and audited corrections/reversals. Use transactions and locks to reject concurrent over-allocation and repeated posting.
5. **REST API and reports.** Provide documented `/api/v1/` resources for auth/session verification, users/roles, configuration, customers, operations, logistics, freight, fleet, requests, assignments, trips, costs, rates, invoices, payments, payables, settlements, approvals, documents and reports. Add bounded pagination, allowed filters/order/search, consistent validation/permission errors, and a frontend mapping. Prepare PDF/Excel from the same authorized filtered report rows.
6. **Acceptance and delivery.** Run focused permission/financial tests, signed-in create/read/update workflows, cross-user denial checks, desktop/mobile checks, and download verification. Document environment variable names without secrets, supported local setup, migrations, backup/restore requirements and publishing checks. Offer illustrative cases through an explicitly separate test/demo setup, never automatic live seeding.

## Policies requiring a decision before dependent financial actions

Keep these dependent actions unposted until approved: currency conversion rounding/precision; invoice numbering and tax treatment; allocation of customer advances; permitted overpayments/customer credits; reversal rules after a settlement; applicable container-identifier uniqueness across repeat shipments. Preserve existing historical values. Do not invent rates, tax amounts, credit terms or approval authority.

## GitHub connection — separate user action

Requested repository: `https://github.com/rayztechn26/Rayz-Logistic-Transport-ERP`.

Lovable Git sync creates a **new private repository** and cannot attach this project to that existing repository. The agent cannot connect or verify Git sync from chat. A GitHub API connector would not establish code synchronization.

Supported path: in **Project settings → Git**, connect GitHub to create a new private repository. To retain the requested repository, merge or copy the ERP source into it on GitHub separately after reviewing its existing contents; that does not make it the synced repository. Do not overwrite either repository or change repository history without review. No connection has been made by preparing this plan.

## Completion criteria

- Existing records and identities remain traceable; newly created records survive refresh.
- Officers see only authorized work; no officer or creator/submitter can self-approve.
- One released freight item can dispatch while an unrelated item remains blocked.
- A source charge cannot post twice; historical currency conversion remains unchanged.
- Partial/advance/final customer payments and partial supplier settlements reconcile correctly; concurrent actions cannot over-allocate.
- Private files, reports, prints and exports cannot be accessed outside authorization scope.
- Invoiced revenue, cash, approved costs, receivables, payables and estimated profit are distinct.
- Each stage's important workflow is verified through the real signed-in UI and API/database readback.
- GitHub synchronization, provider/email delivery, backups and publishing are reported as verified only when actually checked; otherwise their remaining user actions stay explicit.