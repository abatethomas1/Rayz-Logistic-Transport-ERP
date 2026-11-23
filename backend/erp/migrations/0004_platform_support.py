from django.db import migrations, models

SQL = """
CREATE FUNCTION erp_support_company(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(target::text = nullif(current_setting('rayz.support_company_id', true), '')
  AND EXISTS(SELECT 1 FROM erp_platformadministrator p JOIN auth_user u ON u.id=p.user_id
   WHERE p.user_id::text=nullif(current_setting('rayz.user_id', true), '')
   AND p.active AND u.is_active AND p.support_permissions ? 'support.view_operations'), false);
$$;
CREATE POLICY platform_support_read ON erp_record FOR SELECT USING(erp_support_company(company_id));
"""
REVERSE = "DROP POLICY platform_support_read ON erp_record; DROP FUNCTION erp_support_company(uuid);"

class Migration(migrations.Migration):
    dependencies = [('erp', '0003_company_row_security')]
    operations = [
        migrations.AddField(model_name='platformadministrator', name='support_permissions', field=models.JSONField(blank=True, default=list)),
        migrations.RunSQL(SQL, REVERSE),
    ]
