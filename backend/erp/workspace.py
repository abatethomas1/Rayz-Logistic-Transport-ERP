"""Compatibility boundary for the existing ERP screens, never a client-side ledger."""
import uuid
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from .models import Record, Membership, AuditEvent, Document, Company
from .policy import ROLE_AREA, MANAGER, GENERAL, DEPARTMENT, require_module
from .services import audit, require_edit

ROLE_MAP = {'Company Administrator': 'Admin', 'External Officer': 'External Logistics Officer', 'Internal Officer': 'Internal Logistics Officer'}
MASTER_KINDS = {'master-customer', 'master-port', 'master-truck', 'master-config', 'profile'}
WORK_KINDS = {'external': ['Port stage', 'Bill', 'Correction', 'Void'], 'internal': ['Local clearance task', 'Bill', 'Correction', 'Void'], 'transport': ['Truck request', 'Assignment', 'Trip', 'Correction', 'Void'], 'finance': ['Bill', 'Invoice', 'Expense', 'Payment', 'Payable', 'Settlement', 'Correction', 'Reversal', 'Void', 'Rate card']}

def number(value, positive=False):
    try:
        result = Decimal(str(value))
        if not result.is_finite() or result < 0 or (positive and result <= 0):
            raise InvalidOperation
        return result
    except (ValueError, TypeError, InvalidOperation):
        raise ValidationError('A finite positive amount is required.' if positive else 'A finite nonnegative amount is required.')

def work_amount(kind, payload, value):
    if not isinstance(payload, dict) or any(not isinstance(v, str) for v in payload.values()):
        raise ValidationError('Invalid work payload.')
    if kind in ['Bill', 'Expense'] and payload.get('currency'):
        original = number(payload.get('amount'), True); rate = number(payload.get('rate'), True)
        if payload['currency'] == 'ETB' and rate != 1:
            raise ValidationError('ETB exchange rate must be 1.')
        if payload['currency'] != 'ETB' and not payload.get('rateSource', '').strip():
            raise ValidationError('A historical exchange-rate source is required.')
        return original if payload['currency'] == 'ETB' else (original * rate).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    return number(value, kind in ['Invoice', 'Payment', 'Settlement', 'Bill', 'Expense', 'Payable', 'Rate card', 'Reversal'])

def text(value, name='Value', required=True, limit=200):
    if not isinstance(value, str) or len(value) > limit or (required and not value.strip()):
        raise ValidationError(f'{name} is invalid.')
    return value.strip()

def company_records(member):
    return Record.objects.filter(company=member.company).select_related('assigned_to', 'created_by', 'submitted_by', 'related_record')

def is_management(member):
    return member.role in GENERAL or member.role in MANAGER.values() or member.role == 'Company Administrator'

def operation_ids(member):
    if is_management(member):
        return set(company_records(member).filter(kind='operations').values_list('code', flat=True))
    assigned = company_records(member).filter(kind='operation-assignment', assigned_to=member, area=ROLE_AREA.get(member.role))
    owned = company_records(member).filter(kind='operations', assigned_to=member)
    return {r.data.get('operationId') for r in assigned} | set(owned.values_list('code', flat=True))

def operation(member, code, lock=False):
    if code not in operation_ids(member):
        raise PermissionDenied('Assigned operation access required.')
    qs = company_records(member).filter(kind='operations')
    if lock:
        qs = qs.select_for_update(of=('self',))
    return get_object_or_404(qs, code=code)

def can_area(member, area):
    return member.role in GENERAL or member.role == MANAGER.get(area) or ROLE_AREA.get(member.role) == area

def writable(member, area, op):
    require_module(member, area)
    return operation(member, op)

def visible(member, record):
    if record.kind in MASTER_KINDS:
        return True
    op = record.data.get('operationId') or (record.code if record.kind == 'operations' else '')
    if op and op not in operation_ids(member):
        return False
    if record.kind in ['operations', 'freight', 'freight-dependency', 'operation-assignment']:
        return True
    if member.role == 'Company Administrator' or member.role in GENERAL:
        return True
    if record.kind in ['costs', 'trips', 'invoices', 'cash', 'advance', 'allocation', 'reversal'] and (ROLE_AREA.get(member.role) == 'finance' or member.role == 'Finance Manager'):
        return True
    if not can_area(member, record.area):
        return False
    return member.role in MANAGER.values() or record.assigned_to_id == member.id

def accessible(member, kind=None):
    qs = company_records(member)
    if kind:
        qs = qs.filter(kind=kind)
    return [r for r in qs if visible(member, r)]

def get_record(member, code, kind=None, lock=False):
    qs = company_records(member)
    if kind:
        qs = qs.filter(kind=kind)
    if lock:
        qs = qs.select_for_update(of=('self',))
    row = get_object_or_404(qs, code=code)
    if not visible(member, row):
        raise PermissionDenied('Assigned record access required.')
    return row

def authoritative_amount(member, kind, payload, value, operation_id):
    amount = work_amount(kind, payload, value)
    if kind == 'Reversal':
        cash = get_record(member, payload.get('cashEntryId'), 'cash')
        if cash.data.get('operation_id') != operation_id or cash.data.get('source_kind') == 'Reversal' or company_records(member).filter(kind='reversal', data__cash_entry_id=cash.code).exists():
            raise ValidationError('Choose an original unreversed cash entry in this operation.')
        amount = number(cash.data['amount'], True)
    return amount

def new_record(member, kind, code, area, data, parent=None, assigned=None, amount=0, status='Draft'):
    if company_records(member).filter(kind=kind, code=code).exists():
        raise ValidationError('This reference already exists in your company.')
    return Record.objects.create(company=member.company, kind=kind, code=code, title=str(data.get('title') or data.get('name') or code)[:200], area=area, amount=number(amount), data=data, related_record=parent, assigned_to=assigned or member, created_by=member, status=status)

def profile(member):
    row = company_records(member).filter(kind='profile', code=f'PROFILE-{member.id}').first()
    return row.data if row else {'display_name': member.user.get_full_name() or member.user.username, 'avatar_url': ''}

def work_row(record):
    d = record.data
    return {'id': record.code, 'operation_id': d['operationId'], 'area': record.area, 'kind': d['workKind'], 'title': record.title, 'amount': float(record.amount), 'details': d.get('details', ''), 'documents': d.get('documents', []) + list(record.documents.values_list('filename', flat=True)), 'dependencies': d.get('dependencies', 0), 'created_by': str(record.created_by_id), 'assigned_to': str(record.assigned_to_id), 'submitted_by': str(record.submitted_by_id) if record.submitted_by_id else None, 'status': record.status, 'payload': d.get('payload', {}), 'history': d.get('history', [])}

def freight_ready(member, freight):
    if not freight.data.get('clearance_confirmed'):
        return False
    for dep in company_records(member).filter(kind='freight-dependency'):
        if dep.data.get('freight_id') != freight.code:
            continue
        target_id = dep.data.get('stage_id') or dep.data.get('task_id')
        target = company_records(member).filter(code=target_id, kind__in=['stages', 'local-task']).first()
        if target is None or target.data.get('status') != 'Released':
            return False
    return True

def snapshot(member):
    rows = accessible(member)
    enabled = member.company.enabled_modules
    rows = [r for r in rows if r.kind in MASTER_KINDS or r.kind in ['operations', 'operation-assignment'] or DEPARTMENT.get(r.area) in enabled]
    def data(kind):
        return [dict(r.data) for r in rows if r.kind == kind]
    records = [{'id': r.code, 'kind': r.kind, 'data': r.data} for r in rows if r.kind in ['operations', 'stages', 'trips', 'costs', 'invoices', 'activity'] and r.data.get('id') == r.code]
    freight = [{**r.data, 'ready': freight_ready(member, r)} for r in rows if r.kind == 'freight']
    for r in records:
        if r['kind'] == 'operations':
            items = [f for f in freight if f['operation_id'] == r['id']]
            r['data'] = {**r['data'], 'ready': any(f['ready'] for f in items), 'blocker': '' if any(f['ready'] for f in items) else 'Freight clearance pending'}
    staff_qs = Membership.objects.filter(company=member.company, active=True).select_related('user')
    if not is_management(member):
        staff_qs = staff_qs.filter(pk=member.pk)
    staff = [{'id': str(m.id), 'display_name': profile(m)['display_name'], 'role': ROLE_MAP.get(m.role, m.role)} for m in staff_qs]
    allowed = operation_ids(member)
    events = AuditEvent.objects.filter(company=member.company).order_by('-occurred_at')[:1000]
    audit_rows = [{'id': str(e.id), 'operation_id': e.details.get('operationId', ''), 'actor_id': e.details.get('membership', str(e.actor_id)), 'action': e.action, 'record_id': e.target, 'reason': e.details.get('reason', ''), 'occurred_at': e.occurred_at.isoformat()} for e in events if (is_management(member) or e.details.get('membership') == str(member.id)) and (not e.details.get('operationId') or e.details['operationId'] in allowed)]
    return {'userId': str(member.id), 'role': ROLE_MAP.get(member.role, member.role), 'company': {'id': str(member.id), 'company': str(member.company_id), 'name': member.company.name, 'role': member.role, 'branding': member.company.branding, 'enabled_modules': enabled}, 'profile': profile(member), 'records': records, 'work': [work_row(r) for r in rows if r.kind == 'work'], 'staff': staff, 'assignments': [{'operation_id': r.data['operationId'], 'user_id': str(r.assigned_to_id), 'area': r.area} for r in rows if r.kind == 'operation-assignment'], 'audit': audit_rows, 'customers': data('master-customer'), 'ports': data('master-port'), 'trucks': data('master-truck'), 'configuration': data('master-config'), 'freight': freight, 'dependencies': data('freight-dependency'), 'tasks': data('local-task'), 'requests': data('truck-request'), 'rates': data('rate-card'), 'cash': data('cash'), 'tripDetails': data('trip-detail'), 'advances': data('advance'), 'reversals': data('reversal'), 'allocations': data('allocation')}

def event(member, record, action, reason=''):
    history = record.data.get('history', [])
    record.data = {**record.data, 'history': history + [{'actor': profile(member)['display_name'], 'action': action, 'reason': reason, 'time': timezone.now().isoformat()}]}
    audit(member, action, record.code, {'reason': reason, 'operationId': record.data.get('operationId', ''), 'membership': str(member.id)})

@transaction.atomic
def master_action(member, kind, value):
    if member.role not in GENERAL and member.role != 'Company Administrator' and not (kind == 'truck' and member.role == 'Transport Manager'):
        raise PermissionDenied('Company configuration access required.')
    if kind not in ['customer', 'port', 'truck', 'configuration'] or not isinstance(value, dict):
        raise ValidationError('Unknown directory.')
    name = text(value.get('truck') if kind == 'truck' else value.get('name'), 'Name')
    model_kind = {'customer': 'master-customer', 'port': 'master-port', 'truck': 'master-truck', 'configuration': 'master-config'}[kind]
    code = f'{value.get("category", "")}:{name}' if kind == 'configuration' else name
    if kind == 'truck':
        value['capacity'] = float(number(value.get('capacity'), True))
        if value.get('ownership') not in ['Company', 'Subcontractor']:
            raise ValidationError('Invalid truck ownership.')
    if kind == 'port':
        text(value.get('country'), 'Country')
    if kind == 'configuration' and value.get('category') not in ['freight_type', 'container_size', 'charge_category', 'authority', 'currency']:
        raise ValidationError('Invalid configuration category.')
    row = company_records(member).filter(kind=model_kind, code=code).select_for_update(of=('self',)).first()
    data = {**value, 'id': str(row.id) if row else str(uuid.uuid4()), 'active': value.get('active', True)}
    if row:
        row.data = data; row.save(update_fields=['data'])
    else:
        new_record(member, model_kind, code, 'transport' if kind == 'truck' else 'external', data)
    audit(member, 'master_data', code, {'membership': str(member.id)})
    return True

@transaction.atomic
def create_operation(member, value, stages):
    if member.role not in GENERAL and ROLE_AREA.get(member.role) not in ['external', 'internal', 'transport'] and member.role not in ['Logistics Manager', 'Transport Manager']:
        raise PermissionDenied('Operation creation is outside your department.')
    if not isinstance(value, dict) or not isinstance(stages, list) or not 1 <= len(stages) <= 50:
        raise ValidationError('An operation and one or more port stages are required.')
    code = text(value.get('id'), 'Operation reference')
    customer = text(value.get('customer'), 'Customer')
    if not company_records(member).filter(kind='master-customer', code=customer).exists():
        raise ValidationError('Choose a customer in your company.')
    for key in ['origin', 'destination', 'type', 'due']:
        text(value.get(key), key)
    if not company_records(member).filter(kind='master-config', code=f'freight_type:{value["type"]}').exists():
        raise ValidationError('Choose a configured freight type.')
    qty = number(value.get('quantity'), True)
    if qty != int(qty) or qty > 10000:
        raise ValidationError('Quantity must be a positive whole count up to 10,000.')
    weight = number(value.get('weight'), True)
    charge = number(value.get('charge'))
    containers = value.get('containers', [])
    if not isinstance(containers, list) or len(containers) > qty or any(not isinstance(c, str) or not c.strip() for c in containers):
        raise ValidationError('Container identifiers must match the operation quantity.')
    normalized = [c.strip().upper() for c in containers]
    if len(set(normalized)) != len(normalized):
        raise ValidationError('Container identifiers must be unique within this operation.')
    area = ROLE_AREA.get(member.role, 'external')
    value = {**value, 'quantity': int(qty), 'weight': float(weight), 'charge': float(charge), 'containers': containers, 'status': 'Draft', 'progress': 0, 'ready': False, 'blocker': 'Freight clearance pending', 'opened': timezone.now().date().isoformat()}
    parent = new_record(member, 'operations', code, area, value)
    if member.role in ROLE_AREA:
        new_record(member, 'operation-assignment', f'{code}:{member.id}:{area}', area, {'operationId': code}, parent=parent)
    for stage in stages:
        port = text(stage.get('port'), 'Port')
        if not company_records(member).filter(kind='master-port', code=port, data__active=True).exists():
            raise ValidationError('Choose an active port in your company.')
        stage_data = {**stage, 'operationId': code, 'status': 'Pending', 'owner': profile(member)['display_name']}
        new_record(member, 'stages', text(stage.get('id')), 'external', stage_data, parent=parent)
    for i in range(int(qty)):
        identifier = containers[i] if i < len(containers) else f'Unit {i+1}'
        fid = f'{code}-F-{i+1}'
        new_record(member, 'freight', fid, 'transport', {'id': fid, 'operationId': code, 'operation_id': code, 'identifier': identifier, 'freight_type': value['type'], 'weight': float(weight / qty), 'clearance_confirmed': False, 'blocker': 'Clearance not confirmed'}, parent=parent)
    event(member, parent, 'createOperation'); parent.save(update_fields=['data'])
    return code

@transaction.atomic
def assign_staff(member, value):
    target = get_object_or_404(Membership.objects.filter(company=member.company, active=True), pk=value.get('staff_id'))
    op = value.get('operation_id')
    if not op:
        if member.role != 'Company Administrator' or member.id == target.id:
            raise PermissionDenied('An independent company administrator must change staff roles.')
        role = {v: k for k, v in ROLE_MAP.items()}.get(value.get('staff_role'), value.get('staff_role'))
        from .policy import ROLES
        if role not in ROLES:
            raise ValidationError('Invalid company role.')
        target.role = role; target.save(update_fields=['role'])
    else:
        area = value.get('work_area')
        if area not in DEPARTMENT or ROLE_AREA.get(target.role) != area:
            raise ValidationError('Assign an officer in the matching department.')
        if member.role not in GENERAL and member.role not in ['Company Administrator', MANAGER[area]]:
            raise PermissionDenied('Department manager required.')
        parent = operation(member, op)
        code = f'{op}:{target.id}:{area}'
        if not company_records(member).filter(kind='operation-assignment', code=code).exists():
            new_record(member, 'operation-assignment', code, area, {'operationId': op}, parent=parent, assigned=target)
    audit(member, 'assign_staff', str(target.id), {'membership': str(member.id), 'operationId': op or ''})
    return True

@transaction.atomic
def workspace_action(member, action, value):
    if not isinstance(value, dict) or set(value) & {'company', 'company_id', 'created_by', 'submitted_by', 'status'}:
        raise ValidationError('Ownership and status are server-controlled.')
    if action == 'createOperation':
        return create_operation(member, value.get('operation'), value.get('stages'))
    if action == 'create':
        area = value.get('area'); kind = value.get('kind'); op = value.get('operationId')
        if area not in WORK_KINDS or kind not in WORK_KINDS[area]:
            raise ValidationError('This work kind does not belong to your department.')
        parent = writable(member, area, op)
        payload = value.get('payload', {})
        amount = authoritative_amount(member, kind, payload, value.get('amount', 0), op)
        data = {'operationId': op, 'workKind': kind, 'payload': payload, 'details': text(value.get('details', ''), required=False, limit=2000), 'documents': value.get('documents', []), 'dependencies': 0, 'history': []}
        if not isinstance(data['documents'], list) or any(not isinstance(d, str) for d in data['documents']):
            raise ValidationError('Invalid supporting documents.')
        row = new_record(member, 'work', text(value.get('id')), area, data, parent=parent, amount=amount)
        row.title = text(value.get('title'), 'Work title'); event(member, row, 'Draft'); row.save()
        return row.code
    row = get_record(member, text(value.get('id')), 'work', lock=True)
    require_module(member, row.area)
    reason = text(value.get('reason', ''), required=False, limit=2000)
    if action in ['edit', 'delete', 'assign', 'Submitted']:
        require_edit(member, row)
    if action == 'edit':
        payload = value.get('payload', row.data['payload'])
        row.title = text(value.get('title'), 'Title'); row.amount = authoritative_amount(member, row.data['workKind'], payload, value.get('amount'), row.data['operationId'])
        documents = value.get('documents', row.data.get('documents', []))
        if not isinstance(documents, list) or any(not isinstance(d, str) for d in documents):
            raise ValidationError('Invalid supporting documents.')
        row.data = {**row.data, 'details': text(value.get('details', ''), required=False, limit=2000), 'documents': documents, 'payload': payload}
    elif action == 'delete':
        if member.role not in ROLE_AREA or row.created_by_id != member.id or row.status != 'Draft' or row.submitted_by_id or row.documents.exists() or row.data.get('documents') or company_records(member).filter(related_record=row).exists():
            raise PermissionDenied('Only your own unused Draft may be deleted.')
        event(member, row, 'delete'); row.delete(); return True
    elif action == 'assign':
        if member.role not in GENERAL and member.role != MANAGER[row.area]:
            raise PermissionDenied('Department manager required.')
        target = get_object_or_404(Membership.objects.filter(company=member.company, active=True), pk=value.get('assignedTo'))
        if ROLE_AREA.get(target.role) != row.area or not company_records(member).filter(kind='operation-assignment', assigned_to=target, area=row.area, data__operationId=row.data['operationId']).exists():
            raise PermissionDenied('An assigned officer in this area is required.')
        row.assigned_to = target
    elif action == 'Submitted':
        row.status = 'Submitted'; row.submitted_by = member
    elif action in ['Approved', 'Returned']:
        if row.status != 'Submitted' or (member.role not in GENERAL and member.role != MANAGER[row.area]):
            raise PermissionDenied('Submitted work and an independent manager are required.')
        if member.id in [row.created_by_id, row.submitted_by_id]:
            raise PermissionDenied('You cannot approve or return your own creation or submission.')
        if row.data['workKind'] in ['Reversal', 'Void'] and member.role not in ['Finance Manager', 'General Manager']:
            raise PermissionDenied('Finance Manager or General Manager required for reversals.')
        limit = member.company.approval_limits.get(member.role)
        if limit is not None and row.amount > number(limit):
            raise PermissionDenied('Your company approval limit is exceeded.')
        if action == 'Returned' and not reason:
            raise ValidationError('A return reason is required.')
        row.status = action
    elif action == 'post':
        return post_work(member, row)
    else:
        raise ValidationError('Unknown workspace action.')
    event(member, row, action, reason); row.save(); return True

def projected(member, row, kind, code, data):
    data = {**data, 'id': code, 'operationId': row.data['operationId']}
    return new_record(member, kind, code, row.area, data, parent=row, assigned=row.assigned_to, amount=row.amount, status='Approved')

@transaction.atomic
def post_work(member, row):
    # One company lock serializes posting, allocation and sequence changes.
    company = Company.objects.select_for_update().get(pk=member.company_id)
    if row.status != 'Approved':
        raise ValidationError('Only approved unposted work may be posted.')
    require_module(member, row.area)
    if member.role not in GENERAL and member.role != MANAGER[row.area] and row.assigned_to_id != member.id:
        raise PermissionDenied('Assigned officer or department manager required.')
    p = row.data['payload']; kind = row.data['workKind']; op = row.data['operationId']; amount = number(row.amount, kind in ['Invoice', 'Payment', 'Settlement', 'Bill', 'Expense', 'Reversal'])
    operation(member, op, lock=True)
    now = timezone.now().date().isoformat(); code = p.get('sourceId') or f'{kind.upper().replace(" ", "-")}-{uuid.uuid4().hex[:10]}'
    if kind in ['Bill', 'Expense']:
        original = number(p.get('amount', amount), True); rate = number(p.get('rate', 1), True); currency = p.get('currency', 'ETB')
        if currency == 'ETB' and rate != 1:
            raise ValidationError('ETB exchange rate must be 1.')
        converted = original if currency == 'ETB' else (original * rate).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        if currency != 'ETB' and not p.get('rateSource', '').strip():
            raise ValidationError('Historical exchange-rate source required.')
        stage_id = p.get('stageId', '')
        if stage_id:
            stage = get_record(member, stage_id, 'stages')
            if stage.data['operationId'] != op:
                raise ValidationError('The stage belongs to another operation.')
        projected(member, row, 'costs', code, {'stageId': stage_id, 'category': p.get('category', row.title), 'supplier': p.get('supplier', ''), 'currency': currency, 'amount': float(original), 'rate': float(rate), 'convertedAmount': float(converted), 'rateSource': p.get('rateSource', ''), 'approval': 'Approved', 'status': 'Unsettled', 'date': p.get('date', now)})
    elif kind == 'Port stage':
        port = text(p.get('port'), 'Port')
        if not company_records(member).filter(kind='master-port', code=port, data__active=True).exists():
            raise ValidationError('Choose an active company port.')
        projected(member, row, 'stages', code, {'port': port, 'country': p.get('country', ''), 'status': 'Pending', 'arrival': p.get('arrival', now), 'release': p.get('release', ''), 'owner': profile(row.assigned_to)['display_name']})
    elif kind == 'Local clearance task':
        projected(member, row, 'local-task', code, {'operation_id': op, 'title': p.get('title', row.title), 'authority': p.get('authority', ''), 'assigned_to': str(row.assigned_to_id), 'status': 'Pending', 'started': p.get('date', now), 'completed': None, 'source_work_id': row.code})
    elif kind == 'Truck request':
        count = number(p.get('count'), True)
        if count != int(count):
            raise ValidationError('Truck count must be whole.')
        projected(member, row, 'truck-request', code, {'operation_id': op, 'truck_count': int(count), 'assigned_to': str(row.assigned_to_id), 'status': 'Open', 'source_work_id': row.code, 'fulfilled': 0})
    elif kind in ['Assignment', 'Trip']:
        item = get_record(member, (p.get('freightId') or '').split(' · ')[0], 'freight', lock=True)
        request = get_record(member, p.get('requestId', ''), 'truck-request', lock=True)
        truck = get_record(member, (p.get('truck') or '').split(' · ')[0], 'master-truck', lock=True)
        if item.data['operation_id'] != op or request.data['operation_id'] != op or not freight_ready(member, item) or request.data['status'] != 'Open':
            raise ValidationError('Choose cleared freight and an open request on this operation.')
        if not truck.data.get('active') or number(truck.data.get('capacity'), True) < number(item.data['weight'], True):
            raise ValidationError('An active truck with sufficient capacity is required.')
        for trip in company_records(member).filter(kind='trips'):
            if trip.data.get('status') not in ['Completed', 'Cancelled'] and (trip.data.get('truck') == truck.code or trip.data.get('freight') == item.data['identifier'] and trip.data.get('operationId') == op):
                raise ValidationError('This truck or freight already has an unfinished trip.')
        if number(p.get('count', 1)) != 1 or p.get('arrival', '') < p.get('departure', ''):
            raise ValidationError('Create one assignment per truck with valid dates.')
        selling = number(p.get('charge'), True); cost = number(p.get('cost'), True)
        projected(member, row, 'trips', code, {'truck': truck.code, 'driver': truck.data['driver'], 'ownership': truck.data['ownership'], 'supplier': truck.data['supplier'], 'status': 'Assigned', 'departure': p.get('departure', now), 'arrival': p.get('arrival', now), 'freight': item.data['identifier'], 'charge': float(selling), 'cost': float(cost), 'paid': 0, 'pod': '', 'requestId': request.code, 'freightId': item.code})
        projected(member, row, 'trip-detail', code, {'operation_id': op, 'request_id': request.code, 'freight_id': item.code, 'truck_id': truck.code, 'source_work_id': row.code, 'status': 'Assigned'})
        fulfilled = request.data.get('fulfilled', 0) + 1
        if fulfilled > request.data['truck_count']:
            raise ValidationError('The truck request is already fulfilled.')
        request.data = {**request.data, 'fulfilled': fulfilled, 'status': 'Fulfilled' if fulfilled == request.data['truck_count'] else 'Open'}; request.save(update_fields=['data'])
    elif kind == 'Invoice':
        code = f'{company.invoice_prefix}-{company.next_invoice_number:06d}'
        company.next_invoice_number += 1; company.save(update_fields=['next_invoice_number'])
        projected(member, row, 'invoices', code, {'amount': float(amount), 'paid': 0, 'due': p.get('due', now), 'issued': now, 'status': 'Issued', 'taxRate': 0, 'taxAmount': 0})
        row.status = 'Issued'
    elif kind in ['Payment', 'Settlement']:
        payment_type = p.get('paymentType', '')
        if payment_type == 'Advance':
            parent = operation(member, op)
            projected(member, row, 'advance', code, {'operation_id': op, 'customer_name': parent.data['customer'], 'amount': float(amount), 'allocated': 0, 'reversed': False, 'received_date': p.get('date', now), 'reference': p.get('reference', ''), 'source_work_id': row.code})
            projected(member, row, 'cash', f'CASH-{code}', {'operation_id': op, 'source_id': code, 'source_kind': 'Advance', 'direction': 'Receipt', 'amount': float(amount), 'reference': p.get('reference', ''), 'transaction_date': p.get('date', now), 'source_work_id': row.code})
        else:
            target_kind = 'trips' if kind == 'Settlement' else 'invoices'
            target = get_record(member, p.get('sourceId', ''), target_kind, lock=True)
            if target.data['operationId'] != op:
                raise ValidationError('The payment target belongs to another operation.')
            balance = number(target.data['cost'] if target_kind == 'trips' else target.data['amount']) - number(target.data['paid'])
            if amount > balance or target.data.get('status') in ['Cancelled', 'Voided', 'Draft']:
                raise ValidationError('The payment exceeds the eligible outstanding balance.')
            if target_kind == 'trips' and target.data['ownership'] != 'Subcontractor':
                raise ValidationError('Only subcontractor trips have supplier payables.')
            if payment_type == 'Allocation':
                advance = get_record(member, p.get('advanceId', ''), 'advance', lock=True)
                customer = operation(member, op).data['customer']
                if advance.data['customer_name'] != customer or advance.data['reversed'] or amount > number(advance.data['amount']) - number(advance.data['allocated']):
                    raise ValidationError('Allocation exceeds eligible customer credit.')
                advance.data = {**advance.data, 'allocated': float(number(advance.data['allocated']) + amount)}; advance.save(update_fields=['data'])
                projected(member, row, 'allocation', f'ALLOC-{uuid.uuid4().hex[:10]}', {'advance_id': advance.code, 'invoice_id': target.code, 'amount': float(amount), 'operation_id': op, 'source_work_id': row.code})
            else:
                projected(member, row, 'cash', f'CASH-{uuid.uuid4().hex[:10]}', {'operation_id': op, 'source_id': target.code, 'source_kind': target_kind, 'direction': 'Settlement' if kind == 'Settlement' else 'Receipt', 'amount': float(amount), 'reference': p.get('reference', ''), 'transaction_date': p.get('date', now), 'source_work_id': row.code})
            paid = number(target.data['paid']) + amount
            target.data = {**target.data, 'paid': float(paid), 'status': ('Paid' if paid == number(target.data['amount']) else 'Part-paid') if target_kind == 'invoices' else target.data['status']}; target.save(update_fields=['data'])
        row.status = 'Settled' if kind == 'Settlement' else 'Paid'
    elif kind == 'Reversal':
        cash = get_record(member, p.get('cashEntryId', ''), 'cash', lock=True)
        if cash.data['operation_id'] != op or company_records(member).filter(kind='reversal', data__cash_entry_id=cash.code).exists():
            raise ValidationError('The cash transaction is not eligible for reversal.')
        if not row.data.get('details', '').strip() or cash.data.get('source_kind') == 'Reversal':
            raise ValidationError('An original cash entry and a reversal reason are required.')
        if cash.data.get('source_kind') == 'Advance':
            source = get_record(member, cash.data['source_id'], 'advance', lock=True)
            if source.data['allocated']:
                raise ValidationError('An allocated advance needs an allocation reversal first.')
            source.data = {**source.data, 'reversed': True}
        else:
            source = get_record(member, cash.data['source_id'], cash.data['source_kind'], lock=True)
            paid = number(source.data['paid']) - number(cash.data['amount'])
            if paid < 0:
                raise ValidationError('Reversal exceeds the recorded payment.')
            source.data = {**source.data, 'paid': float(paid), 'status': ('Part-paid' if paid else 'Issued') if source.kind == 'invoices' else source.data['status']}
        source.save(update_fields=['data'])
        rev_id = f'REV-{uuid.uuid4().hex[:10]}'
        projected(member, row, 'reversal', rev_id, {'cash_entry_id': cash.code, 'operation_id': op, 'source_work_id': row.code, 'reason': row.data['details'], 'amount': cash.data['amount']})
        projected(member, row, 'cash', f'CASH-{rev_id}', {**cash.data, 'source_kind': 'Reversal', 'direction': 'Receipt' if cash.data['direction'] == 'Settlement' else 'Settlement', 'reference': row.data['details'], 'transaction_date': now, 'source_work_id': row.code})
    elif kind == 'Void':
        target = get_record(member, p.get('sourceId', ''), 'invoices', lock=True)
        if target.data['operationId'] != op or number(target.data['paid']) != 0 or target.data['status'] == 'Voided':
            raise ValidationError('Only an unpaid eligible invoice may be voided.')
        target.data = {**target.data, 'status': 'Voided'}; target.save(update_fields=['data']); row.status = 'Voided'
    elif kind == 'Rate card':
        if p.get('type') not in ['Company', 'Subcontractor'] or not p.get('lane', '').strip() or not p.get('from') or p.get('to') and p['to'] < p['from']:
            raise ValidationError('A valid lane, ownership and effective date range are required.')
        projected(member, row, 'rate-card', code, {'route': p['lane'], 'ownership': p['type'], 'freight_type': p.get('freight', ''), 'rate': float(number(p.get('amount', amount), True)), 'minimum': float(number(p.get('minimum', 0))), 'effective_from': p['from'], 'effective_to': p.get('to', ''), 'source_work_id': row.code})
    else:
        raise ValidationError('This work kind has no authorized posting command; no records were changed.')
    if row.status == 'Approved':
        row.status = 'Posted'
    event(member, row, 'Posted'); row.save(); return True

@transaction.atomic
def operational_action(member, value):
    action = value.get('action')
    if action == 'post':
        return workspace_action(member, 'post', {'id': value.get('id')})
    kinds = {'stageStatus': 'stages', 'taskStatus': 'local-task', 'tripStatus': 'trips', 'freightClearance': 'freight', 'dependency': 'freight', 'assignStage': 'stages'}
    if action not in kinds:
        raise ValidationError('Unknown operational command.')
    row = get_record(member, value.get('id'), kinds[action], lock=True)
    area = ('internal' if ROLE_AREA.get(member.role) == 'internal' else 'external') if action in ['freightClearance', 'dependency'] else row.area
    require_module(member, area)
    if member.role not in GENERAL and member.role != MANAGER[area] and (ROLE_AREA.get(member.role) != area or row.assigned_to_id != member.id and row.kind != 'freight'):
        raise PermissionDenied('Assigned department access required.')
    op = row.data.get('operationId') or row.data.get('operation_id')
    operation(member, op, lock=True)
    reason = text(value.get('reason', ''), required=False, limit=2000)
    if action == 'freightClearance':
        if not reason or not isinstance(value.get('ready'), bool):
            raise ValidationError('Clearance evidence or a blocker is required.')
        row.data = {**row.data, 'clearance_confirmed': value['ready'], 'blocker': '' if value['ready'] else reason}
    elif action == 'dependency':
        target_id = value.get('stageId') or value.get('taskId')
        if bool(value.get('stageId')) == bool(value.get('taskId')):
            raise ValidationError('Choose exactly one relevant stage or task.')
        if area == 'external' and value.get('taskId') and member.role not in GENERAL and member.role != 'Logistics Manager' or area == 'internal' and value.get('stageId'):
            raise PermissionDenied('Choose a dependency in your clearance department.')
        target = get_record(member, target_id, 'stages' if value.get('stageId') else 'local-task')
        if target.data.get('operationId') != op:
            raise ValidationError('Dependency belongs to another operation.')
        code = f'DEP-{uuid.uuid4().hex[:12]}'
        if not company_records(member).filter(kind='freight-dependency', data__freight_id=row.code, data__target=target_id).exists():
            new_record(member, 'freight-dependency', code, area, {'operationId': op, 'freight_id': row.code, 'stage_id': value.get('stageId'), 'task_id': value.get('taskId'), 'target': target_id}, parent=row)
    elif action == 'assignStage':
        if member.role not in GENERAL and member.role != MANAGER[area]:
            raise PermissionDenied('Department manager required.')
        target = get_object_or_404(Membership.objects.filter(company=member.company, active=True, role='External Officer'), pk=value.get('assignedTo'))
        if not company_records(member).filter(kind='operation-assignment', assigned_to=target, data__operationId=op, area='external').exists():
            raise PermissionDenied('Officer must first be assigned to this operation.')
        row.assigned_to = target; row.data = {**row.data, 'owner': profile(target)['display_name']}
    else:
        allowed = {'Assigned': ['Active', 'Cancelled'], 'Active': ['Arrived'], 'Arrived': ['Offloaded'], 'Offloaded': ['Completed']} if action == 'tripStatus' else {'Pending': ['In clearance', 'On hold'], 'In clearance': ['Released', 'On hold'], 'On hold': ['In clearance']}
        target = value.get('status')
        if target not in allowed.get(row.data.get('status'), []):
            raise ValidationError('Invalid milestone transition.')
        if target in ['On hold', 'Cancelled'] and not reason:
            raise ValidationError('A reason is required.')
        row.data = {**row.data, 'status': target}
        if target == 'Released':
            row.data['release' if row.kind == 'stages' else 'completed'] = timezone.now().date().isoformat()
        if action == 'tripStatus' and target == 'Active':
            item = get_record(member, row.data.get('freightId'), 'freight')
            if not freight_ready(member, item):
                raise ValidationError('Freight clearance is not ready for departure.')
        if action == 'tripStatus' and target == 'Completed':
            attachments = company_records(member).filter(kind='document-attachment', related_record=row, data__category='Proof of delivery')
            docs = Document.objects.filter(company=member.company, record__in=attachments)
            if not docs.exists():
                raise ValidationError('Attach proof of delivery before completing the trip.')
            row.data['pod'] = docs.first().filename
    event(member, row, action, reason); row.save(); return True