
from django.contrib import admin
from .models import Category, Supplier, Product, StockMovement


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "company",
        "created_at",
    )

    search_fields = ("name",)

    list_filter = ("company",)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "company",
        "phone",
        "email",
    )

    search_fields = ("name", "phone", "email")

    list_filter = ("company",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "sku",
        "company",
        "category",
        "selling_price",
        "stock_quantity",
        "is_active",
    )

    search_fields = ("name", "sku")

    list_filter = (
        "company",
        "category",
        "is_active",
    )


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "product",
        "company",
        "movement_type",
        "quantity",
        "previous_stock",
        "new_stock",
        "created_by",
        "created_at",
    )

    search_fields = ("product__name", "product__sku")

    list_filter = ("company", "movement_type")
