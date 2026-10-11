
import os
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import Company, User
from inventory.models import Category, Product, Supplier, Warehouse
from inventory.services import record_stock_movement


class Command(BaseCommand):
    help = "Safely populate NovaTech Electronics with fictional demo data."

    def handle(self, *args, **options):
        password = os.environ.get("NOVATECH_DEMO_PASSWORD")

        if not password or len(password) < 12:
            raise CommandError(
                "Set NOVATECH_DEMO_PASSWORD to a strong password "
                "of at least 12 characters."
            )

        companies = Company.objects.filter(name="NovaTech Electronics")

        if companies.count() != 1:
            raise CommandError(
                "Expected exactly one existing NovaTech Electronics "
                "company. No changes were made."
            )

        company = companies.get()

        categories = [
            "Laptops",
            "Smartphones",
            "Accessories",
            "Printers",
        ]

        suppliers = [
            ("TechWorld Distributors", "Rajesh Kumar"),
            ("Digital Hub Wholesale", "Anjali Menon"),
            ("Prime Electronics Supply", "Vivek Nair"),
            ("NextGen Tech Traders", "Priya Sharma"),
            ("Smart Devices Distribution", "Arun Das"),
        ]

        accounts = [
            ("novatech_manager1", "Meera", "Menon", "MANAGER"),
            ("novatech_manager2", "Vivek", "Nair", "MANAGER"),
            ("novatech_staff1", "Rahul", "Kumar", "STAFF"),
            ("novatech_staff2", "Anjali", "Das", "STAFF"),
            ("novatech_staff3", "Nikhil", "Raj", "STAFF"),
        ]

        # SKU, name, category, supplier index, purchase,
        # selling, opening quantity, reorder level
        products = [
            ("NT-LAP-001", "HP 15 Laptop", "Laptops", 0, "38000", "43500", 12, 5),
            ("NT-LAP-002", "Dell Inspiron Laptop", "Laptops", 0, "42000", "48500", 8, 5),
            ("NT-LAP-003", "Lenovo IdeaPad", "Laptops", 1, "35000", "39999", 10, 5),
            ("NT-LAP-004", "ASUS VivoBook", "Laptops", 1, "44000", "51000", 6, 5),
            ("NT-MOB-001", "Samsung Galaxy A Series", "Smartphones", 2, "14500", "17999", 20, 5),
            ("NT-MOB-002", "Redmi Note Series", "Smartphones", 2, "12500", "15999", 18, 5),
            ("NT-MOB-003", "Motorola G Series", "Smartphones", 4, "13000", "16999", 9, 5),
            ("NT-MOB-004", "OnePlus Nord Series", "Smartphones", 4, "23000", "27999", 7, 5),
            ("NT-ACC-001", "Logitech Wireless Mouse", "Accessories", 3, "450", "799", 30, 10),
            ("NT-ACC-002", "Mechanical Keyboard", "Accessories", 3, "1200", "1999", 4, 5),
            ("NT-ACC-003", "USB-C Charging Cable", "Accessories", 3, "150", "349", 40, 10),
            ("NT-ACC-004", "Bluetooth Headphones", "Accessories", 4, "950", "1599", 15, 5),
            ("NT-PRN-001", "HP Ink Tank Printer", "Printers", 0, "11500", "13999", 5, 3),
            ("NT-PRN-002", "Canon PIXMA Printer", "Printers", 1, "8500", "10999", 3, 5),
            ("NT-PRN-003", "Epson EcoTank Printer", "Printers", 2, "14500", "17999", 6, 3),
        ]

        with transaction.atomic():
            # Lock the target company during seeding.
            company = Company.objects.select_for_update().get(pk=company.pk)

            admin = User.objects.filter(
                company=company,
                role=User.Role.ADMIN,
                is_active=True,
            ).order_by("pk").first()

            if admin is None:
                raise CommandError("No active NovaTech administrator found.")

            # Preflight account collisions before writing data.
            for username, first, last, role in accounts:
                email = f"{username}@example.com"

                username_owner = User.objects.filter(
                    username=username
                ).first()

                email_owner = User.objects.filter(
                    email=email
                ).first()

                if username_owner is not None:
                    if (
                        username_owner.company_id != company.pk
                        or username_owner.role != role
                        or username_owner.email != email
                    ):
                        raise CommandError(
                            f"Username collision: {username}"
                        )

                if email_owner is not None and (
                    username_owner is None
                    or email_owner.pk != username_owner.pk
                ):
                    raise CommandError(
                        f"Email collision: {email}"
                    )

            for username, first, last, role in accounts:
                if not User.objects.filter(username=username).exists():
                    user = User(
                        username=username,
                        first_name=first,
                        last_name=last,
                        email=f"{username}@example.com",
                        company=company,
                        role=role,
                        is_active=True,
                    )
                    user.set_password(password)
                    user.save()

            category_map = {}

            for name in categories:
                category, _ = Category.objects.get_or_create(
                    company=company,
                    name=name,
                )
                category_map[name] = category

            supplier_list = []

            for name, contact in suppliers:
                supplier, _ = Supplier.objects.get_or_create(
                    company=company,
                    name=name,
                    defaults={
                        "contact_person": contact,
                        "email": "",
                        "address": "Kerala, India (fictional demo supplier)",
                    },
                )
                supplier_list.append(supplier)

            warehouse, _ = Warehouse.objects.get_or_create(
                company=company,
                code="NT-MAIN",
                defaults={
                    "name": "NovaTech Main Warehouse",
                    "address": "Kerala, India (demo location)",
                },
            )

            if not warehouse.is_active:
                raise CommandError("NovaTech demo warehouse is inactive.")

            for (
                sku, name, category_name, supplier_index,
                purchase, selling, quantity, reorder
            ) in products:

                supplier = supplier_list[supplier_index]

                product, created = Product.objects.get_or_create(
                    company=company,
                    sku=sku,
                    defaults={
                        "name": name,
                        "category": category_map[category_name],
                        "supplier": supplier,
                        "purchase_price": Decimal(purchase),
                        "selling_price": Decimal(selling),
                        "reorder_level": reorder,
                        "stock_quantity": 0,
                        "is_active": True,
                    },
                )

                if not product.is_active:
                    raise CommandError(
                        f"Existing product {sku} is inactive."
                    )

                reference = f"NT-SEED-{sku}"

                movement_exists = product.stock_movements.filter(
                    company=company,
                    reference_number=reference,
                ).exists()

                if not movement_exists:
                    # Avoid adding demo stock to an existing
                    # product with a different inventory history.
                    if not created and product.stock_movements.exists():
                        self.stdout.write(
                            f"Skipping opening stock for existing product: {sku}"
                        )
                        continue

                    record_stock_movement(
                        company=company,
                        product_id=product.pk,
                        movement_type="PURCHASE_IN",
                        quantity=quantity,
                        user=admin,
                        to_warehouse_id=warehouse.pk,
                        supplier_id=supplier.pk,
                        unit_cost=Decimal(purchase),
                        reference_number=reference,
                        notes="Fictional opening inventory for evaluation",
                    )

        self.stdout.write(
            self.style.SUCCESS(
                "NovaTech demo data created successfully."
            )
        )
        self.stdout.write("Company: NovaTech Electronics")
        self.stdout.write("Categories: 4 | Suppliers: 5 | Products: 15")
        self.stdout.write("Managers: 2 | Staff: 3 | Warehouses: 1")
        self.stdout.write(
            "Demo account usernames: novatech_manager1, "
            "novatech_manager2, novatech_staff1, "
            "novatech_staff2, novatech_staff3"
        )
        self.stdout.write(
            "Existing demo users and their passwords were not changed."
        )
