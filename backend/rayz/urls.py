from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenBlacklistView
from erp import views
from erp.models import Record
from erp import workspace_views as workspace

router = DefaultRouter()
router.register('platform/companies', views.PlatformCompanyViewSet, basename='company')
router.register('company-settings', views.CompanySettingsViewSet, basename='company-settings')
router.register('memberships', views.MembershipViewSet, basename='membership')
for kind in Record.KINDS:
    resource_view = type(f'{kind.title()}ViewSet', (views.RecordViewSet,), {'kind': kind})
    router.register(kind, resource_view, basename=kind)
router.register('documents', views.DocumentViewSet, basename='document')
router.register('reports', views.ReportViewSet, basename='report')
router.register('export-jobs', views.ExportJobViewSet, basename='export-job')

urlpatterns = [
    path('health/', views.health), path('api/v1/auth/token/', workspace.CompanyTokenView.as_view()), path('api/v1/auth/refresh/', TokenRefreshView.as_view()), path('api/v1/auth/logout/', TokenBlacklistView.as_view()), path('api/v1/auth/memberships/', views.my_memberships), path('api/v1/auth/me/', workspace.identity), path('api/v1/auth/accept-invitation/', views.accept_invitation),
    path('api/v1/auth/password-reset/', workspace.password_reset), path('api/v1/auth/password-reset-confirm/', workspace.password_reset_confirm),
    path('api/v1/workspace/', workspace.workspace_snapshot), path('api/v1/workspace/actions/', workspace.actions), path('api/v1/workspace/operational-actions/', workspace.operational), path('api/v1/workspace/master-data/', workspace.masters), path('api/v1/workspace/assignments/', workspace.assignments), path('api/v1/workspace/profile/', workspace.update_profile), path('api/v1/workspace/invitations/', workspace.invitations), path('api/v1/workspace/documents/', workspace.documents), path('api/v1/workspace/reports/', workspace.reports),
    path('api/v1/', include(router.urls)),
]