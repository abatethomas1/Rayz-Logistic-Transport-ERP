import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/features/erp/store';
import { assignStaff, inviteStaff } from '@/features/erp/workspace.functions';
import { Button, PageHeader, SectionHeading } from '@/features/erp/ui';
import { roles } from '@/features/erp/model';
import { djangoAccountAction } from '@/features/erp/django.functions';

export const Route = createFileRoute('/_authenticated/staff')({
  head: () => ({ meta: [{ title: 'Staff and Account | Rayz Logistic and Transport' }, { name: 'description', content: 'Manage your staff profile and authorized staff assignments.' }, { property: 'og:title', content: 'Rayz Staff and Account' }, { property: 'og:description', content: 'Staff profiles, roles and operation assignments.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: StaffPage,
});
function StaffPage() {
  const ws = useWorkspace(); const assign = useServerFn(assignStaff); const queryClient = useQueryClient(); const [busy, setBusy] = useState(false);
  const invite = useServerFn(inviteStaff);
  const account = useServerFn(djangoAccountAction);
  const admin = ws.role === 'Admin';
  async function sendInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); const d = new FormData(e.currentTarget);
    try { await invite({ data: { email: String(d.get('email')), name: String(d.get('name')), role: String(d.get('role')) as typeof roles[number], origin: window.location.origin } }); await queryClient.invalidateQueries({ queryKey: ['workspace'] }); toast.success('Staff invitation sent'); } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not send invitation'); } finally { setBusy(false); }
  }
  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); const d = new FormData(e.currentTarget);
    try { await account({ data: { action: 'profile', name: String(d.get('name')), avatar: String(d.get('avatar') || '') } }); await queryClient.invalidateQueries({ queryKey: ['workspace'] }); toast.success('Staff profile saved'); } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not save profile'); } finally { setBusy(false); }
  }
  async function updateStaff(e: FormEvent<HTMLFormElement>, operation: boolean) {
    e.preventDefault(); setBusy(true); const d = new FormData(e.currentTarget);
    try { await assign({ data: { staff_id: String(d.get('staff')), staff_role: String(d.get('role') || ''), ...(operation ? { operation_id: String(d.get('operation')), work_area: String(d.get('area')) } : {}) } }); await queryClient.invalidateQueries({ queryKey: ['workspace'] }); toast.success(operation ? 'Operation assigned' : 'Staff role updated'); } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not update staff'); } finally { setBusy(false); }
  }
  return <><PageHeader title="Staff & account" description={ws.actor.name}><Button asChild variant="outline"><Link to="/configuration">Company configuration</Link></Button></PageHeader>
    <section className="py-5 border-b border-border"><SectionHeading title="My profile" /><form className="record-form max-w-xl" onSubmit={saveProfile}><label className="form-field">Staff name<input name="name" defaultValue={ws.actor.name} required /></label><label className="form-field">Avatar URL<input name="avatar" type="url" defaultValue={ws.profile?.avatar_url || ''} /></label><p className="text-muted-foreground">Staff role: {ws.role}</p><Button disabled={busy} type="submit">Save profile</Button></form></section>
    {admin && <section className="py-5 border-b border-border"><SectionHeading title="Invite staff" /><form className="record-form max-w-xl" onSubmit={sendInvite}><label className="form-field">Staff name<input name="name" required /></label><label className="form-field">Staff email<input name="email" type="email" required /></label><label className="form-field">Staff role<select name="role">{roles.map((r) => <option key={r}>{r}</option>)}</select></label><Button disabled={busy} type="submit">Send invitation</Button></form></section>}
    {(admin || ws.actor.manager) && <><section className="py-5 border-b border-border"><SectionHeading title="Staff directory" /><div className="table-scroll"><table><thead><tr><th>Staff name</th><th>Role</th><th>Account reference</th></tr></thead><tbody>{ws.staff.map((s) => <tr key={s.id}><td>{s.display_name || 'Unnamed staff account'}</td><td>{s.role || 'Pending access'}</td><td className="break-all">{s.id}</td></tr>)}</tbody></table></div></section>
    {admin && <section className="py-5 border-b border-border"><SectionHeading title="Assign staff role" /><form onSubmit={(e) => void updateStaff(e, false)} className="record-form max-w-xl"><label className="form-field">Staff account<select name="staff" required>{ws.staff.filter((s) => s.id !== ws.actor.id).map((s) => <option key={s.id} value={s.id}>{s.display_name || s.id}</option>)}</select></label><label className="form-field">Staff role<select name="role">{roles.map((role) => <option key={role}>{role}</option>)}</select></label><Button type="submit" disabled={busy || ws.staff.length < 2}>Assign role</Button></form></section>}
    <section className="py-5"><SectionHeading title="Assign operation to staff" /><form onSubmit={(e) => void updateStaff(e, true)} className="record-form max-w-xl"><label className="form-field">Staff account<select name="staff" required>{ws.staff.filter((s) => s.id !== ws.actor.id && s.role).map((s) => <option key={s.id} value={s.id}>{s.display_name || s.id} · {s.role}</option>)}</select></label><label className="form-field">Freight operation<select name="operation" required>{ws.operations.map((o) => <option key={o.id}>{o.id}</option>)}</select></label><label className="form-field">Work area<select name="area">{['external','internal','transport','finance'].filter((area) => admin || ws.actor.department === (['external','internal'].includes(area) ? 'logistics' : area)).map((a) => <option key={a}>{a}</option>)}</select></label><Button type="submit" disabled={busy || !ws.operations.length}>Assign operation</Button></form></section></>}
  </>;
}