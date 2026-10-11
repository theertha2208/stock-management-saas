
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Company
from inventory.models import (
    Product,
    Warehouse,
    Supplier,
    StockLevel,
    StockMovement,
)


User = get_user_model()


class InventoryAPISecurityTests(APITestCase):

    def setUp(self):
        self.company_a = Company.objects.create(
            name="Company A",
            slug="company-a",
        )
        self.company_b = Company.objects.create(
            name="Company B",
            slug="company-b",
        )

        self.admin_a = User.objects.create_user(
            username="admin_a",
            email="admin_a@example.com",
            password="TestPassword123!",
            company=self.company_a,
            role="ADMIN",
        )
        self.manager_a = User.objects.create_user(
            username="manager_a",
            email="manager_a@example.com",
            password="TestPassword123!",
            company=self.company_a,
            role="MANAGER",
        )
        self.staff_a = User.objects.create_user(
            username="staff_a",
            email="staff_a@example.com",
            password="TestPassword123!",
            company=self.company_a,
            role="STAFF",
        )
        self.admin_b = User.objects.create_user(
            username="admin_b",
            email="admin_b@example.com",
            password="TestPassword123!",
            company=self.company_b,
            role="ADMIN",
        )

        self.product_a = Product.objects.create(
            company=self.company_a,
            name="Laptop A",
            sku="LAP-A",
            purchase_price=Decimal("100.00"),
            selling_price=Decimal("150.00"),
        )
        self.product_b = Product.objects.create(
            company=self.company_b,
            name="Laptop B",
            sku="LAP-B",
            purchase_price=Decimal("200.00"),
            selling_price=Decimal("250.00"),
        )

        self.warehouse_a = Warehouse.objects.create(
            company=self.company_a,
            name="Warehouse A",
            code="WA",
        )
        self.warehouse_b = Warehouse.objects.create(
            company=self.company_b,
            name="Warehouse B",
            code="WB",
        )

        self.supplier_a = Supplier.objects.create(
            company=self.company_a,
            name="Supplier A",
        )
        self.supplier_b = Supplier.objects.create(
            company=self.company_b,
            name="Supplier B",
        )

        self.stock_a = StockLevel.objects.create(
            company=self.company_a,
            product=self.product_a,
            warehouse=self.warehouse_a,
            quantity=10,
            average_unit_cost=Decimal("100.0000"),
        )
        self.stock_b = StockLevel.objects.create(
            company=self.company_b,
            product=self.product_b,
            warehouse=self.warehouse_b,
            quantity=20,
            average_unit_cost=Decimal("200.0000"),
        )

        self.products_url = "/api/v1/products/"
        self.warehouses_url = "/api/v1/warehouses/"
        self.stock_levels_url = "/api/v1/stock-levels/"
        self.movements_url = "/api/v1/stock-movements/"

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_unauthenticated_user_cannot_access_products(self):
        response = self.client.get(self.products_url)
        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )

    def test_company_a_cannot_list_company_b_products(self):
        self.authenticate(self.admin_a)

        response = self.client.get(self.products_url)

        self.assertEqual(response.status_code, 200)

        data = response.data
        results = data if isinstance(data, list) else data["results"]

        ids = [item["id"] for item in results]

        self.assertIn(self.product_a.id, ids)
        self.assertNotIn(self.product_b.id, ids)

    def test_company_a_cannot_retrieve_company_b_product(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            f"{self.products_url}{self.product_b.id}/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_company_a_cannot_update_company_b_product(self):
        self.authenticate(self.admin_a)

        response = self.client.patch(
            f"{self.products_url}{self.product_b.id}/",
            {"name": "Hacked Product"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)

        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.name, "Laptop B")

    def test_company_a_cannot_see_company_b_warehouses(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            f"{self.warehouses_url}{self.warehouse_b.id}/"
        )

        self.assertEqual(response.status_code, 404)

    def test_company_a_cannot_see_company_b_stock_levels(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            f"{self.stock_levels_url}{self.stock_b.id}/"
        )

        self.assertEqual(response.status_code, 404)

    def test_cross_tenant_movement_is_rejected(self):
        self.authenticate(self.admin_a)

        response = self.client.post(
            self.movements_url,
            {
                "product": self.product_b.id,
                "movement_type": "PURCHASE_IN",
                "quantity": 5,
                "to_warehouse": self.warehouse_a.id,
                "supplier": self.supplier_a.id,
                "unit_cost": "100.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(StockMovement.objects.count(), 0)

    def test_staff_cannot_create_product(self):
        self.authenticate(self.staff_a)

        response = self.client.post(
            self.products_url,
            {
                "name": "New Product",
                "sku": "NEW-001",
                "purchase_price": "100.00",
                "selling_price": "150.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_staff_cannot_create_warehouse(self):
        self.authenticate(self.staff_a)

        response = self.client.post(
            self.warehouses_url,
            {
                "name": "Unauthorized Warehouse",
                "code": "UW",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_manager_can_create_product(self):
        self.authenticate(self.manager_a)

        response = self.client.post(
            self.products_url,
            {
                "name": "Manager Product",
                "sku": "MAN-001",
                "purchase_price": "100.00",
                "selling_price": "150.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

    def test_staff_can_record_sale(self):
        self.authenticate(self.staff_a)

        response = self.client.post(
            self.movements_url,
            {
                "product": self.product_a.id,
                "movement_type": "SALE_OUT",
                "quantity": 2,
                "from_warehouse": self.warehouse_a.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        self.stock_a.refresh_from_db()
        self.assertEqual(self.stock_a.quantity, 8)

    def test_staff_cannot_transfer_stock(self):
        self.authenticate(self.staff_a)

        response = self.client.post(
            self.movements_url,
            {
                "product": self.product_a.id,
                "movement_type": "TRANSFER",
                "quantity": 2,
                "from_warehouse": self.warehouse_a.id,
                "to_warehouse": self.warehouse_a.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_manager_can_transfer_stock(self):
        self.authenticate(self.manager_a)

        second_warehouse = Warehouse.objects.create(
            company=self.company_a,
            name="Second Warehouse",
            code="SW",
        )

        response = self.client.post(
            self.movements_url,
            {
                "product": self.product_a.id,
                "movement_type": "TRANSFER",
                "quantity": 3,
                "from_warehouse": self.warehouse_a.id,
                "to_warehouse": second_warehouse.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        self.stock_a.refresh_from_db()
        self.assertEqual(self.stock_a.quantity, 7)

        destination = StockLevel.objects.get(
            company=self.company_a,
            product=self.product_a,
            warehouse=second_warehouse,
        )
        self.assertEqual(destination.quantity, 3)

    def test_staff_cannot_delete_product(self):
        self.authenticate(self.staff_a)

        response = self.client.delete(
            f"{self.products_url}{self.product_a.id}/"
        )

        self.assertEqual(response.status_code, 403)

    def test_manager_cannot_delete_product(self):
        self.authenticate(self.manager_a)

        response = self.client.delete(
            f"{self.products_url}{self.product_a.id}/"
        )

        self.assertEqual(response.status_code, 403)

    def test_admin_can_delete_product_without_history(self):
        self.authenticate(self.admin_a)

        new_product = Product.objects.create(
            company=self.company_a,
            name="Disposable Test Product",
            sku="DELETE-001",
        )

        response = self.client.delete(
            f"{self.products_url}{new_product.id}/"
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(
            Product.objects.filter(pk=new_product.pk).exists()
        )
