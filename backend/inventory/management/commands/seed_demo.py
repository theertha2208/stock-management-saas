
import os
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import Company, User
from inventory.models import Category, Product, Supplier, Warehouse
from inventory.services import record_stock_movement


class Command(BaseCommand):
    help = "Create a demo company, users, products, and stock."

    def handle(self, *args, **options):
        password = os.environ.get("DEMO_PASSWORD")

        if not password:
            raise CommandError(
                "Set DEMO_PASSWORD before running seed_demo."
            )

        with transaction.atomic():
            company, _ = Company.objects.get_or_create(
                slug="demo-stock-company",
                defaults={
                    "name": "Demo Stock Company",
                    "allow_negative_stock": False,
                },
            )

            users = {}

            demo_accounts = [
                ("ADMIN", "demo_admin"),
                ("MANAGER", "demo_manager"),
                ("STAFF", "demo_staff"),
            ]

            for role, username in demo_accounts:
                email = f"{username}@seed-demo.example.com"

                existing_user = User.objects.filter(
                    username=username
                ).first()

                if existing_user is not None:
                    if (
                        existing_user.company_id != company.id
                        or existing_user.role != role
                        or existing_user.email != email
                    ):
                        raise CommandError(
                            f"Username '{username}' already exists "
                            "with different account details."
                        )

                    user = existing_user

                else:
                    if User.objects.filter(email=email).exists():
                        raise CommandError(
                            f"Email '{email}' is already in use."
                        )

                    user = User(
                        username=username,
                        email=email,
                        company=company,
                        role=role,
                        is_active=True,
                    )

                    user.set_password(password)
                    user.save()

                users[role] = user

            category, _ = Category.objects.get_or_create(
                company=company,
                name="Electronics",
            )

            supplier, _ = Supplier.objects.get_or_create(
                company=company,
                name="Demo Electronics Supplier",
                defaults={
                    "contact_person": "Demo Contact",
                    "email": "supplier@seed-demo.example.com",
                },
            )

            main_warehouse, _ = Warehouse.objects.get_or_create(
                company=company,
                code="MAIN",
                defaults={
                    "name": "Main Warehouse",
                },
            )

            second_warehouse, _ = Warehouse.objects.get_or_create(
                company=company,
                code="BRANCH",
                defaults={
                    "name": "Branch Warehouse",
                },
            )

            products = [
                {
                    "sku": "DEMO-LAPTOP-001",
                    "name": "Demo Laptop",
                    "purchase_price": Decimal("35000.00"),
                    "selling_price": Decimal("45000.00"),
                    "quantity": 12,
                },
                {
                    "sku": "DEMO-MOUSE-001",
                    "name": "Wireless Mouse",
                    "purchase_price": Decimal("400.00"),
                    "selling_price": Decimal("650.00"),
                    "quantity": 20,
                },
                {
                    "sku": "DEMO-KEYBOARD-001",
                    "name": "Mechanical Keyboard",
                    "purchase_price": Decimal("1200.00"),
                    "selling_price": Decimal("1800.00"),
                    "quantity": 3,
                },
            ]

            for item in products:
                product, _ = Product.objects.get_or_create(
                    company=company,
                    sku=item["sku"],
                    defaults={
                        "name": item["name"],
                        "category": category,
                        "supplier": supplier,
                        "purchase_price": item["purchase_price"],
                        "selling_price": item["selling_price"],
                        "reorder_level": 5,
                    },
                )

                reference = f"SEED-{item['sku']}"

                movement_exists = product.stock_movements.filter(
                    company=company,
                    reference_number=reference,
                ).exists()

                if not movement_exists:
                    record_stock_movement(
                        company=company,
                        product_id=product.id,
                        movement_type="PURCHASE_IN",
                        quantity=item["quantity"],
                        user=users["ADMIN"],
                        to_warehouse_id=main_warehouse.id,
                        supplier_id=supplier.id,
                        unit_cost=item["purchase_price"],
                        reference_number=reference,
                        notes="Initial demo inventory",
                    )

            self.stdout.write(
                self.style.SUCCESS(
                    "Demo data created successfully!"
                )
            )

            self.stdout.write(
                f"Company: {company.name}"
            )

            self.stdout.write(
                "Users: demo_admin, demo_manager, demo_staff"
            )

            self.stdout.write(
                "Warehouses: Main Warehouse, Branch Warehouse"
            )

            self.stdout.write(
                "Products: Demo Laptop, Wireless Mouse, "
                "Mechanical Keyboard"
            )

            self.stdout.write(
                "Password: the value provided through DEMO_PASSWORD"
            )
