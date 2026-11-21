CREATE FUNCTION public.activate_company_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF lower(NEW.email)='rayztechn26@gmail.com' AND NEW.email_confirmed_at IS NOT NULL THEN INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'Business Owner') ON CONFLICT(user_id) DO NOTHING; END IF; RETURN NEW; END $$;
CREATE TRIGGER activate_verified_company_owner AFTER INSERT OR UPDATE OF email_confirmed_at,email ON auth.users FOR EACH ROW EXECUTE FUNCTION public.activate_company_owner();
INSERT INTO public.user_roles(user_id,role) SELECT id,'Business Owner' FROM auth.users WHERE lower(email)='rayztechn26@gmail.com' AND email_confirmed_at IS NOT NULL ON CONFLICT(user_id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.staff_directory() RETURNS TABLE(id uuid,display_name text,role text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT p.id,p.display_name,coalesce(u.role,'') FROM public.profiles p LEFT JOIN public.user_roles u ON u.user_id=p.id WHERE public.staff_role()='Admin' OR public.general_approver() OR (public.staff_role() LIKE '%Manager' AND CASE WHEN u.role LIKE '%Logistics%' THEN 'logistics' WHEN u.role IN ('Transport Manager','Transport Officer','Dispatcher') THEN 'transport' WHEN u.role IN ('Finance Manager','Finance Officer','Accountant') THEN 'finance' END=public.staff_department()) OR p.id=auth.uid() $$;
CREATE OR REPLACE FUNCTION public.assign_staff(staff_id uuid, staff_role text, operation_id text DEFAULT NULL, work_area text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Staff authentication required'; END IF;
IF operation_id IS NULL THEN
IF NOT(public.staff_role()='Admin' OR public.general_approver()) THEN RAISE EXCEPTION 'Administrator required'; END IF;
IF staff_id=auth.uid() THEN RAISE EXCEPTION 'Another administrator must change your access'; END IF;
INSERT INTO public.user_roles(user_id,role) VALUES(staff_id,staff_role) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role;
ELSE
IF NOT(public.staff_role()='Admin' OR public.department_manager(work_area)) OR NOT public.operation_access(operation_id) THEN RAISE EXCEPTION 'Authorized department manager required'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.erp_records WHERE kind='operations' AND id=operation_id) THEN RAISE EXCEPTION 'Operation required'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.user_roles u WHERE user_id=staff_id AND CASE work_area WHEN 'external' THEN u.role='External Logistics Officer' WHEN 'internal' THEN u.role='Internal Logistics Officer' WHEN 'transport' THEN u.role IN ('Transport Officer','Dispatcher') WHEN 'finance' THEN u.role IN ('Finance Officer','Accountant') ELSE false END) THEN RAISE EXCEPTION 'Role must match assigned work area'; END IF;
INSERT INTO public.operation_assignments VALUES(operation_id,staff_id,work_area) ON CONFLICT DO NOTHING;
END IF;
END $$;
CREATE OR REPLACE FUNCTION public.operation_access(op text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.general_approver() OR public.staff_role()='Admin' OR (public.staff_role() LIKE '%Manager' AND (EXISTS(SELECT 1 FROM public.operation_assignments WHERE operation_id=op AND public.area_department(area)=public.staff_department()) OR EXISTS(SELECT 1 FROM public.erp_work WHERE operation_id=op AND public.area_department(area)=public.staff_department()))) OR EXISTS(SELECT 1 FROM public.operation_assignments WHERE operation_id=op AND user_id=auth.uid() AND area=public.staff_area()) $$;
CREATE POLICY finance_related_record_read ON public.erp_records FOR SELECT TO authenticated USING(public.operation_access(operation_id) AND public.staff_department()='finance' AND kind IN ('costs','trips','invoices'));
REVOKE ALL ON FUNCTION public.create_staff_profile() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.activate_company_owner() FROM PUBLIC,anon,authenticated;