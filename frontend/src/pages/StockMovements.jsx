
import { useCallback, useEffect, useMemo, useState } from "react"
import api from "../api/axios"
import { useAuth } from "../context/AuthContext"

const initialForm = {
  product: "",
  movement_type: "PURCHASE_IN",
  quantity: 1,
  from_warehouse: "",
  to_warehouse: "",
  supplier: "",
  unit_cost: "",
  adjustment_direction: "IN",
  reference_number: "",
  notes: "",
}

const movementLabels = {
  PURCHASE_IN: "Purchase In",
  SALE_OUT: "Sale Out",
  TRANSFER: "Warehouse Transfer",
  ADJUSTMENT: "Stock Adjustment",
  RETURN: "Customer Return",
  IN: "Legacy Stock In",
  OUT: "Legacy Stock Out",
}

const movementColors = {
  PURCHASE_IN: "bg-emerald-50 text-emerald-700",
  SALE_OUT: "bg-rose-50 text-rose-700",
  TRANSFER: "bg-blue-50 text-blue-700",
  ADJUSTMENT: "bg-amber-50 text-amber-700",
  RETURN: "bg-purple-50 text-purple-700",
  IN: "bg-slate-100 text-slate-700",
  OUT: "bg-slate-100 text-slate-700",
}

function getErrorMessage(error) {
  const data = error.response?.data

  if (error.response?.status === 401) {
    return "Your session has expired. Please log in again."
  }

  if (typeof data?.detail === "string") {
    return data.detail
  }

  if (Array.isArray(data?.detail)) {
    return data.detail.join(", ")
  }

  if (data && typeof data === "object") {
    return Object.entries(data)
      .map(([key, value]) => {
        const message = Array.isArray(value)
          ? value.join(", ")
          : String(value)
        return `${key}: ${message}`
      })
      .join(" | ")
  }

  return "Something went wrong. Please try again."
}

async function fetchAllPages(endpoint) {
  const results = []
  let next = endpoint

  while (next) {
    const response = await api.get(next)
    const data = response.data

    if (Array.isArray(data)) {
      results.push(...data)
      break
    }

    results.push(...(data.results || []))
    next = data.next
  }

  return results
}

function formatDate(value) {
  if (!value) return "—"

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
}

function StockMovements() {
  const { user } = useAuth()

  const isStaff = user?.role === "STAFF"

  const movementTypes = isStaff
    ? ["PURCHASE_IN", "SALE_OUT"]
    : [
        "PURCHASE_IN",
        "SALE_OUT",
        "TRANSFER",
        "ADJUSTMENT",
        "RETURN",
      ]

  const [products, setProducts] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [stockLevels, setStockLevels] = useState([])
  const [movements, setMovements] = useState([])

  const [form, setForm] = useState(initialForm)
  const [showForm, setShowForm] = useState(false)

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const [
        productData,
        warehouseData,
        supplierData,
        stockData,
        movementData,
      ] = await Promise.all([
        fetchAllPages("products/"),
        fetchAllPages("warehouses/"),
        fetchAllPages("suppliers/"),
        fetchAllPages("stock-levels/"),
        fetchAllPages("stock-movements/"),
      ])

      setProducts(productData)
      setWarehouses(warehouseData)
      setSuppliers(supplierData)
      setStockLevels(stockData)
      setMovements(movementData)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const activeProducts = useMemo(
    () => products.filter((product) => product.is_active),
    [products]
  )

  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.is_active),
    [warehouses]
  )

  const filteredMovements = useMemo(() => {
    const term = search.trim().toLowerCase()

    return movements.filter((movement) => {
      const text = [
        movement.product_name,
        movement.movement_type,
        movement.reference_number,
        movement.created_by_username,
        movement.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      if (term && !text.includes(term)) return false

      if (typeFilter && movement.movement_type !== typeFilter) {
        return false
      }

      const movementDate = movement.created_at?.slice(0, 10)

      if (dateFrom && movementDate < dateFrom) return false
      if (dateTo && movementDate > dateTo) return false

      return true
    })
  }, [movements, search, typeFilter, dateFrom, dateTo])

  const selectedProduct = products.find(
    (product) => String(product.id) === String(form.product)
  )

  const selectedWarehouseId =
    form.movement_type === "PURCHASE_IN" ||
    form.movement_type === "RETURN" ||
    (
      form.movement_type === "ADJUSTMENT" &&
      form.adjustment_direction === "IN"
    )
      ? form.to_warehouse
      : form.from_warehouse

  const selectedStock = stockLevels.find(
    (stock) =>
      String(stock.product) === String(form.product) &&
      String(stock.warehouse) === String(selectedWarehouseId)
  )

  function updateField(name, value) {
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  function changeMovementType(type) {
    setForm({
      ...initialForm,
      movement_type: type,
    })
    setError("")
    setSuccess("")
  }

  function openForm() {
    setForm({
      ...initialForm,
      movement_type: movementTypes[0],
    })
    setError("")
    setSuccess("")
    setShowForm(true)
  }

  function buildPayload() {
    const payload = {
      product: Number(form.product),
      movement_type: form.movement_type,
      quantity: Number(form.quantity),
      reference_number: form.reference_number.trim(),
      notes: form.notes.trim(),
    }

    if (form.movement_type === "PURCHASE_IN") {
      payload.to_warehouse = Number(form.to_warehouse)
      payload.supplier = Number(form.supplier)
      payload.unit_cost = form.unit_cost
    }

    if (form.movement_type === "SALE_OUT") {
      payload.from_warehouse = Number(form.from_warehouse)
    }

    if (form.movement_type === "TRANSFER") {
      payload.from_warehouse = Number(form.from_warehouse)
      payload.to_warehouse = Number(form.to_warehouse)
    }

    if (form.movement_type === "RETURN") {
      payload.to_warehouse = Number(form.to_warehouse)

      if (form.unit_cost !== "") {
        payload.unit_cost = form.unit_cost
      }
    }

    if (form.movement_type === "ADJUSTMENT") {
      payload.adjustment_direction = form.adjustment_direction

      if (form.adjustment_direction === "IN") {
        payload.to_warehouse = Number(form.to_warehouse)

        if (form.unit_cost !== "") {
          payload.unit_cost = form.unit_cost
        }
      } else {
        payload.from_warehouse = Number(form.from_warehouse)
      }
    }

    return payload
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setSuccess("")

    if (!form.product) {
      setError("Please select a product.")
      return
    }

    if (!Number.isInteger(Number(form.quantity)) ||
        Number(form.quantity) <= 0) {
      setError("Quantity must be a positive whole number.")
      return
    }

    if (
      form.movement_type === "TRANSFER" &&
      form.from_warehouse === form.to_warehouse
    ) {
      setError("Source and destination warehouses must be different.")
      return
    }

    setSaving(true)

    try {
      await api.post("stock-movements/", buildPayload())

      setShowForm(false)
      setForm(initialForm)
      await loadData()
      setSuccess("Stock movement recorded successfully.")
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const needsSource =
    form.movement_type === "SALE_OUT" ||
    form.movement_type === "TRANSFER" ||
    (
      form.movement_type === "ADJUSTMENT" &&
      form.adjustment_direction === "OUT"
    )

  const needsDestination =
    form.movement_type === "PURCHASE_IN" ||
    form.movement_type === "TRANSFER" ||
    form.movement_type === "RETURN" ||
    (
      form.movement_type === "ADJUSTMENT" &&
      form.adjustment_direction === "IN"
    )

  const needsUnitCost =
    form.movement_type === "PURCHASE_IN" ||
    form.movement_type === "RETURN" ||
    (
      form.movement_type === "ADJUSTMENT" &&
      form.adjustment_direction === "IN"
    )

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Stock Movements
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Record and track stock changes across warehouses.
          </p>
        </div>

        <button
          onClick={() => {
            if (showForm) {
              setShowForm(false)
            } else {
              openForm()
            }
          }}
          className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {showForm ? "Close Form" : "+ Record Movement"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl bg-white p-5 shadow-sm md:p-6"
        >
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Record Stock Movement
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Each successful operation is recorded in the inventory ledger.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>Movement Type *</span>
              <select
                className={inputClass}
                value={form.movement_type}
                onChange={(event) =>
                  changeMovementType(event.target.value)
                }
              >
                {movementTypes.map((type) => (
                  <option key={type} value={type}>
                    {movementLabels[type]}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>Product *</span>
              <select
                required
                className={inputClass}
                value={form.product}
                onChange={(event) =>
                  updateField("product", event.target.value)
                }
              >
                <option value="">Select product</option>
                {activeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>Quantity *</span>
              <input
                required
                type="number"
                min="1"
                step="1"
                className={inputClass}
                value={form.quantity}
                onChange={(event) =>
                  updateField("quantity", event.target.value)
                }
              />
            </label>

            {form.movement_type === "ADJUSTMENT" && (
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Adjustment Direction *</span>
                <select
                  className={inputClass}
                  value={form.adjustment_direction}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      adjustment_direction: event.target.value,
                      from_warehouse: "",
                      to_warehouse: "",
                      unit_cost: "",
                    }))
                  }
                >
                  <option value="IN">Increase Stock</option>
                  <option value="OUT">Decrease Stock</option>
                </select>
              </label>
            )}

            {needsSource && (
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Source Warehouse *</span>
                <select
                  required
                  className={inputClass}
                  value={form.from_warehouse}
                  onChange={(event) =>
                    updateField(
                      "from_warehouse",
                      event.target.value
                    )
                  }
                >
                  <option value="">Select source warehouse</option>
                  {activeWarehouses.map((warehouse) => (
                    <option
                      key={warehouse.id}
                      value={warehouse.id}
                    >
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {needsDestination && (
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Destination Warehouse *</span>
                <select
                  required
                  className={inputClass}
                  value={form.to_warehouse}
                  onChange={(event) =>
                    updateField("to_warehouse", event.target.value)
                  }
                >
                  <option value="">Select destination warehouse</option>
                  {activeWarehouses.map((warehouse) => (
                    <option
                      key={warehouse.id}
                      value={warehouse.id}
                    >
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {form.movement_type === "PURCHASE_IN" && (
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Supplier *</span>
                <select
                  required
                  className={inputClass}
                  value={form.supplier}
                  onChange={(event) =>
                    updateField("supplier", event.target.value)
                  }
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option
                      key={supplier.id}
                      value={supplier.id}
                    >
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {needsUnitCost && (
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>
                  Unit Cost
                  {form.movement_type === "PURCHASE_IN"
                    ? " *"
                    : " (optional)"}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  required={form.movement_type === "PURCHASE_IN"}
                  placeholder="Enter cost per unit"
                  className={inputClass}
                  value={form.unit_cost}
                  onChange={(event) =>
                    updateField("unit_cost", event.target.value)
                  }
                />
              </label>
            )}

            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>Reference Number</span>
              <input
                maxLength={100}
                placeholder="PO-001 / INV-001"
                className={inputClass}
                value={form.reference_number}
                onChange={(event) =>
                  updateField(
                    "reference_number",
                    event.target.value
                  )
                }
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
              <span>Notes</span>
              <textarea
                rows={3}
                placeholder="Reason or additional information"
                className={inputClass}
                value={form.notes}
                onChange={(event) =>
                  updateField("notes", event.target.value)
                }
              />
            </label>
          </div>

          {selectedProduct && selectedWarehouseId && (
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
              Current stock in selected warehouse:{" "}
              <strong>{selectedStock?.quantity ?? 0} units</strong>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || loading}
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Recording..." : "Record Movement"}
            </button>

            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900">
            Movement History
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            A read-only record of inventory transactions.
          </p>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-4">
          <input
            type="search"
            placeholder="Search movements..."
            className={inputClass}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            className={inputClass}
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value)
            }
          >
            <option value="">All movement types</option>
            {Object.entries(movementLabels).map(
              ([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              )
            )}
          </select>

          <input
            type="date"
            aria-label="From date"
            className={inputClass}
            value={dateFrom}
            onChange={(event) =>
              setDateFrom(event.target.value)
            }
          />

          <input
            type="date"
            aria-label="To date"
            className={inputClass}
            value={dateTo}
            onChange={(event) =>
              setDateTo(event.target.value)
            }
          />
        </div>

        {loading ? (
          <p className="p-8 text-center text-slate-500">
            Loading stock movements...
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">Movement</th>
                  <th className="px-5 py-4">Quantity</th>
                  <th className="px-5 py-4">From</th>
                  <th className="px-5 py-4">To</th>
                  <th className="px-5 py-4">Previous</th>
                  <th className="px-5 py-4">New</th>
                  <th className="px-5 py-4">Recorded By</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Reference</th>
                </tr>
              </thead>

              <tbody>
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-5 py-12 text-center text-slate-500"
                    >
                      No movements found.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((movement) => (
                    <tr
                      key={movement.id}
                      className="border-t border-slate-100"
                    >
                      <td className="px-5 py-4 font-medium text-slate-900">
                        {movement.product_name ||
                          `Product #${movement.product}`}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            movementColors[
                              movement.movement_type
                            ] || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {movementLabels[
                            movement.movement_type
                          ] || movement.movement_type}
                        </span>

                        {movement.is_legacy && (
                          <span className="ml-2 text-xs text-slate-400">
                            Legacy
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {movement.quantity}
                      </td>

                      <td className="px-5 py-4">
                        {movement.from_warehouse_name || "—"}
                      </td>

                      <td className="px-5 py-4">
                        {movement.to_warehouse_name || "—"}
                      </td>

                      <td className="px-5 py-4">
                        {movement.previous_stock}
                      </td>

                      <td className="px-5 py-4">
                        {movement.new_stock}
                      </td>

                      <td className="px-5 py-4">
                        {movement.created_by_username || "—"}
                      </td>

                      <td className="px-5 py-4">
                        {formatDate(movement.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        {movement.reference_number || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default StockMovements
