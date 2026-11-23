import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CompanyLogo } from './company-logo';

type Company = { id: string; name: string; slug: string; active: boolean; branding: { display_name?: string; logo_url?: string; primary_color?: string }; enabled_modules: string[] };
type Overview = { totals: { companies: number; active: number; members: number }; companies: { id: string; members: number; administrators: number }[] };
type Support = { company: { id: string; name: string; active: boolean }; operations: { id: string; code: string; title: string; status: string }[]; memberships: { id: string; username: string; email: string; role: string; active: boolean }[] };
const MODULES = ['logistics', 'transport', 'finance', 'reports'];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/platform/companies/${path}`, { ...init, headers: { 'Content-Type': 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : JSON.stringify(body));
  return body as T;
}

export function PlatformWorkspace() {
  const context = useQuery({ queryKey: ['platform-context'], queryFn: () => api<{ permissions: string[] }>('context/') });
  const can = (p: string) => context.data?.permissions.includes(p) ?? false;
  return <Tabs defaultValue="admin" className="space-y-6">
    <TabsList><TabsTrigger value="admin">Platform administration</TabsTrigger><TabsTrigger value="support">Company support</TabsTrigger></TabsList>
    <TabsContent value="admin"><PlatformAdministration can={can} /></TabsContent>
    <TabsContent value="support"><CompanySupport can={can} /></TabsContent>
  </Tabs>;
}

function PlatformAdministration({ can }: { can: (p: string) => boolean }) {
  const client = useQueryClient();
  const companies = useQuery({ queryKey: ['platform-companies'], queryFn: () => api<{ results: Company[] }>('') });
  const overview = useQuery({ queryKey: ['platform-overview'], queryFn: () => api<Overview>('overview/') });
  const [editing, setEditing] = useState<Company | null>(null);
  const [creating, setCreating] = useState(false);
  const refresh = () => { void client.invalidateQueries({ queryKey: ['platform-companies'] }); void client.invalidateQueries({ queryKey: ['platform-overview'] }); };
  const lifecycle = useMutation({ mutationFn: ({ company, active, reason }: { company: Company; active: boolean; reason: string }) => api(`${company.id}/${active ? 'activate' : 'suspend'}/`, { method: 'POST', body: JSON.stringify({ reason }) }), onSuccess: () => { refresh(); toast.success('Company status updated.'); }, onError: (e) => toast.error(e.message) });
  const configure = can('platform.configure_companies');
  const stats = (id: string) => overview.data?.companies.find((c) => c.id === id);
  return <section className="space-y-6">
    {overview.data && <div className="grid grid-cols-3 gap-3">{[['Companies', overview.data.totals.companies], ['Active', overview.data.totals.active], ['Active staff', overview.data.totals.members]].map(([label, value]) => <div key={label} className="rounded-md border border-border p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>)}</div>}
    <div className="flex justify-between items-center"><h2 className="text-lg font-semibold">Client companies</h2>{configure && <Button onClick={() => { setCreating(true); setEditing(null); }}>New company</Button>}</div>
    {companies.error && <p role="alert">{companies.error.message}</p>}
    {(creating || editing) && <CompanyForm company={editing} onDone={() => { setEditing(null); setCreating(false); refresh(); }} />}
    <div className="space-y-3">{companies.data?.results.map((c) => <article key={c.id} className="rounded-md border border-border p-4 flex flex-wrap items-center gap-4 justify-between">
      <div className="flex items-center gap-3"><CompanyLogo company={c} /><div><p className="font-semibold">{c.branding.display_name || c.name}</p><p className="text-sm text-muted-foreground">{c.slug} · {stats(c.id)?.members ?? 0} staff · {stats(c.id)?.administrators ?? 0} administrators · {c.enabled_modules.join(', ') || 'no modules'}</p></div><Badge variant={c.active ? 'default' : 'destructive'}>{c.active ? 'Active' : 'Suspended'}</Badge></div>
      <div className="flex flex-wrap gap-2">
        {configure && <Button variant="outline" size="sm" onClick={() => { setEditing(c); setCreating(false); }}>Configure</Button>}
        {configure && <Button variant={c.active ? 'destructive' : 'secondary'} size="sm" disabled={lifecycle.isPending} onClick={() => { const reason = window.prompt(`Reason to ${c.active ? 'suspend' : 'activate'} ${c.name}`); if (reason) lifecycle.mutate({ company: c, active: !c.active, reason }); }}>{c.active ? 'Suspend' : 'Activate'}</Button>}
        {can('platform.invite_company_admins') && <InviteAdmin company={c} />}
      </div></article>)}</div>
  </section>;
}

function CompanyForm({ company, onDone }: { company: Company | null; onDone: () => void }) {
  const [name, setName] = useState(company?.name ?? ''); const [slug, setSlug] = useState(company?.slug ?? '');
  const [display, setDisplay] = useState(company?.branding.display_name ?? ''); const [logo, setLogo] = useState(company?.branding.logo_url ?? '');
  const [modules, setModules] = useState<string[]>(company?.enabled_modules ?? MODULES);
  const save = useMutation({ mutationFn: () => { const branding = { ...(company?.branding ?? {}), display_name: display, logo_url: logo }; return company ? api(`${company.id}/`, { method: 'PATCH', body: JSON.stringify({ name, branding, enabled_modules: modules }) }) : api('', { method: 'POST', body: JSON.stringify({ name, slug, branding, enabled_modules: modules }) }); }, onSuccess: () => { toast.success('Company saved.'); onDone(); }, onError: (e) => toast.error(e.message) });
  return <form className="rounded-md border border-border p-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
    <h3 className="sm:col-span-2 font-semibold">{company ? `Configure ${company.name}` : 'New client company'}</h3>
    <div className="space-y-1"><Label htmlFor="co-name">Legal name</Label><Input id="co-name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
    <div className="space-y-1"><Label htmlFor="co-slug">Reference</Label><Input id="co-slug" required disabled={!!company} value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
    <div className="space-y-1"><Label htmlFor="co-display">Brand display name</Label><Input id="co-display" value={display} onChange={(e) => setDisplay(e.target.value)} /></div>
    <div className="space-y-1"><Label htmlFor="co-logo">Logo address</Label><Input id="co-logo" type="url" value={logo} onChange={(e) => setLogo(e.target.value)} /></div>
    <fieldset className="sm:col-span-2 flex flex-wrap gap-4"><legend className="text-sm font-medium mb-1">Enabled modules</legend>{MODULES.map((m) => <label key={m} className="flex items-center gap-2 capitalize"><Checkbox checked={modules.includes(m)} onCheckedChange={(v) => setModules(v ? [...modules, m] : modules.filter((x) => x !== m))} />{m}</label>)}</fieldset>
    <div className="sm:col-span-2 flex gap-2"><Button type="submit" disabled={save.isPending}>Save</Button><Button type="button" variant="ghost" onClick={onDone}>Cancel</Button></div>
  </form>;
}

function InviteAdmin({ company }: { company: Company }) {
  const invite = useMutation({ mutationFn: (email: string) => api(`${company.id}/administrator-invitations/`, { method: 'POST', body: JSON.stringify({ email, role: 'Company Administrator' }) }), onSuccess: () => toast.success('Administrator invitation sent.'), onError: (e) => toast.error(e.message) });
  return <Button variant="outline" size="sm" disabled={invite.isPending} onClick={() => { const email = window.prompt(`Company administrator email for ${company.name}`); if (email) invite.mutate(email); }}>Invite administrator</Button>;
}

function CompanySupport({ can }: { can: (p: string) => boolean }) {
  const companies = useQuery({ queryKey: ['platform-companies'], queryFn: () => api<{ results: Company[] }>('') });
  const [selected, setSelected] = useState(''); const [reason, setReason] = useState('');
  const [data, setData] = useState<Support | null>(null);
  const open = useMutation({ mutationFn: () => api<Support>(`${selected}/support/?reason=${encodeURIComponent(reason)}`), onSuccess: setData, onError: (e) => toast.error(e.message) });
  const act = useMutation({ mutationFn: ({ membership, active }: { membership: string; active: boolean }) => api(`${selected}/support-actions/`, { method: 'POST', body: JSON.stringify({ action: active ? 'reactivate_membership' : 'deactivate_membership', membership, reason, confirm_company: data?.company.id }) }), onSuccess: () => { toast.success('Support action recorded in the audit log.'); open.mutate(); }, onError: (e) => toast.error(e.message) });
  if (!can('support.view_operations')) return <p className="rounded-md border border-border p-4">Your platform account has no company support permission. Support access is granted separately from platform administration.</p>;
  const reasonOk = reason.trim().length >= 5;
  return <section className="space-y-5">
    <p className="text-sm text-muted-foreground">Support access is audited. It never allows approving submissions, issuing invoices, recording payments or settling payables.</p>
    <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] items-end">
      <div className="space-y-1"><Label htmlFor="support-company">Company</Label><select id="support-company" className="h-10 w-full rounded-md border border-input bg-background px-3" value={selected} onChange={(e) => { setSelected(e.target.value); setData(null); }}><option value="">Select a company…</option>{companies.data?.results.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="space-y-1"><Label htmlFor="support-reason">Support reason (recorded)</Label><Input id="support-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ticket number or reason" /></div>
      <Button disabled={!selected || !reasonOk || open.isPending} onClick={() => open.mutate()}>Open support view</Button>
    </div>
    {data && <div className="space-y-4">
      <div role="status" className="rounded-md border-2 border-primary bg-primary/10 p-4"><p className="text-sm">Active support company</p><p className="text-xl font-bold">{data.company.name}</p></div>
      <div><h3 className="font-semibold mb-2">Operations (read only)</h3>{data.operations.length ? <ul className="divide-y divide-border rounded-md border border-border">{data.operations.map((o) => <li key={o.id} className="p-3 flex justify-between"><span>{o.code} · {o.title}</span><Badge variant="outline">{o.status}</Badge></li>)}</ul> : <p className="text-muted-foreground">No operations.</p>}</div>
      <div><h3 className="font-semibold mb-2">Staff access</h3><ul className="divide-y divide-border rounded-md border border-border">{data.memberships.map((m) => <li key={m.id} className="p-3 flex flex-wrap gap-2 justify-between items-center"><span>{m.email || m.username} · {m.role} {!m.active && <Badge variant="destructive">Inactive</Badge>}</span>{can('support.manage_memberships') && <Button size="sm" variant="outline" disabled={!reasonOk || act.isPending} onClick={() => act.mutate({ membership: m.id, active: !m.active })}>{m.active ? 'Deactivate access' : 'Reactivate access'}</Button>}</li>)}</ul></div>
    </div>}
  </section>;
}
