"""Platform Administration and audited Company Support contexts for Rayz operators."""
from django.db import connection, transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from .models import AuditEvent, Company, Membership, PlatformAdministrator, Record
from .policy import GENERAL, MANAGER, ROLE_AREA

PLATFORM_PERMISSIONS = ['platform.view_status', 'platform.configure_companies', 'platform.invite_company_admins']
SUPPORT_PERMISSIONS = ['support.view_operations', 'support.manage_memberships']
SUPPORT_ACTIONS = {'deactivate_membership': 'support.manage_memberships', 'reactivate_membership': 'support.manage_memberships'}

def platform_admin(user):
    return PlatformAdministrator.objects.filter(user=user, active=True, user__is_active=True).first()

def platform_permissions(user):
    admin = platform_admin(user)
    if not admin:
        return []
    return PLATFORM_PERMISSIONS + [p for p in admin.support_permissions if p in SUPPORT_PERMISSIONS]

def require_platform(user, permission='platform.view_status'):
    if permission not in platform_permissions(user):
        raise PermissionDenied(f'Platform permission required: {permission}.')

def membership_permissions(membership):
    role = membership.role
    if role == 'Company Administrator':
        return ['company.manage_users', 'company.configure']
    perms = []
    for area, manager in MANAGER.items():
        if role in GENERAL or role == manager:
            perms += [f'{area}.edit', f'{area}.approve']
    if role in ROLE_AREA:
        perms += [f'{ROLE_AREA[role]}.create', f'{ROLE_AREA[role]}.submit']
    return sorted(set(perms))

def platform_audit(user, company, action, reason, target=''):
    return AuditEvent.objects.create(company=company, actor=user, action=action, target=str(target or company.id), details={'context': 'company_support' if action.startswith('support_') else 'platform_administration', 'reason': reason})

class ReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=5, max_length=500)

class SupportActionSerializer(ReasonSerializer):
    action = serializers.ChoiceField(choices=list(SUPPORT_ACTIONS))
    membership = serializers.UUIDField()
    confirm_company = serializers.UUIDField()

def overview():
    rows = Company.objects.annotate(
        members=Count('membership', filter=Q(membership__active=True)),
        administrators=Count('membership', filter=Q(membership__active=True, membership__role='Company Administrator')),
    ).order_by('slug')
    return {'companies': [{'id': str(c.id), 'name': c.name, 'active': c.active, 'members': c.members, 'administrators': c.administrators, 'enabled_modules': c.enabled_modules} for c in rows],
            'totals': {'companies': len(rows), 'active': sum(1 for c in rows if c.active), 'members': sum(c.members for c in rows)}}

def set_support_context(user, company):
    with connection.cursor() as cursor:
        cursor.execute("SELECT set_config('rayz.user_id', %s, true), set_config('rayz.company_id', '', true), set_config('rayz.support_company_id', %s, true)", [str(user.pk), str(company.id)])

@transaction.atomic
def support_view(user, company, reason):
    require_platform(user, 'support.view_operations')
    set_support_context(user, company)
    platform_audit(user, company, 'support_view_operations', reason)
    records = Record.objects.filter(company=company, kind='operations').order_by('code')[:200]
    members = Membership.objects.filter(company=company).select_related('user').order_by('role', 'user__username')
    return {'company': {'id': str(company.id), 'name': company.name, 'active': company.active},
            'operations': [{'id': str(r.id), 'code': r.code, 'title': r.title, 'status': r.status, 'area': r.area} for r in records],
            'memberships': [{'id': str(m.id), 'username': m.user.username, 'email': m.user.email, 'role': m.role, 'active': m.active} for m in members]}

@transaction.atomic
def support_action(user, company, data):
    if str(data['confirm_company']) != str(company.id):
        raise ValidationError('Select this company explicitly before a support action.')
    require_platform(user, SUPPORT_ACTIONS[data['action']])
    membership = get_object_or_404(Membership.objects.select_for_update(), pk=data['membership'], company=company)
    membership.active = data['action'] == 'reactivate_membership'
    membership.save(update_fields=['active'])
    event = platform_audit(user, company, f"support_{data['action']}", data['reason'], membership.id)
    return {'id': str(membership.id), 'active': membership.active, 'audit': {'actor': user.username, 'company': str(company.id), 'action': event.action, 'reason': data['reason'], 'timestamp': event.occurred_at.isoformat()}}
