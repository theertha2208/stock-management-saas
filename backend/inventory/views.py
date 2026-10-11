
from decimal import Decimal

from django.core.exceptions import (
    ValidationError as DjangoValidationError,
)
from django.db.models import (
    Count,
    DecimalField,
    ExpressionWrapper,
    F,
    Q,
    Sum,
)
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import (
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response

from .models import (
    Category,
    Product,
    StockLevel,
    StockMovement,
    Supplier,
    Warehouse,
)
from .permissions import (
    CanManageInventory,
    CanManageWarehouses,
    CanRecordStockMovements,
    CanViewReports,
    IsAdminOrManagerOrReadOnly,
    IsCompanyMember,
)
from .serializers import (
    CategorySerializer,
    ProductSerializer,
    RecordStockMovementSerializer,
    StockLevelSerializer,
    StockMovementSerializer,
    SupplierSerializer,
    WarehouseSerializer,
)
from .services import record_stock_movement

# ==================================================
# COMMON COMPANY-SCOPED VIEWSET
# ==================================================

class CompanyScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [
        permissions.IsAuthenticated,
        IsCompanyMember,
    ]

    def get_company(self):
        company = getattr(
            self.request.user,
            "company",
            None,
        )

        if company is None:
            raise PermissionDenied(
                "Your account is not assigned to a company."
            )

        return company

    def get_queryset(self):
        return super().get_queryset().filter(
            company=self.get_company()
        )

    def perform_create(self, serializer):
        serializer.save(
            company=self.get_company()
        )


# ==================================================
# CATEGORIES
# ==================================================

class CategoryViewSet(CompanyScopedViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    permission_classes = [
        permissions.IsAuthenticated,
        IsCompanyMember,
        IsAdminOrManagerOrReadOnly,
    ]


# ==================================================
# SUPPLIERS
# ==================================================

class SupplierViewSet(CompanyScopedViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer

    permission_classes = [
        permissions.IsAuthenticated,
        IsCompanyMember,
        IsAdminOrManagerOrReadOnly,
    ]


# ==================================================
# PRODUCTS
# ==================================================

class ProductViewSet(CompanyScopedViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    permission_classes = [
        permissions.IsAuthenticated,
        IsCompanyMember,
        CanManageInventory,
    ]

    @action(
        detail=False,
        methods=["post"],
        url_path="update-stock",
    )
    def update_stock_action(self, request):
        return Response(
            {
                "detail": (
                    "The old stock update endpoint is disabled. "
                    "Use POST /api/v1/stock-movements/ instead."
                )
            },
            status=status.HTTP_410_GONE,
        )


# ==================================================
# WAREHOUSES
# ==================================================

class WarehouseViewSet(CompanyScopedViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer

    permission_classes = [
        permissions.IsAuthenticated,
        IsCompanyMember,
        CanManageWarehouses,
    ]

    def perform_destroy(self, instance):
        has_stock = StockLevel.objects.filter(
            company=self.get_company(),
            warehouse=instance,
        ).exists()

        has_history = StockMovement.objects.filter(
            company=self.get_company(),
        ).filter(
            Q(from_warehouse=instance)
            | Q(to_warehouse=instance)
        ).exists()

        if has_stock or has_history:
            raise ValidationError(
                {
                    "detail": (
                        "This warehouse has inventory history. "
                        "Deactivate it instead of deleting it."
                    )
                }
            )

        instance.delete()


# ==================================================
# STOCK LEVELS
# ==================================================

class StockLevelViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockLevelSerializer

    permission_classes = [
        permissions.IsAuthenticated,
        IsCompanyMember,
    ]

    def get_queryset(self):
        queryset = StockLevel.objects.filter(
            company=self.request.user.company
        ).select_related(
            "product",
            "warehouse",
        )

        warehouse_id = self.request.query_params.get(
            "warehouse"
        )
        product_id = self.request.query_params.get(
            "product"
        )

        if warehouse_id:
            queryset = queryset.filter(
                warehouse_id=warehouse_id
            )

        if product_id:
            queryset = queryset.filter(
                product_id=product_id
            )

        return queryset.order_by(
            "warehouse_id",
            "product_id",
        )


# ==================================================
# STOCK MOVEMENTS
# ==================================================

class StockMovementViewSet(viewsets.ModelViewSet):
    permission_classes = [
        permissions.IsAuthenticated,
        IsCompanyMember,
        CanRecordStockMovements,
    ]

    http_method_names = [
        "get",
        "post",
        "head",
        "options",
    ]

    def get_queryset(self):
        queryset = StockMovement.objects.filter(
            company=self.request.user.company
        ).select_related(
            "product",
            "created_by",
            "from_warehouse",
            "to_warehouse",
            "supplier",
        )

        movement_type = self.request.query_params.get(
            "movement_type"
        )
        product_id = self.request.query_params.get(
            "product"
        )
        warehouse_id = self.request.query_params.get(
            "warehouse"
        )
        date_from = self.request.query_params.get(
            "date_from"
        )
        date_to = self.request.query_params.get(
            "date_to"
        )

        if movement_type:
            queryset = queryset.filter(
                movement_type=movement_type
            )

        if product_id:
            queryset = queryset.filter(
                product_id=product_id
            )

        if warehouse_id:
            queryset = queryset.filter(
                Q(from_warehouse_id=warehouse_id)
                | Q(to_warehouse_id=warehouse_id)
            )

        if date_from:
            queryset = queryset.filter(
                created_at__date__gte=date_from
            )

        if date_to:
            queryset = queryset.filter(
                created_at__date__lte=date_to
            )

        return queryset.order_by(
            "-created_at",
            "-id",
        )

    def get_serializer_class(self):
        if self.action == "create":
            return RecordStockMovementSerializer

        return StockMovementSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        data = serializer.validated_data

        # STAFF can record only purchase IN and sale OUT.
        # Transfers, adjustments, and returns are reserved
        # for ADMIN and MANAGER.
        if request.user.role == "STAFF":
            allowed_types = {
                "PURCHASE_IN",
                "SALE_OUT",
            }

            if data["movement_type"] not in allowed_types:
                raise PermissionDenied(
                    "Staff can record only PURCHASE_IN "
                    "and SALE_OUT stock movements."
                )

        try:
            movement = record_stock_movement(
                company=request.user.company,
                product_id=data["product"].pk,
                movement_type=data["movement_type"],
                quantity=data["quantity"],
                user=request.user,
                from_warehouse_id=(
                    data["from_warehouse"].pk
                    if data.get("from_warehouse")
                    else None
                ),
                to_warehouse_id=(
                    data["to_warehouse"].pk
                    if data.get("to_warehouse")
                    else None
                ),
                supplier_id=(
                    data["supplier"].pk
                    if data.get("supplier")
                    else None
                ),
                unit_cost=data.get("unit_cost"),
                reference_number=data.get(
                    "reference_number",
                    "",
                ),
                notes=data.get("notes", ""),
                adjustment_direction=data.get(
                    "adjustment_direction"
                ),
            )

        except DjangoValidationError as exc:
            raise ValidationError(
                {"detail": exc.messages}
            ) from exc

        output = StockMovementSerializer(
            movement,
            context=self.get_serializer_context(),
        )

        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
        )


# ==================================================
# REPORTS
# ==================================================

class ReportViewSet(viewsets.ViewSet):
    """
    Read-only, company-scoped inventory reports.

    GET /api/v1/reports/summary/
    GET /api/v1/reports/low-stock/
    GET /api/v1/reports/warehouses/
    GET /api/v1/reports/movements/
    """

    permission_classes = [
        permissions.IsAuthenticated,
        IsCompanyMember,
        CanViewReports,
    ]

    def get_company(self):
        company = getattr(
            self.request.user,
            "company",
            None,
        )

        if company is None:
            raise PermissionDenied(
                "Your account is not assigned to a company."
            )

        return company

    @staticmethod
    def stock_value_expression():
        return ExpressionWrapper(
            F("quantity") * F("average_unit_cost"),
            output_field=DecimalField(
                max_digits=24,
                decimal_places=4,
            ),
        )

    @staticmethod
    def money(value):
        if value is None:
            value = Decimal("0")

        return str(
            Decimal(value).quantize(
                Decimal("0.01")
            )
        )

    # ----------------------------------------------
    # INVENTORY SUMMARY
    # ----------------------------------------------

    @action(
        detail=False,
        methods=["get"],
        url_path="summary",
    )
    def summary(self, request):
        company = self.get_company()

        products = Product.objects.filter(
            company=company,
            is_active=True,
        )

        levels = StockLevel.objects.filter(
            company=company,
            product__is_active=True,
        )

        totals = levels.aggregate(
            total_quantity=Sum("quantity"),
            total_value=Sum(
                self.stock_value_expression()
            ),
        )

        low_stock_count = (
            products.annotate(
                available_quantity=Sum(
                    "stock_levels__quantity",
                    filter=Q(
                        stock_levels__company=company
                    ),
                )
            )
            .filter(
                Q(
                    available_quantity__lt=F(
                        "reorder_level"
                    )
                )
                | Q(
                    available_quantity__isnull=True,
                    reorder_level__gt=0,
                )
            )
            .count()
        )

        return Response(
            {
                "total_products": products.count(),

                "total_warehouses": Warehouse.objects.filter(
                    company=company,
                    is_active=True,
                ).count(),

                "total_suppliers": Supplier.objects.filter(
                    company=company
                ).count(),

                "total_stock_quantity": (
                    totals["total_quantity"] or 0
                ),

                "total_stock_value": self.money(
                    totals["total_value"]
                ),

                "low_stock_products": low_stock_count,

                "total_movements": StockMovement.objects.filter(
                    company=company
                ).count(),
            }
        )

    # ----------------------------------------------
    # LOW STOCK REPORT
    # ----------------------------------------------

    @action(
        detail=False,
        methods=["get"],
        url_path="low-stock",
    )
    def low_stock(self, request):
        company = self.get_company()

        products = (
            Product.objects.filter(
                company=company,
                is_active=True,
            )
            .annotate(
                available_quantity=Sum(
                    "stock_levels__quantity",
                    filter=Q(
                        stock_levels__company=company
                    ),
                )
            )
            .filter(
                Q(
                    available_quantity__lt=F(
                        "reorder_level"
                    )
                )
                | Q(
                    available_quantity__isnull=True,
                    reorder_level__gt=0,
                )
            )
            .order_by("name", "id")
        )

        results = []

        for product in products:
            quantity = product.available_quantity or 0

            results.append(
                {
                    "id": product.id,
                    "name": product.name,
                    "sku": product.sku,
                    "stock_quantity": quantity,
                    "reorder_level": product.reorder_level,
                    "shortage": max(
                        product.reorder_level - quantity,
                        0,
                    ),
                }
            )

        return Response(results)

    # ----------------------------------------------
    # WAREHOUSE REPORT
    # ----------------------------------------------

    @action(
        detail=False,
        methods=["get"],
        url_path="warehouses",
    )
    def warehouses(self, request):
        company = self.get_company()

        warehouses = Warehouse.objects.filter(
            company=company
        ).order_by("name", "id")

        results = []

        for warehouse in warehouses:
            levels = StockLevel.objects.filter(
                company=company,
                warehouse=warehouse,
                product__is_active=True,
            )

            totals = levels.aggregate(
                total_quantity=Sum("quantity"),
                total_value=Sum(
                    self.stock_value_expression()
                ),
            )

            results.append(
                {
                    "id": warehouse.id,
                    "name": warehouse.name,
                    "code": warehouse.code,
                    "is_active": warehouse.is_active,

                    "product_count": levels.filter(
                        quantity__gt=0
                    ).count(),

                    "total_quantity": (
                        totals["total_quantity"] or 0
                    ),

                    "total_value": self.money(
                        totals["total_value"]
                    ),
                }
            )

        return Response(results)

    # ----------------------------------------------
    # MOVEMENT STATISTICS
    # ----------------------------------------------

    @action(
        detail=False,
        methods=["get"],
        url_path="movements",
    )
    def movements(self, request):
        company = self.get_company()

        movements = StockMovement.objects.filter(
            company=company
        )

        date_from = request.query_params.get(
            "date_from"
        )
        date_to = request.query_params.get(
            "date_to"
        )

        if date_from:
            movements = movements.filter(
                created_at__date__gte=date_from
            )

        if date_to:
            movements = movements.filter(
                created_at__date__lte=date_to
            )

        grouped = (
            movements.values("movement_type")
            .annotate(
                count=Count("id"),
                total_quantity=Sum("quantity"),
            )
            .order_by("movement_type")
        )

        results = [
            {
                "movement_type": row["movement_type"],
                "count": row["count"],
                "total_quantity": row["total_quantity"],
            }
            for row in grouped
        ]

        return Response(
            {
                "total_movements": movements.count(),
                "by_type": results,
            }
        )
