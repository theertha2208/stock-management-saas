
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Company, User


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "slug",
        "allow_negative_stock",
        "created_at",
    )

    search_fields = ("name", "slug")

    list_filter = ("allow_negative_stock",)


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = (
        "id",
        "username",
        "email",
        "company",
        "role",
        "is_staff",
        "is_active",
    )

    list_filter = (
        "role",
        "company",
        "is_staff",
        "is_active",
    )

    fieldsets = UserAdmin.fieldsets + (
        (
            "Company Information",
            {
                "fields": (
                    "company",
                    "role",
                )
            },
        ),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        (
            "Company Information",
            {
                "fields": (
                    "email",
                    "company",
                    "role",
                )
            },
        ),
    )
