from django.core.management.base import BaseCommand
from erp.models import Company

class Command(BaseCommand):
    help = 'Create Base, SAT and Yangtze without staff accounts or demonstration transactions.'
    def handle(self, *args, **kwargs):
        for slug, name in [('base', 'Base'), ('sat', 'SAT'), ('yangtze', 'Yangtze')]:
            Company.objects.get_or_create(slug=slug, defaults={'name': f'{name} Logistics & Transport', 'branding': {'display_name': f'{name} Logistics & Transport'}, 'enabled_modules': ['logistics', 'transport', 'finance', 'reports']})
        self.stdout.write(self.style.SUCCESS('Base, SAT and Yangtze companies exist. No staff passwords were assigned.'))