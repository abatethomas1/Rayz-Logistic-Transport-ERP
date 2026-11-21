import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import type { Json } from '@/integrations/supabase/types';
import { roles, type Role, type Operation, type Stage, type Trip, type Cost, type Invoice, type Doc, type Activity } from './model';
import { actorFor, type WorkRecord, type WorkArea, type WorkKind } from './approval-model';
import { loadWorkspace, mutateWorkspace, saveMaster, operationalAction } from './workspace.functions';
import type { MasterInput, OperationalInput } from './production-model';
import { useStaffAuth } from './auth';

function useWorkspaceState() {
  const { session } = useStaffAuth();
  const fetchWorkspace = useServerFn(loadWorkspace);
  const mutate = useServerFn(mutateWorkspace);
  const master = useServerFn(saveMaster);
  const operational = useServerFn(operationalAction);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['workspace', session?.activeCompany, session?.user.id], queryFn: () => fetchWorkspace(), enabled: Boolean(session?.activeCompany), refetchOnWindowFocus: true });
  const refreshRecords = () => queryClient.invalidateQueries({ predicate: (q) => ['workspace', 'report', 'documents'].includes(String(q.queryKey[0])) });
  const mutation = useMutation({ mutationFn: (data: { action: string; input: Json }) => mutate({ data }), onSuccess: refreshRecords });
  const masterMutation = useMutation({ mutationFn: (data: MasterInput) => master({ data }), onSuccess: refreshRecords });
  const operationalMutation = useMutation({ mutationFn: (data: OperationalInput) => operational({ data }), onSuccess: refreshRecords });
  const data = query.data;
  const role: Role = roles.find((r) => r === data?.role) ?? 'Admin';
  const actor = { ...actorFor(role), id: data?.userId ?? '', name: data?.profile?.display_name || role };
  const [viewState, setViewState] = useState<Record<string, string>>({});
  function rows<T>(kind: string): T[] { return (data?.records.filter((r) => r.kind === kind).map((r) => r.data) ?? []) as T[]; }
  const work: WorkRecord[] = (data?.work ?? []).map((w) => ({ id: w.id, operationId: w.operation_id, area: w.area as WorkArea, kind: w.kind as WorkKind, title: w.title, amount: Number(w.amount), details: w.details, documents: w.documents as string[], dependencies: w.dependencies, createdBy: w.created_by, assignedTo: w.assigned_to, submittedBy: w.submitted_by ?? '', status: w.status as WorkRecord['status'], payload: w.payload as Record<string, string>, history: w.history as WorkRecord['history'] }));
  function action(action: string, input: Json) { return mutation.mutateAsync({ action, input }); }
  async function createWork(area: WorkArea, kind: WorkKind, operationId: string, title: string, amount = 0, payload: Record<string, string> = {}, details = '', documents: string[] = []) {
    const id = `WK-${crypto.randomUUID()}`;
    await action('create', { id, area, kind, operationId, title, amount, payload, details, documents });
    return id;
  }
  return {
    role: role as Role, actor, work, company: data?.company ?? { id: '', company: '', name: '', role: '', branding: {}, enabled_modules: [] }, profile: data?.profile, staff: data?.staff ?? [], assignments: data?.assignments ?? [],
    customers: (data?.customers ?? []).map((c) => ({ ...c, initials: c.name.split(/\s+/).slice(0, 2).map((s) => s[0] ?? '').join('').toUpperCase() })),
    fleet: data?.trucks ?? [], ports: data?.ports ?? [], configuration: data?.configuration ?? [], freight: data?.freight ?? [], dependencies: data?.dependencies ?? [], tasks: data?.tasks ?? [], requests: data?.requests ?? [],
    rates: (data?.rates ?? []).map((r) => ({ ...r, type: r.ownership, freight: r.freight_type, from: r.effective_from, to: r.effective_to })), cash: data?.cash ?? [], tripDetails: data?.tripDetails ?? [],
    advances: data?.advances ?? [], reversals: data?.reversals ?? [], allocations: data?.allocations ?? [],
    saveMaster: (data: MasterInput) => masterMutation.mutateAsync(data),
    operationalAction: (data: OperationalInput) => operationalMutation.mutateAsync(data),
    operations: rows<Operation>('operations'), stages: rows<Stage>('stages'), trips: rows<Trip>('trips'), costs: rows<Cost>('costs'), invoices: rows<Invoice>('invoices'), documents: rows<Doc>('documents'),
    activity: [...(data?.audit ?? []).map((a): Activity => ({ id: a.id, operationId: a.operation_id, actor: data?.staff.find((s) => s.id === a.actor_id)?.display_name || a.actor_id, text: `${a.action} · ${a.record_id}${a.reason ? ` · ${a.reason}` : ''}`, time: a.occurred_at })), ...rows<Activity>('activity')],
    createWork,
    editWork: (id: string, fields: Pick<WorkRecord, 'title' | 'amount' | 'details' | 'documents'> & { payload?: Record<string, string> }) => action('edit', { id, ...fields }),
    deleteWork: (id: string) => action('delete', { id }),
    decideWork: (id: string, decision: 'Submitted' | 'Approved' | 'Returned', reason = '') => action(decision, { id, reason }),
    assignWork: (id: string, assignedTo: string) => action('assign', { id, assignedTo }),
    postWork: (id: string) => action('post', { id }),
    createOperation: (operation: Operation, stages: Stage[]) => action('createOperation', { operation: operation as unknown as Json, stages: stages as unknown as Json }),
    viewState, setViewState, pending: mutation.isPending || masterMutation.isPending || operationalMutation.isPending,
    loading: query.isPending, error: query.error, hasRole: roles.some((r) => r === data?.role), refresh: () => query.refetch(),
  };
}
type Workspace = ReturnType<typeof useWorkspaceState>;
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const state = useWorkspaceState();
  const { signOut, user } = useStaffAuth();
  if (state.loading) return <main className="min-h-screen flex items-center justify-center bg-background"><p role="status">Loading your assigned workspace…</p></main>;
  if (state.error) return <main className="min-h-screen flex flex-col gap-4 items-center justify-center bg-background"><p role="alert">{state.error.message}</p><Button onClick={() => void state.refresh()}>Try again</Button><Button variant="outline" onClick={() => void signOut()}>Sign out</Button></main>;
  if (!state.hasRole) return <main className="min-h-screen flex items-center justify-center bg-background p-6"><section className="max-w-md space-y-5"><div className="brand-mark">R</div><h1 className="text-2xl font-bold">Staff access pending</h1><p>{user?.email}</p><p className="text-muted-foreground">Your account is ready. An administrator must assign your staff role and operations before you can enter the workspace.</p><div className="flex gap-3"><Button onClick={() => void state.refresh()}>Check access</Button><Button variant="outline" onClick={() => void signOut()}>Sign out</Button></div></section></main>;
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useWorkspace() { const context = useContext(Context); if (!context) throw new Error('Workspace provider required'); return context; }
export function useSessionField(key: string, initial = ''): [string, (value: string) => void] {
  const { viewState, setViewState } = useWorkspace();
  return [viewState[key] ?? initial, (value) => setViewState((state) => ({ ...state, [key]: value }))];
}
