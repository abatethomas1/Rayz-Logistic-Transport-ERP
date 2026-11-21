import { createFileRoute, redirect } from '@tanstack/react-router';
import { getDjangoSession } from '@/features/erp/django.functions';
import { useStaffAuth } from '@/features/erp/auth';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
export const Route = createFileRoute('/platform')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Client Companies | Rayz Technologies ERP' }, { name: 'description', content: 'Platform administration for client companies.' }, { property: 'og:title', content: 'Rayz Technologies Client Companies' }, { property: 'og:description', content: 'Manage isolated client company accounts.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  beforeLoad: async () => { const session = await getDjangoSession(); if (!session) throw redirect({ to: '/auth' }); if (!session.platformAdmin) throw redirect({ to: '/companies' }); },
  component: Platform,
});
function Platform() {
  const { signOut } = useStaffAuth();
  const companies = useQuery({ queryKey: ['platform-companies'], queryFn: async () => { const response = await fetch('/api/v1/platform/companies/'); if (!response.ok) throw new Error('Platform access unavailable.'); return response.json() as Promise<{ results: { id: string; name: string; slug: string; active: boolean }[] }>; } });
  return <main className="min-h-screen bg-background p-6"><section className="mx-auto max-w-5xl"><header className="flex flex-wrap justify-between gap-4 border-b border-border py-5"><h1 className="text-2xl font-bold">Rayz Technologies PLC · Client companies</h1><Button variant="outline" onClick={() => void signOut()}>Sign out</Button></header>{companies.error && <p role="alert">{companies.error.message}</p>}<table className="w-full"><thead><tr><th>Company</th><th>Reference</th><th>Status</th></tr></thead><tbody>{companies.data?.results.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.slug}</td><td>{c.active ? 'Active' : 'Suspended'}</td></tr>)}</tbody></table></section></main>;
}