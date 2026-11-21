from decimal import Decimal, InvalidOperation
from rest_framework import serializers
from .models import Company, Membership, Record, Document, ExportJob
from .policy import AREAS, ROLES

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['id', 'name', 'slug', 'active', 'branding', 'enabled_modules', 'charge_categories', 'truck_rate_cards', 'approval_limits', 'invoice_prefix', 'report_access']
        read_only_fields = ['id']
    def validate(self, attrs):
        modules = attrs.get('enabled_modules', [])
        if not isinstance(modules, list) or any(m not in ['logistics', 'transport', 'finance', 'reports'] for m in modules):
            raise serializers.ValidationError('Unknown enabled module.')
        branding = attrs.get('branding', {})
        if not isinstance(branding, dict) or set(branding) - {'display_name', 'logo_url', 'primary_color'}:
            raise serializers.ValidationError('Invalid branding fields.')
        display_name = branding.get('display_name')
        if display_name is not None and (not isinstance(display_name, str) or len(display_name) > 160):
            raise serializers.ValidationError('Brand display name must be text up to 160 characters.')
        logo = branding.get('logo_url')
        if logo and not isinstance(logo, str):
            raise serializers.ValidationError('Logo URL must be text.')
        if logo:
            from django.core.validators import URLValidator
            serializers.URLField(validators=[URLValidator(schemes=['https'])]).run_validation(logo)
        import re
        color = branding.get('primary_color')
        if color and (not isinstance(color, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', color)):
            raise serializers.ValidationError('Invalid brand color.')
        for name in ['charge_categories', 'truck_rate_cards']:
            value = attrs.get(name, [])
            if not isinstance(value, list) or len(value) > 200:
                raise serializers.ValidationError(f'Invalid {name}.')
        limits = attrs.get('approval_limits', {})
        if not isinstance(limits, dict) or set(limits) - set(ROLES):
            raise serializers.ValidationError('Invalid approval roles.')
        for value in limits.values():
            try:
                amount = Decimal(str(value))
                if not amount.is_finite() or amount < 0:
                    raise InvalidOperation
            except (InvalidOperation, ValueError, TypeError):
                raise serializers.ValidationError('Approval limits must be finite nonnegative amounts.')
        access = attrs.get('report_access', {})
        if not isinstance(access, dict) or set(access) - {'logistics', 'transport', 'finance'}:
            raise serializers.ValidationError('Invalid report departments.')
        if any(not isinstance(v, list) or any(not isinstance(r, str) for r in v) or set(v) - set(ROLES) for v in access.values()):
            raise serializers.ValidationError('Invalid report roles.')
        return attrs

class MembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = Membership
        fields = ['id', 'username', 'role', 'active']
        read_only_fields = ['id', 'username']

class RecordSerializer(serializers.ModelSerializer):
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=Membership.objects.none())
    related_record = serializers.PrimaryKeyRelatedField(queryset=Record.objects.none(), allow_null=True, required=False)
    class Meta:
        model = Record
        fields = ['id', 'kind', 'code', 'title', 'area', 'amount', 'data', 'assigned_to', 'related_record', 'created_by', 'submitted_by', 'status', 'created_at']
        read_only_fields = ['id', 'kind', 'created_by', 'submitted_by', 'status', 'created_at']
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        membership = self.context.get('membership')
        if membership:
            self.fields['assigned_to'].queryset = Membership.objects.filter(company=membership.company, active=True, user__is_active=True)
            from .services import scoped_records
            self.fields['related_record'].queryset = scoped_records(membership)
    def validate(self, attrs):
        original = self.initial_data
        if set(original) & {'company', 'company_id', 'created_by', 'submitted_by', 'status', 'kind'}:
            raise serializers.ValidationError('Ownership and lifecycle fields are server-controlled.')
        area = attrs.get('area', getattr(self.instance, 'area', None))
        assignee = attrs.get('assigned_to', getattr(self.instance, 'assigned_to', None))
        from .policy import ROLE_AREA
        if assignee and ROLE_AREA.get(assignee.role) != area:
            raise serializers.ValidationError('Assign an active officer in this work area.')
        if self.instance and area != self.instance.area:
            raise serializers.ValidationError('Work area cannot be changed after creation.')
        if not isinstance(attrs.get('data', {}), dict):
            raise serializers.ValidationError('Record data must be an object.')
        return attrs

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'record', 'filename', 'size', 'sha256', 'created_at']

class ReportRequestSerializer(serializers.Serializer):
    area = serializers.ChoiceField(choices=AREAS)
    kind = serializers.ChoiceField(choices=Record.KINDS)
    search = serializers.CharField(max_length=200, default='', allow_blank=True)
    format = serializers.ChoiceField(choices=['pdf', 'xlsx'], default='xlsx')

class ExportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExportJob
        fields = ['id', 'area', 'kind', 'search', 'format', 'status']
        read_only_fields = fields