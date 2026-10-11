
from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsCompanyMember(BasePermission):
    message = "You must belong to an active company account."

    def has_permission(self, request, view):
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.company_id is not None
            and user.role in ("ADMIN", "MANAGER", "STAFF")
        )


class IsAdminOrManagerOrReadOnly(BasePermission):
    message = "Only admins and managers can modify this resource."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        return request.user.role in ("ADMIN", "MANAGER")


class IsAdminOrReadOnly(BasePermission):
    message = "Only admins can modify this resource."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        return request.user.role == "ADMIN"


class CanManageInventory(BasePermission):
    message = "You do not have permission to manage products."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        if view.action == "update_stock_action":
            return False

        if request.method == "DELETE":
            return request.user.role == "ADMIN"

        return request.user.role in ("ADMIN", "MANAGER")


class CanManageWarehouses(BasePermission):
    message = "Only admins and managers can manage warehouses."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        return request.user.role in ("ADMIN", "MANAGER")


class CanRecordStockMovements(BasePermission):
    message = "You cannot perform this stock operation."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        if request.method == "POST" and view.action == "create":
            return request.user.role in (
                "ADMIN",
                "MANAGER",
                "STAFF",
            )

        return False


class CanViewReports(BasePermission):
    message = "Only admins and managers can view reports."

    def has_permission(self, request, view):
        return bool(
            request.user
            and user_is_company_member(request.user)
            and request.user.role in ("ADMIN", "MANAGER")
        )


def user_is_company_member(user):
    return bool(
        user.is_authenticated
        and user.is_active
        and user.company_id is not None
    )
