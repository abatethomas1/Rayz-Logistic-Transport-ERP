import { z } from 'zod';

const text = z.string().trim().min(1).max(200);
const optionalText = z.string().trim().max(500).default('');
export const configurationCategories = ['freight_type', 'container_size', 'charge_category', 'authority', 'currency'] as const;
export const masterSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('customer'), input: z.object({ name: text, contact: optionalText, email: z.union([z.string().email().max(200), z.literal('')]).default(''), phone: optionalText, industry: optionalText, terms: optionalText }) }),
  z.object({ kind: z.literal('port'), input: z.object({ name: text, country: text, active: z.boolean().default(true) }) }),
  z.object({ kind: z.literal('truck'), input: z.object({ truck: text, driver: text, ownership: z.enum(['Company', 'Subcontractor']), supplier: text, capacity: z.coerce.number().finite().positive(), trailer: optionalText, active: z.boolean().default(true) }) }),
  z.object({ kind: z.literal('configuration'), input: z.object({ category: z.enum(configurationCategories), name: text, description: optionalText, active: z.boolean().default(true) }) }),
]);
export type MasterInput = z.input<typeof masterSchema>;
export const operationalSchema = z.object({
  action: z.enum(['post', 'stageStatus', 'taskStatus', 'tripStatus', 'freightClearance', 'dependency', 'assignStage']),
  id: text,
  status: z.enum(['Pending', 'In clearance', 'Released', 'On hold', 'Active', 'Arrived', 'Offloaded', 'Completed', 'Cancelled']).optional(),
  reason: z.string().trim().max(2000).default(''),
  stageId: text.optional(), taskId: text.optional(), assignedTo: z.string().uuid().optional(),
  ready: z.boolean().optional(), occurredAt: z.string().datetime().optional(),
});
export type OperationalInput = z.input<typeof operationalSchema>;
export type FreightItem = { id: string; operation_id: string; identifier: string; freight_type: string; weight: number; clearance_confirmed: boolean; blocker: string };
export type FreightDependency = { freight_id: string; stage_id: string | null; task_id: string | null };
export function freightReady(item: FreightItem, dependencies: FreightDependency[], stages: { id: string; status: string }[], tasks: { id: string; status: string }[]) {
  return item.clearance_confirmed && dependencies.filter((d) => d.freight_id === item.id).every((d) => d.stage_id ? stages.some((s) => s.id === d.stage_id && s.status === 'Released') : tasks.some((t) => t.id === d.task_id && t.status === 'Released'));
}
export function canMaintainMaster(role: string, kind: string) {
  return ['Admin', 'Business Owner', 'General Manager'].includes(role) || (kind === 'truck' && role === 'Transport Manager');
}
export function convertNewCost(amount: number, rate: number, currency: string) {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) throw new Error('Positive finite amounts and rates are required.');
  if (currency === 'ETB' && rate !== 1) throw new Error('ETB rate must be 1.');
  return currency === 'ETB' ? amount : Math.round(amount * rate);
}
export const invoiceTaxRate = 0;
export function independentReversalApprover(role: string, actorId: string, createdBy: string, submittedBy: string) {
  return ['Finance Manager', 'General Manager'].includes(role) && actorId !== createdBy && actorId !== submittedBy;
}
export function availableAdvance(amount: number, allocated: number) { return amount - allocated; }
export function duplicateContainersWithinOperation(identifiers: string[]) { return new Set(identifiers.map((s) => s.trim().toUpperCase())).size !== identifiers.length; }