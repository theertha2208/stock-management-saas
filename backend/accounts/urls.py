
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CompanyUserViewSet,
    accept_invitation,
    company_invitations,
    current_user,
    invitation_details,
    register_company,
)

router = DefaultRouter()

router.register(
    "company-users",
    CompanyUserViewSet,
    basename="company-users",
)

urlpatterns = [
    path(
        "register/",
        register_company,
        name="register-company",
    ),
    path(
        "me/",
        current_user,
        name="current-user",
    ),
    path(
        "invitations/",
        company_invitations,
        name="company-invitations",
    ),
    path(
        "invitations/details/",
        invitation_details,
        name="invitation-details",
    ),
    path(
        "invitations/accept/",
        accept_invitation,
        name="accept-invitation",
    ),
    path("", include(router.urls)),
]
