from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    ProductViewSet,
    ReportViewSet,
    StockLevelViewSet,
    StockMovementViewSet,
    SupplierViewSet,
    WarehouseViewSet,
)

router = DefaultRouter()

router.register(
    "categories",
    CategoryViewSet,
    basename="category",
)

router.register(
    "suppliers",
    SupplierViewSet,
    basename="supplier",
)

router.register(
    "products",
    ProductViewSet,
    basename="product",
)

router.register(
    "warehouses",
    WarehouseViewSet,
    basename="warehouse",
)

router.register(
    "stock-levels",
    StockLevelViewSet,
    basename="stock-level",
)

router.register(
    "stock-movements",
    StockMovementViewSet,
    basename="stock-movement",
)

router.register(
    "reports",
    ReportViewSet,
    basename="reports",
)

urlpatterns = [
    path("", include(router.urls)),
]