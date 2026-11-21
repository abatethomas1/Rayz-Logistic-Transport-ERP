import hashlib
import secrets
import uuid
from datetime import timedelta
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, serializers
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from .models import Company, PlatformAdministrator, Membership, Record, Document, AuditEvent, ExportJob, StaffInvitation
from .serializers import CompanySerializer, MembershipSerializer, RecordSerializer, DocumentSerializer, ReportRequestSerializer, ExportJobSerializer
from .policy import resolve_membership, require_company_admin, require_module, ROLE_AREA, GENERAL, MANAGER
from .services import scoped_records, require_edit, transition, audit, report_records, export_bytes, private_path, set_company_context

class CompanyScope:
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.membership = resolve_membership(request.user, request.headers.get('X-Company'))
        set_company_context(self.membership)

class PlatformCompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not PlatformAdministrator.objects.filter(user=request.user, active=True).exists():
            raise PermissionDenied('Rayz platform administrator required.')
    def get_queryset(self):
        return Company.objects.order_by('slug')
    def perform_create(self, serializer):
        company = serializer.save()
        AuditEvent.objects.create(actor=self.request.user, action='company_create', target=str(company.id))
    def perform_update(self, serializer):
        company = serializer.save()
        AuditEvent.objects.create(actor=self.request.user, action='company_configure', target=str(company.id))
    @action(detail=True, methods=['post'], url_path='administrator-invitations')
    def administrator_invitation(self, request, pk=None):
        company = self.get_object()
        return create_invitation(request, company, platform=True)

class CompanySettingsViewSet(CompanyScope, viewsets.GenericViewSet):
    serializer_class = CompanySerializer
    def get_queryset(self):
        return Company.objects.filter(pk=self.membership.company_id)
    @action(detail=False, methods=['get', 'patch'], url_path='current')
    def current(self, request):
        company = self.membership.company
        if request.method == 'PATCH':
            require_company_admin(self.membership)
            # Client administrators cannot unsuspend themselves or alter product-level modules.
            if set(request.data) - {'name', 'branding', 'charge_categories', 'truck_rate_cards', 'approval_limits', 'invoice_prefix', 'report_access'}:
                raise PermissionDenied('Only Rayz can change company activation and licensed modules.')
            serializer = self.get_serializer(company, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            audit(self.membership, 'company_settings', company.id)
        return Response(self.get_serializer(company).data)

class MembershipViewSet(CompanyScope, viewsets.ModelViewSet):
    serializer_class = MembershipSerializer
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    def create(self, request):
        raise PermissionDenied('Use a staff invitation to create company memberships.')
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        require_company_admin(self.membership)
    def get_queryset(self):
        return Membership.objects.filter(company=self.membership.company).select_related('user').order_by('id')
    def perform_update(self, serializer):
        if set(self.request.data) - {'role', 'active'}:
            raise ValidationError('Only company role and active status may be changed.')
        if serializer.instance.id == self.membership.id:
            raise PermissionDenied('Another company administrator must change your membership.')
        serializer.save()
        audit(self.membership, 'membership_update', serializer.instance.id)
    @action(detail=False, methods=['post'])
    def invitations(self, request):
        return create_invitation(request, self.membership.company)

class InvitationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=[r for r in Membership._meta.get_field('role').choices])

def create_invitation(request, company, platform=False):
    serializer = InvitationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    if platform and data['role'] != 'Company Administrator':
        raise ValidationError('Use this action to invite a company administrator.')
    if not settings.INVITATION_URL or not settings.DEFAULT_FROM_EMAIL:
        raise ValidationError('Invitation email delivery is not configured.')
    token = secrets.token_urlsafe(48)
    invitation = StaffInvitation.objects.create(company=company, email=data['email'], role=data['role'], token_hash=hashlib.sha256(token.encode()).hexdigest(), expires_at=timezone.now() + timedelta(days=2))
    link = f'{settings.INVITATION_URL}?token={token}'
    try:
        send_mail(f'{company.name}: staff invitation', f'Choose your own password to join {company.name}: {link}', settings.DEFAULT_FROM_EMAIL, [data['email']], fail_silently=False)
    except Exception:
        invitation.delete()
        raise ValidationError('Invitation could not be delivered; no membership was created.')
    AuditEvent.objects.create(company=company, actor=request.user, action='staff_invite', target=str(invitation.id))
    return Response({'id': invitation.id, 'message': 'Invitation sent.'}, status=201)

@api_view(['POST'])
@permission_classes([AllowAny])
def accept_invitation(request):
    class Acceptance(serializers.Serializer):
        token = serializers.CharField(max_length=200)
        username = serializers.CharField(max_length=150)
        password = serializers.CharField(max_length=200, write_only=True)
    data = Acceptance(data=request.data)
    data.is_valid(raise_exception=True)
    values = data.validated_data
    with transaction.atomic():
        invitation = get_object_or_404(StaffInvitation.objects.select_for_update().filter(company__active=True, accepted_at__isnull=True, expires_at__gt=timezone.now()), token_hash=hashlib.sha256(values['token'].encode()).hexdigest())
        User = get_user_model()
        if User.objects.filter(username=values['username']).exists() or User.objects.filter(email__iexact=invitation.email).exists():
            # Joining a second company requires an existing authenticated account, not email takeover.
            if not request.user.is_authenticated or request.user.email.lower() != invitation.email.lower():
                raise PermissionDenied('Sign in to your existing account to accept this invitation.')
            user = request.user
        else:
            user = User(username=values['username'], email=invitation.email)
            try:
                validate_password(values['password'], user)
            except DjangoValidationError as error:
                raise ValidationError({'password': error.messages})
            user.set_password(values['password'])
            user.save()
        if Membership.objects.filter(company=invitation.company, user=user).exists():
            raise ValidationError('This account already has a company membership.')
        Membership.objects.create(company=invitation.company, user=user, role=invitation.role)
        invitation.accepted_at = timezone.now()
        invitation.save(update_fields=['accepted_at'])
        AuditEvent.objects.create(company=invitation.company, actor=user, action='invitation_accept', target=str(invitation.id))
    return Response({'message': 'Membership created. Sign in with your individual account.'}, status=201)

class RecordViewSet(CompanyScope, viewsets.ModelViewSet):
    serializer_class = RecordSerializer
    kind = ''
    def get_queryset(self):
        qs = scoped_records(self.membership, self.kind)
        enabled = self.membership.company.enabled_modules
        qs = qs.filter(area__in=[a for a, module in {'external': 'logistics', 'internal': 'logistics', 'transport': 'transport', 'finance': 'finance'}.items() if module in enabled])
        search = self.request.query_params.get('search', '')
        if len(search) > 200:
            raise ValidationError('Search is too long.')
        qs = qs.filter(title__icontains=search)
        return qs.order_by('code', 'id')
    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'membership': self.membership}
    @transaction.atomic
    def perform_create(self, serializer):
        values = serializer.validated_data
        area = values['area']
        require_module(self.membership, area)
        expected = {'trips': 'transport', 'trucks': 'transport', 'bills': 'finance', 'invoices': 'finance', 'payments': 'finance'}
        if self.kind in expected and area != expected[self.kind]:
            raise ValidationError('Resource does not belong to this work area.')
        if self.membership.role in ROLE_AREA and values['assigned_to'].id != self.membership.id:
            raise PermissionDenied('Officers may create only their own assigned work.')
        record = serializer.save(company=self.membership.company, kind=self.kind, created_by=self.membership)
        audit(self.membership, 'create', record.id)
    @transaction.atomic
    def perform_update(self, serializer):
        serializer.instance = scoped_records(self.membership, self.kind).select_for_update(of=('self',)).get(pk=serializer.instance.pk)
        require_edit(self.membership, serializer.instance)
        if self.membership.role in ROLE_AREA and serializer.validated_data.get('assigned_to', serializer.instance.assigned_to).id != self.membership.id:
            raise PermissionDenied('Officers cannot reassign work.')
        serializer.save()
        audit(self.membership, 'edit', serializer.instance.id)
    @transaction.atomic
    def perform_destroy(self, instance):
        instance = scoped_records(self.membership, self.kind).select_for_update(of=('self',)).get(pk=instance.pk)
        require_edit(self.membership, instance)
        if self.membership.role not in ROLE_AREA or instance.created_by_id != self.membership.id or instance.status != 'Draft' or instance.submitted_by_id or instance.documents.exists() or instance.record_set.exists():
            raise PermissionDenied('Only your own unused Draft may be deleted.')
        audit(self.membership, 'delete_draft', instance.id)
        instance.delete()
    @action(detail=True, methods=['post'], url_path='lifecycle')
    def lifecycle(self, request, pk=None):
        record = self.get_object()
        class Command(serializers.Serializer):
            command = serializers.ChoiceField(choices=['submit', 'approve', 'return', 'issue'])
            reason = serializers.CharField(max_length=2000, default='', allow_blank=True)
        data = Command(data=request.data)
        data.is_valid(raise_exception=True)
        updated = transition(self.membership, record.id, **data.validated_data)
        return Response(self.get_serializer(updated).data)

class DocumentViewSet(CompanyScope, viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    http_method_names = ['get', 'post', 'head', 'options']
    def get_queryset(self):
        records = scoped_records(self.membership)
        return Document.objects.filter(company=self.membership.company, record__in=records).order_by('id')
    def create(self, request):
        record = get_object_or_404(scoped_records(self.membership), pk=request.data.get('record'))
        require_edit(self.membership, record)
        file = request.FILES.get('file')
        if file is None or file.size > 10 * 1024 * 1024 or file.size == 0:
            raise ValidationError('A file between 1 byte and 10 MB is required.')
        prefix = file.read(12)
        file.seek(0)
        if not (prefix.startswith(b'%PDF-') or prefix.startswith(b'\x89PNG\r\n\x1a\n') or prefix.startswith(b'\xff\xd8\xff')):
            raise ValidationError('Only PDF, PNG and JPEG documents are accepted.')
        identifier = uuid.uuid4()
        key = f'{self.membership.company_id}/documents/{identifier}'
        path = private_path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256()
        try:
            with path.open('xb') as destination:
                for chunk in file.chunks():
                    digest.update(chunk)
                    destination.write(chunk)
            path.chmod(0o600)
            with transaction.atomic():
                # Lock the parent to avoid attaching a document while work is submitted.
                parent = scoped_records(self.membership).select_for_update(of=('self',)).get(pk=record.pk)
                require_edit(self.membership, parent)
                document = Document.objects.create(id=identifier, company=self.membership.company, record=parent, uploaded_by=self.membership, filename=file.name[:200], object_key=key, size=file.size, sha256=digest.hexdigest())
                audit(self.membership, 'upload', document.id)
        except Exception:
            path.unlink(missing_ok=True)
            raise
        return Response(self.get_serializer(document).data, status=201)
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        document = self.get_object()
        require_module(self.membership, document.record.area)
        response = FileResponse(private_path(document.object_key).open('rb'), as_attachment=True, filename=document.filename, content_type='application/octet-stream')
        audit(self.membership, 'download', document.id)
        return response

class ReportViewSet(CompanyScope, viewsets.GenericViewSet):
    @action(detail=False, methods=['get'])
    def rows(self, request):
        data = ReportRequestSerializer(data=request.query_params)
        data.is_valid(raise_exception=True)
        args = {k: v for k, v in data.validated_data.items() if k != 'format'}
        records = report_records(self.membership, **args)
        page = self.paginate_queryset(records)
        result = RecordSerializer(page, many=True, context={'membership': self.membership}).data
        return self.get_paginated_response(result)
    @action(detail=False, methods=['get'])
    def export(self, request):
        data = ReportRequestSerializer(data=request.query_params)
        data.is_valid(raise_exception=True)
        args = data.validated_data
        content = export_bytes(self.membership, args['area'], args['kind'], args['search'], args['format'])
        mime = 'application/pdf' if args['format'] == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        response = HttpResponse(content, content_type=mime)
        response['Content-Disposition'] = f'attachment; filename="company-report.{args["format"]}"'
        audit(self.membership, 'export', args['kind'])
        return response

class ExportJobViewSet(CompanyScope, viewsets.ModelViewSet):
    serializer_class = ExportJobSerializer
    http_method_names = ['get', 'post', 'head', 'options']
    def get_queryset(self):
        return ExportJob.objects.filter(company=self.membership.company, requested_by=self.membership).order_by('id')
    def create(self, request):
        if set(request.data) - {'area', 'kind', 'search', 'format'}:
            raise ValidationError('Job ownership is server-controlled.')
        data = ReportRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        report_records(self.membership, values['area'], values['kind'], values['search'])
        job = ExportJob.objects.create(company=self.membership.company, requested_by=self.membership, **values)
        return Response(self.get_serializer(job).data, status=201)
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        job = self.get_object()
        report_records(self.membership, job.area, job.kind, job.search)
        if job.status != 'Ready':
            raise ValidationError('Export is not ready.')
        return FileResponse(private_path(job.object_key).open('rb'), as_attachment=True, filename=f'company-report.{job.format}', content_type='application/octet-stream')

@api_view(['GET'])
def my_memberships(request):
    memberships = Membership.objects.filter(user=request.user, active=True, company__active=True).select_related('company')
    return Response([{'id': m.id, 'company': m.company_id, 'name': m.company.name, 'role': m.role, 'branding': m.company.branding} for m in memberships])

def health(request):
    return JsonResponse({'status': 'ok'})