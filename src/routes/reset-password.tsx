import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { djangoAccountAction } from '@/features/erp/django.functions';
import { Button } from '@/components/ui/button';
export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [{ title: 'Password and Invitation | Rayz ERP' }, { name: 'description', content: 'Choose your individual staff password.' }, { property: 'og:title', content: 'Rayz ERP Account Activation' }, { property: 'og:description', content: 'Secure password recovery and staff invitation acceptance.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: ResetPassword,
});
function ResetPassword() {
  const account = useServerFn(djangoAccountAction); const [link, setLink] = useState({ token: '', uid: '', invite: false }); const [error, setError] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { const q = new URLSearchParams(window.location.search); setLink({ token: q.get('token') || '', uid: q.get('uid') || '', invite: !q.get('uid') }); window.history.replaceState(null, '', '/reset-password'); }, []);
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setBusy(true); setError(''); const d = new FormData(e.currentTarget); const password = String(d.get('password'));
    try { if (password !== d.get('confirm')) throw new Error('Passwords do not match.'); await account({ data: link.invite ? { action: 'invite', token: link.token, username: String(d.get('username')), password } : { action: 'reset', token: link.token, uid: link.uid, password } }); setDone(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Password update failed.'); } finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-background flex items-center justify-center p-6"><section className="max-w-md w-full space-y-5"><h1 className="text-2xl font-bold">{link.invite ? 'Activate staff account' : 'Set your new password'}</h1>{done ? <p role="status">Your account is ready. Sign in with your individual password.</p> : link.token ? <form onSubmit={submit} className="space-y-4">{link.invite && <label className="form-field">Username<input name="username" autoComplete="username" required /></label>}<label className="form-field">New password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label className="form-field">Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>{error && <p role="alert" className="form-error">{error}</p>}<Button disabled={busy} type="submit">{busy ? 'Saving…' : 'Save password'}</Button></form> : <p>Open the invitation or password reset link from your email.</p>}<Button variant="outline" asChild><Link to="/auth">Back to sign-in</Link></Button></section></main>;
}
