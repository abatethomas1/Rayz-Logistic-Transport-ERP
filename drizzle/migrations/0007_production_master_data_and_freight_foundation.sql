CREATE TABLE public.erp_customers (id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE, name text PRIMARY KEY CHECK(length(trim(name))>0), contact text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', industry text NOT NULL DEFAULT '', terms text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.erp_customers TO authenticated; GRANT ALL ON public.erp_customers TO service_role;
ALTER TABLE public.erp_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_customers_read ON public.erp_customers FOR SELECT TO authenticated USING(public.staff_role()<>'');
CREATE TABLE public.erp_ports (name text PRIMARY KEY CHECK(length(trim(name))>0), country text NOT NULL CHECK(length(trim(country))>0), active boolean NOT NULL DEFAULT true);
GRANT SELECT ON public.erp_ports TO authenticated; GRANT ALL ON public.erp_ports TO service_role;
ALTER TABLE public.erp_ports ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_ports_read ON public.erp_ports FOR SELECT TO authenticated USING(public.staff_role()<>'');
CREATE TABLE public.erp_trucks (truck text PRIMARY KEY CHECK(length(trim(truck))>0), driver text NOT NULL, ownership text NOT NULL CHECK(ownership IN ('Company','Subcontractor')), supplier text NOT NULL, capacity numeric NOT NULL CHECK(capacity>0 AND capacity::text NOT IN ('NaN','Infinity','-Infinity')), trailer text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true);
GRANT SELECT ON public.erp_trucks TO authenticated; GRANT ALL ON public.erp_trucks TO service_role;
ALTER TABLE public.erp_trucks ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_trucks_read ON public.erp_trucks FOR SELECT TO authenticated USING(public.staff_role() IN ('Admin','Business Owner','General Manager','Transport Manager','Transport Officer','Dispatcher','Finance Manager','Finance Officer','Accountant'));
CREATE TABLE public.erp_configuration (category text NOT NULL CHECK(category IN ('freight_type','container_size','charge_category','authority','currency')), name text NOT NULL CHECK(length(trim(name))>0), description text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true, PRIMARY KEY(category,name));
GRANT SELECT ON public.erp_configuration TO authenticated; GRANT ALL ON public.erp_configuration TO service_role;
ALTER TABLE public.erp_configuration ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_configuration_read ON public.erp_configuration FOR SELECT TO authenticated USING(public.staff_role()<>'');
INSERT INTO public.erp_customers(name) SELECT DISTINCT data->>'customer' FROM public.erp_records WHERE kind='operations' AND nullif(data->>'customer','') IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO public.erp_ports(name,country) SELECT DISTINCT ON (data->>'port') data->>'port',coalesce(nullif(data->>'country',''),'Unspecified') FROM public.erp_records WHERE kind='stages' AND nullif(data->>'port','') IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO public.erp_configuration(category,name) SELECT DISTINCT 'freight_type',data->>'type' FROM public.erp_records WHERE kind='operations' AND nullif(data->>'type','') IS NOT NULL ON CONFLICT DO NOTHING;
CREATE TABLE public.erp_operations (id text PRIMARY KEY, customer_name text NOT NULL REFERENCES public.erp_customers(name), origin text NOT NULL, destination text NOT NULL, freight_type text NOT NULL, quantity integer NOT NULL CHECK(quantity>0), weight numeric NOT NULL CHECK(weight>0), customer_charge numeric NOT NULL CHECK(customer_charge>=0 AND customer_charge::text NOT IN ('NaN','Infinity','-Infinity')), opened date NOT NULL, due date NOT NULL, status text NOT NULL);
GRANT SELECT ON public.erp_operations TO authenticated; GRANT ALL ON public.erp_operations TO service_role;
ALTER TABLE public.erp_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY assigned_operations_read ON public.erp_operations FOR SELECT TO authenticated USING(public.operation_access(id));
INSERT INTO public.erp_operations SELECT id,data->>'customer',data->>'origin',data->>'destination',data->>'type',(data->>'quantity')::integer,(data->>'weight')::numeric,(data->>'charge')::numeric,(data->>'opened')::date,(data->>'due')::date,data->>'status' FROM public.erp_records WHERE kind='operations';
CREATE TABLE public.erp_local_tasks (id text PRIMARY KEY, operation_id text NOT NULL REFERENCES public.erp_operations(id), title text NOT NULL, authority text NOT NULL DEFAULT '', assigned_to uuid NOT NULL, started date, completed date, status text NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','In clearance','Released','On hold')), source_work_id text NOT NULL UNIQUE REFERENCES public.erp_work(id));
GRANT SELECT ON public.erp_local_tasks TO authenticated; GRANT ALL ON public.erp_local_tasks TO service_role;
ALTER TABLE public.erp_local_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY assigned_local_tasks_read ON public.erp_local_tasks FOR SELECT TO authenticated USING(public.general_approver() OR public.staff_role()='Admin' OR public.department_manager('internal') OR (assigned_to=auth.uid() AND public.staff_area()='internal'));
CREATE TABLE public.erp_freight_items (id text PRIMARY KEY, operation_id text NOT NULL REFERENCES public.erp_operations(id), identifier text NOT NULL CHECK(length(trim(identifier))>0), freight_type text NOT NULL, weight numeric NOT NULL CHECK(weight>0 AND weight::text NOT IN ('NaN','Infinity','-Infinity')), clearance_confirmed boolean NOT NULL DEFAULT false, clearance_by uuid, clearance_at timestamptz, blocker text NOT NULL DEFAULT 'Clearance not confirmed', UNIQUE(operation_id,identifier));
GRANT SELECT ON public.erp_freight_items TO authenticated; GRANT ALL ON public.erp_freight_items TO service_role;
ALTER TABLE public.erp_freight_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY assigned_freight_read ON public.erp_freight_items FOR SELECT TO authenticated USING(public.operation_access(operation_id));
CREATE TABLE public.erp_freight_dependencies (freight_id text NOT NULL REFERENCES public.erp_freight_items(id), stage_id text, task_id text REFERENCES public.erp_local_tasks(id), CHECK((stage_id IS NOT NULL)::integer+(task_id IS NOT NULL)::integer=1), UNIQUE(freight_id,stage_id), UNIQUE(freight_id,task_id));
GRANT SELECT ON public.erp_freight_dependencies TO authenticated; GRANT ALL ON public.erp_freight_dependencies TO service_role;
ALTER TABLE public.erp_freight_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY assigned_dependencies_read ON public.erp_freight_dependencies FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.erp_freight_items f WHERE f.id=freight_id));
CREATE TABLE public.erp_truck_requests (id text PRIMARY KEY, operation_id text NOT NULL REFERENCES public.erp_operations(id), truck_count integer NOT NULL CHECK(truck_count>0), assigned_to uuid NOT NULL, status text NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','Fulfilled','Cancelled')), source_work_id text NOT NULL UNIQUE REFERENCES public.erp_work(id));
GRANT SELECT ON public.erp_truck_requests TO authenticated; GRANT ALL ON public.erp_truck_requests TO service_role;
ALTER TABLE public.erp_truck_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY assigned_requests_read ON public.erp_truck_requests FOR SELECT TO authenticated USING(public.general_approver() OR public.staff_role()='Admin' OR public.department_manager('transport') OR (assigned_to=auth.uid() AND public.staff_area()='transport'));
CREATE TABLE public.erp_master_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL, kind text NOT NULL, record_key text NOT NULL, before_data jsonb, after_data jsonb NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.erp_master_audit TO authenticated; GRANT ALL ON public.erp_master_audit TO service_role;
ALTER TABLE public.erp_master_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY master_audit_read ON public.erp_master_audit FOR SELECT TO authenticated USING(public.general_approver() OR public.staff_role()='Admin');
CREATE FUNCTION public.erp_master_action(kind text, input jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_data jsonb; key text; role text:=public.staff_role();
BEGIN
IF auth.uid() IS NULL OR NOT(role IN ('Admin','Business Owner','General Manager') OR (kind='truck' AND role='Transport Manager')) THEN RAISE EXCEPTION 'Authorized configuration access required' USING ERRCODE='42501'; END IF;
IF kind='customer' THEN
key:=trim(input->>'name'); SELECT to_jsonb(c) INTO old_data FROM public.erp_customers c WHERE name=key;
INSERT INTO public.erp_customers(name,contact,email,phone,industry,terms) VALUES(key,coalesce(input->>'contact',''),coalesce(input->>'email',''),coalesce(input->>'phone',''),coalesce(input->>'industry',''),coalesce(input->>'terms','')) ON CONFLICT(name) DO UPDATE SET contact=excluded.contact,email=excluded.email,phone=excluded.phone,industry=excluded.industry,terms=excluded.terms;
ELSIF kind='port' THEN
key:=trim(input->>'name'); SELECT to_jsonb(p) INTO old_data FROM public.erp_ports p WHERE name=key;
INSERT INTO public.erp_ports(name,country,active) VALUES(key,trim(input->>'country'),coalesce((input->>'active')::boolean,true)) ON CONFLICT(name) DO UPDATE SET country=excluded.country,active=excluded.active;
ELSIF kind='truck' THEN
key:=trim(input->>'truck'); SELECT to_jsonb(t) INTO old_data FROM public.erp_trucks t WHERE truck=key;
INSERT INTO public.erp_trucks(truck,driver,ownership,supplier,capacity,trailer,active) VALUES(key,trim(input->>'driver'),input->>'ownership',trim(input->>'supplier'),(input->>'capacity')::numeric,coalesce(input->>'trailer',''),coalesce((input->>'active')::boolean,true)) ON CONFLICT(truck) DO UPDATE SET driver=excluded.driver,ownership=excluded.ownership,supplier=excluded.supplier,capacity=excluded.capacity,trailer=excluded.trailer,active=excluded.active;
ELSIF kind='configuration' THEN
key:=(input->>'category')||':'||trim(input->>'name'); SELECT to_jsonb(c) INTO old_data FROM public.erp_configuration c WHERE category=input->>'category' AND name=trim(input->>'name');
INSERT INTO public.erp_configuration(category,name,description,active) VALUES(input->>'category',trim(input->>'name'),coalesce(input->>'description',''),coalesce((input->>'active')::boolean,true)) ON CONFLICT(category,name) DO UPDATE SET description=excluded.description,active=excluded.active;
ELSE RAISE EXCEPTION 'Unknown directory'; END IF;
INSERT INTO public.erp_master_audit(actor_id,kind,record_key,before_data,after_data) VALUES(auth.uid(),kind,key,old_data,input);
END $$;
REVOKE ALL ON FUNCTION public.erp_master_action(text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.erp_master_action(text,jsonb) TO authenticated;
CREATE FUNCTION public.erp_sync_operation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb:=NEW.data; ident text; item integer:=0;
BEGIN
IF NEW.kind='operations' THEN
IF NOT EXISTS(SELECT 1 FROM public.erp_configuration WHERE category='freight_type' AND name=r->>'type' AND active) THEN RAISE EXCEPTION 'Configure the freight type first'; END IF;
INSERT INTO public.erp_operations VALUES(NEW.id,r->>'customer',r->>'origin',r->>'destination',r->>'type',(r->>'quantity')::integer,(r->>'weight')::numeric,(r->>'charge')::numeric,(r->>'opened')::date,(r->>'due')::date,r->>'status') ON CONFLICT(id) DO UPDATE SET status=excluded.status;
IF TG_OP='INSERT' THEN
IF jsonb_array_length(coalesce(r->'containers','[]'))>0 THEN
FOR ident IN SELECT jsonb_array_elements_text(r->'containers') LOOP item:=item+1; INSERT INTO public.erp_freight_items(id,operation_id,identifier,freight_type,weight) VALUES(NEW.id||'-F-'||item,NEW.id,trim(ident),r->>'type',(r->>'weight')::numeric/(r->>'quantity')::numeric); END LOOP;
ELSE FOR item IN 1..(r->>'quantity')::integer LOOP INSERT INTO public.erp_freight_items(id,operation_id,identifier,freight_type,weight) VALUES(NEW.id||'-F-'||item,NEW.id,'Unit '||item,r->>'type',(r->>'weight')::numeric/(r->>'quantity')::numeric); END LOOP; END IF;
END IF;
ELSE
IF NOT EXISTS(SELECT 1 FROM public.erp_operations WHERE id=NEW.operation_id) THEN RAISE EXCEPTION 'Operation reference required'; END IF;
IF NEW.kind='stages' AND NOT EXISTS(SELECT 1 FROM public.erp_ports WHERE name=r->>'port' AND active) THEN RAISE EXCEPTION 'Choose a configured active port'; END IF;
END IF;
RETURN NEW;
END $$;
CREATE TRIGGER sync_operation_relations BEFORE INSERT OR UPDATE ON public.erp_records FOR EACH ROW EXECUTE FUNCTION public.erp_sync_operation();
INSERT INTO public.erp_freight_items(id,operation_id,identifier,freight_type,weight,clearance_confirmed,blocker) SELECT r.id||'-F-'||c.ordinality,r.id,c.value,r.data->>'type',(r.data->>'weight')::numeric/(r.data->>'quantity')::numeric,coalesce((r.data->>'ready')::boolean,false),coalesce(r.data->>'blocker','') FROM public.erp_records r CROSS JOIN LATERAL jsonb_array_elements_text(r.data->'containers') WITH ORDINALITY c(value,ordinality) WHERE r.kind='operations';
CREATE INDEX erp_operations_customer_date ON public.erp_operations(customer_name,opened);
CREATE INDEX erp_freight_operation ON public.erp_freight_items(operation_id);
CREATE INDEX erp_local_tasks_assignment ON public.erp_local_tasks(assigned_to,status);
CREATE INDEX erp_truck_requests_operation ON public.erp_truck_requests(operation_id,status);
CREATE INDEX erp_work_operation_status ON public.erp_work(operation_id,status);
CREATE INDEX erp_audit_operation_time ON public.erp_audit(operation_id,occurred_at);
CREATE FUNCTION public.erp_freight_ready(fid text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce((SELECT f.clearance_confirmed AND NOT EXISTS(SELECT 1 FROM public.erp_freight_dependencies d LEFT JOIN public.erp_records s ON s.kind='stages' AND s.id=d.stage_id LEFT JOIN public.erp_local_tasks t ON t.id=d.task_id WHERE d.freight_id=f.id AND ((d.stage_id IS NOT NULL AND coalesce(s.data->>'status','')<>'Released') OR (d.task_id IS NOT NULL AND coalesce(t.status,'')<>'Released'))) FROM public.erp_freight_items f WHERE f.id=fid AND public.operation_access(f.operation_id)),false) $$;
REVOKE ALL ON FUNCTION public.erp_freight_ready(text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.erp_freight_ready(text) TO authenticated;