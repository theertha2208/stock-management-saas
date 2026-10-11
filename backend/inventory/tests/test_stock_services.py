
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from accounts.models import Company
from inventory.models import (
    Product,
    Supplier,
    Warehouse,
    StockLevel,
    StockMovement,
)
from inventory.services import record_stock_movement


User = get_user_model()


class StockServiceTests(TestCase):

    def setUp(self):
        self.company = Company.objects.create(
            name="Test Company",
            slug="test-company",
            allow_negative_stock=False,
        )

        self.other_company = Company.objects.create(
            name="Other Company",
            slug="other-company",
        )

        self.admin = User.objects.create_user(
            username="test_admin",
            email="test_admin@example.com",
            password="TestPassword123!",
            company=self.company,
            role="ADMIN",
        )

        self.staff = User.objects.create_user(
            username="test_staff",
            email="test_staff@example.com",
            password="TestPassword123!",
            company=self.company,
            role="STAFF",
        )

        self.product = Product.objects.create(
            company=self.company,
            name="Test Laptop",
            sku="LAPTOP-001",
            purchase_price=Decimal("100.00"),
            selling_price=Decimal("150.00"),
        )

        self.warehouse_a = Warehouse.objects.create(
            company=self.company,
            name="Warehouse A",
            code="WA",
        )

        self.warehouse_b = Warehouse.objects.create(
            company=self.company,
            name="Warehouse B",
            code="WB",
        )

        self.supplier = Supplier.objects.create(
            company=self.company,
            name="Test Supplier",
        )

    def purchase(self, quantity=10, unit_cost="100.00"):
        return record_stock_movement(
            company=self.company,
            product_id=self.product.pk,
            movement_type="PURCHASE_IN",
            quantity=quantity,
            user=self.admin,
            to_warehouse_id=self.warehouse_a.pk,
            supplier_id=self.supplier.pk,
            unit_cost=unit_cost,
        )

    def get_quantity(self, warehouse):
        return StockLevel.objects.get(
            company=self.company,
            product=self.product,
            warehouse=warehouse,
        ).quantity

    def test_purchase_creates_stock_and_movement(self):
        movement = self.purchase()

        self.assertEqual(
            self.get_quantity(self.warehouse_a), 10
        )
        self.assertEqual(
            movement.movement_type, "PURCHASE_IN"
        )
        self.assertEqual(movement.created_by, self.admin)

    def test_negative_stock_is_rejected(self):
        self.purchase(quantity=5)

        with self.assertRaises(ValidationError):
            record_stock_movement(
                company=self.company,
                product_id=self.product.pk,
                movement_type="SALE_OUT",
                quantity=10,
                user=self.admin,
                from_warehouse_id=self.warehouse_a.pk,
            )

        self.assertEqual(
            self.get_quantity(self.warehouse_a), 5
        )
        self.assertEqual(
            StockMovement.objects.count(), 1
        )

    def test_successful_transfer(self):
        self.purchase(quantity=10)

        movement = record_stock_movement(
            company=self.company,
            product_id=self.product.pk,
            movement_type="TRANSFER",
            quantity=4,
            user=self.admin,
            from_warehouse_id=self.warehouse_a.pk,
            to_warehouse_id=self.warehouse_b.pk,
        )

        self.assertEqual(
            self.get_quantity(self.warehouse_a), 6
        )
        self.assertEqual(
            self.get_quantity(self.warehouse_b), 4
        )
        self.assertEqual(movement.from_warehouse, self.warehouse_a)
        self.assertEqual(movement.to_warehouse, self.warehouse_b)

    def test_failed_transfer_does_not_change_stock(self):
        self.purchase(quantity=5)

        initial_movements = StockMovement.objects.count()

        with self.assertRaises(ValidationError):
            record_stock_movement(
                company=self.company,
                product_id=self.product.pk,
                movement_type="TRANSFER",
                quantity=10,
                user=self.admin,
                from_warehouse_id=self.warehouse_a.pk,
                to_warehouse_id=self.warehouse_b.pk,
            )

        self.assertEqual(
            self.get_quantity(self.warehouse_a), 5
        )
        self.assertFalse(
            StockLevel.objects.filter(
                company=self.company,
                product=self.product,
                warehouse=self.warehouse_b,
            ).exists()
        )
        self.assertEqual(
            StockMovement.objects.count(),
            initial_movements,
        )

    def test_weighted_average_cost(self):
        self.purchase(quantity=10, unit_cost="100.00")
        self.purchase(quantity=10, unit_cost="200.00")

        level = StockLevel.objects.get(
            company=self.company,
            product=self.product,
            warehouse=self.warehouse_a,
        )

        self.assertEqual(level.quantity, 20)
        self.assertEqual(
            level.average_unit_cost,
            Decimal("150.0000"),
        )

    def test_transfer_preserves_cost(self):
        self.purchase(quantity=10, unit_cost="120.00")

        record_stock_movement(
            company=self.company,
            product_id=self.product.pk,
            movement_type="TRANSFER",
            quantity=4,
            user=self.admin,
            from_warehouse_id=self.warehouse_a.pk,
            to_warehouse_id=self.warehouse_b.pk,
        )

        destination = StockLevel.objects.get(
            company=self.company,
            product=self.product,
            warehouse=self.warehouse_b,
        )

        self.assertEqual(
            destination.average_unit_cost,
            Decimal("120.0000"),
        )

    def test_cross_tenant_product_is_rejected(self):
        other_product = Product.objects.create(
            company=self.other_company,
            name="Other Product",
            sku="OTHER-001",
        )

        with self.assertRaises(ValidationError):
            record_stock_movement(
                company=self.company,
                product_id=other_product.pk,
                movement_type="PURCHASE_IN",
                quantity=5,
                user=self.admin,
                to_warehouse_id=self.warehouse_a.pk,
                supplier_id=self.supplier.pk,
                unit_cost="50.00",
            )

        self.assertEqual(
            StockMovement.objects.count(), 0
        )

    def test_cross_tenant_warehouse_is_rejected(self):
        other_warehouse = Warehouse.objects.create(
            company=self.other_company,
            name="Other Warehouse",
            code="OW",
        )

        with self.assertRaises(ValidationError):
            record_stock_movement(
                company=self.company,
                product_id=self.product.pk,
                movement_type="PURCHASE_IN",
                quantity=5,
                user=self.admin,
                to_warehouse_id=other_warehouse.pk,
                supplier_id=self.supplier.pk,
                unit_cost="50.00",
            )

    def test_staff_can_record_purchase(self):
        movement = record_stock_movement(
            company=self.company,
            product_id=self.product.pk,
            movement_type="PURCHASE_IN",
            quantity=3,
            user=self.staff,
            to_warehouse_id=self.warehouse_a.pk,
            supplier_id=self.supplier.pk,
            unit_cost="100.00",
        )

        self.assertEqual(movement.created_by, self.staff)

    def test_staff_cannot_transfer(self):
        self.purchase(quantity=10)

        with self.assertRaises(ValidationError):
            record_stock_movement(
                company=self.company,
                product_id=self.product.pk,
                movement_type="TRANSFER",
                quantity=2,
                user=self.staff,
                from_warehouse_id=self.warehouse_a.pk,
                to_warehouse_id=self.warehouse_b.pk,
            )

    def test_invalid_quantity_is_rejected(self):
        with self.assertRaises(ValidationError):
            self.purchase(quantity=0)

        with self.assertRaises(ValidationError):
            self.purchase(quantity=-5)

    def test_warehouse_stock_is_independent(self):
        self.purchase(quantity=10)

        record_stock_movement(
            company=self.company,
            product_id=self.product.pk,
            movement_type="PURCHASE_IN",
            quantity=3,
            user=self.admin,
            to_warehouse_id=self.warehouse_b.pk,
            supplier_id=self.supplier.pk,
            unit_cost="200.00",
        )

        self.assertEqual(
            self.get_quantity(self.warehouse_a), 10
        )
        self.assertEqual(
            self.get_quantity(self.warehouse_b), 3
        )
