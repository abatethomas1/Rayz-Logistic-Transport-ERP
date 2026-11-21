# Permanent staff workspace

The workspace now uses Lovable Cloud accounts and durable ERP records. Previous illustrative prototype rows are not automatically imported as live company transactions. New records start empty and are created through authenticated actions.

## Accounts
- Create and confirm the designated company email account to activate System Administrator access.
- Administrators can invite staff, assign roles, and assign operation areas. Department managers can assign existing officers within their department.
- The uploaded staff table determines the home view for each role. Emails listed in that table have not been automatically created or emailed.
- Passwords are individual and chosen by each staff member. No shared password was set and the designated administrator password was not changed.
- Google and Lovable sign-in and email/password are enabled. Email confirmation remains required.

## Permissions and records
- Protected database roles and operation assignments enforce staff access independently of navigation and browser controls.
- Officers submit Draft/Returned work; department managers approve or return submissions with no self-approval. Only an officer's own unused Draft can be deleted.
- Invoice issue, payments and settlements are separate atomic posting actions after approval, with balance revalidation and audit history.
- Port stages, assignments, bills and corrections remain reviewable drafts until a separate operational posting process is implemented. Document entries currently store names, not uploaded file contents.
- Customer and fleet directories and rate examples remain illustrative reference data; they are not an editable master-data management system.

## Reports
- Logistics, transport and finance reports offer CSV, branded PDF and styled Excel downloads from the same filtered rows.
- PDFs include report context, totals and page footers. Excel includes typed numeric cells, column widths, frozen headers, filters and print settings.
- Preparing a file and then clicking Download preserves mobile browser download activation.

## Verification
Temporary staff accounts verified operation persistence after refresh, officer submission, independent manager approval, approved officer readback, return/reason/edit/resubmit, invoice issue, partial payment readback, direct cross-department denial, officer approval denial, manager self-approval denial, duplicate posting denial, signed-out route protection, and desktop/mobile rendering.

PDF and Excel files downloaded and their contents were inspected. Hosted confirmation-email delivery, invitation-email delivery and external Google/Lovable provider round trips have not been exercised.