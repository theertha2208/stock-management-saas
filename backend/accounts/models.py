
import hashlib
import secrets

from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


# ==================================================
# COMPANY
# ==================================================

class Company(models.Model):
    name = models.CharField(max_length=200)

    slug = models.SlugField(
        max_length=100,
        unique=True,
    )

    allow_negative_stock = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        verbose_name_plural = "companies"

    def __str__(self):
        return self.name


# ==================================================
# USER
# ==================================================

class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        MANAGER = "MANAGER", "Manager"
        STAFF = "STAFF", "Staff"

    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name="users",
        null=True,
        blank=True,
    )

    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.STAFF,
    )

    email = models.EmailField(
        unique=True
    )

    def __str__(self):
        return self.username


# ==================================================
# COMPANY INVITATION
# ==================================================

class CompanyInvitation(models.Model):
    class InvitationRole(models.TextChoices):
        MANAGER = "MANAGER", "Manager"
        STAFF = "STAFF", "Staff"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="invitations",
    )

    email = models.EmailField()

    role = models.CharField(
        max_length=10,
        choices=InvitationRole.choices,
        default=InvitationRole.STAFF,
    )

    token_hash = models.CharField(
        max_length=64,
        unique=True,
        editable=False,
    )

    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sent_invitations",
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    expires_at = models.DateTimeField()

    accepted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]

        indexes = [
            models.Index(
                fields=["company", "email"]
            ),
        ]

    @staticmethod
    def hash_token(raw_token):
        return hashlib.sha256(
            raw_token.encode("utf-8")
        ).hexdigest()

    @classmethod
    def generate_token(cls):
        raw_token = secrets.token_urlsafe(32)

        return (
            raw_token,
            cls.hash_token(raw_token),
        )

    def is_valid(self):
        return (
            self.accepted_at is None
            and self.revoked_at is None
            and self.expires_at > timezone.now()
        )

    def save(self, *args, **kwargs):
        if self.expires_at is None:
            self.expires_at = (
                timezone.now()
                + timedelta(hours=48)
            )

        super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"{self.email} - "
            f"{self.company.name} - "
            f"{self.role}"
        )
