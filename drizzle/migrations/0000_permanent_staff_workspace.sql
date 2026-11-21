CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, display_name text NOT NULL DEFAULT '', avatar_url text NOT NULL DEFAULT '', preferences jsonb NOT NULL DEFAULT '{}');
GRANT SELECT, UPDATE ON public.profiles TO authenticated; GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_profile_select ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid());
CREATE POLICY own_profile_update ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid()) WITH CHECK (id=auth.uid());
CREATE FUNCTION public.create_staff_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.profiles(id,display_name) VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'display_name',NEW.raw_user_meta_data->>'name','')); RETURN NEW; END $$;
CREATE TRIGGER staff_profile_on_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_staff_profile();
CREATE TABLE public.user_roles (user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, role text NOT NULL CHECK(role IN ('Business Owner','General Manager','Logistics Manager','Transport Manager','Finance Manager','External Logistics Officer','Internal Logistics Officer','Transport Officer','Dispatcher','Finance Officer','Accountant','Admin')));
GRANT SELECT ON public.user_roles TO authenticated; GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_role ON public.user_roles FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE FUNCTION public.staff_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT role FROM public.user_roles WHERE user_id=auth.uid() $$;
CREATE FUNCTION public.staff_department() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT CASE WHEN public.staff_role() LIKE '%Logistics%' THEN 'logistics' WHEN public.staff_role() IN ('Transport Manager','Transport Officer','Dispatcher') THEN 'transport' WHEN public.staff_role() IN ('Finance Manager','Finance Officer','Accountant') THEN 'finance' END $$;
CREATE FUNCTION public.staff_area() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT CASE public.staff_role() WHEN 'External Logistics Officer' THEN 'external' WHEN 'Internal Logistics Officer' THEN 'internal' WHEN 'Transport Officer' THEN 'transport' WHEN 'Dispatcher' THEN 'transport' WHEN 'Finance Officer' THEN 'finance' WHEN 'Accountant' THEN 'finance' END $$;
CREATE FUNCTION public.area_department(a text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE WHEN a IN ('external','internal') THEN 'logistics' ELSE a END $$;
CREATE FUNCTION public.general_approver() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(public.staff_role() IN ('Business Owner','General Manager'),false) $$;
CREATE FUNCTION public.department_manager(a text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.general_approver() OR (public.staff_role() LIKE '%Manager' AND public.staff_department()=public.area_department(a)) $$;
CREATE TABLE public.operation_assignments (operation_id text NOT NULL, user_id uuid NOT NULL, area text NOT NULL CHECK(area IN ('external','internal','transport','finance')), PRIMARY KEY(operation_id,user_id,area));
GRANT SELECT ON public.operation_assignments TO authenticated; GRANT ALL ON public.operation_assignments TO service_role;
ALTER TABLE public.operation_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_assignment ON public.operation_assignments FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.department_manager(area));
CREATE FUNCTION public.operation_access(op text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.general_approver() OR public.staff_role()='Admin' OR (public.staff_role() LIKE '%Manager' AND EXISTS(SELECT 1 FROM public.operation_assignments WHERE operation_id=op AND public.area_department(area)=public.staff_department())) OR EXISTS(SELECT 1 FROM public.operation_assignments WHERE operation_id=op AND user_id=auth.uid() AND area=public.staff_area()) $$;
CREATE TABLE public.erp_records (kind text NOT NULL CHECK(kind IN ('operations','stages','trips','costs','invoices','documents','activity')), id text NOT NULL, operation_id text NOT NULL, area text NOT NULL DEFAULT '', data jsonb NOT NULL, PRIMARY KEY(kind,id));
GRANT SELECT ON public.erp_records TO authenticated; GRANT ALL ON public.erp_records TO service_role;
ALTER TABLE public.erp_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY assigned_record_read ON public.erp_records FOR SELECT TO authenticated USING(public.operation_access(operation_id) AND (kind IN ('operations','documents','activity') OR public.general_approver() OR public.staff_role()='Admin' OR public.department_manager(area) OR public.staff_area()=area));
CREATE TABLE public.erp_work (id text PRIMARY KEY, operation_id text NOT NULL, area text NOT NULL CHECK(area IN ('external','internal','transport','finance')), kind text NOT NULL, title text NOT NULL, amount numeric NOT NULL DEFAULT 0 CHECK(amount>=0), details text NOT NULL DEFAULT '', documents jsonb NOT NULL DEFAULT '[]', dependencies integer NOT NULL DEFAULT 0, created_by uuid NOT NULL, assigned_to uuid NOT NULL, submitted_by uuid, status text NOT NULL DEFAULT 'Draft', payload jsonb NOT NULL DEFAULT '{}', history jsonb NOT NULL DEFAULT '[]');
GRANT SELECT ON public.erp_work TO authenticated; GRANT ALL ON public.erp_work TO service_role;
ALTER TABLE public.erp_work ENABLE ROW LEVEL SECURITY;
CREATE POLICY assigned_work_read ON public.erp_work FOR SELECT TO authenticated USING(public.general_approver() OR public.staff_role()='Admin' OR public.department_manager(area) OR (assigned_to=auth.uid() AND public.staff_area()=area));
CREATE TABLE public.erp_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operation_id text NOT NULL, actor_id uuid NOT NULL, action text NOT NULL, record_id text NOT NULL, reason text NOT NULL DEFAULT '', occurred_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.erp_audit TO authenticated; GRANT ALL ON public.erp_audit TO service_role;
ALTER TABLE public.erp_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY assigned_audit_read ON public.erp_audit FOR SELECT TO authenticated USING(public.operation_access(operation_id));
CREATE FUNCTION public.workspace_action(action text, input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.erp_work; uid uuid:=auth.uid(); a text; op text; assigned uuid; event jsonb; r jsonb; amount numeric; total numeric; paid numeric; new_status text; staff_name text;
BEGIN
IF uid IS NULL OR public.staff_role() IS NULL THEN RAISE EXCEPTION 'Staff access required'; END IF;
SELECT coalesce(nullif(display_name,''),public.staff_role()) INTO staff_name FROM public.profiles WHERE id=uid;
event:=jsonb_build_object('actor',coalesce(staff_name,public.staff_role()),'action',action,'reason',coalesce(input->>'reason',''),'time',now());
IF action='createOperation' THEN
 IF NOT public.general_approver() THEN RAISE EXCEPTION 'Only general management can open operations'; END IF;
 r:=input->'operation'; op:=r->>'id';
 IF coalesce((r->>'quantity')::numeric,0)<=0 OR coalesce((r->>'weight')::numeric,0)<=0 OR coalesce((r->>'charge')::numeric,-1)<0 OR jsonb_array_length(input->'stages')<1 OR r->>'status'<>'Draft' THEN RAISE EXCEPTION 'Invalid operation'; END IF;
 INSERT INTO public.erp_records VALUES('operations',op,op,'',r);
 FOR r IN SELECT value FROM jsonb_array_elements(input->'stages') LOOP
 IF nullif(trim(r->>'port'),'') IS NULL THEN RAISE EXCEPTION 'Port name required'; END IF;
 INSERT INTO public.erp_records VALUES('stages',r->>'id',op,'external',r||jsonb_build_object('operationId',op,'status','Pending'));
 END LOOP;
 INSERT INTO public.erp_audit(operation_id,actor_id,action,record_id) VALUES(op,uid,action,op);
 RETURN to_jsonb(op);
END IF;
IF action='create' THEN
 a:=input->>'area'; op:=input->>'operationId';
 IF NOT public.operation_access(op) OR NOT (public.department_manager(a) OR public.staff_area()=a) THEN RAISE EXCEPTION 'Assigned area required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.erp_records WHERE kind='operations' AND id=op) THEN RAISE EXCEPTION 'Operation not found'; END IF;
 IF NOT ((a='external' AND input->>'kind' IN ('Port stage','Bill','Correction','Void')) OR (a='internal' AND input->>'kind' IN ('Local clearance task','Bill','Correction','Void')) OR (a='transport' AND input->>'kind' IN ('Truck request','Assignment','Trip','Correction','Void')) OR (a='finance' AND input->>'kind' IN ('Bill','Invoice','Expense','Payment','Payable','Settlement','Correction','Reversal','Void','Rate card'))) THEN RAISE EXCEPTION 'Invalid record type for area'; END IF;
 IF nullif(trim(input->>'title'),'') IS NULL THEN RAISE EXCEPTION 'Record name required'; END IF;
 amount:=(input->>'amount')::numeric;
 IF amount IS NULL OR amount<0 OR amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid amount'; END IF;
 IF input->>'kind' IN ('Invoice','Payment','Settlement','Bill','Expense','Payable','Rate card') AND amount<=0 THEN RAISE EXCEPTION 'Positive transaction amount required'; END IF;
 IF input->>'kind' IN ('Correction','Reversal','Void') AND nullif(trim(input->>'details'),'') IS NULL THEN RAISE EXCEPTION 'Correction reason required'; END IF;
 assigned:=uid;
 INSERT INTO public.erp_work(id,operation_id,area,kind,title,amount,details,documents,created_by,assigned_to,payload,history) VALUES(input->>'id',op,a,input->>'kind',input->>'title',amount,coalesce(input->>'details',''),coalesce(input->'documents','[]'),uid,assigned,coalesce(input->'payload','{}'),jsonb_build_array(event)) RETURNING * INTO w;
ELSE
 SELECT * INTO w FROM public.erp_work WHERE id=input->>'id' FOR UPDATE;
 IF w.id IS NULL OR NOT(public.department_manager(w.area) OR (w.assigned_to=uid AND public.staff_area()=w.area)) THEN RAISE EXCEPTION 'Assigned work required'; END IF;
 IF action IN ('edit','delete','Submitted','assign') AND w.status NOT IN ('Draft','Returned') THEN RAISE EXCEPTION 'Only Draft or Returned work may change'; END IF;
 IF action='edit' THEN
 amount:=(input->>'amount')::numeric;
 IF amount IS NULL OR amount<0 OR amount::text IN ('NaN','Infinity','-Infinity') OR (w.kind IN ('Invoice','Payment','Settlement','Bill','Expense','Payable','Rate card') AND amount<=0) THEN RAISE EXCEPTION 'Invalid amount'; END IF;
 IF nullif(trim(input->>'title'),'') IS NULL THEN RAISE EXCEPTION 'Record name required'; END IF;
 IF w.kind IN ('Correction','Reversal','Void') AND nullif(trim(input->>'details'),'') IS NULL THEN RAISE EXCEPTION 'Correction reason required'; END IF;
 UPDATE public.erp_work SET title=input->>'title',amount=amount,details=coalesce(input->>'details',''),documents=coalesce(input->'documents','[]') WHERE id=w.id;
 ELSIF action='delete' THEN
 IF w.status<>'Draft' OR w.created_by<>uid OR public.staff_area() IS NULL OR jsonb_array_length(w.documents)>0 OR w.dependencies>0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(w.history) h WHERE h->>'action' IN ('Submitted','Approved')) THEN RAISE EXCEPTION 'Only officers may delete their own unused Draft'; END IF;
 DELETE FROM public.erp_work WHERE id=w.id;
 ELSIF action='Submitted' THEN UPDATE public.erp_work SET status='Submitted',submitted_by=uid WHERE id=w.id;
 ELSIF action IN ('Approved','Returned') THEN
 IF NOT public.department_manager(w.area) OR w.status<>'Submitted' OR w.created_by=uid OR w.submitted_by=uid THEN RAISE EXCEPTION 'Independent department manager approval required'; END IF;
 IF action='Returned' AND nullif(trim(input->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'Return reason required'; END IF;
 UPDATE public.erp_work SET status=action WHERE id=w.id;
 ELSIF action='assign' THEN
 IF NOT public.department_manager(w.area) THEN RAISE EXCEPTION 'Department manager required'; END IF;
 assigned:=(input->>'assignedTo')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.operation_assignments WHERE operation_id=w.operation_id AND user_id=assigned AND area=w.area) THEN RAISE EXCEPTION 'Choose staff assigned to this operation and area'; END IF;
 UPDATE public.erp_work SET assigned_to=assigned WHERE id=w.id;
 ELSIF action='post' THEN
 IF w.status<>'Approved' OR w.amount<=0 THEN RAISE EXCEPTION 'Approved positive transaction required'; END IF;
 IF w.kind='Payment' THEN
 SELECT data INTO r FROM public.erp_records WHERE kind='invoices' AND id=w.payload->>'sourceId' AND operation_id=w.operation_id FOR UPDATE;
 IF r IS NULL OR r->>'status' NOT IN ('Issued','Part-paid') THEN RAISE EXCEPTION 'Issued invoice required'; END IF;
 total:=(r->>'amount')::numeric; paid:=(r->>'paid')::numeric;
 IF w.amount>total-paid THEN RAISE EXCEPTION 'Amount exceeds outstanding invoice balance'; END IF;
 paid:=paid+w.amount; new_status:=CASE WHEN paid=total THEN 'Paid' ELSE 'Part-paid' END;
 UPDATE public.erp_records SET data=r||jsonb_build_object('paid',paid,'status',new_status) WHERE kind='invoices' AND id=r->>'id'; new_status:='Paid';
 ELSIF w.kind='Settlement' THEN
 SELECT data INTO r FROM public.erp_records WHERE kind='trips' AND id=w.payload->>'sourceId' AND operation_id=w.operation_id FOR UPDATE;
 IF r IS NULL OR r->>'ownership'<>'Subcontractor' THEN RAISE EXCEPTION 'Subcontractor payable required'; END IF;
 total:=(r->>'cost')::numeric; paid:=(r->>'paid')::numeric;
 IF w.amount>total-paid THEN RAISE EXCEPTION 'Amount exceeds payable balance'; END IF;
 UPDATE public.erp_records SET data=r||jsonb_build_object('paid',paid+w.amount) WHERE kind='trips' AND id=r->>'id'; new_status:='Settled';
 ELSIF w.kind='Invoice' THEN
 SELECT data INTO r FROM public.erp_records WHERE kind='operations' AND id=w.operation_id FOR UPDATE;
 SELECT coalesce(sum((data->>'amount')::numeric),0) INTO total FROM public.erp_records WHERE kind='invoices' AND operation_id=w.operation_id AND data->>'status'<>'Voided';
 IF r IS NULL OR w.amount>(r->>'charge')::numeric-total THEN RAISE EXCEPTION 'Amount exceeds unbilled customer charges'; END IF;
 op:='INV-'||w.id;
 INSERT INTO public.erp_records VALUES('invoices',op,w.operation_id,'finance',jsonb_build_object('id',op,'operationId',w.operation_id,'amount',w.amount,'paid',0,'due',coalesce(nullif(w.payload->>'due',''),(current_date+30)::text),'issued',current_date::text,'status','Issued')); new_status:='Issued';
 ELSE RAISE EXCEPTION 'Separate operational posting process required'; END IF;
 UPDATE public.erp_work SET status=new_status,dependencies=dependencies+1 WHERE id=w.id;
 ELSE RAISE EXCEPTION 'Unknown action'; END IF;
 UPDATE public.erp_work SET history=history||jsonb_build_array(event) WHERE id=w.id;
END IF;
INSERT INTO public.erp_audit(operation_id,actor_id,action,record_id,reason) VALUES(w.operation_id,uid,action,w.id,coalesce(input->>'reason',''));
RETURN to_jsonb(w.id);
END $$;
REVOKE ALL ON FUNCTION public.workspace_action(text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.workspace_action(text,jsonb) TO authenticated;
CREATE FUNCTION public.staff_directory() RETURNS TABLE(id uuid,display_name text,role text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT p.id,p.display_name,u.role FROM public.profiles p JOIN public.user_roles u ON u.user_id=p.id WHERE public.staff_role()='Admin' OR public.general_approver() OR (public.staff_role() LIKE '%Manager' AND CASE WHEN u.role LIKE '%Logistics%' THEN 'logistics' WHEN u.role IN ('Transport Manager','Transport Officer','Dispatcher') THEN 'transport' WHEN u.role IN ('Finance Manager','Finance Officer','Accountant') THEN 'finance' END=public.staff_department()) OR p.id=auth.uid() $$;
REVOKE ALL ON FUNCTION public.staff_directory() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.staff_directory() TO authenticated;
CREATE FUNCTION public.assign_staff(staff_id uuid, staff_role text, operation_id text DEFAULT NULL, work_area text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT(public.staff_role()='Admin' OR public.general_approver()) THEN RAISE EXCEPTION 'Administrator required'; END IF;
IF staff_id=auth.uid() THEN RAISE EXCEPTION 'Another administrator must change your access'; END IF;
IF operation_id IS NULL THEN INSERT INTO public.user_roles(user_id,role) VALUES(staff_id,staff_role) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role;
ELSE
IF NOT EXISTS(SELECT 1 FROM public.erp_records WHERE kind='operations' AND id=operation_id) THEN RAISE EXCEPTION 'Operation required'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.user_roles u WHERE user_id=staff_id AND CASE work_area WHEN 'external' THEN u.role='External Logistics Officer' WHEN 'internal' THEN u.role='Internal Logistics Officer' WHEN 'transport' THEN u.role IN ('Transport Officer','Dispatcher') WHEN 'finance' THEN u.role IN ('Finance Officer','Accountant') ELSE false END) THEN RAISE EXCEPTION 'Role must match assigned work area'; END IF;
INSERT INTO public.operation_assignments VALUES(operation_id,staff_id,work_area) ON CONFLICT DO NOTHING;
END IF;
END $$;
REVOKE ALL ON FUNCTION public.assign_staff(uuid,text,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.assign_staff(uuid,text,text,text) TO authenticated;
CREATE INDEX erp_records_operation ON public.erp_records(operation_id); CREATE INDEX erp_work_assignee ON public.erp_work(assigned_to); CREATE INDEX assignments_user ON public.operation_assignments(user_id);