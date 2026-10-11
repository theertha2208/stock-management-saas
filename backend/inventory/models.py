from django.conf import settings
from django.db import models
from django.db.models import Q

from accounts.models import Company


class Category(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["company", "name"], name="unique_category_per_company")]

    def __str__(self):
        return self.name


class Supplier(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="suppliers")
    name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Product(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="products")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products", null=True, blank=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, related_name="products", null=True, blank=True)
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    unit_of_measure = models.CharField(max_length=30, default="pcs")
    barcode = models.CharField(max_length=100, blank=True)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Legacy field: kept until the warehouse migration and API cutover are verified.
    stock_quantity = models.IntegerField(default=0)
    reorder_level = models.PositiveIntegerField(default=5)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["company", "sku"], name="unique_product_sku_per_company"),
            models.CheckConstraint(condition=Q(purchase_price__gte=0), name="product_purchase_price_nonnegative"),
            models.CheckConstraint(condition=Q(selling_price__gte=0), name="product_selling_price_nonnegative"),
        ]

    def __str__(self):
        return f"{self.name} ({self.sku})"


class Warehouse(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="warehouses")
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=40)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["company", "code"], name="unique_warehouse_code_per_company"),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class StockLevel(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="stock_levels")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="stock_levels")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="stock_levels")
    quantity = models.IntegerField(default=0)
    average_unit_cost = models.DecimalField(max_digits=16, decimal_places=4, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["product", "warehouse"], name="unique_product_warehouse_stock"),
            models.CheckConstraint(condition=Q(average_unit_cost__gte=0), name="stock_level_average_cost_nonnegative"),
        ]

    def __str__(self):
        return f"{self.product.sku} @ {self.warehouse.code}: {self.quantity}"


class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        IN = "IN", "Legacy Stock In"
        OUT = "OUT", "Legacy Stock Out"
        PURCHASE_IN = "PURCHASE_IN", "Purchase In"
        SALE_OUT = "SALE_OUT", "Sale Out"
        TRANSFER = "TRANSFER", "Transfer"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"
        RETURN = "RETURN", "Return"

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="stock_movements")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="stock_movements")
    movement_type = models.CharField(max_length=20, choices=MovementType.choices)
    quantity = models.PositiveIntegerField()
    previous_stock = models.IntegerField()
    new_stock = models.IntegerField()
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="stock_movements")
    created_at = models.DateTimeField(auto_now_add=True)
    from_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, null=True, blank=True, related_name="outgoing_movements")
    to_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, null=True, blank=True, related_name="incoming_movements")
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_movements")
    unit_cost = models.DecimalField(max_digits=16, decimal_places=4, null=True, blank=True)
    reference_number = models.CharField(max_length=100, blank=True)
    is_legacy = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(condition=Q(quantity__gt=0), name="stock_movement_quantity_positive"),
            models.CheckConstraint(condition=Q(unit_cost__gte=0) | Q(unit_cost__isnull=True), name="stock_movement_cost_nonnegative"),
        ]

    def __str__(self):
        return f"{self.product.name} - {self.movement_type} - {self.quantity}"
