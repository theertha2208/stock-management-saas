
from rest_framework import serializers

from .models import (
    Category,
    Supplier,
    Product,
    Warehouse,
    StockLevel,
    StockMovement,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = [
            "id", "name", "description", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            "id", "name", "contact_person", "phone",
            "email", "address", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ProductSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.none(),
        allow_null=True,
        required=False,
    )
    supplier = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.none(),
        allow_null=True,
        required=False,
    )

    # Total across every warehouse, not the old product field.
    stock_quantity = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "sku",
            "description",
            "category",
            "supplier",
            "unit_of_measure",
            "barcode",
            "purchase_price",
            "selling_price",
            "stock_quantity",
            "reorder_level",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "stock_quantity", "created_at", "updated_at",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")

        if request and request.user.is_authenticated:
            company = request.user.company
            if company:
                self.fields["category"].queryset = (
                    Category.objects.filter(company=company)
                )
                self.fields["supplier"].queryset = (
                    Supplier.objects.filter(company=company)
                )

    def get_stock_quantity(self, obj):
        from django.db.models import Sum

        result = StockLevel.objects.filter(
            company_id=obj.company_id,
            product_id=obj.pk,
        ).aggregate(total=Sum("quantity"))

        return result["total"] or 0


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = [
            "id",
            "name",
            "code",
            "address",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class StockLevelSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )
    product_sku = serializers.CharField(
        source="product.sku",
        read_only=True,
    )
    warehouse_name = serializers.CharField(
        source="warehouse.name",
        read_only=True,
    )
    stock_value = serializers.SerializerMethodField()

    class Meta:
        model = StockLevel
        fields = [
            "id",
            "product",
            "product_name",
            "product_sku",
            "warehouse",
            "warehouse_name",
            "quantity",
            "average_unit_cost",
            "stock_value",
            "updated_at",
        ]
        read_only_fields = fields

    def get_stock_value(self, obj):
        return round(
            obj.quantity * obj.average_unit_cost, 2
        )


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )
    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
        allow_null=True,
    )
    from_warehouse_name = serializers.CharField(
        source="from_warehouse.name",
        read_only=True,
        allow_null=True,
    )
    to_warehouse_name = serializers.CharField(
        source="to_warehouse.name",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "product",
            "product_name",
            "movement_type",
            "quantity",
            "from_warehouse",
            "from_warehouse_name",
            "to_warehouse",
            "to_warehouse_name",
            "supplier",
            "unit_cost",
            "reference_number",
            "previous_stock",
            "new_stock",
            "notes",
            "created_by_username",
            "created_at",
            "is_legacy",
        ]
        read_only_fields = fields


class RecordStockMovementSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.none(),
    )
    movement_type = serializers.ChoiceField(
        choices=[
            "PURCHASE_IN",
            "SALE_OUT",
            "TRANSFER",
            "ADJUSTMENT",
            "RETURN",
        ]
    )
    quantity = serializers.IntegerField(min_value=1)

    from_warehouse = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.none(),
        required=False,
        allow_null=True,
    )
    to_warehouse = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.none(),
        required=False,
        allow_null=True,
    )
    supplier = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.none(),
        required=False,
        allow_null=True,
    )

    unit_cost = serializers.DecimalField(
        max_digits=16,
        decimal_places=4,
        required=False,
        allow_null=True,
        min_value=0,
    )
    adjustment_direction = serializers.ChoiceField(
        choices=["IN", "OUT"],
        required=False,
    )
    reference_number = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default="",
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return

        company = request.user.company
        if company is None:
            return

        self.fields["product"].queryset = Product.objects.filter(
            company=company,
            is_active=True,
        )
        self.fields["from_warehouse"].queryset = (
            Warehouse.objects.filter(
                company=company,
                is_active=True,
            )
        )
        self.fields["to_warehouse"].queryset = (
            Warehouse.objects.filter(
                company=company,
                is_active=True,
            )
        )
        self.fields["supplier"].queryset = Supplier.objects.filter(
            company=company
        )

    def validate(self, attrs):
        movement_type = attrs["movement_type"]
        source = attrs.get("from_warehouse")
        target = attrs.get("to_warehouse")
        supplier = attrs.get("supplier")
        cost = attrs.get("unit_cost")
        direction = attrs.get("adjustment_direction")

        request = self.context["request"]

        if (
            request.user.role == "STAFF"
            and movement_type not in ("PURCHASE_IN", "SALE_OUT")
        ):
            raise serializers.ValidationError(
                "Staff can record purchases and sales only."
            )

        if movement_type == "PURCHASE_IN":
            if not target or source or not supplier or cost is None:
                raise serializers.ValidationError(
                    "Purchase requires destination warehouse, "
                    "supplier and unit cost."
                )

        elif movement_type == "SALE_OUT":
            if not source or target or supplier or cost is not None:
                raise serializers.ValidationError(
                    "Sale requires only a source warehouse."
                )

        elif movement_type == "TRANSFER":
            if (
                not source
                or not target
                or source.pk == target.pk
                or supplier
                or cost is not None
            ):
                raise serializers.ValidationError(
                    "Transfer requires different source and "
                    "destination warehouses, without supplier or cost."
                )

        elif movement_type == "RETURN":
            if not target or source or supplier:
                raise serializers.ValidationError(
                    "Return requires a destination warehouse "
                    "and no supplier."
                )

        elif movement_type == "ADJUSTMENT":
            if supplier or direction not in ("IN", "OUT"):
                raise serializers.ValidationError(
                    "Adjustment requires IN or OUT direction "
                    "and no supplier."
                )

            if direction == "IN" and (not target or source):
                raise serializers.ValidationError(
                    "IN adjustment requires a destination warehouse."
                )

            if direction == "OUT" and (not source or target):
                raise serializers.ValidationError(
                    "OUT adjustment requires a source warehouse."
                )

            if direction == "OUT" and cost is not None:
                raise serializers.ValidationError(
                    "OUT adjustment cannot specify unit cost."
                )

        return attrs


# Temporary compatibility with the existing frontend.
# The legacy endpoint itself remains disabled.
class StockUpdateSerializer(serializers.Serializer):
    product = serializers.IntegerField(min_value=1)
    movement_type = serializers.ChoiceField(
        choices=["IN", "OUT"],
    )
    quantity = serializers.IntegerField(min_value=1)
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
