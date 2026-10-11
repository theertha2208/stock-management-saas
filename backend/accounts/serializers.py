
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q

from rest_framework import serializers

from .models import User, CompanyInvitation


# ==================================================
# EXISTING COMPANY USER SERIALIZER
# ==================================================

class CompanyUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
            "is_active",
            "password",
            "date_joined",
        ]
        read_only_fields = ["id", "date_joined"]

    def validate_role(self, value):
        if value not in [
            User.Role.MANAGER,
            User.Role.STAFF,
        ]:
            raise serializers.ValidationError(
                "Only Manager and Staff roles can be assigned here."
            )

        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({
                "password": "Password is required."
            })

        if self.instance is None and "role" not in attrs:
            attrs["role"] = User.Role.STAFF

        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        request = self.context["request"]

        user = User(
            company=request.user.company,
            **validated_data,
        )

        user.set_password(password)
        user.save()

        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance


# ==================================================
# CREATE INVITATION SERIALIZER
# ==================================================

class CreateInvitationSerializer(serializers.Serializer):
    email = serializers.EmailField()

    role = serializers.ChoiceField(
        choices=CompanyInvitation.InvitationRole.choices,
        default=CompanyInvitation.InvitationRole.STAFF,
    )

    def validate_email(self, value):
        email = value.strip().lower()

        if User.objects.filter(
            email__iexact=email
        ).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return email

    def validate(self, attrs):
        request = self.context["request"]

        company = request.user.company
        email = attrs["email"]

        existing_invitation = CompanyInvitation.objects.filter(
            company=company,
            email__iexact=email,
            accepted_at__isnull=True,
            revoked_at__isnull=True,
        ).first()

        if (
            existing_invitation
            and existing_invitation.is_valid()
        ):
            raise serializers.ValidationError({
                "email": (
                    "An active invitation has already been "
                    "sent to this email address."
                )
            })

        return attrs


# ==================================================
# ACCEPT INVITATION SERIALIZER
# ==================================================

class AcceptInvitationSerializer(serializers.Serializer):
    token = serializers.CharField(
        write_only=True,
    )

    username = serializers.CharField(
        max_length=150,
    )

    first_name = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
    )

    last_name = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
    )

    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={"input_type": "password"},
    )

    confirm_password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )

    def validate_username(self, value):
        username = value.strip()

        if User.objects.filter(
            username__iexact=username
        ).exists():
            raise serializers.ValidationError(
                "This username is already taken."
            )

        return username

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                exc.messages
            )

        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({
                "confirm_password": "Passwords do not match."
            })

        token_hash = CompanyInvitation.hash_token(
            attrs["token"]
        )

        invitation = CompanyInvitation.objects.filter(
            token_hash=token_hash
        ).first()

        if not invitation or not invitation.is_valid():
            raise serializers.ValidationError({
                "token": "This invitation is invalid or expired."
            })

        if User.objects.filter(
            email__iexact=invitation.email
        ).exists():
            raise serializers.ValidationError({
                "token": (
                    "An account with this invitation email "
                    "already exists."
                )
            })

        attrs["invitation"] = invitation

        return attrs
