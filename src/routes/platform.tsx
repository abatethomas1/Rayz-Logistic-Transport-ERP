import { createFileRoute, redirect } from '@tanstack/react-router';
import { getDjangoSession } from '@/features/erp/django.functions';
import { useStaffAuth } from '@/features/erp/auth';
import { Button } from '@/components/ui/button';
import { PlatformWorkspace } from '@/features/erp/platform-admin';
import rayzLogo from '@/assets/rayz-technology-logo.png.asset.json';
export const Route = createFileRoute('/platform')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Client Companies | Rayz Technologies ERP' }, { name: 'description', content: 'Platform administration for client companies.' }, { property: 'og:title', content: 'Rayz Technologies Client Companies' }, { property: 'og:description', content: 'Manage isolated client company accounts.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  beforeLoad: async () => { const session = await getDjangoSession(); if (!session) throw redirect({ to: '/auth' }); if (!session.platformAdmin) throw redirect({ to: '/companies' }); },
  component: Platform,
});
function Platform() {
  const { signOut } = useStaffAuth();
  return <main className="min-h-screen bg-background p-6"><section className="mx-auto max-w-5xl space-y-6"><header className="flex flex-wrap justify-between gap-4 border-b border-border py-5"><div className="space-y-3"><img src={rayzLogo.url} alt="Rayz Technology" width={1024} height={420} className="w-48 max-w-full h-auto object-contain" /><h1 className="text-2xl font-bold">Rayz Technologies PLC · Platform</h1></div><Button variant="outline" onClick={() => void signOut()}>Sign out</Button></header><PlatformWorkspace /></section></main>;
}
