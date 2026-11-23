from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from erp.models import AuditEvent, Membership, PlatformAdministrator, Record
from erp.tests import test_company_isolation as isolation

class PlatformContextTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        isolation.CompanyIsolationTests.setUpTestData.__func__(cls)
        cls.operator = get_user_model().objects.create_user(username='rayz-operator', email='operator@example.test', password='unused-Strong-Pass-91')
        cls.platform = PlatformAdministrator.objects.create(user=cls.operator, support_permissions=['support.view_operations', 'support.manage_memberships'])

    def setUp(self):
        self.client = APIClient(HTTP_X_FORWARDED_PROTO='https')

    def as_operator(self):
        self.client.force_authenticate(user=self.operator)

    def login(self, company, role):
        self.client.force_authenticate(user=self.people[company][role].user)

    def test_platform_super_admin_can_configure_all_three_companies(self):
        self.as_operator()
        for slug in ['base', 'sat', 'yangtze']:
            company = self.companies[slug]
            url = f'/api/v1/platform/companies/{company.id}/'
            response = self.client.patch(url, {'branding': {'display_name': f'{slug} brand'}, 'enabled_modules': ['logistics', 'reports']}, format='json')
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(self.client.post(url + 'suspend/', {'reason': 'Contract paused'}, format='json').data['active'], False)
            self.assertEqual(self.client.post(url + 'activate/', {'reason': 'Contract renewed'}, format='json').data['active'], True)
            company.refresh_from_db()
            self.assertEqual(company.branding['display_name'], f'{slug} brand')
            self.assertEqual(company.enabled_modules, ['logistics', 'reports'])
        self.assertEqual(self.client.get('/api/v1/platform/companies/overview/').data['totals']['companies'], 3)
        self.assertEqual(self.client.post(f'/api/v1/platform/companies/{self.companies["sat"].id}/suspend/', {}, format='json').status_code, 400)

    def test_base_company_administrator_cannot_change_sat_or_yangtze(self):
        self.login('base', 'admin')
        for slug in ['sat', 'yangtze']:
            target = self.companies[slug]
            self.client.credentials(HTTP_X_COMPANY=str(target.id))
            self.assertEqual(self.client.patch('/api/v1/company-settings/current/', {'name': 'Taken over'}, format='json').status_code, 403)
            self.assertEqual(self.client.patch(f'/api/v1/memberships/{self.people[slug]["external"].id}/', {'active': False}, format='json').status_code, 403)
            self.client.credentials()
            self.assertEqual(self.client.patch(f'/api/v1/platform/companies/{target.id}/', {'name': 'Taken over'}, format='json').status_code, 403)
            target.refresh_from_db()
            self.assertNotEqual(target.name, 'Taken over')
        self.client.credentials(HTTP_X_COMPANY=str(self.companies['base'].id))
        self.assertEqual(self.client.patch('/api/v1/company-settings/current/', {'invoice_prefix': 'BASE'}, format='json').status_code, 200)

    def test_department_manager_approves_eligible_submission_in_own_company(self):
        record = self.records['sat']['operations']
        self.login('sat', 'external')
        url = f'/api/v1/operations/{record.id}/lifecycle/'
        self.assertEqual(self.client.post(url, {'command': 'submit'}, format='json').status_code, 200)
        self.login('sat', 'logistics_manager')
        self.assertEqual(self.client.post(url, {'command': 'approve'}, format='json').status_code, 200)

    def test_platform_status_never_grants_business_approval(self):
        record = self.records['base']['operations']
        record.status = 'Submitted'; record.submitted_by = self.people['base']['external']; record.save()
        self.as_operator()
        self.assertEqual(self.client.get('/api/v1/platform/companies/context/').data['businessApprovals'], False)
        for path in [f'/api/v1/operations/{record.id}/lifecycle/', f'/api/v1/invoices/{self.records["base"]["invoices"].id}/lifecycle/']:
            for headers in [{}, {'HTTP_X_COMPANY': str(self.companies['base'].id)}]:
                self.client.credentials(**headers)
                self.assertEqual(self.client.post(path, {'command': 'approve' if 'operations' in path else 'issue'}, format='json').status_code, 403)
        record.refresh_from_db()
        self.assertEqual(record.status, 'Submitted')

    def test_company_support_actions_are_permissioned_and_audited(self):
        company = self.companies['yangtze']
        member = self.people['yangtze']['transport']
        url = f'/api/v1/platform/companies/{company.id}/'
        self.as_operator()
        self.assertEqual(self.client.get(url + 'support/').status_code, 400)
        view = self.client.get(url + 'support/', {'reason': 'Customer ticket 41'})
        self.assertEqual(view.status_code, 200)
        self.assertEqual([o['code'] for o in view.data['operations']], [self.records['yangtze']['operations'].code])
        payload = {'action': 'deactivate_membership', 'membership': str(member.id), 'reason': 'Lost device report', 'confirm_company': str(self.companies['base'].id)}
        self.assertEqual(self.client.post(url + 'support-actions/', payload, format='json').status_code, 400)
        payload['confirm_company'] = str(company.id)
        response = self.client.post(url + 'support-actions/', payload, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Membership.objects.get(pk=member.id).active)
        event = AuditEvent.objects.get(action='support_deactivate_membership')
        self.assertEqual((event.actor, event.company, event.details['reason'], event.target), (self.operator, company, 'Lost device report', str(member.id)))
        self.assertIsNotNone(event.occurred_at)
        self.assertTrue(AuditEvent.objects.filter(action='support_view_operations', company=company, details__reason='Customer ticket 41').exists())
        self.platform.support_permissions = []; self.platform.save()
        self.assertEqual(self.client.get(url + 'support/', {'reason': 'Customer ticket 41'}).status_code, 403)
        payload['action'] = 'reactivate_membership'
        self.assertEqual(self.client.post(url + 'support-actions/', payload, format='json').status_code, 403)
        self.login('base', 'admin')
        self.assertEqual(self.client.get(url + 'support/', {'reason': 'Curious admin'}).status_code, 403)

    def test_support_row_security_is_read_only_and_limited_to_selected_company(self):
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute('CREATE ROLE rayz_support_reader NOLOGIN NOSUPERUSER NOBYPASSRLS')
            cursor.execute('GRANT USAGE ON SCHEMA public TO rayz_support_reader')
            cursor.execute('GRANT SELECT, UPDATE ON erp_record TO rayz_support_reader')
            cursor.execute('GRANT SELECT ON erp_platformadministrator, auth_user, erp_membership, erp_company TO rayz_support_reader')
            cursor.execute('SET LOCAL ROLE rayz_support_reader')
            cursor.execute("SELECT set_config('rayz.user_id', %s, true), set_config('rayz.support_company_id', %s, true)", [str(self.operator.pk), str(self.companies['sat'].id)])
            cursor.execute('SELECT DISTINCT company_id FROM erp_record')
            self.assertEqual(cursor.fetchall(), [(self.companies['sat'].id,)])
            cursor.execute('UPDATE erp_record SET title=%s WHERE company_id=%s', ['support write', self.companies['sat'].id])
            self.assertEqual(cursor.rowcount, 0)
            cursor.execute("SELECT set_config('rayz.user_id', %s, true)", [str(self.people['base']['admin'].user_id)])
            cursor.execute('SELECT count(*) FROM erp_record')
            self.assertEqual(cursor.fetchone()[0], 0)
            cursor.execute('RESET ROLE')
