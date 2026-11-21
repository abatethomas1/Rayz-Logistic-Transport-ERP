from django.db import migrations

SQL = """
CREATE FUNCTION erp_guard_company_relationships() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id THEN
  RAISE EXCEPTION 'Company ownership is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_TABLE_NAME = 'erp_membership' THEN
  IF TG_OP='UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
   RAISE EXCEPTION 'Membership identity is immutable' USING ERRCODE='23514';
  END IF;
 ELSIF TG_TABLE_NAME = 'erp_record' THEN
  IF TG_OP='UPDATE' AND (NEW.created_by_id IS DISTINCT FROM OLD.created_by_id OR NEW.kind IS DISTINCT FROM OLD.kind) THEN
   RAISE EXCEPTION 'Record creator and resource are immutable' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM erp_membership WHERE id=NEW.assigned_to_id AND company_id=NEW.company_id)
     OR NOT EXISTS (SELECT 1 FROM erp_membership WHERE id=NEW.created_by_id AND company_id=NEW.company_id)
     OR (NEW.submitted_by_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM erp_membership WHERE id=NEW.submitted_by_id AND company_id=NEW.company_id))
     OR (NEW.related_record_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM erp_record WHERE id=NEW.related_record_id AND company_id=NEW.company_id)) THEN
   RAISE EXCEPTION 'Cross-company record relationship denied' USING ERRCODE='23514';
  END IF;
 ELSIF TG_TABLE_NAME = 'erp_document' THEN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Completed documents are immutable' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM erp_record WHERE id=NEW.record_id AND company_id=NEW.company_id)
     OR NOT EXISTS(SELECT 1 FROM erp_membership WHERE id=NEW.uploaded_by_id AND company_id=NEW.company_id)
     OR NEW.object_key NOT LIKE NEW.company_id::text || '/documents/%' THEN
   RAISE EXCEPTION 'Cross-company document relationship denied' USING ERRCODE='23514';
  END IF;
 ELSIF TG_TABLE_NAME = 'erp_exportjob' THEN
  IF TG_OP='UPDATE' AND NEW.requested_by_id IS DISTINCT FROM OLD.requested_by_id THEN
   RAISE EXCEPTION 'Export ownership is immutable' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM erp_membership WHERE id=NEW.requested_by_id AND company_id=NEW.company_id)
    OR (NEW.object_key<>'' AND NEW.object_key NOT LIKE NEW.company_id::text || '/exports/%') THEN
   RAISE EXCEPTION 'Cross-company job relationship denied' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER company_membership_guard BEFORE INSERT OR UPDATE ON erp_membership FOR EACH ROW EXECUTE FUNCTION erp_guard_company_relationships();
CREATE TRIGGER company_record_guard BEFORE INSERT OR UPDATE ON erp_record FOR EACH ROW EXECUTE FUNCTION erp_guard_company_relationships();
CREATE TRIGGER company_document_guard BEFORE INSERT OR UPDATE ON erp_document FOR EACH ROW EXECUTE FUNCTION erp_guard_company_relationships();
CREATE TRIGGER company_export_guard BEFORE INSERT OR UPDATE ON erp_exportjob FOR EACH ROW EXECUTE FUNCTION erp_guard_company_relationships();
CREATE FUNCTION erp_immutable_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit history is immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON erp_auditevent FOR EACH ROW EXECUTE FUNCTION erp_immutable_audit();
"""

class Migration(migrations.Migration):
    dependencies = [('erp', '0001_initial')]
    operations = [migrations.RunSQL(SQL)]