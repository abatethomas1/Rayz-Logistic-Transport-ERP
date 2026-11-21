CREATE FUNCTION public.erp_post_approved_bill(work_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.erp_work; p jsonb; original numeric; fx numeric; converted numeric; currency_code text; source text; stage text;
BEGIN
SELECT * INTO w FROM public.erp_work WHERE id=work_id FOR UPDATE;
IF w.id IS NULL OR w.status<>'Approved' OR w.kind NOT IN ('Bill','Expense') OR NOT(public.department_manager(w.area) OR (w.assigned_to=auth.uid() AND public.staff_area()=w.area)) THEN RAISE EXCEPTION 'Approved assigned bill required' USING ERRCODE='42501'; END IF;
p:=w.payload; currency_code:=coalesce(p->>'currency','ETB'); original:=coalesce(nullif(p->>'amount','')::numeric,w.amount); fx:=coalesce(nullif(p->>'rate','')::numeric,1); source:=coalesce(nullif(p->>'rateSource',''),CASE WHEN currency_code='ETB' THEN 'ETB' END); stage:=nullif(p->>'stageId','');
IF original IS NULL OR original<=0 OR original::text IN ('NaN','Infinity','-Infinity') OR fx IS NULL OR fx<=0 OR fx::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Positive finite original amount and exchange rate required'; END IF;
IF currency_code='ETB' AND fx<>1 THEN RAISE EXCEPTION 'ETB exchange rate must be 1'; END IF;
IF currency_code<>'ETB' AND (source IS NULL OR nullif(p->>'date','') IS NULL) THEN RAISE EXCEPTION 'Historical exchange-rate date and source required'; END IF;
converted:=CASE WHEN currency_code='ETB' THEN original ELSE round(original*fx,0) END;
IF converted<=0 OR w.amount<>converted THEN RAISE EXCEPTION 'Approved ETB amount must match the whole-ETB foreign-currency snapshot'; END IF;
IF stage IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.erp_port_stages WHERE id=stage AND operation_id=w.operation_id) THEN RAISE EXCEPTION 'Source stage must belong to the operation'; END IF;
INSERT INTO public.erp_cost_postings(id,operation_id,source_work_id,stage_id,supplier,category,original_amount,currency,rate,rate_date,rate_source,converted_etb,posted_by) VALUES('BL-'||w.id,w.operation_id,w.id,stage,coalesce(p->>'supplier',w.title),coalesce(p->>'category',w.kind),original,currency_code,fx,coalesce(nullif(p->>'date','')::date,current_date),source,converted,auth.uid());
INSERT INTO public.erp_records(kind,id,operation_id,area,data) VALUES('costs','BL-'||w.id,w.operation_id,w.area,jsonb_build_object('id','BL-'||w.id,'operationId',w.operation_id,'stageId',coalesce(stage,''),'category',coalesce(p->>'category',w.kind),'supplier',coalesce(p->>'supplier',w.title),'currency',currency_code,'amount',original,'rate',fx,'convertedAmount',converted,'rateSource',source,'approval','Approved','status','Unpaid','date',coalesce(p->>'date',current_date::text)));
END $$;
REVOKE ALL ON FUNCTION public.erp_post_approved_bill(text) FROM PUBLIC,anon,authenticated;
DO $$ DECLARE definition text; first_pos integer; end_pos integer;
BEGIN
SELECT pg_get_functiondef('public.erp_operational_action(text,jsonb)'::regprocedure) INTO definition;
first_pos:=strpos(definition,'ELSIF w.kind IN (''Bill'',''Expense'') THEN');
end_pos:=strpos(definition,'ELSE RAISE EXCEPTION ''Use the financial posting action');
IF first_pos=0 OR end_pos<=first_pos THEN RAISE EXCEPTION 'Expected bill posting block not found'; END IF;
definition:=substring(definition,1,first_pos-1)||'ELSIF w.kind IN (''Bill'',''Expense'') THEN PERFORM public.erp_post_approved_bill(w.id);'||chr(10)||substring(definition,end_pos);
EXECUTE definition;
SELECT pg_get_functiondef('public.workspace_action(text,jsonb)'::regprocedure) INTO definition;
IF strpos(definition,'documents=coalesce(input->''documents'',''[]'') WHERE id=w.id;')=0 THEN RAISE EXCEPTION 'Expected draft edit block not found'; END IF;
definition:=replace(definition,'documents=coalesce(input->''documents'',''[]'') WHERE id=w.id;','documents=coalesce(input->''documents'',''[]''),payload=coalesce(input->''payload'',payload) WHERE id=w.id;');
EXECUTE definition;
END $$;