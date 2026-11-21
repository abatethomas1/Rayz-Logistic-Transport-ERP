import uuid
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from .policy import ROLES, AREAS

class Company(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)
    slug = models.SlugField(unique=True)
    active = models.BooleanField(default=True)
    branding = models.JSONField(default=dict)
    enabled_modules = models.JSONField(default=list)
    charge_categories = models.JSONField(default=list)
    truck_rate_cards = models.JSONField(default=list)
    approval_limits = models.JSONField(default=dict)
    invoice_prefix = models.CharField(max_length=30, default='INV')
    next_invoice_number = models.PositiveBigIntegerField(default=1)
    report_access = models.JSONField(default=dict)

class PlatformAdministrator(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    active = models.BooleanField(default=True)

class Membership(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.PROTECT)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    role = models.CharField(max_length=40, choices=[(r, r) for r in ROLES])
    active = models.BooleanField(default=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['company', 'user'], name='unique_company_membership')]

class Record(models.Model):
    """Company-owned resource envelope; dedicated ledger posting is a later migration."""
    KINDS = ['operations', 'customers', 'trucks', 'trips', 'bills', 'invoices', 'payments', 'settings']
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.PROTECT)
    kind = models.CharField(max_length=30, choices=[(k, k) for k in KINDS])
    code = models.CharField(max_length=100)
    title = models.CharField(max_length=200)
    area = models.CharField(max_length=20, choices=[(a, a) for a in AREAS])
    amount = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    data = models.JSONField(default=dict)
    related_record = models.ForeignKey('self', null=True, blank=True, on_delete=models.PROTECT)
    assigned_to = models.ForeignKey(Membership, on_delete=models.PROTECT, related_name='assigned_records')
    created_by = models.ForeignKey(Membership, on_delete=models.PROTECT, related_name='created_records')
    submitted_by = models.ForeignKey(Membership, null=True, blank=True, on_delete=models.PROTECT, related_name='submitted_records')
    status = models.CharField(max_length=20, default='Draft', choices=[(s, s) for s in ['Draft', 'Returned', 'Submitted', 'Approved', 'Issued', 'Paid', 'Settled', 'Voided']])
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['company', 'kind', 'code'], name='company_resource_code'), models.CheckConstraint(condition=models.Q(amount__gte=0), name='nonnegative_record_amount')]
        indexes = [models.Index(fields=['company', 'kind', 'status'])]
    def clean(self):
        for field in ['assigned_to', 'created_by', 'submitted_by', 'related_record']:
            value = getattr(self, field)
            if value is not None and value.company_id != self.company_id:
                raise ValidationError({field: 'Related record belongs to another company.'})

class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.PROTECT)
    record = models.ForeignKey(Record, on_delete=models.PROTECT, related_name='documents')
    uploaded_by = models.ForeignKey(Membership, on_delete=models.PROTECT)
    filename = models.CharField(max_length=200)
    object_key = models.CharField(max_length=300, unique=True)
    size = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

class AuditEvent(models.Model):
    company = models.ForeignKey(Company, on_delete=models.PROTECT, null=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=100)
    target = models.CharField(max_length=100)
    details = models.JSONField(default=dict)
    occurred_at = models.DateTimeField(auto_now_add=True)

class ExportJob(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.PROTECT)
    requested_by = models.ForeignKey(Membership, on_delete=models.PROTECT)
    area = models.CharField(max_length=20, choices=[(a, a) for a in AREAS])
    kind = models.CharField(max_length=30)
    search = models.CharField(max_length=200, default='')
    format = models.CharField(max_length=10, default='xlsx')
    status = models.CharField(max_length=20, default='Pending')
    object_key = models.CharField(max_length=300, default='')

class StaffInvitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.PROTECT)
    email = models.EmailField()
    role = models.CharField(max_length=40, choices=[(r, r) for r in ROLES])
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True)