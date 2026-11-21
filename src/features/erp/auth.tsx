import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { getDjangoSession, loginDjango, logoutDjango, chooseDjangoCompany } from './django.functions';
import type { DjangoSession } from './django-contract';

type StaffAuth = { user: DjangoSession['user'] | null; session: DjangoSession | null; loading: boolean; error: string; signIn: (username: string, password: string) => Promise<void>; signOut: () => Promise<void>; selectCompany: (company: string) => Promise<void>; reload: () => Promise<void> };
const AuthContext = createContext<StaffAuth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DjangoSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const queryClient = useQueryClient(); const router = useRouter(); const navigate = useNavigate();
  const fetchSession = useServerFn(getDjangoSession); const login = useServerFn(loginDjango); const logout = useServerFn(logoutDjango); const choose = useServerFn(chooseDjangoCompany);
  async function reload() { try { setSession(await fetchSession()); setError(''); } catch (err) { setError(err instanceof Error ? err.message : 'Sign-in unavailable.'); } finally { setLoading(false); } }
  useEffect(() => { void reload(); }, []);
  async function signIn(username: string, password: string) {
    await queryClient.cancelQueries(); queryClient.clear();
    const next = await login({ data: { username, password } }); setSession(next); setLoading(false); setError('');
    await router.invalidate();
    await navigate({ to: next?.activeCompany ? '/' : next?.platformAdmin ? '/platform' : '/companies', replace: true });
  }
  async function signOut() {
    setLoading(true);
    await queryClient.cancelQueries(); queryClient.clear();
    try { await logout(); } finally { setSession(null); setLoading(false); await navigate({ to: '/auth', replace: true }); await router.invalidate(); }
  }
  async function selectCompany(company: string) {
    setLoading(true);
    await queryClient.cancelQueries(); queryClient.clear();
    try { const next = await choose({ data: { company } }); await queryClient.cancelQueries(); queryClient.clear(); setSession(next); setLoading(false); await router.invalidate(); await navigate({ to: '/', replace: true }); }
    finally { setLoading(false); }
  }
  return <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, error, signIn, signOut, selectCompany, reload }}>{children}</AuthContext.Provider>;
}
export function useStaffAuth() { const context = useContext(AuthContext); if (!context) throw new Error('Staff auth provider required'); return context; }
