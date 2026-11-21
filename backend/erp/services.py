import csv
import hashlib
import io
from pathlib import Path
from decimal import Decimal
from xml.sax.saxutils import escape
from django.conf import settings
from django.db import transaction, connection
from rest_framework.exceptions import PermissionDenied, ValidationError
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from .models import Record, AuditEvent, Company, ExportJob
from .policy import GENERAL, MANAGER, ROLE_AREA, DEPARTMENT, require_module, resolve_membership

def scoped_records(membership, kind=None):
    qs = Record.objects.filter(company=membership.company).select_related('assigned_to', 'created_by', 'submitted_by')
    if kind:
        qs = qs.filter(kind=kind)
    role = membership.role
    if role in GENERAL or role == 'Company Administrator':
        return qs
    areas = [area for area, manager in MANAGER.items() if manager == role]
    if areas:
        return qs.filter(area__in=areas)
    area = ROLE_AREA.get(role)
    return qs.filter(area=area, assigned_to=membership) if area else qs.none()

def set_company_context(membership):
    with connection.cursor() as cursor:
        cursor.execute("SELECT set_config('rayz.user_id', %s, true), set_config('rayz.company_id', %s, true)", [str(membership.user_id), str(membership.company_id)])

def require_edit(membership, record):
    require_module(membership, record.area)
    if record.status not in ['Draft', 'Returned']:
        raise PermissionDenied('Only Draft or Returned work can be edited.')
    if membership.role not in GENERAL and membership.role != MANAGER[record.area] and record.assigned_to_id != membership.id:
        raise PermissionDenied('Assigned officer or department manager required.')

def audit(membership, action, target, details=None):
    AuditEvent.objects.create(company=membership.company, actor=membership.user, action=action, target=str(target), details=details or {})

@transaction.atomic
def transition(membership, record_id, command, reason=''):
    record = scoped_records(membership).select_for_update(of=('self',)).get(pk=record_id)
    require_module(membership, record.area)
    if command == 'submit':
        require_edit(membership, record)
        record.status = 'Submitted'
        record.submitted_by = membership
    elif command in ['approve', 'return']:
        if record.status != 'Submitted':
            raise ValidationError('Only submitted work can be approved or returned.')
        if membership.role not in GENERAL and membership.role != MANAGER[record.area]:
            raise PermissionDenied('Independent department manager required.')
        if membership.id in [record.created_by_id, record.submitted_by_id]:
            raise PermissionDenied('You cannot approve or return your own creation or submission.')
        limit = membership.company.approval_limits.get(membership.role)
        if limit is not None and record.amount > Decimal(str(limit)):
            raise PermissionDenied('This amount exceeds your company approval limit.')
        if command == 'return' and not reason.strip():
            raise ValidationError('A return reason is required.')
        record.status = 'Approved' if command == 'approve' else 'Returned'
    elif command == 'issue':
        if record.kind != 'invoices' or record.status != 'Approved' or record.area != 'finance':
            raise ValidationError('Only an approved finance invoice can be issued.')
        company = Company.objects.select_for_update().get(pk=membership.company_id)
        record.code = f'{company.invoice_prefix}-{company.next_invoice_number:06d}'
        company.next_invoice_number += 1
        company.save(update_fields=['next_invoice_number'])
        record.status = 'Issued'
    else:
        raise ValidationError('Unknown lifecycle command.')
    record.save()
    audit(membership, command, record.id, {'reason': reason, 'status': record.status})
    return record

def report_records(membership, area, kind, search=''):
    require_module(membership, area)
    company = membership.company
    if 'reports' not in company.enabled_modules or membership.role not in company.report_access.get(DEPARTMENT[area], []):
        raise PermissionDenied('Report access is not enabled for your company role.')
    return scoped_records(membership, kind).filter(area=area, title__icontains=search).order_by('code', 'id')

def safe_cell(value):
    text = str(value)
    return "'" + text if text.startswith(('=', '+', '-', '@', '\t', '\r')) else text

def export_bytes(membership, area, kind, search, output_format):
    records = report_records(membership, area, kind, search)
    rows = [['Reference', 'Title', 'Status', 'Amount (ETB)']]
    rows += [[safe_cell(r.code), safe_cell(r.title), r.status, f'{r.amount:,.2f}'] for r in records]
    stream = io.BytesIO()
    if output_format == 'xlsx':
        wb = Workbook()
        ws = wb.active
        ws.title = 'Company report'
        ws.append([safe_cell(membership.company.name)])
        ws.append([safe_cell(f'{kind.title()} — {area.title()}')])
        for row in rows:
            ws.append(row)
        for cell in ws[3]:
            cell.font = Font(bold=True, color='FFFFFF')
            cell.fill = PatternFill('solid', fgColor='174F43')
        for column, width in [('A', 28), ('B', 48), ('C', 22), ('D', 22)]:
            ws.column_dimensions[column].width = width
        ws.freeze_panes = 'A4'
        ws.auto_filter.ref = f'A3:D{ws.max_row}'
        wb.save(stream)
    elif output_format == 'pdf':
        doc = SimpleDocTemplate(stream, pagesize=landscape(A4), title=membership.company.name)
        styles = getSampleStyleSheet()
        table_rows = [[Paragraph(escape(str(cell)), styles['BodyText']) for cell in row] for row in rows]
        table = Table(table_rows, colWidths=[150, 320, 120, 130], repeatRows=1)
        table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E5F1EB')), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOTTOMPADDING', (0, 0), (-1, -1), 8), ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#174F43'))]))
        doc.build([Paragraph(escape(membership.company.name), styles['Title']), Paragraph(escape(f'{kind.title()} — {area.title()}'), styles['Heading2']), table])
    else:
        raise ValidationError('Select PDF or Excel.')
    return stream.getvalue()

def private_path(key):
    root = settings.PRIVATE_DOCUMENT_ROOT.resolve()
    path = (root / key).resolve()
    if root not in path.parents:
        raise PermissionDenied('Invalid private document location.')
    return path

def run_export_job(job_id):
    """Fresh authorization per job; never reuse a request/global tenant context."""
    with transaction.atomic():
        job = ExportJob.objects.select_for_update().select_related('requested_by__user', 'company').get(pk=job_id)
        if job.status != 'Pending':
            return
        try:
            member = resolve_membership(job.requested_by.user, str(job.company_id))
            if member.id != job.requested_by_id:
                raise PermissionDenied('Export membership changed.')
            set_company_context(member)
            content = export_bytes(member, job.area, job.kind, job.search, job.format)
        except PermissionDenied:
            job.status = 'Denied'
            job.save(update_fields=['status'])
            return
        key = f'{job.company_id}/exports/{job.id}.{job.format}'
        path = private_path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('xb') as file:
            file.write(content)
        path.chmod(0o600)
        job.object_key = key
        job.status = 'Ready'
        job.save(update_fields=['object_key', 'status'])
        audit(member, 'export_ready', job.id)