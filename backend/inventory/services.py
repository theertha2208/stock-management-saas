
"""Warehouse stock operations. Only this module should mutate StockLevel.

A Company row lock serializes movements within each tenant, including creation
of previously absent StockLevel rows. PostgreSQL is required for row locking.
"""

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction

from accounts.models import Company

from .models import Product, StockLevel, StockMovement, Supplier, Warehouse

COST_STEP = Decimal("0.0001")


def _cost(value, *, required=False):
    if value is None or value == "":
        if required:
            raise ValidationError("Unit cost is required.")
        return None

    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValidationError("Unit cost must be a valid number.") from exc

    if (
        not amount.is_finite()
        or amount < 0
        or amount > Decimal("999999999999.9999")
    ):
        raise ValidationError(
            "Unit cost must be finite, nonnegative, and within the allowed range."
        )

    return amount.quantize(COST_STEP, rounding=ROUND_HALF_UP)


def _level(company, product, warehouse):
    level, _ = StockLevel.objects.get_or_create(
        company=company,
        product=product,
        warehouse=warehouse,
        defaults={
            "quantity": 0,
            "average_unit_cost": Decimal(0),
        },
    )
    return level


def _warehouse(company, pk):
    warehouse = Warehouse.objects.filter(
        company=company,
        pk=pk,
        is_active=True,
    ).first()

    if warehouse is None:
        raise ValidationError(
            "Warehouse not found or inactive in your company."
        )

    return warehouse


def _apply(level, delta, *, company, incoming_cost=None):
    before = level.quantity
    after = before + delta

    if after < 0 and not company.allow_negative_stock:
        raise ValidationError(
            "Insufficient stock. Negative stock is not allowed."
        )

    if delta > 0 and incoming_cost is not None:
        # For a nonpositive starting balance, use the incoming
        # cost as the new basis.
        if before <= 0:
            level.average_unit_cost = incoming_cost
        else:
            level.average_unit_cost = (
                (
                    level.average_unit_cost * before
                    + incoming_cost * delta
                )
                / after
            ).quantize(COST_STEP, rounding=ROUND_HALF_UP)

    level.quantity = after
    level.save(
        update_fields=[
            "quantity",
            "average_unit_cost",
            "updated_at",
        ]
    )

    return before, after


@transaction.atomic
def record_stock_movement(
    *,
    company,
    product_id,
    movement_type,
    quantity,
    user,
    from_warehouse_id=None,
    to_warehouse_id=None,
    supplier_id=None,
    unit_cost=None,
    reference_number="",
    notes="",
    adjustment_direction=None,
):
    """
    Record a movement and update warehouse balances atomically.

    ADJUSTMENT requires adjustment_direction='IN' or 'OUT'.
    RETURN is an inbound customer return.
    PURCHASE_IN requires a supplier and unit cost.
    TRANSFER carries the source warehouse's average cost.
    """

    if (
        not isinstance(quantity, int)
        or isinstance(quantity, bool)
        or quantity <= 0
    ):
        raise ValidationError(
            "Quantity must be a positive whole number."
        )

    if (
        not user
        or not user.is_authenticated
        or not user.is_active
        or user.company_id != company.pk
    ):
        raise ValidationError(
            "Active company membership is required."
        )

    if user.role not in ("ADMIN", "MANAGER", "STAFF"):
        raise ValidationError("Invalid user role.")

    allowed = {
        "PURCHASE_IN",
        "SALE_OUT",
        "TRANSFER",
        "ADJUSTMENT",
        "RETURN",
    }

    if movement_type not in allowed:
        raise ValidationError("Invalid movement type.")

    if (
        user.role == "STAFF"
        and movement_type not in ("PURCHASE_IN", "SALE_OUT")
    ):
        raise ValidationError(
            "Staff may record purchase-in and sale-out movements only."
        )

    if (
        not isinstance(reference_number, str)
        or len(reference_number) > 100
    ):
        raise ValidationError(
            "Reference number must be at most 100 characters."
        )

    if not isinstance(notes, str):
        raise ValidationError("Notes must be text.")

    # Lock the company to serialize concurrent stock changes
    # within the same tenant.
    company = Company.objects.select_for_update().get(
        pk=company.pk
    )

    product = Product.objects.filter(
        company=company,
        pk=product_id,
        is_active=True,
    ).first()

    if product is None:
        raise ValidationError(
            "Active product not found in your company."
        )

    source = (
        _warehouse(company, from_warehouse_id)
        if from_warehouse_id is not None
        else None
    )

    target = (
        _warehouse(company, to_warehouse_id)
        if to_warehouse_id is not None
        else None
    )

    supplier = None

    if supplier_id is not None:
        supplier = Supplier.objects.filter(
            company=company,
            pk=supplier_id,
        ).first()

        if supplier is None:
            raise ValidationError(
                "Supplier not found in your company."
            )

    cost = _cost(
        unit_cost,
        required=movement_type == "PURCHASE_IN",
    )

    if movement_type == "TRANSFER":
        if (
            source is None
            or target is None
            or source.pk == target.pk
        ):
            raise ValidationError(
                "Transfer requires two different warehouses."
            )

        if supplier is not None or cost is not None:
            raise ValidationError(
                "Transfer cost and supplier are determined automatically."
            )

        src_level = _level(company, product, source)
        dst_level = _level(company, product, target)

        cost = src_level.average_unit_cost

        previous, new = _apply(
            src_level,
            -quantity,
            company=company,
        )

        _apply(
            dst_level,
            quantity,
            company=company,
            incoming_cost=cost,
        )

    else:
        if movement_type in ("PURCHASE_IN", "RETURN"):
            if target is None or source is not None:
                raise ValidationError(
                    "Incoming movement requires only a destination warehouse."
                )

            if (
                movement_type == "PURCHASE_IN"
                and supplier is None
            ):
                raise ValidationError(
                    "Purchase requires a supplier."
                )

            if (
                movement_type == "RETURN"
                and supplier is not None
            ):
                raise ValidationError(
                    "Customer returns cannot specify a supplier."
                )

            level = _level(company, product, target)

            if cost is None:
                cost = level.average_unit_cost

            previous, new = _apply(
                level,
                quantity,
                company=company,
                incoming_cost=cost,
            )

        elif movement_type == "SALE_OUT":
            if (
                source is None
                or target is not None
                or supplier is not None
                or cost is not None
            ):
                raise ValidationError(
                    "Sale requires only a source warehouse."
                )

            level = _level(company, product, source)
            cost = level.average_unit_cost

            previous, new = _apply(
                level,
                -quantity,
                company=company,
            )

        else:
            # ADJUSTMENT
            if (
                supplier is not None
                or adjustment_direction not in ("IN", "OUT")
            ):
                raise ValidationError(
                    "Adjustment requires direction IN or OUT and no supplier."
                )

            if adjustment_direction == "IN":
                if target is None or source is not None:
                    raise ValidationError(
                        "Positive adjustment requires only a destination warehouse."
                    )

                level = _level(company, product, target)

                if cost is None:
                    cost = level.average_unit_cost

                previous, new = _apply(
                    level,
                    quantity,
                    company=company,
                    incoming_cost=cost,
                )

            else:
                if (
                    source is None
                    or target is not None
                    or cost is not None
                ):
                    raise ValidationError(
                        "Negative adjustment requires only a source warehouse."
                    )

                level = _level(company, product, source)
                cost = level.average_unit_cost

                previous, new = _apply(
                    level,
                    -quantity,
                    company=company,
                )

        if (
            movement_type not in ("PURCHASE_IN", "ADJUSTMENT")
            and supplier is not None
        ):
            raise ValidationError(
                "Supplier is allowed only for purchases."
            )

    return StockMovement.objects.create(
        company=company,
        product=product,
        movement_type=movement_type,
        quantity=quantity,
        previous_stock=previous,
        new_stock=new,
        from_warehouse=source,
        to_warehouse=target,
        supplier=supplier,
        unit_cost=cost,
        reference_number=reference_number,
        notes=notes,
        created_by=user,
        is_legacy=False,
    )


def update_stock(*args, **kwargs):
    """
    Disable the old product-level stock endpoint
    until the warehouse API is connected.
    """
    raise ValidationError(
        "Legacy stock updates are disabled. "
        "Use the warehouse movement API after deployment."
    )
