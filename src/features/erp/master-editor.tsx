import { toast } from 'sonner';
import { FormModal } from './ui';
import { useWorkspace } from './store';
import { configurationCategories, masterSchema } from './production-model';

export function MasterEditor({ kind, open, onClose, initial = {} }: { kind: 'customer' | 'port' | 'truck' | 'configuration'; open: boolean; onClose: () => void; initial?: Record<string, string | number | boolean> }) {
  const ws = useWorkspace();
  const fields = kind === 'customer' ? [
    { name: 'name', label: 'Company name' }, { name: 'contact', label: 'Primary contact', required: false }, { name: 'email', label: 'Email', type: 'email', required: false }, { name: 'phone', label: 'Phone', required: false }, { name: 'industry', label: 'Industry', required: false }, { name: 'terms', label: 'Agreed payment terms', required: false },
  ] : kind === 'truck' ? [
    { name: 'truck', label: 'Truck registration' }, { name: 'driver', label: 'Driver' }, { name: 'ownership', label: 'Ownership', options: ['Company', 'Subcontractor'] }, { name: 'supplier', label: 'Owner / subcontractor' }, { name: 'capacity', label: 'Capacity (kg)', type: 'number' }, { name: 'trailer', label: 'Trailer registration', required: false }, { name: 'active', label: 'Available for new assignments', options: ['Yes', 'No'] },
  ] : kind === 'port' ? [
    { name: 'name', label: 'Port name' }, { name: 'country', label: 'Country' }, { name: 'active', label: 'Active', options: ['Yes', 'No'] },
  ] : [
    { name: 'category', label: 'Category', options: [...configurationCategories] }, { name: 'name', label: 'Name' }, { name: 'description', label: 'Description', required: false }, { name: 'active', label: 'Active', options: ['Yes', 'No'] },
  ];
  return <FormModal key={`${kind}-${open}-${String(initial['name'] || initial['truck'] || '')}`} open={open} onClose={onClose} title={`Save ${kind === 'configuration' ? 'configuration' : kind}`} submit="Save record" fields={fields.map((f) => ({ ...f, value: f.name === 'active' ? initial['active'] === false ? 'No' : 'Yes' : String(initial[f.name] ?? '') }))} onSubmit={async (input) => {
    const data = masterSchema.parse({ kind, input: { ...input, ...(kind !== 'customer' ? { active: input['active'] !== 'No' } : {}) } });
    await ws.saveMaster(data);
    toast.success('Company record saved permanently');
  }} />;
}