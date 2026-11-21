import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useWorkspace } from '@/features/erp/store';
import { Button, Empty, PageHeader, SectionHeading } from '@/features/erp/ui';
import { MasterEditor } from '@/features/erp/master-editor';
import { canMaintainMaster } from '@/features/erp/production-model';

export const Route = createFileRoute('/_authenticated/configuration')({
  head: () => ({ meta: [{ title: 'Company Configuration | Rayz Logistic and Transport' }, { name: 'description', content: 'Manage ports, freight types, container sizes, authorities and charge categories.' }, { property: 'og:title', content: 'Rayz Company Configuration' }, { property: 'og:description', content: 'Authorized company reference records and configuration.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Configuration,
});
function Configuration() {
  const ws = useWorkspace();
  const [editor, setEditor] = useState<{ kind: 'port' | 'configuration'; initial: Record<string, string | boolean> } | null>(null);
  const canEdit = canMaintainMaster(ws.role, 'port');
  return <><PageHeader title="Company configuration" description="Ports, freight types, container sizes and issuing authorities">
    {canEdit && <><Button variant="outline" onClick={() => setEditor({ kind: 'port', initial: {} })}><Plus />Add port</Button><Button onClick={() => setEditor({ kind: 'configuration', initial: {} })}><Plus />Add configuration</Button></>}
  </PageHeader>
  <section className="py-5 border-b border-border"><SectionHeading title="Ports" /><div className="table-scroll"><table><thead><tr><th>Port</th><th>Country</th><th>Status</th><th /></tr></thead><tbody>{ws.ports.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.country}</td><td>{p.active ? 'Active' : 'Inactive'}</td><td>{canEdit && <Button size="icon" variant="ghost" title="Edit port" aria-label={`Edit port ${p.name}`} onClick={() => setEditor({ kind: 'port', initial: p })}><Pencil /></Button>}</td></tr>)}</tbody></table>{!ws.ports.length && <Empty text="No ports have been configured." />}</div></section>
  <section className="py-5"><SectionHeading title="Reference records" /><div className="table-scroll"><table><thead><tr><th>Category</th><th>Name</th><th>Description</th><th>Status</th><th /></tr></thead><tbody>{ws.configuration.map((c) => <tr key={`${c.category}:${c.name}`}><td>{c.category.replaceAll('_', ' ')}</td><td>{c.name}</td><td>{c.description}</td><td>{c.active ? 'Active' : 'Inactive'}</td><td>{canEdit && <Button size="icon" variant="ghost" title="Edit configuration" aria-label={`Edit configuration ${c.name}`} onClick={() => setEditor({ kind: 'configuration', initial: c })}><Pencil /></Button>}</td></tr>)}</tbody></table>{!ws.configuration.length && <Empty text="No reference records have been configured." />}</div></section>
  {editor && <MasterEditor kind={editor.kind} open onClose={() => setEditor(null)} initial={editor.initial} />}
  </>;
}