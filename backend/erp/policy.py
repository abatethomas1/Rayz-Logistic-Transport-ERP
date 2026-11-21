from rest_framework.exceptions import PermissionDenied, ValidationError

ROLES = ['Company Administrator', 'Business Owner', 'General Manager', 'Logistics Manager', 'External Officer', 'Internal Officer', 'Transport Manager', 'Transport Officer', 'Dispatcher', 'Finance Manager', 'Finance Officer', 'Accountant']
AREAS = ['external', 'internal', 'transport', 'finance']
DEPARTMENT = {'external': 'logistics', 'internal': 'logistics', 'transport': 'transport', 'finance': 'finance'}
ROLE_AREA = {'External Officer': 'external', 'Internal Officer': 'internal', 'Transport Officer': 'transport', 'Dispatcher': 'transport', 'Finance Officer': 'finance', 'Accountant': 'finance'}
MANAGER = {'external': 'Logistics Manager', 'internal': 'Logistics Manager', 'transport': 'Transport Manager', 'finance': 'Finance Manager'}
GENERAL = {'Business Owner', 'General Manager'}

def resolve_membership(user, candidate=None):
    from .models import Membership
    from django.core.exceptions import ValidationError as DjangoValidationError
    if not user.is_active:
        raise PermissionDenied('This account is inactive.')
    memberships = Membership.objects.select_related('company').filter(user=user, active=True, company__active=True)
    if candidate:
        try:
            result = memberships.filter(company_id=candidate).first()
        except (ValueError, DjangoValidationError):
            result = None
        if result is None:
            raise PermissionDenied('Active company membership required.')
        return result
    results = list(memberships[:2])
    if len(results) != 1:
        raise PermissionDenied('Select a company from your active memberships.')
    return results[0]

def require_company_admin(membership):
    if membership.role != 'Company Administrator':
        raise PermissionDenied('Company administrator required.')

def department_allowed(membership, area):
    return membership.role in GENERAL or membership.role == MANAGER.get(area) or ROLE_AREA.get(membership.role) == area

def require_module(membership, area):
    if DEPARTMENT.get(area) not in membership.company.enabled_modules:
        raise PermissionDenied('This module is disabled for your company.')
    if not department_allowed(membership, area):
        raise PermissionDenied('Department access denied.')