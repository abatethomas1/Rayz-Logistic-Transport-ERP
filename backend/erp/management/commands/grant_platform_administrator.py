from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from erp.models import PlatformAdministrator

class Command(BaseCommand):
    help = 'Explicit operator-only platform-role bootstrap; no email-based or signup-metadata promotion.'
    def add_arguments(self, parser):
        parser.add_argument('username')
    def handle(self, *args, **options):
        user = get_user_model().objects.filter(username=options['username'], is_active=True).first()
        if not user:
            raise CommandError('Create and verify an individual operator account first.')
        PlatformAdministrator.objects.update_or_create(user=user, defaults={'active': True})
        self.stdout.write(self.style.SUCCESS('Explicit platform administrator role granted.'))