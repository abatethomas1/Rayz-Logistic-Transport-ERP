ALTER TABLE public.erp_records ADD COLUMN assigned_to uuid;
CREATE TABLE public.erp_port_stages (id text PRIMARY KEY, operation_id text NOT NULL REFERENCES public.erp_operations(id), port_name text NOT NULL REFERENCES public.erp_ports(name), assigned_to uuid, arrival date NOT NULL, release date NOT NULL, status text NOT NULL);
GRANT SELECT ON public.erp_port_stages TO authenticated; GRANT ALL ON public.erp_port_stages TO service_role;
ALTER TABLE public.erp_port_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY assigned_port_stage_read ON public.erp_port_stages FOR SELECT TO authenticated USING(public.general_approver() OR public.staff_role()='Admin' OR public.department_manager('external') OR (assigned_to=auth.uid() AND public.staff_area()='external'));
INSERT INTO public.erp_port_stages SELECT id,operation_id,data->>'port',assigned_to,(data->>'arrival')::date,(data->>'release')::date,data->>'status' FROM public.erp_records WHERE kind='stages';
ALTER TABLE public.erp_freight_dependencies ADD CONSTRAINT freight_stage_reference FOREIGN KEY(stage_id) REFERENCES public.erp_port_stages(id);
CREATE TABLE public.erp_trips (id text PRIMARY KEY, operation_id text NOT NULL REFERENCES public.erp_operations(id), truck text NOT NULL REFERENCES public.erp_trucks(truck), freight_id text NOT NULL REFERENCES public.erp_freight_items(id), request_id text NOT NULL REFERENCES public.erp_truck_requests(id), assigned_to uuid NOT NULL, source_work_id text NOT NULL UNIQUE REFERENCES public.erp_work(id), status text NOT NULL CHECK(status IN ('Assigned','Active','Arrived','Offloaded','Completed','Cancelled')), planned_departure date NOT NULL, planned_arrival date NOT NULL, actual_departure timestamptz, actual_arrival timestamptz, offloaded_at timestamptz, completed_at timestamptz, charge numeric NOT NULL CHECK(charge>0), cost numeric NOT NULL CHECK(cost>0), CHECK(planned_arrival>=planned_departure));
GRANT SELECT ON public.erp_trips TO authenticated; GRANT ALL ON public.erp_trips TO service_role;
ALTER TABLE public.erp_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY assigned_trip_read ON public.erp_trips FOR SELECT TO authenticated USING(public.general_approver() OR public.staff_role()='Admin' OR public.department_manager('transport') OR (assigned_to=auth.uid() AND public.staff_area()='transport') OR (public.staff_department()='finance' AND public.operation_access(operation_id)));
CREATE UNIQUE INDEX one_active_trip_per_truck ON public.erp_trips(truck) WHERE status NOT IN ('Completed','Cancelled');
CREATE UNIQUE INDEX one_active_trip_per_freight ON public.erp_trips(freight_id) WHERE status<>'Cancelled';
CREATE TABLE public.erp_rate_cards (id text PRIMARY KEY, ownership text NOT NULL CHECK(ownership IN ('Company','Subcontractor')), lane text NOT NULL, freight_type text NOT NULL, amount numeric NOT NULL CHECK(amount>0), effective_from date NOT NULL, effective_to date NOT NULL, source_work_id text NOT NULL UNIQUE REFERENCES public.erp_work(id), CHECK(effective_to>=effective_from));
GRANT SELECT ON public.erp_rate_cards TO authenticated; GRANT ALL ON public.erp_rate_cards TO service_role;
ALTER TABLE public.erp_rate_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_rates_read ON public.erp_rate_cards FOR SELECT TO authenticated USING(public.general_approver() OR public.staff_role()='Admin' OR public.staff_department()='finance');
CREATE TABLE public.erp_cost_postings (id text PRIMARY KEY, operation_id text NOT NULL REFERENCES public.erp_operations(id), source_work_id text NOT NULL UNIQUE REFERENCES public.erp_work(id), stage_id text REFERENCES public.erp_port_stages(id), task_id text REFERENCES public.erp_local_tasks(id), supplier text NOT NULL, category text NOT NULL, original_amount numeric NOT NULL CHECK(original_amount>0), currency text NOT NULL, rate numeric NOT NULL CHECK(rate>0), rate_date date NOT NULL, rate_source text NOT NULL, converted_etb numeric NOT NULL CHECK(converted_etb>0), posted_by uuid NOT NULL, posted_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.erp_cost_postings TO authenticated; GRANT ALL ON public.erp_cost_postings TO service_role;
ALTER TABLE public.erp_cost_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY authorized_cost_postings_read ON public.erp_cost_postings FOR SELECT TO authenticated USING(public.operation_access(operation_id) AND (public.general_approver() OR public.staff_role()='Admin' OR public.staff_department()='finance' OR EXISTS(SELECT 1 FROM public.erp_work w WHERE w.id=source_work_id)));
CREATE TABLE public.erp_cash_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operation_id text NOT NULL REFERENCES public.erp_operations(id), source_work_id text NOT NULL UNIQUE REFERENCES public.erp_work(id), direction text NOT NULL CHECK(direction IN ('Receipt','Settlement')), source_id text NOT NULL, amount numeric NOT NULL CHECK(amount>0), reference text NOT NULL, transaction_date date NOT NULL, posted_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.erp_cash_entries TO authenticated; GRANT ALL ON public.erp_cash_entries TO service_role;
ALTER TABLE public.erp_cash_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_cash_read ON public.erp_cash_entries FOR SELECT TO authenticated USING(public.operation_access(operation_id) AND (public.general_approver() OR public.staff_role()='Admin' OR public.staff_department()='finance'));
CREATE FUNCTION public.erp_sync_stage() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.kind='stages' THEN INSERT INTO public.erp_port_stages VALUES(NEW.id,NEW.operation_id,NEW.data->>'port',NEW.assigned_to,(NEW.data->>'arrival')::date,(NEW.data->>'release')::date,NEW.data->>'status') ON CONFLICT(id) DO UPDATE SET assigned_to=excluded.assigned_to,arrival=excluded.arrival,release=excluded.release,status=excluded.status; END IF; RETURN NEW; END $$;
CREATE TRIGGER sync_stage_relations AFTER INSERT OR UPDATE ON public.erp_records FOR EACH ROW EXECUTE FUNCTION public.erp_sync_stage();
DROP POLICY assigned_record_read ON public.erp_records;
CREATE POLICY assigned_record_read ON public.erp_records FOR SELECT TO authenticated USING(public.operation_access(operation_id) AND (kind IN ('operations','documents','activity') OR public.general_approver() OR public.staff_role()='Admin' OR public.department_manager(area) OR (public.staff_area()=area AND (kind NOT IN ('stages','trips') OR assigned_to=auth.uid()))));
CREATE FUNCTION public.erp_capture_cash() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('Paid','Settled') AND NEW.kind IN ('Payment','Settlement') THEN INSERT INTO public.erp_cash_entries(operation_id,source_work_id,direction,source_id,amount,reference,transaction_date) VALUES(NEW.operation_id,NEW.id,CASE WHEN NEW.kind='Payment' THEN 'Receipt' ELSE 'Settlement' END,NEW.payload->>'sourceId',NEW.amount,coalesce(NEW.payload->>'reference',''),coalesce(nullif(NEW.payload->>'date','')::date,current_date)); END IF; RETURN NEW; END $$;
CREATE TRIGGER capture_posted_cash AFTER UPDATE ON public.erp_work FOR EACH ROW EXECUTE FUNCTION public.erp_capture_cash();
CREATE FUNCTION public.erp_operational_action(action text,input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.erp_work; fid public.erp_freight_items; tr public.erp_trucks; req public.erp_truck_requests; trip public.erp_trips; stage public.erp_port_stages; task public.erp_local_tasks; uid uuid:=auth.uid(); op text; nid text; p jsonb; n numeric; prior text; target text; person text; at_time timestamptz:=coalesce(nullif(input->>'occurredAt','')::timestamptz,now());
BEGIN
IF uid IS NULL OR public.staff_role()='' THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;
SELECT coalesce(nullif(display_name,''),public.staff_role()) INTO person FROM public.profiles WHERE id=uid;
IF action='post' THEN
SELECT * INTO w FROM public.erp_work WHERE id=input->>'id' FOR UPDATE;
IF w.id IS NULL OR NOT(public.department_manager(w.area) OR (w.assigned_to=uid AND public.staff_area()=w.area)) THEN RAISE EXCEPTION 'Assigned work required' USING ERRCODE='42501'; END IF;
IF w.status<>'Approved' THEN RAISE EXCEPTION 'Approved unposted work required'; END IF;
p:=w.payload; op:=w.operation_id; nid:=w.id;
IF w.kind='Port stage' THEN
IF NOT EXISTS(SELECT 1 FROM public.erp_ports WHERE name=p->>'port' AND active) THEN RAISE EXCEPTION 'Choose a configured port'; END IF;
IF (p->>'release')::date<(p->>'arrival')::date THEN RAISE EXCEPTION 'Release cannot precede arrival'; END IF;
INSERT INTO public.erp_records(kind,id,operation_id,area,data,assigned_to) SELECT 'stages','ST-'||nid,op,'external',jsonb_build_object('id','ST-'||nid,'operationId',op,'port',p->>'port','country',country,'arrival',p->>'arrival','release',p->>'release','owner',person,'status','Pending'),w.assigned_to FROM public.erp_ports WHERE name=p->>'port';
ELSIF w.kind='Local clearance task' THEN
IF nullif(p->>'authority','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.erp_configuration WHERE category='authority' AND name=p->>'authority' AND active) THEN RAISE EXCEPTION 'Choose a configured authority'; END IF;
INSERT INTO public.erp_local_tasks(id,operation_id,title,authority,assigned_to,started,source_work_id) VALUES('LC-'||nid,op,w.title,coalesce(p->>'authority',''),w.assigned_to,coalesce(nullif(p->>'date','')::date,current_date),nid);
ELSIF w.kind='Truck request' THEN
INSERT INTO public.erp_truck_requests(id,operation_id,truck_count,assigned_to,source_work_id) VALUES('RQ-'||nid,op,(p->>'count')::integer,w.assigned_to,nid);
ELSIF w.kind IN ('Assignment','Trip') THEN
SELECT * INTO tr FROM public.erp_trucks WHERE truck=split_part(p->>'truck',' · ',1) AND active FOR UPDATE;
SELECT * INTO fid FROM public.erp_freight_items WHERE id=p->>'freightId' AND operation_id=op FOR UPDATE;
SELECT * INTO req FROM public.erp_truck_requests WHERE id=p->>'requestId' AND operation_id=op FOR UPDATE;
IF tr.truck IS NULL OR fid.id IS NULL OR req.id IS NULL OR req.status<>'Open' THEN RAISE EXCEPTION 'Valid truck, freight and open request required'; END IF;
IF NOT public.erp_freight_ready(fid.id) THEN RAISE EXCEPTION 'Selected freight has a clearance blocker'; END IF;
IF fid.weight>tr.capacity THEN RAISE EXCEPTION 'Freight exceeds truck capacity'; END IF;
IF EXISTS(SELECT 1 FROM public.erp_trips WHERE truck=tr.truck AND status NOT IN ('Completed','Cancelled')) OR EXISTS(SELECT 1 FROM public.erp_trips WHERE freight_id=fid.id AND status<>'Cancelled') THEN RAISE EXCEPTION 'Truck or freight already assigned'; END IF;
IF (SELECT count(*) FROM public.erp_trips WHERE request_id=req.id AND status<>'Cancelled')>=req.truck_count THEN RAISE EXCEPTION 'Requested truck count already fulfilled'; END IF;
n:=(p->>'charge')::numeric;
IF n IS NULL OR n<=0 OR n::text IN ('NaN','Infinity','-Infinity') OR w.amount<=0 THEN RAISE EXCEPTION 'Positive selling charge and actual cost required'; END IF;
INSERT INTO public.erp_trips(id,operation_id,truck,freight_id,request_id,assigned_to,source_work_id,status,planned_departure,planned_arrival,charge,cost) VALUES('TR-'||nid,op,tr.truck,fid.id,req.id,w.assigned_to,nid,'Assigned',(p->>'departure')::date,(p->>'arrival')::date,n,w.amount);
INSERT INTO public.erp_records(kind,id,operation_id,area,data,assigned_to) VALUES('trips','TR-'||nid,op,'transport',jsonb_build_object('id','TR-'||nid,'operationId',op,'truck',tr.truck,'driver',tr.driver,'ownership',tr.ownership,'supplier',tr.supplier,'status','Assigned','departure',p->>'departure','arrival',p->>'arrival','freight',fid.identifier,'charge',n,'cost',w.amount,'paid',0,'pod',''),w.assigned_to);
IF (SELECT count(*) FROM public.erp_trips WHERE request_id=req.id AND status<>'Cancelled')=req.truck_count THEN UPDATE public.erp_truck_requests SET status='Fulfilled' WHERE id=req.id; END IF;
ELSIF w.kind='Rate card' THEN
INSERT INTO public.erp_rate_cards VALUES('RC-'||nid,p->>'type',p->>'lane',p->>'freight',w.amount,(p->>'from')::date,(p->>'to')::date,nid);
ELSIF w.kind IN ('Bill','Expense') THEN
IF coalesce(p->>'currency','ETB')<>'ETB' THEN RAISE EXCEPTION 'Foreign currency posting awaits confirmed conversion and rounding policy'; END IF;
IF coalesce(nullif(p->>'rate','')::numeric,1)<>1 THEN RAISE EXCEPTION 'ETB exchange rate must be 1'; END IF;
IF nullif(p->>'stageId','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.erp_port_stages WHERE id=p->>'stageId' AND operation_id=op) THEN RAISE EXCEPTION 'Source stage must belong to the operation'; END IF;
INSERT INTO public.erp_cost_postings(id,operation_id,source_work_id,stage_id,supplier,category,original_amount,currency,rate,rate_date,rate_source,converted_etb,posted_by) VALUES('BL-'||nid,op,nid,nullif(p->>'stageId',''),coalesce(p->>'supplier',w.title),coalesce(p->>'category',w.kind),w.amount,'ETB',1,coalesce(nullif(p->>'date','')::date,current_date),'ETB',w.amount,uid);
INSERT INTO public.erp_records(kind,id,operation_id,area,data) VALUES('costs','BL-'||nid,op,w.area,jsonb_build_object('id','BL-'||nid,'operationId',op,'stageId',coalesce(p->>'stageId',''),'category',coalesce(p->>'category',w.kind),'supplier',coalesce(p->>'supplier',w.title),'currency','ETB','amount',w.amount,'rate',1,'approval','Approved','status','Unpaid','date',coalesce(p->>'date',current_date::text)));
ELSE RAISE EXCEPTION 'Use the financial posting action or complete the required policy before posting this record'; END IF;
UPDATE public.erp_work SET status='Posted',dependencies=dependencies+1,history=history||jsonb_build_array(jsonb_build_object('actor',person,'action','Posted','reason',coalesce(input->>'reason',''),'time',now())) WHERE id=nid;
ELSIF action IN ('stageStatus','assignStage') THEN
SELECT * INTO stage FROM public.erp_port_stages WHERE id=input->>'id' FOR UPDATE; op:=stage.operation_id;
IF stage.id IS NULL OR NOT(public.department_manager('external') OR (stage.assigned_to=uid AND public.staff_area()='external')) THEN RAISE EXCEPTION 'Assigned stage access required' USING ERRCODE='42501'; END IF;
IF action='assignStage' THEN
IF NOT public.department_manager('external') THEN RAISE EXCEPTION 'Logistics manager required' USING ERRCODE='42501'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.operation_assignments WHERE operation_id=op AND user_id=(input->>'assignedTo')::uuid AND area='external') THEN RAISE EXCEPTION 'Choose an officer assigned to this operation'; END IF;
UPDATE public.erp_records SET assigned_to=(input->>'assignedTo')::uuid,data=data||jsonb_build_object('owner',coalesce((SELECT display_name FROM public.profiles WHERE id=(input->>'assignedTo')::uuid),'Assigned officer')) WHERE kind='stages' AND id=stage.id;
ELSE
prior:=stage.status; target:=input->>'status';
IF NOT((prior='Pending' AND target IN ('In clearance','On hold')) OR (prior='In clearance' AND target IN ('Released','On hold')) OR (prior='On hold' AND target='In clearance')) THEN RAISE EXCEPTION 'Invalid port-stage transition'; END IF;
IF target='On hold' AND nullif(trim(input->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'A hold reason is required'; END IF;
UPDATE public.erp_records SET data=data||jsonb_build_object('status',target) WHERE kind='stages' AND id=stage.id;
END IF;
ELSIF action='taskStatus' THEN
SELECT * INTO task FROM public.erp_local_tasks WHERE id=input->>'id' FOR UPDATE; op:=task.operation_id;
IF task.id IS NULL OR NOT(public.department_manager('internal') OR (task.assigned_to=uid AND public.staff_area()='internal')) THEN RAISE EXCEPTION 'Assigned task required' USING ERRCODE='42501'; END IF;
prior:=task.status; target:=input->>'status';
IF NOT((prior='Pending' AND target IN ('In clearance','On hold')) OR (prior='In clearance' AND target IN ('Released','On hold')) OR (prior='On hold' AND target='In clearance')) THEN RAISE EXCEPTION 'Invalid local-task transition'; END IF;
IF target='On hold' AND nullif(trim(input->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'A hold reason is required'; END IF;
UPDATE public.erp_local_tasks SET status=target,completed=CASE WHEN target='Released' THEN current_date ELSE completed END WHERE id=task.id;
ELSIF action='tripStatus' THEN
SELECT * INTO trip FROM public.erp_trips WHERE id=input->>'id' FOR UPDATE; op:=trip.operation_id;
IF trip.id IS NULL OR NOT(public.department_manager('transport') OR (trip.assigned_to=uid AND public.staff_area()='transport')) THEN RAISE EXCEPTION 'Assigned trip required' USING ERRCODE='42501'; END IF;
prior:=trip.status; target:=input->>'status';
IF NOT((prior='Assigned' AND target IN ('Active','Cancelled')) OR (prior='Active' AND target='Arrived') OR (prior='Arrived' AND target='Offloaded') OR (prior='Offloaded' AND target='Completed')) THEN RAISE EXCEPTION 'Invalid trip transition'; END IF;
IF target='Active' AND NOT public.erp_freight_ready(trip.freight_id) THEN RAISE EXCEPTION 'Freight no longer cleared'; END IF;
IF target='Cancelled' AND nullif(trim(input->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'Cancellation reason required'; END IF;
IF at_time>now() THEN RAISE EXCEPTION 'Actual milestone cannot be in the future'; END IF;
IF target='Arrived' AND at_time<trip.actual_departure OR target='Offloaded' AND at_time<trip.actual_arrival OR target='Completed' AND at_time<trip.offloaded_at THEN RAISE EXCEPTION 'Milestone precedes previous event'; END IF;
UPDATE public.erp_trips SET status=target,actual_departure=CASE WHEN target='Active' THEN at_time ELSE actual_departure END,actual_arrival=CASE WHEN target='Arrived' THEN at_time ELSE actual_arrival END,offloaded_at=CASE WHEN target='Offloaded' THEN at_time ELSE offloaded_at END,completed_at=CASE WHEN target='Completed' THEN at_time ELSE completed_at END WHERE id=trip.id;
UPDATE public.erp_records SET data=data||jsonb_build_object('status',target) WHERE kind='trips' AND id=trip.id;
IF target='Cancelled' THEN UPDATE public.erp_truck_requests SET status='Open' WHERE id=trip.request_id; END IF;
ELSIF action IN ('freightClearance','dependency') THEN
SELECT * INTO fid FROM public.erp_freight_items WHERE id=input->>'id' FOR UPDATE; op:=fid.operation_id;
IF fid.id IS NULL OR NOT public.operation_access(op) OR NOT(public.department_manager('external') OR public.department_manager('internal') OR public.staff_area() IN ('external','internal')) THEN RAISE EXCEPTION 'Assigned logistics access required' USING ERRCODE='42501'; END IF;
IF EXISTS(SELECT 1 FROM public.erp_trips WHERE freight_id=fid.id AND status IN ('Active','Arrived','Offloaded','Completed')) THEN RAISE EXCEPTION 'Dispatched freight cannot change clearance history'; END IF;
IF action='dependency' THEN
IF (nullif(input->>'stageId','') IS NULL)=(nullif(input->>'taskId','') IS NULL) THEN RAISE EXCEPTION 'Select exactly one stage or task'; END IF;
IF nullif(input->>'stageId','') IS NOT NULL THEN
IF NOT EXISTS(SELECT 1 FROM public.erp_port_stages WHERE id=input->>'stageId' AND operation_id=op AND (public.department_manager('external') OR (assigned_to=uid AND public.staff_area()='external'))) THEN RAISE EXCEPTION 'Assigned stage on same operation required'; END IF;
ELSE IF NOT EXISTS(SELECT 1 FROM public.erp_local_tasks WHERE id=input->>'taskId' AND operation_id=op AND (public.department_manager('internal') OR (assigned_to=uid AND public.staff_area()='internal'))) THEN RAISE EXCEPTION 'Assigned task on same operation required'; END IF; END IF;
INSERT INTO public.erp_freight_dependencies(freight_id,stage_id,task_id) VALUES(fid.id,nullif(input->>'stageId',''),nullif(input->>'taskId','')) ON CONFLICT DO NOTHING;
ELSE
IF nullif(trim(input->>'reason'),'') IS NULL OR input->>'ready' IS NULL THEN RAISE EXCEPTION 'Clearance decision and evidence/reference required'; END IF;
UPDATE public.erp_freight_items SET clearance_confirmed=(input->>'ready')::boolean,clearance_by=uid,clearance_at=now(),blocker=CASE WHEN (input->>'ready')::boolean THEN '' ELSE input->>'reason' END WHERE id=fid.id;
END IF;
ELSE RAISE EXCEPTION 'Unknown operational action'; END IF;
INSERT INTO public.erp_audit(operation_id,actor_id,action,record_id,reason) VALUES(op,uid,action,input->>'id',coalesce(input->>'reason',''));
UPDATE public.erp_records r SET data=data||jsonb_build_object('ready',EXISTS(SELECT 1 FROM public.erp_freight_items f WHERE f.operation_id=op AND public.erp_freight_ready(f.id)),'blocker',CASE WHEN EXISTS(SELECT 1 FROM public.erp_freight_items f WHERE f.operation_id=op AND public.erp_freight_ready(f.id)) THEN '' ELSE 'Freight clearance pending' END) WHERE kind='operations' AND id=op;
RETURN to_jsonb(input->>'id');
END $$;
REVOKE ALL ON FUNCTION public.erp_operational_action(text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.erp_operational_action(text,jsonb) TO authenticated;
CREATE INDEX erp_cost_posting_operation ON public.erp_cost_postings(operation_id);
CREATE INDEX erp_cash_operation_date ON public.erp_cash_entries(operation_id,transaction_date);
CREATE INDEX erp_trip_operation_status ON public.erp_trips(operation_id,status);