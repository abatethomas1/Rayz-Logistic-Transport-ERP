import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { reportQuerySchema, type ReportQuery } from './report-query';
import { financialSummary, convertedCost, type Operation, type Cost, type Trip, type Invoice, type Stage } from './model';

export async function authorizedReport(db: SupabaseClient<Database>, input: ReportQuery) {
  const q = reportQuerySchema.parse(input);
  const roleResult = await db.rpc('staff_role');
  if (roleResult.error) throw new Error(roleResult.error.message);
  const role = roleResult.data;
  const global = ['Business Owner', 'General Manager', 'Admin'].includes(role);
  const department = role.includes('Logistics') ? 'logistics' : ['Transport Manager', 'Transport Officer', 'Dispatcher'].includes(role) ? 'transport' : ['Finance Manager', 'Finance Officer', 'Accountant'].includes(role) ? 'finance' : '';
  if (!role || (!global && department !== q.department)) throw new Error('Report department access denied');
  const collected: { kind: string; data: unknown }[] = [];
  for (let start = 0; ; start += 500) {
    const result = await db.from('erp_records').select('kind,data').order('kind').order('id').range(start, start + 499);
    if (result.error) throw new Error(result.error.message);
    collected.push(...result.data);
    if (result.data.length < 500) break;
  }
  const read = <T>(kind: string) => collected.filter((r) => r.kind === kind).map((r) => r.data as T);
  const operations = read<Operation>('operations').filter((o) => (!q.operationId || o.id === q.operationId) && (!q.customer || o.customer === q.customer));
  const ids = new Set(operations.map((o) => o.id));
  const costs = read<Cost>('costs').filter((c) => ids.has(c.operationId));
  const trips = read<Trip>('trips').filter((t) => ids.has(t.operationId));
  const invoices = read<Invoice>('invoices').filter((i) => ids.has(i.operationId));
  const date = (d: string) => (!q.from || d >= q.from) && (!q.to || d <= q.to);
  let rows: Record<string, string | number>[] = [];
  if (q.department === 'logistics') {
    if (q.view === 'Internal') {
      const tasks = await db.from('erp_local_tasks').select('*').order('id');
      if (tasks.error) throw new Error(tasks.error.message);
      rows = tasks.data.filter((t) => ids.has(t.operation_id) && date(t.started || '')).map((t) => ({ Record: t.id, Operation: t.operation_id, Task: t.title, Authority: t.authority, Start: t.started || '', Completion: t.completed || '', Status: t.status }));
    } else if (q.view === 'Costs & Delays') rows = costs.filter((c) => date(c.date)).map((c) => ({ Record: c.id, Operation: c.operationId, Category: c.category, Supplier: c.supplier, Original_amount: c.amount, Currency: c.currency, Historical_rate: c.rate, Approved_cost_ETB: convertedCost(c), Status: c.approval, Date: c.date }));
    else rows = read<Stage>('stages').filter((s) => ids.has(s.operationId) && date(s.arrival)).map((s) => ({ Record: s.id, Operation: s.operationId, Port: s.port, Arrival: s.arrival, Release: s.release, Status: s.status }));
  } else if (q.department === 'transport') {
    if (q.view === 'Freight') {
      const freight = await db.from('erp_freight_items').select('*').order('id');
      if (freight.error) throw new Error(freight.error.message);
      rows = freight.data.filter((f) => ids.has(f.operation_id) && date(operations.find((o) => o.id === f.operation_id)?.opened || '')).map((f) => ({ Record: f.id, Operation: f.operation_id, Freight: f.identifier, Type: f.freight_type, Weight_kg: f.weight, Status: f.clearance_confirmed ? 'Clearance confirmed' : 'Blocked' }));
    } else if (q.view === 'Trucks') {
      const trucks = await db.from('erp_trucks').select('*').order('truck'); if (trucks.error) throw new Error(trucks.error.message);
      rows = trucks.data.filter((t) => trips.some((trip) => trip.truck === t.truck && date(trip.departure))).map((t) => ({ Record: t.truck, Driver: t.driver, Ownership: t.ownership, Trips: trips.filter((trip) => trip.truck === t.truck && date(trip.departure)).length, Status: t.active ? 'Active' : 'Inactive' }));
    } else rows = trips.filter((t) => date(t.departure)).map((t) => ({ Record: t.id, Operation: t.operationId, Truck: t.truck, Ownership: t.ownership, Departure: t.departure, Planned_arrival: t.arrival, Selling_charge_ETB: t.charge, Approved_cost_ETB: t.cost, Status: t.status }));
  } else if (q.view === 'Receivables') rows = invoices.filter((i) => !['Draft', 'Voided'].includes(i.status) && i.amount > i.paid && date(i.issued)).map((i) => ({ Record: i.id, Operation: i.operationId, Invoiced_ETB: i.amount, Received_ETB: i.paid, Receivable_ETB: i.amount - i.paid, Due: i.due, Status: i.status }));
  else if (q.view === 'Payables') rows = trips.filter((t) => t.ownership === 'Subcontractor' && t.status !== 'Cancelled' && t.cost > t.paid && date(t.departure)).map((t) => ({ Record: t.id, Operation: t.operationId, Supplier: t.supplier, Approved_cost_ETB: t.cost, Settled_ETB: t.paid, Payable_ETB: t.cost - t.paid, Status: t.paid ? 'Partially Settled' : 'Unsettled' }));
  else if (q.view === 'Costs') rows = costs.filter((c) => c.approval === 'Approved' && date(c.date)).map((c) => ({ Record: c.id, Operation: c.operationId, Supplier: c.supplier, Original_amount: c.amount, Currency: c.currency, Historical_rate: c.rate, Approved_cost_ETB: convertedCost(c), Status: c.approval }));
  else if (q.view === 'Cash') {
    const cash = await db.from('erp_cash_entries').select('*').order('transaction_date'); if (cash.error) throw new Error(cash.error.message);
    rows = cash.data.filter((c) => ids.has(c.operation_id) && date(c.transaction_date)).map((c) => ({ Record: c.id, Operation: c.operation_id, Type: c.direction, Amount_ETB: c.amount, Reference: c.reference, Date: c.transaction_date, Status: 'Posted' }));
  } else rows = operations.filter((o) => date(o.opened)).map((o) => {
    const s = financialSummary(o, costs, trips, invoices);
    return { Record: o.id, Operation: o.id, Customer: o.customer, Selling_charges_ETB: s.revenue, Invoiced_revenue_ETB: s.invoiced, Cash_collected_ETB: s.received, Approved_costs_ETB: s.costs, Unpaid_receivables_ETB: s.invoiced - s.received, Unsettled_payables_ETB: s.payables, Estimated_profit_ETB: s.profit, Status: o.status };
  });
  return rows.filter((r) => (!q.status || r['Status'] === q.status) && (!q.search || Object.values(r).some((v) => String(v).toLowerCase().includes(q.search.toLowerCase()))));
}