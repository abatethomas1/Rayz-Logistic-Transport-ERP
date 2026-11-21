from django.db import migrations

SQL = """
CREATE FUNCTION erp_active_company(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(target::text = nullif(current_setting('rayz.company_id', true), '')
  AND EXISTS(SELECT 1 FROM erp_membership m JOIN erp_company c ON c.id=m.company_id JOIN auth_user u ON u.id=m.user_id
   WHERE m.company_id=target AND m.user_id::text=nullif(current_setting('rayz.user_id', true), '')
   AND m.active AND c.active AND u.is_active), false);
$$;
ALTER TABLE erp_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_record FORCE ROW LEVEL SECURITY;
CREATE POLICY company_record_boundary ON erp_record FOR ALL
 USING(erp_active_company(company_id)) WITH CHECK(erp_active_company(company_id));
ALTER TABLE erp_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_document FORCE ROW LEVEL SECURITY;
CREATE POLICY company_document_boundary ON erp_document FOR ALL
 USING(erp_active_company(company_id)) WITH CHECK(erp_active_company(company_id));
"""

class Migration(migrations.Migration):
    dependencies = [('erp', '0002_company_relationship_guards')]
    operations = [migrations.RunSQL(SQL)]