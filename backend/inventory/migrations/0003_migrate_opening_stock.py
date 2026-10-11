
from django.db import migrations


def migrate_opening_stock(apps, schema_editor):
    Company = apps.get_model("accounts", "Company")
    Product = apps.get_model("inventory", "Product")
    Warehouse = apps.get_model("inventory", "Warehouse")
    StockLevel = apps.get_model("inventory", "StockLevel")
    StockMovement = apps.get_model("inventory", "StockMovement")

    db = schema_editor.connection.alias

    for company in Company.objects.using(db).all():
        warehouse, _ = Warehouse.objects.using(db).get_or_create(
            company_id=company.pk,
            code="DEFAULT",
            defaults={
                "name": "Main Warehouse",
                "address": "",
                "is_active": True,
            },
        )

        products = Product.objects.using(db).filter(
            company_id=company.pk
        )

        for product in products:
            if StockLevel.objects.using(db).filter(
                product_id=product.pk
            ).exists():
                raise RuntimeError(
                    f"Existing warehouse stock found for product "
                    f"{product.sku}. Migration stopped to prevent "
                    f"duplicate opening balances."
                )

            StockLevel.objects.using(db).create(
                company_id=company.pk,
                product_id=product.pk,
                warehouse_id=warehouse.pk,
                quantity=product.stock_quantity,
                average_unit_cost=product.purchase_price,
            )

    # Preserve historical movements, but distinguish them
    # from the new warehouse-based ledger.
    StockMovement.objects.using(db).filter(
        movement_type__in=["IN", "OUT"]
    ).update(is_legacy=True)


class Migration(migrations.Migration):
    atomic = True

    dependencies = [
        (
            "inventory",
            "0002_product_barcode_product_unit_of_measure_and_more",
        ),
    ]

    operations = [
        migrations.RunPython(
            migrate_opening_stock,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
