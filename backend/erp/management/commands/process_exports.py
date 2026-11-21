from django.core.management.base import BaseCommand
from erp.models import ExportJob
from erp.services import run_export_job

class Command(BaseCommand):
    help = 'Process queued exports, establishing fresh company authorization for every job.'
    def handle(self, *args, **kwargs):
        for job_id in ExportJob.objects.filter(status='Pending').values_list('id', flat=True).iterator():
            run_export_job(job_id)