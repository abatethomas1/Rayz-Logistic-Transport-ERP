import { useState } from 'react';
import { Plus, Check, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from './store';
import { Badge, Button, Empty, FormModal, Modal, SectionHeading } from './ui';
import type { WorkArea } from './approval-model';

export function FreightPanel({ operation = '' }: { operation?: string }) {
  const ws = useWorkspace(); const [selected, setSelected] = useState(''); const [reason, setReason] = useState(''); const [dependency, setDependency] = useState('');
  const item = ws.freight.find((f) => f.id === selected);
  const canClear = ws.actor.general || ws.actor.department === 'logistics';
  const rows = ws.freight.filter((f) => !operation || f.operation_id === operation);
  async function act(ready: boolean) {
    if (!item) return;
    try { await ws.operationalAction({ action: 'freightClearance', id: item.id, ready, reason }); toast.success('Freight clearance recorded'); setSelected(''); } catch (error) { toast.error(error instanceof Error ? error.message : 'Action unavailable'); }
  }
  return <section className="py-4"><SectionHeading title="Freight readiness" /><div className="table-scroll"><table><thead><tr><th>Freight / operation</th><th>Type</th><th>Weight</th><th>Readiness</th><th /></tr></thead><tbody>{rows.map((f) => <tr key={f.id}><td>{f.identifier}<span className="cell-sub">{f.operation_id}</span></td><td>{f.freight_type}</td><td>{f.weight.toLocaleString()} kg</td><td><Badge status={f.ready ? 'Ready for dispatch' : 'On hold'} /><span className="cell-sub">{f.blocker || (f.ready ? '' : 'Relevant clearance dependency pending')}</span></td><td>{canClear && <Button size="sm" variant="outline" onClick={() => { setSelected(f.id); setReason(''); setDependency(''); }}>Clearance</Button>}</td></tr>)}</tbody></table>{!rows.length && <Empty text="No freight items in this operation." />}</div>
  <Modal open={Boolean(item)} onClose={() => setSelected('')} title={item ? `Clearance · ${item.identifier}` : 'Clearance'}>{item && <>
    <p>{item.operation_id} · {item.freight_type}</p>
    <h3>Linked clearance dependencies</h3>{ws.dependencies.filter((d) => d.freight_id === item.id).map((d) => <p key={d.stage_id || d.task_id}>{d.stage_id || d.task_id}</p>)}
    <label className="form-field">Relevant stage or task<select value={dependency} onChange={(e) => setDependency(e.target.value)}><option value="">Select dependency</option>{ws.stages.filter((s) => s.operationId === item.operation_id).map((s) => <option key={s.id} value={`stage:${s.id}`}>{s.port} · {s.id}</option>)}{ws.tasks.filter((t) => t.operation_id === item.operation_id).map((t) => <option key={t.id} value={`task:${t.id}`}>{t.title} · {t.id}</option>)}</select></label>
    <Button variant="outline" disabled={!dependency || ws.pending} onClick={async () => { try { const kind = dependency.split(':')[0]; const id = dependency.slice(dependency.indexOf(':') + 1); await ws.operationalAction({ action: 'dependency', id: item.id, ...(kind === 'stage' ? { stageId: id } : { taskId: id }) }); toast.success('Freight dependency linked'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not link dependency'); } }}><Link2 />Link dependency</Button>
    <label className="form-field">Clearance evidence or blocker<textarea value={reason} onChange={(e) => setReason(e.target.value)} required /></label>
    <div className="form-footer"><Button variant="outline" disabled={!reason.trim() || ws.pending} onClick={() => void act(false)}>Record blocker</Button><Button disabled={!reason.trim() || ws.pending} onClick={() => void act(true)}><Check />Confirm clearance</Button></div>
  </>}</Modal></section>;
}

export function MilestoneControls({ id, kind, status }: { id: string; kind: 'stageStatus' | 'taskStatus' | 'tripStatus'; status: string }) {
  const ws = useWorkspace(); const [next, setNext] = useState(''); const [reason, setReason] = useState('');
  const relevant = ws.actor.general || ws.actor.department === (kind === 'tripStatus' ? 'transport' : 'logistics');
  const targets = kind === 'tripStatus' ? ({ Assigned: ['Active', 'Cancelled'], Active: ['Arrived'], Arrived: ['Offloaded'], Offloaded: ['Completed'] } as Record<string, string[]>)[status] ?? [] : ({ Pending: ['In clearance', 'On hold'], 'In clearance': ['Released', 'On hold'], 'On hold': ['In clearance'] } as Record<string, string[]>)[status] ?? [];
  if (!relevant || !targets.length) return null;
  return <><div className="flex flex-wrap gap-2 my-4">{targets.map((target) => <Button key={target} variant="outline" disabled={ws.pending} onClick={() => { setNext(target); setReason(''); }}>{target === 'Active' ? 'Record departure' : target === 'Arrived' ? 'Record arrival' : target === 'Released' ? 'Record release' : target}</Button>)}</div>
    <Modal open={Boolean(next)} onClose={() => setNext('')} title={`Record ${next.toLowerCase()}`}><label className="form-field">Reference / reason<textarea value={reason} onChange={(e) => setReason(e.target.value)} /></label><Button disabled={ws.pending || (['On hold', 'Cancelled'].includes(next) && !reason.trim())} onClick={async () => { try { await ws.operationalAction({ action: kind, id, status: next as 'Active', reason }); setNext(''); toast.success('Milestone saved'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save milestone'); } }}>Save milestone</Button></Modal></>;
}

export function LocalTaskPanel({ operation = '' }: { operation?: string }) {
  const ws = useWorkspace(); const [open, setOpen] = useState(false);
  const rows = ws.tasks.filter((t) => !operation || t.operation_id === operation);
  return <section className="py-4"><SectionHeading title="Local clearance tasks">{ws.role !== 'Admin' && (ws.actor.general || ws.actor.department === 'logistics') && <Button size="sm" onClick={() => setOpen(true)}><Plus />Add task</Button>}</SectionHeading>{rows.map((t) => <div className="py-4 border-b border-border" key={t.id}><strong>{t.title}</strong><p className="text-muted-foreground">{t.operation_id} · {t.authority || 'Authority not specified'}</p><Badge status={t.status} /><MilestoneControls id={t.id} kind="taskStatus" status={t.status} /></div>)}{!rows.length && <Empty text="No posted local clearance tasks." />}
  <FormModal open={open} onClose={() => setOpen(false)} title="Create local clearance task" submit="Save draft" fields={[{ name: 'operation', label: 'Freight operation', options: ws.operations.filter((o) => !operation || o.id === operation).map((o) => o.id) }, { name: 'title', label: 'Task name' }, { name: 'authority', label: 'Issuing authority', options: ['Not specified', ...ws.configuration.filter((c) => c.category === 'authority' && c.active).map((c) => c.name)] }, { name: 'date', label: 'Start date', type: 'date' }]} onSubmit={async (d) => { await ws.createWork('internal', 'Local clearance task', d['operation'] || '', d['title'] || '', 0, { ...d, authority: d['authority'] === 'Not specified' ? '' : d['authority'] || '' }); toast.success('Task draft saved for review'); }} />
  </section>;
}

export function TruckRequestPanel({ operation = '' }: { operation?: string }) {
  const ws = useWorkspace(); const [open, setOpen] = useState(false);
  return <section className="py-4"><SectionHeading title="Truck requests">{ws.role !== 'Admin' && (ws.actor.general || ws.actor.department === 'transport') && <Button size="sm" onClick={() => setOpen(true)}><Plus />Request trucks</Button>}</SectionHeading><div className="table-scroll"><table><thead><tr><th>Request</th><th>Operation</th><th>Trucks requested</th><th>Status</th></tr></thead><tbody>{ws.requests.filter((r) => !operation || r.operation_id === operation).map((r) => <tr key={r.id}><td>{r.id}</td><td>{r.operation_id}</td><td>{r.truck_count}</td><td>{r.status}</td></tr>)}</tbody></table>{!ws.requests.length && <Empty text="No posted truck requests." />}</div>
  <FormModal open={open} onClose={() => setOpen(false)} title="Request trucks" submit="Save draft" fields={[{ name: 'operation', label: 'Freight operation', options: ws.operations.filter((o) => !operation || o.id === operation).map((o) => o.id) }, { name: 'count', label: 'Number of trucks', type: 'number' }]} onSubmit={async (d) => { const n = Number(d['count']); if (!Number.isInteger(n) || n < 1) throw new Error('Enter a positive whole truck count.'); await ws.createWork('transport', 'Truck request', d['operation'] || '', `${n} truck request`, 0, d); toast.success('Truck request draft saved for review'); }} />
  </section>;
}