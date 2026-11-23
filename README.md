# Rayz Logistics & Transport ERP

One product maintained by Rayz Technologies PLC, with company-scoped Base, SAT, Yangtze and future client workspaces.

## Current status

The TanStack Start / React screens use an external Django REST API with PostgreSQL. Local sign-in, company selection, independent approvals, persistent records and PDF/Excel downloads are verified. **This is not yet production-complete or deployed.** Read [the current acceptance report](docs/production-status.md) before onboarding real companies.

The designated platform administrator is `rayztechn26@gmail.com`; its individual Django account still needs secure onboarding. A platform role is a protected database assignment, never an email-based signup privilege.

## Run locally

1. Follow [backend setup](backend/README.md): create PostgreSQL, apply migrations with migration-owner credentials, grant a separate restricted runtime account, then start Django on `127.0.0.1:8091`.
2. Install frontend packages with `bun install` and start with `bun run dev`. The local frontend defaults to the Django address above; set the frontend server's private `DJANGO_API_URL` for another address.
3. Run `bun run test`. Backend tests use a separate PostgreSQL test database and HTTPS test requests; run `python manage.py test erp.tests` with test-only migration credentials.

Never commit passwords, tokens, private database URLs or deployment secrets. Production needs an HTTPS Django address, persistent private document storage, restricted runtime credentials, SMTP, backups and staging acceptance; Railway deployment remains deferred.

## Source delivery

Source was previously delivered to `https://github.com/abatethomas1/Rayz-Logistic-Transport-ERP`, review branch `lovable-erp-code`. That API delivery is not two-way Lovable Git sync; the existing repository cannot be attached through Git sync. Do not assume later local commits appear on that review branch automatically.

## Stack

TanStack Start, React, TypeScript, Tailwind CSS, Django REST Framework and PostgreSQL. Legacy Cloud data and migrations are retained for deliberate migration, not used as a second screen write path.

## Platform administrator modes

- **Platform administration** (`/platform`, first tab): create, configure (branding, modules), suspend/activate companies with a recorded reason, invite company administrators, view platform totals.
- **Company support** (second tab): requires named permissions granted explicitly, e.g.
  `python manage.py grant_platform_administrator rayztechn26 --support-permission support.view_operations --support-permission support.manage_memberships`.
  Select a company and enter a reason; viewing and every support action are audited (actor, company, action, reason, timestamp). Support can never approve, issue invoices, record payments or settle payables.
- Run `python manage.py migrate` after pulling (adds migration 0004).
