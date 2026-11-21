CREATE TABLE public.erp_customer_advances (id text PRIMARY KEY, operation_id text NOT NULL REFERENCES public.erp_operations(id), customer_name text NOT NULL REFERENCES public.erp_customers(name), source_work_id text NOT NULL UNIQUE REFERENCES public.erp_work(id), amount numeric NOT NULL CHECK(amount>0), allocated numeric NOT NULL DEFAULT 0 CHECK(allocated>=0 AND allocated<=amount), reversed boolean NOT NULL DEFAULT false, received_date date NOT NULL);
GRANT SELECT ON public.erp_customer_advances TO authenticated; GRANT ALL ON public.erp_customer_advances TO service_role;
ALTER TABLE public.erp_customer_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_advances_read ON public.erp_customer_advances FOR SELECT TO authenticated USING(public.operation_access(operation_id) AND (public.general_approver() OR public.staff_role()='Admin' OR public.staff_department()='finance'));
CREATE TABLE public.erp_advance_allocations (id text PRIMARY KEY, advance_id text NOT NULL REFERENCES public.erp_customer_advances(id), operation_id text NOT NULL REFERENCES public.erp_operations(id), invoice_id text NOT NULL, source_work_id text NOT NULL UNIQUE REFERENCES public.erp_work(id), amount numeric NOT NULL CHECK(amount>0), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.erp_advance_allocations TO authenticated; GRANT ALL ON public.erp_advance_allocations TO service_role;
ALTER TABLE public.erp_advance_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_allocations_read ON public.erp_advance_allocations FOR SELECT TO authenticated USING(public.operation_access(operation_id) AND (public.general_approver() OR public.staff_role()='Admin' OR public.staff_department()='finance'));
CREATE TABLE public.erp_cash_reversals (id text PRIMARY KEY, cash_entry_id uuid NOT NULL UNIQUE REFERENCES public.erp_cash_entries(id), operation_id text NOT NULL REFERENCES public.erp_operations(id), source_work_id text NOT NULL UNIQUE REFERENCES public.erp_work(id), amount numeric NOT NULL CHECK(amount>0), authorized_by uuid NOT NULL, reason text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.erp_cash_reversals TO authenticated; GRANT ALL ON public.erp_cash_reversals TO service_role;
ALTER TABLE public.erp_cash_reversals ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_reversals_read ON public.erp_cash_reversals FOR SELECT TO authenticated USING(public.operation_access(operation_id) AND (public.general_approver() OR public.staff_role()='Admin' OR public.staff_department()='finance'));
CREATE FUNCTION public.erp_guard_reversal_approval() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.status='Approved' AND OLD.status IS DISTINCT FROM 'Approved' AND NEW.area='finance' AND NEW.kind IN ('Reversal','Void') THEN IF public.staff_role() NOT IN ('Finance Manager','General Manager') OR NEW.created_by=auth.uid() OR NEW.submitted_by=auth.uid() THEN RAISE EXCEPTION 'Independent Finance Manager or General Manager authorization required' USING ERRCODE='42501'; END IF; END IF; RETURN NEW; END $$;
CREATE TRIGGER independent_financial_reversal_approval BEFORE UPDATE ON public.erp_work FOR EACH ROW EXECUTE FUNCTION public.erp_guard_reversal_approval();
CREATE OR REPLACE FUNCTION public.erp_capture_cash() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('Paid','Settled') AND NEW.kind IN ('Payment','Settlement') AND coalesce(NEW.payload->>'paymentType','')<>'Allocation' THEN INSERT INTO public.erp_cash_entries(operation_id,source_work_id,direction,source_id,amount,reference,transaction_date) VALUES(NEW.operation_id,NEW.id,CASE WHEN NEW.kind='Payment' THEN 'Receipt' ELSE 'Settlement' END,NEW.payload->>'sourceId',NEW.amount,coalesce(NEW.payload->>'reference',''),coalesce(nullif(NEW.payload->>'date','')::date,current_date)); END IF; RETURN NEW; END $$;
CREATE FUNCTION public.erp_financial_action(action text,input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.erp_work; advance public.erp_customer_advances; cash public.erp_cash_entries; r jsonb; op public.erp_operations; paid numeric; total numeric; next_status text; uid uuid:=auth.uid(); person text;
BEGIN
IF action<>'post' OR uid IS NULL OR public.staff_role()='' THEN RAISE EXCEPTION 'Staff financial posting access required' USING ERRCODE='42501'; END IF;
SELECT * INTO w FROM public.erp_work WHERE id=input->>'id' FOR UPDATE;
IF w.id IS NULL OR w.status<>'Approved' OR w.area<>'finance' OR NOT(public.department_manager('finance') OR (w.assigned_to=uid AND public.staff_area()='finance')) THEN RAISE EXCEPTION 'Approved assigned finance work required' USING ERRCODE='42501'; END IF;
SELECT coalesce(nullif(display_name,''),public.staff_role()) INTO person FROM public.profiles WHERE id=uid;
IF w.kind='Payment' AND w.payload->>'paymentType'='Advance' THEN
SELECT * INTO op FROM public.erp_operations WHERE id=w.operation_id;
INSERT INTO public.erp_customer_advances(id,operation_id,customer_name,source_work_id,amount,received_date) VALUES('ADV-'||w.id,w.operation_id,op.customer_name,w.id,w.amount,coalesce(nullif(w.payload->>'date','')::date,current_date));
UPDATE public.erp_work SET payload=payload||jsonb_build_object('sourceId','ADV-'||w.id),status='Paid',dependencies=dependencies+1 WHERE id=w.id;
ELSIF w.kind='Payment' AND w.payload->>'paymentType'='Allocation' THEN
SELECT * INTO advance FROM public.erp_customer_advances WHERE id=w.payload->>'advanceId' FOR UPDATE;
SELECT data INTO r FROM public.erp_records WHERE kind='invoices' AND id=w.payload->>'sourceId' AND operation_id=w.operation_id FOR UPDATE;
SELECT * INTO op FROM public.erp_operations WHERE id=w.operation_id;
IF advance.id IS NULL OR advance.reversed OR r IS NULL OR r->>'status' NOT IN ('Issued','Part-paid') OR advance.customer_name<>op.customer_name OR NOT public.operation_access(advance.operation_id) THEN RAISE EXCEPTION 'Authorized advance and issued invoice for the same customer required'; END IF;
total:=(r->>'amount')::numeric; paid:=(r->>'paid')::numeric;
IF w.amount<=0 OR w.amount>advance.amount-advance.allocated OR w.amount>total-paid THEN RAISE EXCEPTION 'Allocation exceeds available customer credit or invoice balance'; END IF;
INSERT INTO public.erp_advance_allocations(id,advance_id,operation_id,invoice_id,source_work_id,amount) VALUES('AL-'||w.id,advance.id,w.operation_id,r->>'id',w.id,w.amount);
UPDATE public.erp_customer_advances SET allocated=allocated+w.amount WHERE id=advance.id;
UPDATE public.erp_records SET data=r||jsonb_build_object('paid',paid+w.amount,'status',CASE WHEN paid+w.amount=total THEN 'Paid' ELSE 'Part-paid' END) WHERE kind='invoices' AND id=r->>'id';
UPDATE public.erp_work SET status='Paid',dependencies=dependencies+1 WHERE id=w.id;
ELSIF w.kind='Reversal' THEN
SELECT * INTO cash FROM public.erp_cash_entries WHERE id=(w.payload->>'cashEntryId')::uuid AND operation_id=w.operation_id FOR UPDATE;
IF cash.id IS NULL OR EXISTS(SELECT 1 FROM public.erp_cash_reversals WHERE cash_entry_id=cash.id) OR nullif(trim(w.details),'') IS NULL THEN RAISE EXCEPTION 'Unreversed receipt or settlement and reason required'; END IF;
IF cash.amount<>w.amount THEN RAISE EXCEPTION 'Reversal must match the selected original entry'; END IF;
IF cash.direction='Receipt' AND cash.source_id LIKE 'ADV-%' THEN
SELECT * INTO advance FROM public.erp_customer_advances WHERE id=cash.source_id FOR UPDATE;
IF advance.allocated<>0 THEN RAISE EXCEPTION 'Allocated advance cannot be reversed until its allocations are resolved'; END IF;
UPDATE public.erp_customer_advances SET reversed=true WHERE id=advance.id;
ELSE
SELECT data INTO r FROM public.erp_records WHERE kind=CASE WHEN cash.direction='Receipt' THEN 'invoices' ELSE 'trips' END AND id=cash.source_id FOR UPDATE;
IF r IS NULL OR (r->>'paid')::numeric<cash.amount THEN RAISE EXCEPTION 'Original balance cannot support this reversal'; END IF;
paid:=(r->>'paid')::numeric-cash.amount; total:=CASE WHEN cash.direction='Receipt' THEN (r->>'amount')::numeric ELSE (r->>'cost')::numeric END;
UPDATE public.erp_records SET data=r||jsonb_build_object('paid',paid)||CASE WHEN cash.direction='Receipt' THEN jsonb_build_object('status',CASE WHEN paid=0 THEN 'Issued' WHEN paid=total THEN 'Paid' ELSE 'Part-paid' END) ELSE '{}'::jsonb END WHERE kind=CASE WHEN cash.direction='Receipt' THEN 'invoices' ELSE 'trips' END AND id=cash.source_id;
END IF;
INSERT INTO public.erp_cash_reversals VALUES('RV-'||w.id,cash.id,w.operation_id,w.id,cash.amount,w.submitted_by,w.details,now());
UPDATE public.erp_work SET status='Voided',dependencies=dependencies+1 WHERE id=w.id;
ELSIF w.kind='Void' AND w.payload->>'sourceKind'='Invoice' THEN
SELECT data INTO r FROM public.erp_records WHERE kind='invoices' AND id=w.payload->>'sourceId' AND operation_id=w.operation_id FOR UPDATE;
IF r IS NULL OR (r->>'paid')::numeric<>0 OR r->>'status'='Voided' OR nullif(trim(w.details),'') IS NULL THEN RAISE EXCEPTION 'An unpaid unvoided invoice and reason are required; reverse receipts first'; END IF;
UPDATE public.erp_records SET data=r||jsonb_build_object('status','Voided') WHERE kind='invoices' AND id=r->>'id';
UPDATE public.erp_work SET status='Voided',dependencies=dependencies+1 WHERE id=w.id;
ELSE RETURN public.workspace_action(action,input); END IF;
UPDATE public.erp_work SET history=history||jsonb_build_array(jsonb_build_object('actor',person,'action','Posted','reason',w.details,'time',now())) WHERE id=w.id;
INSERT INTO public.erp_audit(operation_id,actor_id,action,record_id,reason) VALUES(w.operation_id,uid,'Financial posting',w.id,w.details);
RETURN to_jsonb(w.id);
END $$;
REVOKE ALL ON FUNCTION public.erp_financial_action(text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.erp_financial_action(text,jsonb) TO authenticated;
CREATE INDEX erp_advances_customer ON public.erp_customer_advances(customer_name);
CREATE INDEX erp_allocations_invoice ON public.erp_advance_allocations(invoice_id);
CREATE INDEX erp_reversals_operation ON public.erp_cash_reversals(operation_id);