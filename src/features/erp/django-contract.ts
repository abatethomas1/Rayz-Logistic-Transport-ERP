import type { Database, Json } from '@/integrations/supabase/types';

type Row<K extends keyof Database['public']['Tables']> = Database['public']['Tables'][K]['Row'];
export type CompanyMembership = { id: string; company: string; name: string; role: string; branding: { display_name?: string; logo_url?: string; primary_color?: string }; enabled_modules: string[] };
export type DjangoSession = { user: { id: string; email: string; name: string }; memberships: CompanyMembership[]; activeCompany: string | null; platformAdmin: boolean };
export type DjangoWorkspace = {
  userId: string; role: string | null; company: CompanyMembership;
  profile: { display_name: string; avatar_url: string }; records: { kind: string; id: string; data: Json }[];
  work: Row<'erp_work'>[]; staff: { id: string; display_name: string; role: string }[];
  assignments: Row<'operation_assignments'>[]; audit: Row<'erp_audit'>[];
  customers: Row<'erp_customers'>[]; ports: Row<'erp_ports'>[]; trucks: Row<'erp_trucks'>[]; configuration: Row<'erp_configuration'>[];
  freight: (Row<'erp_freight_items'> & { ready: boolean })[]; dependencies: Row<'erp_freight_dependencies'>[];
  tasks: Row<'erp_local_tasks'>[]; requests: Row<'erp_truck_requests'>[]; rates: Row<'erp_rate_cards'>[];
  cash: Row<'erp_cash_entries'>[]; tripDetails: Row<'erp_trips'>[]; advances: Row<'erp_customer_advances'>[];
  reversals: Row<'erp_cash_reversals'>[]; allocations: Row<'erp_advance_allocations'>[];
};
export type DjangoDocument = { id: string; name: string; operation_id: string; work_id: string | null; trip_id: string | null; area: string; category: string; created_at: string };