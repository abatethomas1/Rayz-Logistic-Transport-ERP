import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { getDjangoSession } from '@/features/erp/django.functions';
import { WorkspaceProvider } from '@/features/erp/store';
import { WorkspaceShell } from '@/features/erp/shell';
import { useStaffAuth } from '@/features/erp/auth';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async () => { const session = await getDjangoSession(); if (!session) throw redirect({ to: '/auth' }); if (!session.activeCompany) throw redirect({ to: session.platformAdmin ? '/platform' : '/companies' }); },
  component: AuthenticatedWorkspace,
});
function AuthenticatedWorkspace() { const { session, loading } = useStaffAuth(); if (loading) return <div className="page-loading">Opening your company workspace…</div>; return <WorkspaceProvider key={session?.activeCompany}><WorkspaceShell><Outlet /></WorkspaceShell></WorkspaceProvider>; }