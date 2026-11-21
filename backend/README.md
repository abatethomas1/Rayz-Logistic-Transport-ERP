# Rayz shared Django ERP service

One Django REST Framework service and one PostgreSQL database for Base, SAT, Yangtze and future client companies. This directory is an **externally hosted backend foundation**, not the backend currently serving the Lovable preview. Railway was selected by the user; no Railway service has been deployed or connected yet.

## Local frontend migration update

The ERP screens now use Django-only session, workspace, directory, staff, document and report adapters. Access and refresh tokens stay in HttpOnly cookies; company selection is verified against live memberships. Local development defaults to the Django API at `http://127.0.0.1:8091`; configure the frontend server's `DJANGO_API_URL` when using another address. Production requires an HTTPS API address. No Railway deployment is needed to configure and test locally.

The compatibility endpoints under `/api/v1/workspace/` expose the existing screen shapes and transactional posting actions. They cover independent approvals, FX snapshots, freight dependencies, dispatch checks, trip delivery documents, invoices, payments, advances, allocations and cash reversals. Records still use company-owned envelopes rather than a complete dedicated relational ledger. Generic resource endpoints must not be used to bypass workspace posting.

Verified locally: **56 Django PostgreSQL tests**, including workspace actions under a non-superuser NOBYPASSRLS role, and **62 frontend tests**. Browser verification used real temporary Django accounts: officer draft/submission, independent logistics-manager approval, posting and refresh read-back; Base-to-SAT membership switching removed Base records; mobile had no page overflow. Password reset, invitation role mapping and private document download denial were tested at API level. Hosted email, deployment, concurrency/load acceptance and full domain parity remain unverified.

Configure `INVITATION_URL` to your frontend's `/reset-password` page and SMTP privately before issuing real invitations. Existing Cloud accounts/data are untouched and are **not** automatically imported or assigned to a company. GitHub delivery to the requested existing repository remains blocked by read-only connector permissions; nothing was written to that repository.

The earlier foundation status and remaining-work notes below describe the pre-migration baseline; this update takes precedence for frontend adapter status.

## Implemented

- Company records and configurable branding, module availability, categories, rate-card configuration, approval limits, invoice prefixes/sequences and report permissions.
- Explicit protected platform-administrator assignments and company memberships; no platform privileges from email, signup metadata or browser fields.
- JWT sign-in, short-lived access tokens, rotating/revocable refresh tokens, active-membership discovery, staff invitations with individually chosen passwords and one-use acceptance.
- Membership-validated company context. One membership resolves automatically; multiple memberships require `X-Company`, which is verified against the authenticated user on every request.
- Company-scoped resource APIs for operations, customers, trucks, trips, bills, invoices, payments and settings. These currently share a company-owned record envelope; they are not yet dedicated financial ledger/domain models.
- Assigned-area officer access, department-manager/general-manager approval, no self-approval, required return reasons, configurable approval limits, locked mutations and protected Draft deletion.
- PostgreSQL relationship triggers and company row security for business records and document metadata, plus immutable audit/document history.
- Private PDF/PNG/JPEG uploads up to 10 MB; opaque company-owned paths, authenticated downloads, no public file-serving URL.
- Company-scoped report rows and matching PDF/Excel, safe spreadsheet text, queued export jobs with fresh authorization at execution/download.
- Three-company automated fixtures and a repeatable command that creates Base, SAT and Yangtze company accounts without staff passwords or demo transactions.

## Local setup

Use Python 3.13 and PostgreSQL. Install `requirements.txt` in an environment outside the frontend dependency tree. Set these variables privately:

- `DJANGO_SECRET_KEY`: a newly generated high-entropy secret.
- `DATABASE_URL`: your external PostgreSQL connection string, not Lovable-managed database credentials.
- `DJANGO_DEBUG=true` only for local development.
- `PRIVATE_DOCUMENT_ROOT`: a local private directory outside any served/static directory.

```sh
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py create_test_companies
python manage.py test erp.tests
python manage.py runserver 127.0.0.1:8091
```

Tests require PostgreSQL and create/drop an isolated test database. Never run them against a production role that has unrestricted access to real data. The row-security test explicitly switches to a non-superuser, non-bypass role; creating this test role requires a privileged **test-only** database account. No existing Lovable Cloud schema or records are changed by these external Django migrations.

### Verification completed in this request

- 28 Django tests passed against isolated PostgreSQL, including all six directional Base/SAT/Yangtze company pairs for resource isolation and authenticated document/export/job boundaries.
- A real password/JWT flow created and read back an operation under a non-superuser `NOBYPASSRLS` runtime role; foreign operation reads returned 404.
- Direct PostgreSQL row-security checks returned no rows without company context, denied forged company context and could not update foreign records.
- PostgreSQL triggers rejected foreign record/membership/document/job relationships and document overwrite.
- Existing frontend regression tests remained green: 61 tests across six files. Django migration consistency and startup-script syntax checks passed.
- These are local verification results, not a Railway deployment or a signed-in test of the final connected frontend.

## Railway deployment

Deployment incurs Railway hosting/storage costs. No account access was available in this sandbox, so the following steps remain operator actions:

1. Connect the shared source repository to one Railway Django service. Set its root directory to `backend`; use `Dockerfile` and `railway.toml` in that directory. Do not create separate services/projects per client.
2. Add one PostgreSQL service. Keep privileged migration credentials separate from the runtime database login. Railway pre-deploy runs `python manage.py migrate --noinput`.
3. Attach a private persistent volume at `/data`, set `PRIVATE_DOCUMENT_ROOT=/data/private-documents`, and verify write permissions. The startup script creates the private directory; application workers run as the unprivileged `app` user. Do not expose this volume as static/media hosting. Start with one service replica because the file volume is local to that service; multiple replicas require shared private object storage first.
4. Set `DJANGO_SECRET_KEY`, `DATABASE_URL`, `DJANGO_ALLOWED_HOSTS` (the real API hostname), `FRONTEND_ORIGINS` (explicit HTTPS frontend origins), and `DJANGO_DEBUG=false`. Set `SECURE_SSL_REDIRECT` through the provided production settings; Railway supplies the forwarded HTTPS header. Do not use wildcard CORS or hosts.
5. Configure SMTP with `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`, and a real `INVITATION_URL`. Invitation/password onboarding UI must exist on the frontend before issuing invitations. Configure email secrets directly in Railway, never in Git or chat.
6. Bootstrap a verified individual operator with `python manage.py createsuperuser`, then explicitly grant the separate platform role with `python manage.py grant_platform_administrator <username>`. Django superuser status alone does not grant the product's platform role. Do not derive this privilege from an email string.
7. Create the three client companies with `python manage.py create_test_companies`, invite each company's administrator using the platform action, then configure departments/report permissions. Report access defaults to denied until explicitly configured.
8. Run `python manage.py check --deploy`, verify API health over HTTPS, onboarding/email, JWT sign-out/refresh, backups/restores and private-volume recovery. Run isolation acceptance against a dedicated staging database before inviting real clients.

### Separate migration and runtime roles

Use a non-superuser `NOBYPASSRLS` runtime login; never use a Railway PostgreSQL administrator connection for API workers. An operator creates this login/password privately. With the appropriate external database privileges, grant that login schema `USAGE`, table `SELECT/INSERT/UPDATE/DELETE` and sequence `USAGE/SELECT`; set default privileges for the migration owner so later migrations receive the same runtime grants. Use migration-owner credentials only for migrations.

The current Railway configuration uses one `DATABASE_URL` for migration and startup by default. For separated credentials, supply `MIGRATION_DATABASE_URL` as a private Railway variable as well: the pre-deploy wrapper uses it while API workers retain the restricted `DATABASE_URL`. Verify `rolsuper=false` and `rolbypassrls=false` for the runtime login. Record/document `FORCE ROW LEVEL SECURITY` also covers a non-superuser table owner. Direct PostgreSQL access is not a public app interface.

## API contract

All application paths start `/api/v1/`. Authenticate using `/auth/token/`, send `Authorization: Bearer <access token>`, and discover memberships at `/auth/memberships/`. Never place tokens in query strings. JWT claims do not carry trusted role/company authority; live membership rows are checked on each request.

| Surface | Endpoints |
| --- | --- |
| Platform companies | `GET/POST platform/companies/`, `GET/PATCH platform/companies/:id/`, `POST platform/companies/:id/administrator-invitations/` |
| Active company | `GET/PATCH company-settings/current/` |
| Company staff | `GET memberships/`, `GET/PATCH memberships/:id/`, `POST memberships/invitations/` |
| Invitation acceptance | `POST auth/accept-invitation/`; one-use email token, username and individually chosen password |
| Resources | `GET/POST operations/`, `customers/`, `trucks/`, `trips/`, `bills/`, `invoices/`, `payments/`, `settings/`; scoped detail read/update/delete |
| Approval lifecycle | `POST <resource>/:id/lifecycle/` with `command`: submit, approve, return or invoice issue |
| Documents | `GET/POST documents/`, `GET documents/:id/`, `GET documents/:id/download/`; multipart upload uses `record` and `file` |
| Reports | `GET reports/rows/` and `reports/export/`; area, kind, search and PDF/Excel format |
| Export jobs | `GET/POST export-jobs/`, `GET export-jobs/:id/download/`; worker command `python manage.py process_exports` |

Foreign detail IDs return 404; forged company selection or inactive membership returns 403. Business mutations reject supplied ownership/lifecycle fields. All API responses are private and non-cacheable. No endpoint publishes stored file keys. The worker command processes queued work when invoked; Railway worker scheduling/event dispatch is not yet configured.

## Remaining work before switching the existing frontend

- Deploy Railway, configure production secrets, private volume, mail and runtime/migration roles; verify live health and restore procedures.
- Map/migrate the current ERP's legacy identifiers, users and record ownership into the external service without guessing which client owns them. Existing Lovable staff sessions cannot authenticate against Django without an explicit account/session migration.
- Replace the frontend's existing Cloud queries/actions and authentication with the Django contract; add membership selection, platform/company administration, company branding and invitation acceptance pages. Do not run both backend write paths against the same business data.
- Port the complete existing logistics/dispatch/clearance and financial posting/advance/allocation/reversal rules into dedicated relational Django models/services. The resource envelope isolates data but does **not** implement ledger posting or all prior operational rules; invoice issuance here assigns a sequence only, not ledger entries.
- Validate effective-dated rate cards and charge calculations, department staff assignment administration and detailed invoice numbering rules. Rate-card/category configuration currently stores bounded JSON lists, not dedicated validated rate-card entities.
- Extend staging acceptance to concurrent invoice issuance, concurrent posting/settlement, full delivery, account migration, revocation during long-running exports and the final frontend workflows.

Do not describe the existing preview as multi-company or this foundation as a fully migrated production ERP.