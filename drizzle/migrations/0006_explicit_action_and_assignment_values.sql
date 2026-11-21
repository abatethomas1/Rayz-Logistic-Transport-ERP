DO $$ DECLARE definition text; BEGIN SELECT pg_get_functiondef('public.workspace_action(text,jsonb)'::regprocedure) INTO definition; definition:=replace(definition,'public.staff_role() IS NULL','public.staff_role()='''''); definition:=replace(definition,'amount=amount,','amount=(input->>''amount'')::numeric,'); definition:=replace(definition,'INSERT INTO public.erp_records VALUES(''operations'',op,op,'''',r);','IF (r->>''quantity'')::numeric::text IN (''NaN'',''Infinity'',''-Infinity'') OR (r->>''weight'')::numeric::text IN (''NaN'',''Infinity'',''-Infinity'') OR (r->>''charge'')::numeric::text IN (''NaN'',''Infinity'',''-Infinity'') THEN RAISE EXCEPTION ''Finite operation values required''; END IF; INSERT INTO public.erp_records VALUES(''operations'',op,op,'''',r);'); EXECUTE definition; END $$;
CREATE OR REPLACE FUNCTION public.assign_staff(staff_id uuid, staff_role text, operation_id text DEFAULT NULL, work_area text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NULL OR public.staff_role()='' THEN RAISE EXCEPTION 'Staff authentication required'; END IF;
IF $3 IS NULL THEN
IF NOT(public.staff_role()='Admin' OR public.general_approver()) THEN RAISE EXCEPTION 'Administrator required'; END IF;
IF $1=auth.uid() THEN RAISE EXCEPTION 'Another administrator must change your access'; END IF;
INSERT INTO public.user_roles(user_id,role) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role;
ELSE
IF NOT(public.staff_role()='Admin' OR public.department_manager($4)) OR NOT public.operation_access($3) THEN RAISE EXCEPTION 'Authorized department manager required'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.erp_records r WHERE r.kind='operations' AND r.id=$3) THEN RAISE EXCEPTION 'Operation required'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.user_roles u WHERE u.user_id=$1 AND CASE $4 WHEN 'external' THEN u.role='External Logistics Officer' WHEN 'internal' THEN u.role='Internal Logistics Officer' WHEN 'transport' THEN u.role IN ('Transport Officer','Dispatcher') WHEN 'finance' THEN u.role IN ('Finance Officer','Accountant') ELSE false END) THEN RAISE EXCEPTION 'Role must match assigned work area'; END IF;
INSERT INTO public.operation_assignments(operation_id,user_id,area) VALUES($3,$1,$4) ON CONFLICT DO NOTHING;
INSERT INTO public.erp_audit(operation_id,actor_id,action,record_id,reason) VALUES($3,auth.uid(),'Assigned operation',$1::text,$4);
END IF;
END $$;