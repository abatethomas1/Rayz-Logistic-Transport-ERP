CREATE TABLE public.erp_documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operation_id text NOT NULL REFERENCES public.erp_operations(id), area text NOT NULL CHECK(area IN ('external','internal','transport','finance')), work_id text REFERENCES public.erp_work(id), name text NOT NULL, category text NOT NULL, mime_type text NOT NULL, object_path text NOT NULL UNIQUE, created_by uuid NOT NULL, ready boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.erp_documents TO authenticated; GRANT ALL ON public.erp_documents TO service_role;
ALTER TABLE public.erp_documents ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.erp_document_read(doc_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce((SELECT public.operation_access(d.operation_id) AND (public.general_approver() OR public.staff_role()='Admin' OR public.department_manager(d.area) OR (public.staff_area()=d.area AND (d.work_id IS NULL OR EXISTS(SELECT 1 FROM public.erp_work w WHERE w.id=d.work_id AND w.assigned_to=auth.uid()))) OR (public.staff_department()='finance' AND EXISTS(SELECT 1 FROM public.erp_cost_postings c WHERE c.source_work_id=d.work_id))) FROM public.erp_documents d WHERE d.id=doc_id),false) $$;
REVOKE ALL ON FUNCTION public.erp_document_read(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.erp_document_read(uuid) TO authenticated;
CREATE POLICY authorized_document_metadata ON public.erp_documents FOR SELECT TO authenticated USING(public.erp_document_read(id));
CREATE FUNCTION public.erp_document_upload(path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.erp_documents d WHERE d.object_path=path AND d.created_by=auth.uid() AND NOT d.ready AND public.operation_access(d.operation_id) AND (public.department_manager(d.area) OR public.staff_area()=d.area) AND (d.work_id IS NULL OR EXISTS(SELECT 1 FROM public.erp_work w WHERE w.id=d.work_id AND w.status IN ('Draft','Returned') AND (public.department_manager(w.area) OR w.assigned_to=auth.uid())))) $$;
REVOKE ALL ON FUNCTION public.erp_document_upload(text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.erp_document_upload(text) TO authenticated;
CREATE POLICY erp_private_file_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='erp-documents' AND public.erp_document_upload(name));
CREATE POLICY erp_private_file_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='erp-documents' AND EXISTS(SELECT 1 FROM public.erp_documents d WHERE d.object_path=name AND d.ready AND public.erp_document_read(d.id)));
CREATE POLICY erp_pending_file_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='erp-documents' AND public.erp_document_upload(name));
CREATE FUNCTION public.erp_document_action(action text,input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.erp_documents; w public.erp_work; uid uuid:=auth.uid(); doc_id uuid:=gen_random_uuid(); op text:=input->>'operationId'; a text:=input->>'area'; path text;
BEGIN
IF uid IS NULL OR public.staff_role()='' THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;
IF action='prepare' THEN
IF NOT public.operation_access(op) OR NOT(public.department_manager(a) OR public.staff_area()=a) THEN RAISE EXCEPTION 'Assigned department access required' USING ERRCODE='42501'; END IF;
IF nullif(input->>'workId','') IS NOT NULL THEN SELECT * INTO w FROM public.erp_work WHERE id=input->>'workId' FOR UPDATE; IF w.id IS NULL OR w.operation_id<>op OR w.area<>a OR w.status NOT IN ('Draft','Returned') OR NOT(public.department_manager(a) OR w.assigned_to=uid) THEN RAISE EXCEPTION 'Eligible assigned draft required'; END IF; END IF;
IF nullif(trim(input->>'name'),'') IS NULL OR length(input->>'name')>250 THEN RAISE EXCEPTION 'Valid file name required'; END IF;
path:=op||'/'||a||'/'||doc_id;
INSERT INTO public.erp_documents(id,operation_id,area,work_id,name,category,mime_type,object_path,created_by) VALUES(doc_id,op,a,nullif(input->>'workId',''),input->>'name',input->>'category',input->>'mimeType',path,uid);
RETURN jsonb_build_object('id',doc_id,'path',path);
ELSIF action='finalize' THEN
SELECT * INTO d FROM public.erp_documents WHERE id=(input->>'id')::uuid FOR UPDATE;
IF d.id IS NULL OR NOT public.erp_document_upload(d.object_path) THEN RAISE EXCEPTION 'Pending own upload required' USING ERRCODE='42501'; END IF;
IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='erp-documents' AND name=d.object_path) THEN RAISE EXCEPTION 'Uploaded file bytes not found'; END IF;
IF d.work_id IS NOT NULL THEN SELECT * INTO w FROM public.erp_work WHERE id=d.work_id FOR UPDATE; IF w.status NOT IN ('Draft','Returned') THEN RAISE EXCEPTION 'Work already submitted'; END IF; UPDATE public.erp_work SET documents=documents||jsonb_build_array(d.name),dependencies=dependencies+1 WHERE id=w.id; END IF;
UPDATE public.erp_documents SET ready=true WHERE id=d.id;
INSERT INTO public.erp_audit(operation_id,actor_id,action,record_id,reason) VALUES(d.operation_id,uid,'Document attached',d.id::text,d.name);
RETURN to_jsonb(d.id);
ELSE RAISE EXCEPTION 'Unknown document action'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.erp_document_action(text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.erp_document_action(text,jsonb) TO authenticated;
CREATE INDEX erp_documents_operation_area ON public.erp_documents(operation_id,area);
CREATE INDEX erp_documents_work ON public.erp_documents(work_id);