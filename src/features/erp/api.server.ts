import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database, Json } from '@/integrations/supabase/types';
import { masterSchema, operationalSchema } from './production-model';
import { authorizedReport } from './reports.server';

export class ApiError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
export async function apiClient(request: Request): Promise<SupabaseClient<Database>> {
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) throw new ApiError(401, 'authentication_required', 'A staff bearer token is required.');
  const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new ApiError(503, 'configuration_unavailable', 'Authentication is unavailable.');
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const user = await db.auth.getUser(token);
  if (user.error || !user.data.user) throw new ApiError(401, 'invalid_session', 'The staff session is invalid or expired.');
  const role = await db.from('user_roles').select('role').eq('user_id', user.data.user.id).maybeSingle();
  if (role.error || !role.data) throw new ApiError(403, 'staff_access_required', 'An assigned staff role is required.');
  return db;
}
const resources = {
  customers: { table: 'erp_customers', key: 'name', order: 'name' },
  ports: { table: 'erp_ports', key: 'name', order: 'name' },
  configuration: { table: 'erp_configuration', key: 'name', order: 'name' },
  trucks: { table: 'erp_trucks', key: 'truck', order: 'truck' },
  operations: { table: 'erp_records', key: 'id', order: 'id', kind: 'operations' },
  stages: { table: 'erp_records', key: 'id', order: 'id', kind: 'stages' },
  assignments: { table: 'erp_records', key: 'id', order: 'id', kind: 'trips' },
  trips: { table: 'erp_records', key: 'id', order: 'id', kind: 'trips' },
  costs: { table: 'erp_records', key: 'id', order: 'id', kind: 'costs' },
  invoices: { table: 'erp_records', key: 'id', order: 'id', kind: 'invoices' },
  'local-tasks': { table: 'erp_local_tasks', key: 'id', order: 'id' },
  freight: { table: 'erp_freight_items', key: 'id', order: 'id' },
  'truck-requests': { table: 'erp_truck_requests', key: 'id', order: 'id' },
  'rate-cards': { table: 'erp_rate_cards', key: 'id', order: 'id' },
  payments: { table: 'erp_cash_entries', key: 'id', order: 'transaction_date' },
  settlements: { table: 'erp_cash_entries', key: 'id', order: 'transaction_date' },
  advances: { table: 'erp_customer_advances', key: 'id', order: 'received_date' },
  allocations: { table: 'erp_advance_allocations', key: 'id', order: 'created_at' },
  reversals: { table: 'erp_cash_reversals', key: 'id', order: 'occurred_at' },
  'cost-postings': { table: 'erp_cost_postings', key: 'id', order: 'posted_at' },
  approvals: { table: 'erp_work', key: 'id', order: 'id' },
  documents: { table: 'erp_documents', key: 'id', order: 'created_at' },
  audit: { table: 'erp_audit', key: 'id', order: 'occurred_at' },
} as const;
const listSchema = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), page_size: z.coerce.number().int().min(1).max(100).default(25), search: z.string().max(200).default(''), operation: z.string().max(200).optional(), status: z.string().max(100).optional(), order: z.enum(['asc', 'desc']).default('asc') });
function dbError(error: { code: string; message: string }) {
  const denied = error.code === '42501' || /required|access|manager|assigned|approve your own/i.test(error.message);
  throw new ApiError(denied ? 403 : error.code === '23505' ? 409 : 422, denied ? 'permission_denied' : 'validation_error', error.message);
}
const jsonValue: z.ZodType<Json> = z.lazy(() => z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]));
export async function handleApi(request: Request, splat: string) {
  const db = await apiClient(request); const url = new URL(request.url); const [resource, id, command] = splat.split('/').map(decodeURIComponent);
  if (request.method === 'GET' && resource === 'auth' && id === 'me') {
    const [profile, role] = await Promise.all([db.from('profiles').select('*').single(), db.rpc('staff_role')]); if (profile.error) dbError(profile.error); if (role.error) dbError(role.error); return { data: { profile: profile.data, role: role.data } };
  }
  if (request.method === 'GET' && resource === 'users') { const result = await db.rpc('staff_directory'); if (result.error) dbError(result.error); return { data: result.data }; }
  if (request.method === 'GET' && resource === 'reports') {
    const department = id || 'finance';
    if (!['logistics', 'transport', 'finance'].includes(department)) throw new ApiError(404, 'not_found', 'Report not found.');
    const rows = await authorizedReport(db, { department: department as 'finance', ...Object.fromEntries(url.searchParams) });
    return { data: rows, meta: { count: rows.length } };
  }
  if (request.method === 'GET' && resource && resource in resources) {
    const spec = resources[resource as keyof typeof resources]; const q = listSchema.parse(Object.fromEntries(url.searchParams));
    // Runtime resource names are a closed registry; filters remain validated above.
    const resourceClient: SupabaseClient = db;
    let query = resourceClient.from(spec.table).select('*', { count: 'exact' });
    if ('kind' in spec) query = query.eq('kind', spec.kind);
    if (resource === 'payments' || resource === 'settlements') query = query.eq('direction', resource === 'payments' ? 'Receipt' : 'Settlement');
    if (resource === 'documents') query = query.eq('ready', true);
    if (id) query = query.eq(spec.key, id);
    if (q.search) query = query.ilike(spec.key, `%${q.search.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
    if (q.operation) query = query.eq('operation_id', q.operation);
    if (q.status) query = query.eq('kind' in spec ? 'data->>status' : 'status', q.status);
    const result = await query.order(spec.order, { ascending: q.order === 'asc' }).range((q.page - 1) * q.page_size, q.page * q.page_size - 1);
    if (result.error) dbError(result.error);
    const rows = result.data ?? [];
    if (id && !rows.length) throw new ApiError(404, 'not_found', 'Record not found in your authorized work.');
    return { data: rows, meta: { page: q.page, page_size: q.page_size, total: result.count } };
  }
  if (request.method === 'POST') {
    if (Number(request.headers.get('Content-Length') || 0) > 65536) throw new ApiError(413, 'payload_too_large', 'Request is too large.');
    const raw = await request.text(); if (raw.length > 65536) throw new ApiError(413, 'payload_too_large', 'Request is too large.');
    let body: unknown; try { body = JSON.parse(raw); } catch { throw new ApiError(400, 'invalid_json', 'Request must contain valid JSON.'); }
    if (resource === 'master-data') { const data = masterSchema.parse(body); const result = await db.rpc('erp_master_action', data); if (result.error) dbError(result.error); return { data: true }; }
    if (resource === 'operational-actions') { const data = operationalSchema.parse(body); const result = await db.rpc('erp_operational_action', { action: data.action, input: data }); if (result.error) dbError(result.error); return { data: result.data }; }
    if (resource === 'work') {
      const commands = { submit: 'Submitted', approve: 'Approved', return: 'Returned', edit: 'edit', delete: 'delete', assign: 'assign', post: 'post' } as const;
      const data = z.record(jsonValue).parse(body);
      if (id && command && command in commands) {
        const action = commands[command as keyof typeof commands];
        const operational = action === 'post' && (await db.from('erp_work').select('kind').eq('id', id).maybeSingle()).data;
        const result = operational && !['Invoice', 'Payment', 'Settlement', 'Reversal', 'Void'].includes(operational.kind) ? await db.rpc('erp_operational_action', { action, input: { ...data, id } }) : await db.rpc(action === 'post' ? 'erp_financial_action' : 'workspace_action', { action, input: { ...data, id } });
        if (result.error) dbError(result.error); return { data: result.data };
      }
      if (!id) { const result = await db.rpc('workspace_action', { action: 'create', input: data }); if (result.error) dbError(result.error); return { data: result.data }; }
    }
    if (resource === 'operations' && !id) { const data = z.object({ operation: jsonValue, stages: z.array(jsonValue).min(1).max(50) }).parse(body); const result = await db.rpc('workspace_action', { action: 'createOperation', input: data }); if (result.error) dbError(result.error); return { data: result.data }; }
    if (resource === 'users' && id === 'assign') {
      const data = z.object({ staff_id: z.string().uuid(), staff_role: z.string().max(100), operation_id: z.string().max(200).optional(), work_area: z.string().max(50).optional() }).parse(body); const result = await db.rpc('assign_staff', { staff_id: data.staff_id, staff_role: data.staff_role, ...(data.operation_id ? { operation_id: data.operation_id } : {}), ...(data.work_area ? { work_area: data.work_area } : {}) }); if (result.error) dbError(result.error); return { data: true };
    }
  }
  throw new ApiError(404, 'not_found', 'API resource or action not found.');
}