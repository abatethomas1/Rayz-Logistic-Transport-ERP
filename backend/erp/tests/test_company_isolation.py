import hashlib
import io
import secrets
import tempfile
from pathlib import Path
from decimal import Decimal
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection, IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from openpyxl import load_workbook
from erp.models import Company, Membership, PlatformAdministrator, Record, Document, ExportJob, StaffInvitation
from erp.services import run_export_job, private_path

class CompanyIsolationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        assert connection.vendor == 'postgresql', 'Isolation tests must run against PostgreSQL.'
        User = get_user_model()
        cls.companies = {}
        cls.people = {}
        cls.records = {}
        cls.passwords = {}
        for slug, name in [('base', 'Base'), ('sat', 'SAT'), ('yangtze', 'Yangtze')]:
            company = Company.objects.create(slug=slug, name=f'{name} Logistics & Transport', enabled_modules=['logistics', 'transport', 'finance', 'reports'], report_access={d: ['General Manager'] for d in ['logistics', 'transport', 'finance']})
            cls.companies[slug] = company
            members = {}
            for key, role in [('admin', 'Company Administrator'), ('general', 'General Manager'), ('external', 'External Officer'), ('internal', 'Internal Officer'), ('transport', 'Transport Officer'), ('finance', 'Finance Officer'), ('finance_manager', 'Finance Manager'), ('logistics_manager', 'Logistics Manager')]:
                password = secrets.token_urlsafe(24)
                user = User.objects.create_user(username=f'{slug}-{key}', email=f'{slug}-{key}@example.test', password=password)
                cls.passwords[(slug, key)] = password
                members[key] = Membership.objects.create(company=company, user=user, role=role)
            cls.people[slug] = members
            cls.records[slug] = {}
            for kind in Record.KINDS:
                area = 'transport' if kind in ['trips', 'trucks'] else 'finance' if kind in ['bills', 'invoices', 'payments'] else 'external'
                officer = members[area]
                cls.records[slug][kind] = Record.objects.create(company=company, kind=kind, code=f'{kind}-001', title=f'{slug}-private-{kind}', area=area, assigned_to=officer, created_by=officer, amount=Decimal('1250.00'))
        cls.platform_user = User.objects.create_user(username='rayz-platform', password=secrets.token_urlsafe(24))
        PlatformAdministrator.objects.create(user=cls.platform_user)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='rayz-private-')
        self.override = override_settings(PRIVATE_DOCUMENT_ROOT=Path(self.temp.name))
        self.override.enable()
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(self.override.disable)
        self.client = APIClient()

    def login(self, company='base', role='general'):
        self.client.force_authenticate(user=self.people[company][role].user)
        self.client.credentials()

    def test_three_named_companies_exist_and_share_one_database(self):
        self.assertEqual(connection.vendor, 'postgresql')
        self.assertEqual(list(Company.objects.order_by('slug').values_list('name', flat=True)), ['Base Logistics & Transport', 'SAT Logistics & Transport', 'Yangtze Logistics & Transport'])

    def test_real_password_token_membership_and_detail_read(self):
        self.client.force_authenticate(user=None)
        response = self.client.post('/api/v1/auth/token/', {'username': 'base-general', 'password': self.passwords[('base', 'general')]}, format='json')
        self.assertEqual(response.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')
        memberships = self.client.get('/api/v1/auth/memberships/')
        self.assertEqual(len(memberships.data), 1)
        self.assertEqual(str(memberships.data[0]['company']), str(self.companies['base'].id))
        own = self.records['base']['operations']
        self.assertEqual(self.client.get(f'/api/v1/operations/{own.id}/').status_code, 200)
        other = self.records['sat']['operations']
        self.assertEqual(self.client.get(f'/api/v1/operations/{other.id}/').status_code, 404)

    def test_every_pair_lists_searches_and_direct_urls_isolate_every_resource(self):
        for source in self.companies:
            self.login(source)
            for target in self.companies:
                if source == target:
                    continue
                for kind in Record.KINDS:
                    with self.subTest(source=source, target=target, resource=kind):
                        foreign = self.records[target][kind]
                        listing = self.client.get(f'/api/v1/{kind}/')
                        self.assertEqual(listing.status_code, 200)
                        self.assertEqual([r['title'] for r in listing.data['results']], [self.records[source][kind].title])
                        search = self.client.get(f'/api/v1/{kind}/', {'search': foreign.title, 'company_id': str(self.companies[target].id)})
                        self.assertEqual(search.data['count'], 0)
                        self.assertEqual(self.client.get(f'/api/v1/{kind}/{foreign.id}/').status_code, 404)

    def test_every_pair_cannot_change_delete_submit_or_approve_foreign_records(self):
        for source in self.companies:
            self.login(source)
            for target in self.companies:
                if source == target:
                    continue
                for kind in Record.KINDS:
                    foreign = self.records[target][kind]
                    url = f'/api/v1/{kind}/{foreign.id}/'
                    with self.subTest(source=source, target=target, kind=kind):
                        self.assertEqual(self.client.patch(url, {'title': 'tampered'}, format='json').status_code, 404)
                        self.assertEqual(self.client.delete(url).status_code, 404)
                        for command in ['submit', 'approve', 'return', 'issue']:
                            self.assertEqual(self.client.post(url + 'lifecycle/', {'command': command, 'reason': 'test'}, format='json').status_code, 404)
                        foreign.refresh_from_db()
                        self.assertEqual(foreign.title, f'{target}-private-{kind}')
                        self.assertEqual(foreign.status, 'Draft')

    def test_forged_company_selection_is_denied(self):
        self.login('base')
        for target in ['sat', 'yangtze']:
            self.client.credentials(HTTP_X_COMPANY=str(self.companies[target].id))
            self.assertEqual(self.client.get('/api/v1/operations/').status_code, 403)

    def test_company_and_related_ownership_are_not_browser_writable(self):
        self.login('base', 'external')
        own = self.people['base']['external']
        payload = {'code': 'NEW', 'title': 'new work', 'area': 'external', 'assigned_to': str(own.id), 'company_id': str(self.companies['sat'].id)}
        self.assertEqual(self.client.post('/api/v1/operations/', payload, format='json').status_code, 400)
        del payload['company_id']
        payload['related_record'] = str(self.records['sat']['customers'].id)
        self.assertEqual(self.client.post('/api/v1/operations/', payload, format='json').status_code, 400)
        del payload['related_record']
        payload['assigned_to'] = str(self.people['sat']['external'].id)
        self.assertEqual(self.client.post('/api/v1/operations/', payload, format='json').status_code, 400)

    def test_independent_same_company_submission_and_approval_succeed(self):
        record = self.records['base']['operations']
        self.login('base', 'external')
        url = f'/api/v1/operations/{record.id}/lifecycle/'
        self.assertEqual(self.client.post(url, {'command': 'submit'}, format='json').status_code, 200)
        self.assertEqual(self.client.post(url, {'command': 'approve'}, format='json').status_code, 403)
        self.login('base', 'logistics_manager')
        self.assertEqual(self.client.post(url, {'command': 'approve'}, format='json').status_code, 200)
        self.login('base', 'external')
        self.assertEqual(self.client.get(f'/api/v1/operations/{record.id}/').data['status'], 'Approved')
        self.assertEqual(self.client.patch(f'/api/v1/operations/{record.id}/', {'title': 'edit approved'}, format='json').status_code, 403)

    def test_no_self_approval_and_return_requires_reason(self):
        record = self.records['base']['operations']
        record.status = 'Submitted'
        record.submitted_by = self.people['base']['external']
        record.save()
        self.login('base', 'logistics_manager')
        url = f'/api/v1/operations/{record.id}/lifecycle/'
        self.assertEqual(self.client.post(url, {'command': 'return'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(url, {'command': 'return', 'reason': 'Missing clearance'}, format='json').status_code, 200)
        record = Record.objects.create(company=self.companies['base'], kind='operations', code='OWN-GM', title='Manager-created work', area='external', assigned_to=self.people['base']['external'], created_by=self.people['base']['general'], submitted_by=self.people['base']['external'], status='Submitted')
        url = f'/api/v1/operations/{record.id}/lifecycle/'
        self.login('base', 'general')
        self.assertEqual(self.client.post(url, {'command': 'approve'}, format='json').status_code, 403)

    def test_company_approval_limits_are_enforced(self):
        company = self.companies['base']
        company.approval_limits = {'Logistics Manager': '1000.00'}
        company.save()
        record = self.records['base']['operations']
        record.status = 'Submitted'
        record.submitted_by = self.people['base']['external']
        record.save()
        self.login('base', 'logistics_manager')
        self.assertEqual(self.client.post(f'/api/v1/operations/{record.id}/lifecycle/', {'command': 'approve'}, format='json').status_code, 403)
        self.login('base', 'general')
        self.assertEqual(self.client.post(f'/api/v1/operations/{record.id}/lifecycle/', {'command': 'approve'}, format='json').status_code, 200)

    def test_officers_cannot_view_other_areas_or_reassign_work(self):
        self.login('base', 'internal')
        self.assertEqual(self.client.get(f'/api/v1/operations/{self.records["base"]["operations"].id}/').status_code, 404)
        self.login('base', 'external')
        record = self.records['base']['operations']
        payload = {'assigned_to': str(self.people['base']['general'].id)}
        self.assertEqual(self.client.patch(f'/api/v1/operations/{record.id}/', payload, format='json').status_code, 400)

    def test_each_company_export_contains_only_its_own_data(self):
        for source in self.companies:
            self.login(source)
            response = self.client.get('/api/v1/reports/export/', {'area': 'external', 'kind': 'operations', 'format': 'xlsx'})
            self.assertEqual(response.status_code, 200)
            wb = load_workbook(io.BytesIO(response.content))
            values = str(list(wb.active.values))
            self.assertIn(self.companies[source].name, values)
            self.assertIn(self.records[source]['operations'].title, values)
            for target in self.companies:
                if source != target:
                    self.assertNotIn(self.records[target]['operations'].title, values)
            for target in self.companies:
                if source != target:
                    self.client.credentials(HTTP_X_COMPANY=str(self.companies[target].id))
                    self.assertEqual(self.client.get('/api/v1/reports/export/', {'area': 'external', 'kind': 'operations', 'format': 'pdf'}).status_code, 403)
                    self.client.credentials()
            pdf = self.client.get('/api/v1/reports/export/', {'area': 'external', 'kind': 'operations', 'format': 'pdf'})
            self.assertEqual(pdf.status_code, 200)
            self.assertTrue(pdf.content.startswith(b'%PDF'))

    def upload(self, company):
        self.login(company, 'external')
        content = b'%PDF-1.4\nprivate ' + company.encode()
        response = self.client.post('/api/v1/documents/', {'record': str(self.records[company]['operations'].id), 'file': SimpleUploadedFile('clearance.pdf', content, content_type='application/pdf')}, format='multipart')
        self.assertEqual(response.status_code, 201)
        return response.data['id'], content

    def test_every_pair_document_list_upload_metadata_and_download_are_isolated(self):
        documents = {source: self.upload(source) for source in self.companies}
        for source in self.companies:
            self.login(source, 'external')
            own_id, content = documents[source]
            download = self.client.get(f'/api/v1/documents/{own_id}/download/')
            self.assertEqual(download.status_code, 200)
            self.assertEqual(b''.join(download.streaming_content), content)
            self.assertEqual(self.client.get('/api/v1/documents/').data['count'], 1)
            for target in self.companies:
                if source == target:
                    continue
                foreign_id = documents[target][0]
                self.assertEqual(self.client.get(f'/api/v1/documents/{foreign_id}/').status_code, 404)
                self.assertEqual(self.client.get(f'/api/v1/documents/{foreign_id}/download/').status_code, 404)
                self.assertEqual(self.client.post('/api/v1/documents/', {'record': str(self.records[target]['operations'].id), 'file': SimpleUploadedFile('foreign.pdf', b'%PDF-1.4\nforeign')}, format='multipart').status_code, 404)
                doc = Document.objects.get(pk=foreign_id)
                self.assertEqual(self.client.get(f'/private-documents/{doc.object_key}').status_code, 404)

    def test_background_exports_scope_and_download_and_revalidate_revocation(self):
        jobs = {}
        for source in self.companies:
            self.login(source)
            response = self.client.post('/api/v1/export-jobs/', {'area': 'external', 'kind': 'operations', 'format': 'xlsx'}, format='json')
            self.assertEqual(response.status_code, 201)
            job_id = response.data['id']
            run_export_job(job_id)
            jobs[source] = job_id
            download = self.client.get(f'/api/v1/export-jobs/{job_id}/download/')
            self.assertEqual(download.status_code, 200)
            workbook = load_workbook(io.BytesIO(b''.join(download.streaming_content)))
            self.assertIn(self.records[source]['operations'].title, str(list(workbook.active.values)))
        for source in self.companies:
            self.login(source)
            for target in self.companies:
                if source != target:
                    self.assertEqual(self.client.get(f'/api/v1/export-jobs/{jobs[target]}/download/').status_code, 404)
        member = self.people['base']['general']
        pending = ExportJob.objects.create(company=member.company, requested_by=member, area='external', kind='operations')
        member.active = False
        member.save()
        run_export_job(pending.id)
        pending.refresh_from_db()
        self.assertEqual(pending.status, 'Denied')
        self.assertEqual(pending.object_key, '')
        self.login('base')
        self.assertEqual(self.client.get(f'/api/v1/export-jobs/{jobs["base"]}/download/').status_code, 403)

    def test_company_admin_is_not_platform_admin_and_cannot_manage_foreign_staff(self):
        for source in self.companies:
            self.login(source, 'admin')
            self.assertEqual(self.client.get('/api/v1/platform/companies/').status_code, 403)
            self.assertEqual(self.client.post('/api/v1/platform/companies/', {'name': 'intruder', 'slug': 'intruder'}, format='json').status_code, 403)
            for target in self.companies:
                if source != target:
                    foreign = self.people[target]['external']
                    self.assertEqual(self.client.patch(f'/api/v1/memberships/{foreign.id}/', {'role': 'Company Administrator'}, format='json').status_code, 404)
            own = self.people[source]['external']
            self.assertEqual(self.client.patch(f'/api/v1/memberships/{own.id}/', {'role': 'Platform Administrator'}, format='json').status_code, 400)

    def test_platform_admin_manages_companies_but_cannot_read_customer_data(self):
        self.client.force_authenticate(user=self.platform_user)
        self.assertEqual(self.client.get('/api/v1/platform/companies/').data['count'], 3)
        self.assertEqual(self.client.get('/api/v1/operations/').status_code, 403)
        created = self.client.post('/api/v1/platform/companies/', {'name': 'Future Client', 'slug': 'future', 'enabled_modules': ['logistics']}, format='json')
        self.assertEqual(created.status_code, 201)

    def test_company_settings_are_local_and_modules_and_report_permissions_enforced(self):
        self.login('base', 'admin')
        response = self.client.patch('/api/v1/company-settings/current/', {'invoice_prefix': 'BASE', 'branding': {'display_name': 'Base Cargo'}}, format='json')
        self.assertEqual(response.status_code, 200)
        self.companies['sat'].refresh_from_db()
        self.assertEqual(self.companies['sat'].invoice_prefix, 'INV')
        self.assertEqual(self.client.patch('/api/v1/company-settings/current/', {'active': True, 'enabled_modules': ['finance']}, format='json').status_code, 403)
        self.login('base', 'external')
        self.assertEqual(self.client.get('/api/v1/reports/rows/', {'area': 'external', 'kind': 'operations'}).status_code, 403)
        company = self.companies['base']
        company.enabled_modules = ['finance', 'reports']
        company.save()
        self.login('base')
        self.assertEqual(self.client.get('/api/v1/operations/').data['count'], 0)
        self.assertEqual(self.client.get('/api/v1/reports/export/', {'area': 'external', 'kind': 'operations'}).status_code, 403)

    def test_same_business_codes_and_invoice_numbers_are_independent_by_company(self):
        codes = []
        for source in self.companies:
            record = self.records[source]['invoices']
            record.status = 'Approved'
            record.save()
            self.login(source, 'finance')
            response = self.client.post(f'/api/v1/invoices/{record.id}/lifecycle/', {'command': 'issue'}, format='json')
            self.assertEqual(response.status_code, 200)
            codes.append(response.data['code'])
        self.assertEqual(codes, ['INV-000001', 'INV-000001', 'INV-000001'])

    def test_suspended_company_revoked_membership_and_unauthenticated_reads_denied(self):
        self.login('base')
        company = self.companies['base']
        company.active = False
        company.save()
        self.assertEqual(self.client.get('/api/v1/operations/').status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get('/api/v1/operations/').status_code, 401)

    def test_multiple_memberships_require_a_verified_explicit_selection(self):
        member = self.people['base']['general']
        Membership.objects.create(company=self.companies['sat'], user=member.user, role='External Officer')
        self.login('base')
        self.assertEqual(self.client.get('/api/v1/operations/').status_code, 403)
        self.client.credentials(HTTP_X_COMPANY=str(self.companies['base'].id))
        self.assertEqual(self.client.get('/api/v1/operations/').data['count'], 1)
        self.client.credentials(HTTP_X_COMPANY=str(self.companies['yangtze'].id))
        self.assertEqual(self.client.get('/api/v1/operations/').status_code, 403)

    def test_private_paths_reject_traversal(self):
        from rest_framework.exceptions import PermissionDenied
        with self.assertRaises(PermissionDenied):
            private_path('../outside')

    def test_returned_or_used_drafts_are_never_deleted(self):
        self.login('base', 'external')
        record = self.records['base']['operations']
        record.status = 'Returned'
        record.save()
        self.assertEqual(self.client.delete(f'/api/v1/operations/{record.id}/').status_code, 403)
        record.status = 'Draft'
        record.save()
        self.upload('base')
        self.assertEqual(self.client.delete(f'/api/v1/operations/{record.id}/').status_code, 403)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', DEFAULT_FROM_EMAIL='staff@example.test', INVITATION_URL='https://erp.example.test/accept-invitation')
    def test_invitation_chooses_individual_password_and_cannot_be_replayed(self):
        from django.core import mail
        self.login('base', 'admin')
        response = self.client.post('/api/v1/memberships/invitations/', {'email': 'new-officer@example.test', 'role': 'External Officer'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        token = mail.outbox[0].body.split('?token=')[1]
        self.client.force_authenticate(user=None)
        payload = {'token': token, 'username': 'new-officer', 'password': secrets.token_urlsafe(24)}
        self.assertEqual(self.client.post('/api/v1/auth/accept-invitation/', payload, format='json').status_code, 201)
        self.assertEqual(self.client.post('/api/v1/auth/accept-invitation/', payload, format='json').status_code, 404)
        self.assertEqual(Membership.objects.get(user__username='new-officer').company_id, self.companies['base'].id)

    def test_database_rejects_cross_company_foreign_keys(self):
        record = self.records['base']['operations']
        with self.assertRaises(IntegrityError), transaction.atomic():
            Record.objects.filter(pk=record.pk).update(related_record=self.records['sat']['customers'])
        with self.assertRaises(IntegrityError), transaction.atomic():
            Record.objects.filter(pk=record.pk).update(assigned_to=self.people['sat']['external'])

    def test_postgresql_row_security_denies_foreign_and_unscoped_reads(self):
        # Test through a real non-superuser role, not the migration owner's bypass.
        with connection.cursor() as cursor:
            cursor.execute('CREATE ROLE rayz_isolation_reader NOLOGIN NOSUPERUSER NOBYPASSRLS')
            cursor.execute('GRANT USAGE ON SCHEMA public TO rayz_isolation_reader')
            cursor.execute('GRANT SELECT, UPDATE ON erp_record, erp_document TO rayz_isolation_reader')
            cursor.execute('SET LOCAL ROLE rayz_isolation_reader')
            cursor.execute('SELECT count(*) FROM erp_record')
            self.assertEqual(cursor.fetchone()[0], 0)
            cursor.execute("SELECT set_config('rayz.user_id', %s, true), set_config('rayz.company_id', %s, true)", [str(self.people['base']['general'].user_id), str(self.companies['base'].id)])
            cursor.execute('SELECT DISTINCT company_id FROM erp_record')
            self.assertEqual(cursor.fetchall(), [(self.companies['base'].id,)])
            cursor.execute('UPDATE erp_record SET title=%s WHERE id=%s', ['forbidden', self.records['sat']['operations'].id])
            self.assertEqual(cursor.rowcount, 0)
            cursor.execute("SELECT set_config('rayz.company_id', %s, true)", [str(self.companies['sat'].id)])
            cursor.execute('SELECT count(*) FROM erp_record')
            self.assertEqual(cursor.fetchone()[0], 0)
            cursor.execute('RESET ROLE')

    def test_invalid_company_selection_and_malformed_configuration_are_rejected(self):
        self.login('base')
        self.client.credentials(HTTP_X_COMPANY='not-a-company-id')
        self.assertEqual(self.client.get('/api/v1/operations/').status_code, 403)
        self.login('base', 'admin')
        self.assertEqual(self.client.patch('/api/v1/company-settings/current/', {'approval_limits': {'Finance Manager': '-1'}}, format='json').status_code, 400)
        self.assertEqual(self.client.patch('/api/v1/company-settings/current/', {'report_access': {'finance': ['Platform Administrator']}}, format='json').status_code, 400)

    def test_forged_export_job_ownership_is_rejected(self):
        self.login('base')
        payload = {'area': 'external', 'kind': 'operations', 'company_id': str(self.companies['sat'].id)}
        self.assertEqual(self.client.post('/api/v1/export-jobs/', payload, format='json').status_code, 400)
        with self.assertRaises(IntegrityError), transaction.atomic():
            ExportJob.objects.create(company=self.companies['sat'], requested_by=self.people['base']['general'], area='external', kind='operations')

    def test_document_database_metadata_cannot_cross_companies_or_be_overwritten(self):
        document_id, _ = self.upload('base')
        with self.assertRaises(IntegrityError), transaction.atomic():
            Document.objects.filter(pk=document_id).update(filename='overwritten.pdf')
        with self.assertRaises(IntegrityError), transaction.atomic():
            Document.objects.create(company=self.companies['sat'], record=self.records['base']['operations'], uploaded_by=self.people['sat']['external'], filename='foreign.pdf', object_key=f'{self.companies["sat"].id}/documents/foreign', size=1, sha256='0' * 64)

    def test_authenticated_api_flow_under_restricted_postgresql_runtime_role(self):
        with connection.cursor() as cursor:
            cursor.execute('CREATE ROLE rayz_api_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS')
            cursor.execute('GRANT USAGE ON SCHEMA public TO rayz_api_runtime')
            cursor.execute('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rayz_api_runtime')
            cursor.execute('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rayz_api_runtime')
            cursor.execute('SET LOCAL ROLE rayz_api_runtime')
        try:
            self.client.force_authenticate(user=None)
            token = self.client.post('/api/v1/auth/token/', {'username': 'base-external', 'password': self.passwords[('base', 'external')]}, format='json')
            self.assertEqual(token.status_code, 200)
            self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.data["access"]}')
            listing = self.client.get('/api/v1/operations/')
            self.assertEqual(listing.status_code, 200)
            self.assertEqual(listing.data['count'], 1)
            self.assertEqual(self.client.get(f'/api/v1/operations/{self.records["sat"]["operations"].id}/').status_code, 404)
            payload = {'code': 'REAL-RUNTIME', 'title': 'Restricted-role operation', 'area': 'external', 'assigned_to': str(self.people['base']['external'].id)}
            created = self.client.post('/api/v1/operations/', payload, format='json')
            self.assertEqual(created.status_code, 201)
            self.assertEqual(self.client.get(f'/api/v1/operations/{created.data["id"]}/').data['title'], 'Restricted-role operation')
        finally:
            with connection.cursor() as cursor:
                cursor.execute('RESET ROLE')