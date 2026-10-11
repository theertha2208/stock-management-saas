from datetime import timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import (
    api_view,
    permission_classes,
    throttle_classes,
)
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import (
    AllowAny,
    BasePermission,
    IsAuthenticated,
)
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from .models import Company, CompanyInvitation, User
from .serializers import (
    AcceptInvitationSerializer,
    CompanyUserSerializer,
    CreateInvitationSerializer,
)


# ==================================================
# PERMISSIONS
# ==================================================
class IsCompanyAdmin(BasePermission):
    message = "Only company administrators can manage users."
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.company_id is not None
            and user.role == User.Role.ADMIN
        )
# ==================================================
# THROTTLING
# ==================================================
class PublicRegistrationThrottle(AnonRateThrottle):
    scope = "public_registration"
    def get_rate(self):
        return "5/hour"
class InvitationThrottle(UserRateThrottle):
    scope = "company_invitations"
    def get_rate(self):
        return "20/hour"
class InvitationAcceptanceThrottle(AnonRateThrottle):
    scope = "invitation_acceptance"
    def get_rate(self):
        return "10/hour"
# ==================================================
# COMPANY REGISTRATION
# ==================================================
class CompanyRegistrationSerializer(serializers.Serializer):
    company_name = serializers.CharField(max_length=200)
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={"input_type": "password"},
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
    def validate_company_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Company name is required."
            )
        return value
    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                "This username is already taken."
            )
        return value
    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "This email address is already registered."
            )
        return value
    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value
    @transaction.atomic
    def create(self, validated_data):
        company_name = validated_data["company_name"]
        base_slug = (slugify(company_name) or "company")[:90]
        slug = base_slug
        counter = 2
        while Company.objects.filter(slug=slug).exists():
            suffix = f"-{counter}"
            slug = f"{base_slug[:100 - len(suffix)]}{suffix}"
            counter += 1
        company = Company.objects.create(
            name=company_name,
            slug=slug,
        )
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            company=company,
            role=User.Role.ADMIN,
        )
        return user
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PublicRegistrationThrottle])
def register_company(request):
    serializer = CompanyRegistrationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(
        {
            "message": "Company registered successfully.",
            "company": {
                "id": user.company.id,
                "name": user.company.name,
                "slug": user.company.slug,
            },
            "admin": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
            },
        },
        status=status.HTTP_201_CREATED,
    )
# ==================================================
# CURRENT USER
# ==================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request):
    user = request.user
    return Response(
        {
            "id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "role": user.role,
            "company_id": user.company_id,
            "company_name": (
                user.company.name if user.company_id else None
            ),
            "is_superuser": user.is_superuser,
        }
    )
# ==================================================
# COMPANY USER MANAGEMENT
# ==================================================
class CompanyUserViewSet(viewsets.ModelViewSet):
    serializer_class = CompanyUserSerializer
    permission_classes = [IsAuthenticated, IsCompanyAdmin]
    http_method_names = ["get", "post", "patch", "head", "options"]
    def get_queryset(self):
        return User.objects.filter(
            company=self.request.user.company,
            role__in=[User.Role.MANAGER, User.Role.STAFF],
            is_superuser=False,
        ).order_by("-date_joined")
    def perform_create(self, serializer):
        serializer.save()
    def perform_update(self, serializer):
        if serializer.instance.pk == self.request.user.pk:
            raise PermissionDenied(
                "You cannot modify your own account here."
            )
        serializer.save()
# ==================================================
# INVITATION LIST AND CREATION
# ==================================================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsCompanyAdmin])
@throttle_classes([InvitationThrottle])
def company_invitations(request):
    company = request.user.company
    if request.method == "GET":
        invitations = CompanyInvitation.objects.filter(
            company=company
        ).order_by("-created_at")[:100]
        results = []
        for invitation in invitations:
            if invitation.accepted_at:
                invitation_status = "ACCEPTED"
            elif invitation.revoked_at:
                invitation_status = "REVOKED"
            elif invitation.expires_at <= timezone.now():
                invitation_status = "EXPIRED"
            else:
                invitation_status = "PENDING"
            results.append(
                {
                    "id": invitation.id,
                    "email": invitation.email,
                    "role": invitation.role,
                    "status": invitation_status,
                    "created_at": invitation.created_at,
                    "expires_at": invitation.expires_at,
                }
            )
        return Response(results)
    serializer = CreateInvitationSerializer(
        data=request.data,
        context={"request": request},
    )
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"]
    role = serializer.validated_data["role"]
    raw_token, token_hash = CompanyInvitation.generate_token()
    with transaction.atomic():
        # Serialize invitation creation within this company.
        Company.objects.select_for_update().get(pk=company.pk)
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                {"email": "An account with this email already exists."}
            )
        if CompanyInvitation.objects.filter(
            company=company,
            email__iexact=email,
            accepted_at__isnull=True,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).exists():
            raise serializers.ValidationError(
                {"email": "An active invitation already exists."}
            )
        invitation = CompanyInvitation.objects.create(
            company=company,
            email=email,
            role=role,
            token_hash=token_hash,
            invited_by=request.user,
            expires_at=timezone.now() + timedelta(hours=48),
        )
        frontend_url = getattr(
            settings,
            "FRONTEND_URL",
            "http://localhost:5173",
        ).rstrip("/")
        invitation_link = (
            f"{frontend_url}/accept-invitation?token={raw_token}"
        )
        send_mail(
            subject=f"Invitation to join {company.name}",
            message=(
                f"You have been invited to join {company.name} "
                f"as {role}.\n\n"
                f"Accept your invitation here:\n"
                f"{invitation_link}\n\n"
                "This invitation expires in 48 hours.\n"
                "If you did not expect this invitation, ignore this email."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
    return Response(
        {
            "message": "Invitation created and email generated.",
            "invitation": {
                "id": invitation.id,
                "email": invitation.email,
                "role": invitation.role,
                "expires_at": invitation.expires_at,
            },
        },
        status=status.HTTP_201_CREATED,
    )
# ==================================================
# INVITATION DETAILS
# ==================================================
@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([InvitationAcceptanceThrottle])
def invitation_details(request):
    token = request.query_params.get("token", "")
    if not token:
        raise serializers.ValidationError(
            {"token": "Invitation token is required."}
        )
    token_hash = CompanyInvitation.hash_token(token)
    invitation = CompanyInvitation.objects.select_related(
        "company"
    ).filter(token_hash=token_hash).first()
    if not invitation or not invitation.is_valid():
        raise serializers.ValidationError(
            {"token": "This invitation is invalid or expired."}
        )
    return Response(
        {
            "company_name": invitation.company.name,
            "email": invitation.email,
            "role": invitation.role,
            "expires_at": invitation.expires_at,
        }
    )
# ==================================================
# ACCEPT INVITATION
# ==================================================
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([InvitationAcceptanceThrottle])
def accept_invitation(request):
    serializer = AcceptInvitationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    invitation_id = data["invitation"].pk
    with transaction.atomic():
        invitation = (
            CompanyInvitation.objects.select_for_update()
            .get(pk=invitation_id)
        )
        # Recheck inside the transaction to prevent token reuse.
        if not invitation.is_valid():
            raise serializers.ValidationError(
                {"token": "This invitation is invalid or expired."}
            )
        if User.objects.filter(
            email__iexact=invitation.email
        ).exists():
            raise serializers.ValidationError(
                {"email": "This email is already registered."}
            )
        if User.objects.filter(
            username__iexact=data["username"]
        ).exists():
            raise serializers.ValidationError(
                {"username": "This username is already taken."}
            )
        try:
            user = User.objects.create_user(
                username=data["username"],
                email=invitation.email,
                password=data["password"],
                first_name=data.get("first_name", ""),
                last_name=data.get("last_name", ""),
                company=invitation.company,
                role=invitation.role,
            )
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {
                    "detail": (
                        "This account could not be created. "
                        "Please check the username and email."
                    )
                }
            ) from exc
        invitation.accepted_at = timezone.now()
        invitation.save(update_fields=["accepted_at"])
    return Response(
        {
            "message": "Invitation accepted successfully.",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "company_name": user.company.name,
            },
        },
        status=status.HTTP_201_CREATED,
    )
