import { useState, type FormEvent } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from './store';
import { uploadDocument, listDocuments } from './production.functions';
import { Button, SectionHeading, Empty, Modal } from './ui';
import type { WorkArea } from './approval-model';

export function DocumentPanel({ operation = '', department = '', workId = '', tripId = '' }: { operation?: string; department?: string; workId?: string; tripId?: string }) {
  const ws = useWorkspace();
  const fetchDocuments = useServerFn(listDocuments); const mutate = useServerFn(uploadDocument); const cache = useQueryClient();
  const documents = useQuery({ queryKey: ['documents', ws.company.company, ws.actor.id], queryFn: () => fetchDocuments() });
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const canUpload = ws.role !== 'Admin' && (ws.actor.general || ws.actor.manager || Boolean(ws.actor.area));
  const rows = (documents.data ?? []).filter((d) => (!operation || d.operation_id === operation) && (!department || d.area === department) && (!workId || d.work_id === workId) && (!tripId || d.trip_id === tripId));
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const data = new FormData(form); const file = data.get('file');
    if (!(file instanceof File) || !file.size) return;
    setBusy(true);
    try {
      data.set('operationId', String(data.get('operation')));
      if (workId) data.set('workId', workId);
      if (tripId) data.set('tripId', tripId);
      await mutate({ data });
      await Promise.all([cache.invalidateQueries({ queryKey: ['documents'] }), ws.refresh()]);
      setOpen(false); toast.success('Private document uploaded and attached');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Upload failed'); } finally { setBusy(false); }
  }
  async function download(id: string, name: string) {
    try {
      const response = await fetch(`/api/v1/documents/${encodeURIComponent(id)}/download/`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Document not available in your company.');
      const { downloadBlob } = await import('./report-export'); downloadBlob(await response.blob(), name);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Document unavailable'); }
  }
  return <section className="py-4">
    <SectionHeading title="Private documents">{canUpload && <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Upload />Upload document</Button>}</SectionHeading>
    {documents.isPending && <p role="status">Loading documents…</p>}
    {documents.error && <p role="alert">{documents.error.message}</p>}
    {rows.map((d) => <div className="audit-item" key={d.id}><FileText size={18} /><div><strong>{d.name}</strong><p>{d.operation_id} · {d.category} · {d.created_at.slice(0, 10)}</p></div><Button size="icon" variant="ghost" title="Download private document" aria-label={`Download ${d.name}`} onClick={() => void download(d.id, d.name)}><Download /></Button></div>)}
    {!documents.isPending && !rows.length && <Empty text="No private documents attached." />}
    <Modal open={open} onClose={() => setOpen(false)} title="Upload private document"><form className="record-form" onSubmit={upload}>
      <label className="form-field">Freight operation<select name="operation" defaultValue={operation} required>{ws.operations.filter((o) => !operation || o.id === operation).map((o) => <option key={o.id}>{o.id}</option>)}</select></label>
      <label className="form-field">Department<select name="area" defaultValue={department || ws.actor.area || 'external'} required>{(['external', 'internal', 'transport', 'finance'] as const).filter((area) => (!department || department === area) && (ws.actor.general || ws.actor.department === (['external', 'internal'].includes(area) ? 'logistics' : area))).map((a) => <option key={a}>{a}</option>)}</select></label>
      <label className="form-field">Category<input name="category" required defaultValue={tripId ? 'Proof of delivery' : workId ? 'Supporting document' : ''} /></label>
      <label className="form-field">File<input name="file" type="file" accept="application/pdf,image/png,image/jpeg" required /></label>
      <div className="form-footer"><Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy} type="submit"><Upload />{busy ? 'Uploading…' : 'Upload document'}</Button></div>
    </form></Modal>
  </section>;
}