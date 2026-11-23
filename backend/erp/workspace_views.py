import uuid
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from .platform import membership_permissions, platform_admin, platform_permissions
from .models import Membership, PlatformAdministrator, Record, Document
from .policy import resolve_membership, DEPARTMENT, GENERAL, MANAGER, ROLE_AREA
from .services import set_company_context, private_path, audit
from .workspace import snapshot, workspace_action, operational_action, master_action, assign_staff, profile, company_records, get_record, operation, visible, ROLE_MAP, text, number, new_record
from .views import create_invitation, DocumentViewSet

def current(request):
    member = resolve_membership(request.user, request.headers.get('X-Company'))
    set_company_context(member)
    return member

class CompanyTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = attrs.get('username', '')
        if '@' in username:
            users = list(get_user_model().objects.filter(email__iexact=username, is_active=True)[:2])
            if len(users) == 1:
                attrs['username'] = users[0].username
        return super().validate(attrs)

class CompanyTokenView(TokenObtainPairView):
    serializer_class = CompanyTokenSerializer

@api_view(['GET'])
def identity(request):
    memberships = Membership.objects.filter(user=request.user, active=True, company__active=True).select_related('company')
    return Response({'user': {'id': str(request.user.pk), 'email': request.user.email, 'name': request.user.get_full_name() or request.user.username}, 'memberships': [{'id': str(m.id), 'company': str(m.company_id), 'name': m.company.name, 'role': m.role, 'branding': m.company.branding, 'enabled_modules': m.company.enabled_modules, 'permissions': membership_permissions(m)} for m in memberships], 'platformAdmin': bool(platform_admin(request.user)), 'platformPermissions': platform_permissions(request.user)})

@api_view(['GET'])
def workspace_snapshot(request):
    return Response(snapshot(current(request)))

@api_view(['POST'])
def actions(request):
    class Input(serializers.Serializer):
        action = serializers.ChoiceField(choices=['createOperation', 'create', 'edit', 'delete', 'assign', 'Submitted', 'Approved', 'Returned', 'post'])
        input = serializers.JSONField()
    data = Input(data=request.data); data.is_valid(raise_exception=True)
    return Response(workspace_action(current(request), data.validated_data['action'], data.validated_data['input']))

@api_view(['POST'])
def masters(request):
    return Response(master_action(current(request), request.data.get('kind'), request.data.get('input')))

@api_view(['POST'])
def operational(request):
    return Response(operational_action(current(request), request.data))

@api_view(['POST'])
def assignments(request):
    return Response(assign_staff(current(request), request.data))

@api_view(['POST'])
def invitations(request):
    member = current(request)
    if member.role != 'Company Administrator':
        raise PermissionDenied('Company administrator required.')
    role = {v: k for k, v in ROLE_MAP.items()}.get(request.data.get('role'), request.data.get('role'))
    request._full_data = {**request.data, 'role': role}
    return create_invitation(request, member.company)

@api_view(['POST'])
def update_profile(request):
    member = current(request)
    class Profile(serializers.Serializer):
        name = serializers.CharField(max_length=150)
        avatar = serializers.URLField(allow_blank=True, default='')
    data = Profile(data=request.data); data.is_valid(raise_exception=True)
    value = {'display_name': data.validated_data['name'], 'avatar_url': data.validated_data['avatar']}
    row = company_records(member).filter(kind='profile', code=f'PROFILE-{member.id}').first()
    if row:
        row.data = value; row.save(update_fields=['data'])
    else:
        Record.objects.create(company=member.company, kind='profile', code=f'PROFILE-{member.id}', title=value['display_name'], area=ROLE_AREA.get(member.role, 'finance'), assigned_to=member, created_by=member, data=value)
    audit(member, 'profile_update', str(member.id), {'membership': str(member.id)})
    return Response({'message': 'Profile saved.'})

def document_row(document):
    record = document.record
    return {'id': str(document.id), 'name': document.filename, 'operation_id': record.data.get('operationId', record.code), 'work_id': record.code if record.kind == 'work' else None, 'trip_id': record.data.get('tripId'), 'area': record.area, 'category': record.data.get('category', 'Supporting document'), 'created_at': document.created_at.isoformat()}

@api_view(['GET', 'POST'])
def documents(request):
    member = current(request)
    if request.method == 'POST':
        # The browser supplies display codes; resolve them inside the verified company.
        trip_id = request.data.get('tripId')
        work_id = request.data.get('workId')
        record = get_record(member, trip_id or work_id or request.data.get('operationId'), 'trips' if trip_id else 'work' if work_id else 'operations')
        category = text(request.data.get('category'), 'Document category', limit=100)
        if record.kind in ['operations', 'trips']:
            op_id = record.code if record.kind == 'operations' else record.data['operationId']
            operation(member, op_id)
            area = request.data.get('area')
            from .policy import require_module
            require_module(member, area)
            if record.kind == 'trips' and (area != 'transport' or record.data['status'] in ['Completed', 'Cancelled']):
                raise PermissionDenied('An unfinished trip in your transport department is required.')
            if record.kind == 'trips' and member.role not in GENERAL and member.role != 'Transport Manager' and record.assigned_to_id != member.id:
                raise PermissionDenied('Assigned trip required.')
            if not area or not (member.role in GENERAL or member.role == MANAGER.get(area) or ROLE_AREA.get(member.role) == area):
                raise PermissionDenied('Assigned document department required.')
            record = new_record(member, 'document-attachment', f'DOC-{uuid.uuid4().hex}', area, {'operationId': op_id, 'tripId': trip_id, 'category': category}, parent=record)
        else:
            record.data = {**record.data, 'category': category}; record.save(update_fields=['data'])
        request._full_data = {**request.data.dict(), 'record': str(record.id)}
        view = DocumentViewSet()
        view.request = request; view.membership = member; view.format_kwarg = None
        response = view.create(request)
        document = Document.objects.select_related('record').get(pk=response.data['id'])
        return Response(document_row(document), status=201)
    rows = Document.objects.filter(company=member.company).select_related('record')
    return Response([document_row(d) for d in rows if visible(member, d.record)])

@api_view(['POST'])
def reports(request):
    member = current(request)
    q = request.data
    department = q.get('department')
    if department not in ['logistics', 'transport', 'finance']:
        raise ValidationError('Invalid report department.')
    if 'reports' not in member.company.enabled_modules or department not in member.company.enabled_modules or member.role not in member.company.report_access.get(department, []):
        raise PermissionDenied('Company report access denied.')
    if member.role not in GENERAL and not (member.role == f'{department.title()} Manager' or DEPARTMENT.get(ROLE_AREA.get(member.role)) == department):
        raise PermissionDenied('Department report access denied.')
    data = snapshot(member)
    def records(kind):
        return [r['data'] for r in data['records'] if r['kind'] == kind]
    ops = [o for o in records('operations') if (not q.get('operationId') or o['id'] == q['operationId']) and (not q.get('customer') or o['customer'] == q['customer'])]
    ids = {o['id'] for o in ops}
    def date(value):
        return (not q.get('from') or value >= q['from']) and (not q.get('to') or value <= q['to'])
    trips = [r for r in records('trips') if r['operationId'] in ids]
    costs = [r for r in records('costs') if r['operationId'] in ids]
    invoices = [r for r in records('invoices') if r['operationId'] in ids]
    view = q.get('view', '')
    if department == 'logistics':
        if view == 'Internal':
            rows = [{'Record': r['id'], 'Operation': r['operation_id'], 'Task': r['title'], 'Authority': r['authority'], 'Start': r['started'] or '', 'Completion': r['completed'] or '', 'Status': r['status']} for r in data['tasks'] if r['operation_id'] in ids and date(r['started'] or '')]
        elif view == 'Costs & Delays':
            rows = [{'Record': r['id'], 'Operation': r['operationId'], 'Category': r['category'], 'Supplier': r['supplier'], 'Original_amount': r['amount'], 'Currency': r['currency'], 'Historical_rate': r['rate'], 'Approved_cost_ETB': r['convertedAmount'], 'Status': r['approval'], 'Date': r['date']} for r in costs if date(r['date'])]
        else:
            rows = [{'Record': r['id'], 'Operation': r['operationId'], 'Port': r['port'], 'Arrival': r['arrival'], 'Release': r['release'], 'Status': r['status']} for r in records('stages') if r['operationId'] in ids and date(r['arrival'])]
    elif department == 'transport':
        if view == 'Freight':
            rows = [{'Record': r['id'], 'Operation': r['operation_id'], 'Freight': r['identifier'], 'Type': r['freight_type'], 'Weight_kg': r['weight'], 'Status': 'Ready' if r['ready'] else 'Blocked'} for r in data['freight'] if r['operation_id'] in ids]
        elif view == 'Trucks':
            rows = [{'Record': r['truck'], 'Driver': r['driver'], 'Ownership': r['ownership'], 'Trips': sum(1 for t in trips if t['truck'] == r['truck'] and date(t['departure'])), 'Status': 'Active' if r['active'] else 'Inactive'} for r in data['trucks'] if any(t['truck'] == r['truck'] and date(t['departure']) for t in trips)]
        else:
            rows = [{'Record': r['id'], 'Operation': r['operationId'], 'Truck': r['truck'], 'Ownership': r['ownership'], 'Departure': r['departure'], 'Planned_arrival': r['arrival'], 'Selling_charge_ETB': r['charge'], 'Approved_cost_ETB': r['cost'], 'Status': r['status']} for r in trips if date(r['departure'])]
    elif view == 'Receivables':
        rows = [{'Record': r['id'], 'Operation': r['operationId'], 'Invoiced_ETB': r['amount'], 'Received_ETB': r['paid'], 'Receivable_ETB': r['amount'] - r['paid'], 'Due': r['due'], 'Status': r['status']} for r in invoices if r['status'] not in ['Draft', 'Voided'] and r['amount'] > r['paid'] and date(r['issued'])]
    elif view == 'Payables':
        rows = [{'Record': r['id'], 'Operation': r['operationId'], 'Supplier': r['supplier'], 'Approved_cost_ETB': r['cost'], 'Settled_ETB': r['paid'], 'Payable_ETB': r['cost'] - r['paid'], 'Status': 'Partially Settled' if r['paid'] else 'Unsettled'} for r in trips if r['ownership'] == 'Subcontractor' and r['status'] != 'Cancelled' and r['cost'] > r['paid'] and date(r['departure'])]
    elif view == 'Costs':
        rows = [{'Record': r['id'], 'Operation': r['operationId'], 'Supplier': r['supplier'], 'Original_amount': r['amount'], 'Currency': r['currency'], 'Historical_rate': r['rate'], 'Approved_cost_ETB': r['convertedAmount'], 'Status': r['approval']} for r in costs if date(r['date'])]
    elif view == 'Cash':
        rows = [{'Record': r['id'], 'Operation': r['operation_id'], 'Type': r['direction'], 'Amount_ETB': r['amount'], 'Reference': r['reference'], 'Date': r['transaction_date'], 'Status': 'Posted'} for r in data['cash'] if r['operation_id'] in ids and date(r['transaction_date'])]
    else:
        rows = []
        for o in ops:
            if not date(o['opened']):
                continue
            oc = sum(c['convertedAmount'] for c in costs if c['operationId'] == o['id']) + sum(t['cost'] for t in trips if t['operationId'] == o['id'] and t['status'] != 'Cancelled')
            invoiced = sum(i['amount'] for i in invoices if i['operationId'] == o['id'] and i['status'] not in ['Draft', 'Voided'])
            received = sum(c['amount'] * (1 if c['direction'] == 'Receipt' else -1) for c in data['cash'] if c['operation_id'] == o['id'])
            payables = sum(t['cost'] - t['paid'] for t in trips if t['operationId'] == o['id'] and t['ownership'] == 'Subcontractor' and t['status'] != 'Cancelled')
            rows.append({'Record': o['id'], 'Operation': o['id'], 'Customer': o['customer'], 'Selling_charges_ETB': o['charge'], 'Invoiced_revenue_ETB': invoiced, 'Cash_collected_ETB': received, 'Approved_costs_ETB': oc, 'Unpaid_receivables_ETB': sum(i['amount'] - i['paid'] for i in invoices if i['operationId'] == o['id'] and i['status'] not in ['Draft', 'Voided']), 'Unsettled_payables_ETB': payables, 'Estimated_profit_ETB': o['charge'] - oc, 'Status': o['status']})
    rows = [r for r in rows if (not q.get('status') or r.get('Status') == q['status']) and (not q.get('search') or q['search'].lower() in str(r).lower())]
    return Response(rows)

@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset(request):
    email = serializers.EmailField().run_validation(request.data.get('email'))
    if not settings.INVITATION_URL or not settings.DEFAULT_FROM_EMAIL:
        raise ValidationError('Password reset email delivery is not configured.')
    for user in get_user_model().objects.filter(email__iexact=email, is_active=True):
        if user.has_usable_password():
            uid = urlsafe_base64_encode(force_bytes(user.pk)); token = default_token_generator.make_token(user)
            send_mail('Rayz ERP password reset', f'Choose your new password: {settings.INVITATION_URL}?uid={uid}&token={token}', settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
    return Response({'message': 'If an account exists, a password reset link has been sent.'})

@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    try:
        uid = urlsafe_base64_decode(request.data.get('uid', '')).decode()
        user = get_user_model().objects.get(pk=uid, is_active=True)
    except (ValueError, TypeError, get_user_model().DoesNotExist):
        raise ValidationError('The reset link is invalid or expired.')
    if not default_token_generator.check_token(user, request.data.get('token')):
        raise ValidationError('The reset link is invalid or expired.')
    password = serializers.CharField(min_length=8, max_length=200).run_validation(request.data.get('password'))
    try:
        validate_password(password, user)
    except DjangoValidationError as error:
        raise ValidationError({'password': error.messages})
    with transaction.atomic():
        user = get_user_model().objects.select_for_update().get(pk=user.pk)
        if not default_token_generator.check_token(user, request.data.get('token')):
            raise ValidationError('The reset link has already been used.')
        user.set_password(password); user.save(update_fields=['password'])
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
    return Response({'message': 'Password updated.'})