import secrets
import tempfile
from pathlib import Path
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from erp.models import Company, Membership, Record, Document
from erp.workspace import master_action, create_operation, assign_staff

class WorkspaceMigrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        assert connection.vendor == 'postgresql'
        cls.companies = {}; cls.staff = {}; cls.passwords = {}
        for slug in ['base', 'sat', 'yangtze']:
            company = Company.objects.create(slug=slug, name=f'{slug.title()} Logistics & Transport', enabled_modules=['logistics', 'transport', 'finance', 'reports'], invoice_prefix=f'{slug.upper()}-INV', report_access={d: ['General Manager', f'{d.title()} Manager', 'Finance Officer'] for d in ['logistics', 'transport', 'finance']})
            cls.companies[slug] = company; cls.staff[slug] = {}
            for role in ['Company Administrator', 'General Manager', 'Business Owner', 'External Officer', 'Internal Officer', 'Transport Officer', 'Finance Officer', 'Logistics Manager', 'Transport Manager', 'Finance Manager']:
                pw = secrets.token_urlsafe(28)
                user = get_user_model().objects.create_user(username=f'{slug}-{role.replace(" ", "-")}', email=f'{slug}-{role.replace(" ", "-")}@example.test', password=pw)
                cls.staff[slug][role] = Membership.objects.create(company=company, user=user, role=role)
                cls.passwords[(slug, role)] = pw
            admin = cls.staff[slug]['Company Administrator']
            master_action(admin, 'customer', {'name': f'{slug}-customer', 'contact': '', 'email': '', 'phone': '', 'active': True})
            master_action(admin, 'port', {'name': 'Port One', 'country': 'Ethiopia', 'active': True})
            master_action(admin, 'configuration', {'name': 'Container', 'category': 'freight_type', 'description': '', 'active': True})
            master_action(admin, 'truck', {'truck': 'TRUCK-1', 'driver': f'{slug}-driver', 'ownership': 'Subcontractor', 'supplier': f'{slug}-supplier', 'capacity': 30000, 'active': True})
            create_operation(cls.staff[slug]['External Officer'], cls.operation_input(slug), [{'id': 'STAGE-1', 'port': 'Port One', 'country': 'Ethiopia', 'arrival': '2026-11-21', 'release': ''}])
            general = cls.staff[slug]['General Manager']
            for role, area in [('Finance Officer', 'finance'), ('Internal Officer', 'internal'), ('Transport Officer', 'transport')]:
                assign_staff(general, {'staff_id': str(cls.staff[slug][role].id), 'operation_id': 'OP-1', 'work_area': area})

    @classmethod
    def operation_input(cls, slug='base', code='OP-1', containers=None):
        return {'id': code, 'customer': f'{slug}-customer', 'origin': 'Port One', 'destination': 'Addis Ababa', 'type': 'Container', 'quantity': 1 if containers is None else len(containers), 'weight': 10000, 'charge': 25000, 'due': '2026-12-01', 'containers': ['CONT-1'] if containers is None else containers}

    def setUp(self):
        self.client = APIClient()
        temp = tempfile.TemporaryDirectory(); self.addCleanup(temp.cleanup)
        override = override_settings(PRIVATE_DOCUMENT_ROOT=Path(temp.name)); override.enable(); self.addCleanup(override.disable)

    def login(self, role='External Officer', company='base'):
        self.client.force_authenticate(user=self.staff[company][role].user); self.client.credentials()

    def action(self, action, value):
        return self.client.post('/api/v1/workspace/actions/', {'action': action, 'input': value}, format='json')

    def work(self, kind='Bill', code='WORK-1', area='external', amount=1326, payload=None):
        result = self.action('create', {'id': code, 'operationId': 'OP-1', 'area': area, 'kind': kind, 'title': f'{kind} work', 'details': 'Evidence and business reason', 'amount': amount, 'payload': payload or {}})
        self.assertEqual(result.status_code, 200, result.data)
        return code

    def approve_post(self, code, officer='External Officer', manager='Logistics Manager'):
        self.login(officer); self.assertEqual(self.action('Submitted', {'id': code}).status_code, 200)
        self.login(manager); self.assertEqual(self.action('Approved', {'id': code}).status_code, 200)
        self.login(officer); response = self.action('post', {'id': code}); self.assertEqual(response.status_code, 200, response.data)

    def invoice(self, amount=5000):
        self.login('Finance Officer'); code = self.work('Invoice', 'INVOICE-W', 'finance', amount, {'due': '2026-12-01', 'sourceId': 'BROWSER-UNTRUSTED'})
        self.approve_post(code, 'Finance Officer', 'Finance Manager')
        return Record.objects.get(company=self.companies['base'], kind='invoices')

    def test_email_sign_in_and_memberships_use_actual_user(self):
        self.client.force_authenticate(user=None)
        user = self.staff['base']['Finance Officer'].user
        response = self.client.post('/api/v1/auth/token/', {'username': user.email, 'password': self.passwords[('base', 'Finance Officer')]}, format='json')
        self.assertEqual(response.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')
        identity = self.client.get('/api/v1/auth/me/')
        self.assertEqual(identity.data['memberships'][0]['company'], str(self.companies['base'].id))
        self.assertFalse(identity.data['platformAdmin'])
        self.assertEqual(self.client.post('/api/v1/auth/logout/', {'refresh': response.data['refresh']}, format='json').status_code, 200)
        self.assertEqual(self.client.post('/api/v1/auth/refresh/', {'refresh': response.data['refresh']}, format='json').status_code, 401)

    def test_every_company_pair_snapshot_and_forged_company_are_isolated(self):
        for source in self.companies:
            self.login('General Manager', source)
            snapshot = self.client.get('/api/v1/workspace/'); self.assertEqual(snapshot.status_code, 200)
            ops = [r['data'] for r in snapshot.data['records'] if r['kind'] == 'operations']
            self.assertEqual([r['customer'] for r in ops], [f'{source}-customer'])
            for target in self.companies:
                if source == target: continue
                response = self.client.get('/api/v1/workspace/', HTTP_X_COMPANY=str(self.companies[target].id))
                self.assertEqual(response.status_code, 403)

    def test_multi_membership_requires_selection_and_role_follows_company(self):
        user = self.staff['base']['General Manager'].user
        Membership.objects.create(company=self.companies['sat'], user=user, role='External Officer')
        self.client.force_authenticate(user=user)
        self.assertEqual(self.client.get('/api/v1/workspace/').status_code, 403)
        sat = self.client.get('/api/v1/workspace/', HTTP_X_COMPANY=str(self.companies['sat'].id))
        self.assertEqual(sat.status_code, 200); self.assertEqual(sat.data['role'], 'External Logistics Officer')
        self.assertEqual(sat.data['records'], [])

    def test_officer_submit_independent_approval_post_and_repeat_post_denied(self):
        self.login(); code = self.work(payload={'amount': '10', 'currency': 'USD', 'rate': '132.56', 'rateSource': 'Bank quote'})
        self.assertEqual(self.action('Submitted', {'id': code}).status_code, 200)
        self.assertEqual(self.action('Approved', {'id': code}).status_code, 403)
        self.login('Logistics Manager'); self.assertEqual(self.action('Approved', {'id': code}).status_code, 200)
        self.login(); self.assertEqual(self.action('post', {'id': code}).status_code, 200)
        self.assertEqual(self.action('post', {'id': code}).status_code, 400)
        self.assertEqual(Record.objects.filter(company=self.companies['base'], kind='costs').count(), 1)

    def test_original_currency_and_rate_are_retained_and_conversion_rounds_whole_etb(self):
        self.login(); code = self.work(amount=1, payload={'amount': '10', 'currency': 'USD', 'rate': '132.56', 'rateSource': 'Bank quote'})
        self.approve_post(code)
        cost = Record.objects.get(company=self.companies['base'], kind='costs')
        self.assertEqual(cost.data['amount'], 10); self.assertEqual(cost.data['rate'], 132.56); self.assertEqual(cost.data['convertedAmount'], 1326)
        self.assertEqual(cost.amount, Decimal('1326'))

    def test_return_requires_reason_then_officer_can_edit_and_resubmit(self):
        self.login(); self.work(); self.action('Submitted', {'id': 'WORK-1'})
        self.login('Logistics Manager'); self.assertEqual(self.action('Returned', {'id': 'WORK-1'}).status_code, 400)
        self.assertEqual(self.action('Returned', {'id': 'WORK-1', 'reason': 'Attach receipt'}).status_code, 200)
        self.login(); self.assertEqual(self.action('edit', {'id': 'WORK-1', 'title': 'Updated bill', 'amount': 1000}).status_code, 200)
        self.assertEqual(self.action('Submitted', {'id': 'WORK-1'}).status_code, 200)

    def test_fx_draft_edit_recalculates_amount_before_manager_approval(self):
        self.login(); self.work(payload={'amount': '10', 'currency': 'USD', 'rate': '132.56', 'rateSource': 'Bank quote'})
        response = self.action('edit', {'id': 'WORK-1', 'title': 'Updated bill', 'amount': 1, 'payload': {'amount': '20', 'currency': 'USD', 'rate': '132.56', 'rateSource': 'Bank quote'}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Record.objects.get(company=self.companies['base'], kind='work').amount, Decimal('2651'))

    def test_wrong_department_cannot_create_or_approve(self):
        self.login('Finance Officer'); self.assertEqual(self.action('create', {'id': 'BAD', 'operationId': 'OP-1', 'area': 'external', 'kind': 'Bill', 'title': 'Wrong department'}).status_code, 403)
        self.login(); self.work(); self.action('Submitted', {'id': 'WORK-1'})
        self.login('Finance Manager'); self.assertEqual(self.action('Approved', {'id': 'WORK-1'}).status_code, 403)

    def test_company_admin_cannot_approve_business_work(self):
        self.login(); self.work(); self.action('Submitted', {'id': 'WORK-1'})
        self.login('Company Administrator'); self.assertEqual(self.action('Approved', {'id': 'WORK-1'}).status_code, 403)

    def test_foreign_work_id_cannot_read_change_or_approve(self):
        self.login('External Officer', 'sat'); self.work(code='SAT-PRIVATE'); self.action('Submitted', {'id': 'SAT-PRIVATE'})
        for role in ['External Officer', 'Logistics Manager', 'General Manager']:
            self.login(role)
            self.assertNotIn('SAT-PRIVATE', str(self.client.get('/api/v1/workspace/').data))
            for action in ['edit', 'delete', 'Approved', 'post']:
                self.assertEqual(self.action(action, {'id': 'SAT-PRIVATE', 'title': 'Forged', 'amount': 1}).status_code, 404)

    def test_manager_approval_limit_cannot_be_bypassed_with_browser_amount(self):
        company = self.companies['base']; company.approval_limits = {'Logistics Manager': 1000}; company.save()
        self.login(); self.work(amount=1, payload={'amount': '10', 'currency': 'USD', 'rate': '132.56', 'rateSource': 'Bank quote'}); self.action('Submitted', {'id': 'WORK-1'})
        self.login('Logistics Manager'); self.assertEqual(self.action('Approved', {'id': 'WORK-1', 'amount': 1}).status_code, 403)

    def test_no_self_approval_even_after_role_change(self):
        self.login(); self.work(); self.action('Submitted', {'id': 'WORK-1'})
        member = self.staff['base']['External Officer']; member.role = 'Logistics Manager'; member.save()
        self.login(); self.assertEqual(self.action('Approved', {'id': 'WORK-1'}).status_code, 403)

    def test_container_identifier_is_unique_within_operation_but_reusable_across_operations(self):
        self.login()
        duplicate = self.action('createOperation', {'operation': self.operation_input(code='OP-2', containers=['CONT-1', 'cont-1']), 'stages': [{'id': 'S2', 'port': 'Port One', 'country': 'Ethiopia', 'arrival': '2026-11-21', 'release': ''}]})
        self.assertEqual(duplicate.status_code, 400)
        reused = self.action('createOperation', {'operation': self.operation_input(code='OP-2'), 'stages': [{'id': 'S2', 'port': 'Port One', 'country': 'Ethiopia', 'arrival': '2026-11-21', 'release': ''}]})
        self.assertEqual(reused.status_code, 200)

    def test_invoice_is_tax_free_and_number_comes_from_company_sequence(self):
        invoice = self.invoice()
        self.assertEqual(invoice.code, 'BASE-INV-000001')
        self.assertEqual(invoice.data['taxRate'], 0); self.assertEqual(invoice.data['taxAmount'], 0)

    def test_advance_remains_unallocated_until_finance_selects_invoice(self):
        invoice = self.invoice()
        self.login('Finance Officer'); self.work('Payment', 'ADV-W', 'finance', 2000, {'paymentType': 'Advance', 'reference': 'BANK-1'})
        self.approve_post('ADV-W', 'Finance Officer', 'Finance Manager')
        advance = Record.objects.get(company=self.companies['base'], kind='advance')
        self.assertEqual(advance.data['allocated'], 0)
        self.assertEqual(Record.objects.get(pk=invoice.id).data['paid'], 0)
        self.login('Finance Officer'); self.work('Payment', 'ALLOC-W', 'finance', 1000, {'paymentType': 'Allocation', 'advanceId': advance.code, 'sourceId': invoice.code})
        self.approve_post('ALLOC-W', 'Finance Officer', 'Finance Manager')
        self.assertEqual(Record.objects.get(pk=advance.id).data['allocated'], 1000)
        self.assertEqual(Record.objects.get(pk=invoice.id).data['paid'], 1000)
        self.assertEqual(Record.objects.filter(company=self.companies['base'], kind='cash').count(), 1)

    def test_reversal_authorization_finance_or_general_manager_not_business_owner(self):
        self.login('Finance Officer'); self.work('Payment', 'ADV-W', 'finance', 100, {'paymentType': 'Advance', 'reference': 'BANK'})
        self.approve_post('ADV-W', 'Finance Officer', 'Finance Manager')
        cash = Record.objects.get(company=self.companies['base'], kind='cash')
        self.login('Finance Officer'); self.work('Reversal', 'REV-W', 'finance', 100, {'cashEntryId': cash.code}); self.action('Submitted', {'id': 'REV-W'})
        self.login('Business Owner'); self.assertEqual(self.action('Approved', {'id': 'REV-W'}).status_code, 403)
        self.login('General Manager'); self.assertEqual(self.action('Approved', {'id': 'REV-W'}).status_code, 200)

    def test_cash_payment_and_reversal_preserve_audit_and_restore_balance(self):
        invoice = self.invoice()
        self.login('Finance Officer'); self.work('Payment', 'PAY-W', 'finance', 1000, {'sourceId': invoice.code, 'reference': 'BANK-2'})
        self.approve_post('PAY-W', 'Finance Officer', 'Finance Manager')
        cash = Record.objects.get(company=self.companies['base'], kind='cash')
        self.login('Finance Officer'); self.work('Reversal', 'REV-W', 'finance', 1000, {'cashEntryId': cash.code})
        self.approve_post('REV-W', 'Finance Officer', 'Finance Manager')
        self.assertEqual(Record.objects.get(pk=invoice.id).data['paid'], 0)
        self.assertEqual(Record.objects.filter(company=self.companies['base'], kind='cash').count(), 2)
        self.assertEqual(Record.objects.filter(company=self.companies['base'], kind='reversal').count(), 1)

    def test_finance_report_filters_and_foreign_operation_do_not_widen_access(self):
        self.invoice(); self.login('Finance Manager')
        response = self.client.post('/api/v1/workspace/reports/', {'department': 'finance', 'view': 'Receivables', 'customer': 'base-customer'}, format='json')
        self.assertEqual(response.status_code, 200); self.assertEqual(response.data[0]['Receivable_ETB'], 5000)
        foreign = self.client.post('/api/v1/workspace/reports/', {'department': 'finance', 'view': 'Receivables', 'customer': 'sat-customer', 'company_id': str(self.companies['sat'].id)}, format='json')
        self.assertEqual(foreign.data, [])

    def test_report_role_revocation_applies_on_next_request(self):
        self.login('Finance Manager'); company = self.companies['base']; company.report_access = {}; company.save()
        self.assertEqual(self.client.post('/api/v1/workspace/reports/', {'department': 'finance', 'view': 'Cash'}, format='json').status_code, 403)

    def test_private_document_uploaded_to_draft_can_read_back_and_foreign_cannot_download(self):
        self.login(); self.work()
        response = self.client.post('/api/v1/workspace/documents/', {'operationId': 'OP-1', 'workId': 'WORK-1', 'area': 'external', 'category': 'Receipt', 'file': SimpleUploadedFile('receipt.pdf', b'%PDF-1.4\nprivate receipt')}, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        did = response.data['id']; self.assertEqual(response.data['work_id'], 'WORK-1')
        own = self.client.get(f'/api/v1/documents/{did}/download/'); self.assertEqual(own.status_code, 200)
        self.assertEqual(b''.join(own.streaming_content), b'%PDF-1.4\nprivate receipt')
        self.login('General Manager', 'sat'); self.assertEqual(self.client.get('/api/v1/workspace/documents/').data, [])
        self.assertEqual(self.client.get(f'/api/v1/documents/{did}/download/').status_code, 404)

    def test_foreign_work_attachment_is_rejected_before_file_storage(self):
        self.login('External Officer', 'sat'); self.work(code='SAT-WORK')
        self.login(); response = self.client.post('/api/v1/workspace/documents/', {'operationId': 'OP-1', 'workId': 'SAT-WORK', 'area': 'external', 'category': 'Receipt', 'file': SimpleUploadedFile('receipt.pdf', b'%PDF-1.4\nprivate')}, format='multipart')
        self.assertEqual(response.status_code, 404); self.assertEqual(Document.objects.count(), 0)

    def test_company_profile_update_cannot_change_role_or_other_membership(self):
        self.login('Finance Officer')
        response = self.client.post('/api/v1/workspace/profile/', {'name': 'New staff name', 'avatar': '', 'role': 'General Manager', 'company_id': str(self.companies['sat'].id)}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Membership.objects.get(pk=self.staff['base']['Finance Officer'].pk).role, 'Finance Officer')
        self.assertEqual(self.client.get('/api/v1/workspace/').data['profile']['display_name'], 'New staff name')

    def test_reversal_approval_limit_uses_original_cash_amount_not_browser_amount(self):
        self.login('Finance Officer'); self.work('Payment', 'ADV-W', 'finance', 2000, {'paymentType': 'Advance', 'reference': 'BANK'})
        self.approve_post('ADV-W', 'Finance Officer', 'Finance Manager')
        cash = Record.objects.get(company=self.companies['base'], kind='cash')
        company = self.companies['base']; company.approval_limits = {'Finance Manager': 1000}; company.save()
        self.login('Finance Officer'); self.work('Reversal', 'REV-W', 'finance', 1, {'cashEntryId': cash.code}); self.action('Submitted', {'id': 'REV-W'})
        self.login('Finance Manager'); self.assertEqual(self.action('Approved', {'id': 'REV-W'}).status_code, 403)

    def test_dispatch_requires_cleared_freight_then_finishes_with_private_proof_of_delivery(self):
        self.login('Transport Officer'); self.work('Truck request', 'REQUEST-W', 'transport', 0, {'count': '1'})
        self.approve_post('REQUEST-W', 'Transport Officer', 'Transport Manager')
        request = Record.objects.get(company=self.companies['base'], kind='truck-request')
        self.login('External Officer')
        self.assertEqual(self.client.post('/api/v1/workspace/operational-actions/', {'action': 'freightClearance', 'id': 'OP-1-F-1', 'ready': True, 'reason': 'Released clearance certificate'}, format='json').status_code, 200)
        self.login('Transport Officer'); self.work('Assignment', 'ASSIGN-W', 'transport', 0, {'freightId': 'OP-1-F-1', 'requestId': request.code, 'truck': 'TRUCK-1', 'departure': '2026-11-21', 'arrival': '2026-11-22', 'count': '1', 'charge': '25000', 'cost': '20000'})
        self.approve_post('ASSIGN-W', 'Transport Officer', 'Transport Manager')
        trip = Record.objects.get(company=self.companies['base'], kind='trips')
        for status in ['Active', 'Arrived', 'Offloaded']:
            self.assertEqual(self.client.post('/api/v1/workspace/operational-actions/', {'action': 'tripStatus', 'id': trip.code, 'status': status}, format='json').status_code, 200)
        self.assertEqual(self.client.post('/api/v1/workspace/operational-actions/', {'action': 'tripStatus', 'id': trip.code, 'status': 'Completed'}, format='json').status_code, 400)
        upload = self.client.post('/api/v1/workspace/documents/', {'operationId': 'OP-1', 'tripId': trip.code, 'area': 'transport', 'category': 'Proof of delivery', 'file': SimpleUploadedFile('pod.pdf', b'%PDF-1.4\nproof')}, format='multipart')
        self.assertEqual(upload.status_code, 201, upload.data)
        self.assertEqual(self.client.post('/api/v1/workspace/operational-actions/', {'action': 'tripStatus', 'id': trip.code, 'status': 'Completed'}, format='json').status_code, 200)
        self.assertEqual(Record.objects.get(pk=trip.id).data['pod'], 'pod.pdf')
        self.login('General Manager', 'yangtze'); self.assertEqual(self.client.get(f'/api/v1/documents/{upload.data["id"]}/download/').status_code, 404)

    def test_internal_clearance_dependencies_do_not_block_unrelated_cleared_freight(self):
        self.login('External Officer')
        op = self.operation_input(code='OP-2', containers=['CONT-1', 'CONT-2'])
        self.assertEqual(self.action('createOperation', {'operation': op, 'stages': [{'id': 'STAGE-2', 'port': 'Port One', 'country': 'Ethiopia', 'arrival': '2026-11-21', 'release': ''}]}).status_code, 200)
        self.client.post('/api/v1/workspace/operational-actions/', {'action': 'dependency', 'id': 'OP-2-F-1', 'stageId': 'STAGE-2'}, format='json')
        for fid in ['OP-2-F-1', 'OP-2-F-2']:
            self.assertEqual(self.client.post('/api/v1/workspace/operational-actions/', {'action': 'freightClearance', 'id': fid, 'ready': True, 'reason': 'Evidence'}, format='json').status_code, 200)
        rows = {r['id']: r['ready'] for r in self.client.get('/api/v1/workspace/').data['freight']}
        self.assertFalse(rows['OP-2-F-1']); self.assertTrue(rows['OP-2-F-2'])

    def test_migrated_workspace_actions_run_under_restricted_postgresql_role(self):
        with connection.cursor() as cursor:
            cursor.execute('CREATE ROLE rayz_workspace_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS')
            cursor.execute('GRANT USAGE ON SCHEMA public TO rayz_workspace_runtime')
            cursor.execute('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rayz_workspace_runtime')
            cursor.execute('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rayz_workspace_runtime')
            cursor.execute('SET LOCAL ROLE rayz_workspace_runtime')
        try:
            self.login(); self.work(); self.approve_post('WORK-1')
            snapshot = self.client.get('/api/v1/workspace/'); self.assertEqual(snapshot.status_code, 200)
            self.assertEqual([r['data']['customer'] for r in snapshot.data['records'] if r['kind'] == 'operations'], ['base-customer'])
        finally:
            with connection.cursor() as cursor: cursor.execute('RESET ROLE')

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', DEFAULT_FROM_EMAIL='staff@example.test', INVITATION_URL='https://erp.example.test/reset-password')
    def test_password_reset_changes_password_and_link_cannot_be_replayed(self):
        from django.core import mail
        user = self.staff['base']['Finance Officer'].user
        response = self.client.post('/api/v1/auth/password-reset/', {'email': user.email}, format='json')
        self.assertEqual(response.status_code, 200)
        from urllib.parse import urlparse, parse_qs
        link = parse_qs(urlparse(mail.outbox[0].body.split('password: ')[1]).query)
        password = secrets.token_urlsafe(25)
        data = {'uid': link['uid'][0], 'token': link['token'][0], 'password': password}
        self.assertEqual(self.client.post('/api/v1/auth/password-reset-confirm/', data, format='json').status_code, 200)
        self.assertEqual(self.client.post('/api/v1/auth/password-reset-confirm/', data, format='json').status_code, 400)
        user.refresh_from_db(); self.assertTrue(user.check_password(password))

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', DEFAULT_FROM_EMAIL='staff@example.test', INVITATION_URL='https://erp.example.test/reset-password')
    def test_screen_invitation_maps_role_without_cross_company_or_signup_metadata_privileges(self):
        self.login('Company Administrator')
        response = self.client.post('/api/v1/workspace/invitations/', {'email': 'invited@example.test', 'role': 'External Logistics Officer', 'company_id': str(self.companies['sat'].id)}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        from erp.models import StaffInvitation
        invitation = StaffInvitation.objects.get(email='invited@example.test')
        self.assertEqual(invitation.role, 'External Officer'); self.assertEqual(invitation.company_id, self.companies['base'].id)