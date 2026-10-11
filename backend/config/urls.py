
from django.contrib import admin
from django.urls import include, path

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)


urlpatterns = [
    path("admin/", admin.site.urls),

    # Versioned API
    path(
        "api/v1/",
        include(
            ("inventory.urls", "inventory"),
            namespace="inventory-v1",
        ),
    ),
    path(
        "api/v1/",
        include(
            ("accounts.urls", "accounts"),
            namespace="accounts-v1",
        ),
    ),

    # JWT authentication
    path(
        "api/v1/token/",
        TokenObtainPairView.as_view(),
        name="v1-token-obtain",
    ),
    path(
        "api/v1/token/refresh/",
        TokenRefreshView.as_view(),
        name="v1-token-refresh",
    ),

    # Temporary compatibility with existing React frontend
    path(
        "api/",
        include(
            ("inventory.urls", "inventory"),
            namespace="inventory-legacy",
        ),
    ),
    path(
        "api/",
        include(
            ("accounts.urls", "accounts"),
            namespace="accounts-legacy",
        ),
    ),

    path(
        "api/token/",
        TokenObtainPairView.as_view(),
        name="legacy-token-obtain",
    ),
    path(
        "api/token/refresh/",
        TokenRefreshView.as_view(),
        name="legacy-token-refresh",
    ),

    path("api-auth/", include("rest_framework.urls")),
]
