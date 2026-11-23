import { createFileRoute, redirect } from '@tanstack/react-router';
import { getDjangoSession } from '@/features/erp/django.functions';
import { useStaffAuth } from '@/features/erp/auth';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { CompanyLogo } from '@/features/erp/company-logo';
export const Route = createFileRoute('/companies')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Choose Company | Rayz ERP' }, { name: 'description', content: 'Choose your authorized company workspace.' }, { property: 'og:title', content: 'Rayz ERP Company Workspaces' }, { property: 'og:description', content: 'Secure access to your company memberships.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  beforeLoad: async () => { if (!await getDjangoSession()) throw redirect({ to: '/auth' }); },
  component: CompanyPicker,
});
function CompanyPicker() {
  const { session, selectCompany, signOut } = useStaffAuth(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <main className="min-h-screen bg-background flex items-center justify-center p-6"><section className="w-full max-w-lg space-y-6"><h1 className="text-2xl font-bold">Choose your company</h1>{session?.memberships.map((m) => <Button key={m.id} variant="outline" className="w-full justify-between gap-4 h-auto py-4" disabled={busy} onClick={async () => { setBusy(true); try { await selectCompany(m.company); } catch (err) { setError(err instanceof Error ? err.message : 'Company unavailable.'); } finally { setBusy(false); } }}><span className="text-left whitespace-normal">{m.branding.display_name || m.name}<small className="block text-muted-foreground">{m.role}</small></span><CompanyLogo company={m} /></Button>)}{!session?.memberships.length && <p>No active company membership. Contact your company administrator.</p>}{error && <p role="alert">{error}</p>}<Button variant="ghost" onClick={() => void signOut()}>Sign out</Button></section></main>;
}