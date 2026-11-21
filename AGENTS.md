<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## ERP architecture
- Keep pure ERP calculations in model.ts; persistent records and approval mutations use authenticated server functions and database authorization, never session-local writes.
- Mount the workspace provider and shared navigation in the authenticated layout so records and filter context survive client navigation across modules without rendering private pages signed out.
- Keep independent port-stage, freight-readiness, trip and financial statuses; cleared freight may dispatch while other freight remains blocked.
- Use separate customer-charge and approved-cost calculations, preserving historical foreign-currency conversion rates; estimated profit is not cash received.
- Legacy Cloud roles come from protected user_roles rows and SQL actions; external Django roles come from protected Membership and PlatformAdministrator rows, with authorization enforced independently of UI controls.
- Use un-nested operation detail routes so `/operations` can remain a full-page list without swallowing detail content.
- Use global CSS semantic tokens for workspace styling and browser print for prototype PDF views; CSV exports must use the same filtered rows as the report.
- Define the three navigation levels in a shared navigation registry and render additional submodule views through a typed dynamic workspace route; this preserves existing URLs while keeping categories as filtered views of the same records.
- Keep tabs, searches, filters and the active-operation field session-local; durable ERP records come from the authenticated workspace query.
- Keep approval-model.ts as UI affordances only; every entry form awaits database draft creation and lifecycle posting is a separately authorized transactional SQL action.
- Put all staff workspace routes under the client-only authenticated layout while auth and password recovery stay public; this prevents SSR session redirect loops.
- Generate PDF and Excel from the same filtered report rows using shared export data; prepare blobs before a separate download click to retain mobile browser activation.
- New staff use invitation or confirmed signup with individually chosen passwords; privileges never come from signup metadata, and first administrator access requires the verified designated company email.
- Keep additive relational ERP tables synchronized with legacy record projections until each legacy reader is retired, so existing IDs and frontend contracts remain intact.
- Share transactional database actions between authenticated workspace functions and bearer-validated versioned REST handlers, so both enforce the same access and lifecycle boundaries.
- Store document reservations and metadata in public application tables and file bytes in private storage, with immutable completed uploads and scoped download authorization.
- Build report/export rows through the shared server-authorized report query; browser formatting must not widen the authorized result set.
- Keep new currency conversion helpers separate from historical snapshot readers, so a policy change cannot revalue approved records.
- Do not enable multi-company operation until memberships, database authorization, transactional actions, reports, storage and jobs share a verified company boundary; browser-only filters cannot isolate tenants.
- Keep the external Django service in backend/ with its own dependency and migration set for Railway deployment; it must not mutate the existing Cloud schema.
- Resolve external API company context from active protected memberships and set PostgreSQL context transaction-locally; company headers are candidates, never authorization.
- Run external business-record/document queries under a non-superuser NOBYPASSRLS database role; migrations use separate privileged credentials so row security cannot be silently bypassed.
- Keep Django tokens in HttpOnly same-origin cookies and proxy screen requests through server-only adapters; never expose tokens to browser storage or mix Cloud and Django writes.
- Preserve existing screen DTOs through the Django workspace service, with company-keyed caches cleared on membership changes; generic record APIs are not a replacement for validated posting actions.
