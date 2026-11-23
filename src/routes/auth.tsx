import { createFileRoute } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStaffAuth } from '@/features/erp/auth';
import { djangoAccountAction } from '@/features/erp/django.functions';
import rayzLogo from '@/assets/rayz-technology-logo.png.asset.json';
export const Route = createFileRoute('/auth')({
  head: () => ({ meta: [{ title: 'Staff Sign-in | Rayz ERP' }, { name: 'description', content: 'Sign in to your company logistics and transport workspace.' }, { property: 'og:title', content: 'Rayz ERP Staff Sign-in' }, { property: 'og:description', content: 'Secure company-scoped staff access and approvals.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: AuthPage,
});
function AuthPage() {
  const [forgot, setForgot] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const { signIn, loading } = useStaffAuth(); const account = useServerFn(djangoAccountAction);
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setBusy(true); setError(''); setMessage(''); const d = new FormData(e.currentTarget);
    try { if (forgot) { await account({ data: { action: 'forgot', email: String(d.get('username')) } }); setMessage('If an account exists, a password reset link has been sent.'); } else await signIn(String(d.get('username')), String(d.get('password'))); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not sign in.'); } finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-background flex items-center justify-center p-6"><section className="w-full max-w-md space-y-6"><div className="space-y-3"><img src={rayzLogo.url} alt="Rayz Technology" width={1024} height={420} className="w-64 max-w-full h-auto object-contain" /><h1 className="text-xl font-bold">Rayz Technologies PLC</h1></div><div><ShieldCheck className="text-primary mb-3" /><h2 className="text-2xl font-bold">{forgot ? 'Reset your password' : 'Staff sign-in'}</h2><p className="text-muted-foreground text-sm mt-2">Logistics &amp; Transport ERP</p></div><form method="post" onSubmit={submit} className="space-y-4"><label className="form-field">{forgot ? 'Email' : 'Email or username'}<input name="username" type={forgot ? 'email' : 'text'} autoComplete="username" required /></label>{!forgot && <label className="form-field">Password<input name="password" type="password" autoComplete="current-password" required /></label>}{error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status" className="text-sm text-primary">{message}</p>}<Button disabled={busy || loading} type="submit" className="w-full">{busy || loading ? 'Please wait…' : forgot ? 'Send reset link' : 'Sign in'}</Button></form><Button disabled={loading} variant="ghost" onClick={() => { setForgot(!forgot); setError(''); setMessage(''); }}>{forgot ? 'Back to sign-in' : 'Forgot password?'}</Button><p className="text-xs text-muted-foreground">Staff accounts are created through company invitations.</p></section></main>;
}
