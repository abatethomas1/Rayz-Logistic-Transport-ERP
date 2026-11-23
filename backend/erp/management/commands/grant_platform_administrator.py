from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from erp.models import PlatformAdministrator
from erp.platform import SUPPORT_PERMISSIONS

class Command(BaseCommand):
    help = 'Explicit operator-only platform-role bootstrap; no email-based or signup-metadata promotion.'
    def add_arguments(self, parser):
        parser.add_argument('username')
        parser.add_argument('--support-permission', action='append', default=[], choices=SUPPORT_PERMISSIONS, help='Named company-support permission; repeat for several.')
    def handle(self, *args, **options):
        user = get_user_model().objects.filter(username=options['username'], is_active=True).first()
        if not user:
            raise CommandError('Create and verify an individual operator account first.')
        admin, _ = PlatformAdministrator.objects.update_or_create(user=user, defaults={'active': True})
        if options['support_permission']:
            admin.support_permissions = sorted(set(admin.support_permissions) | set(options['support_permission']))
            admin.save(update_fields=['support_permissions'])
        self.stdout.write(self.style.SUCCESS('Explicit platform administrator role granted.'))