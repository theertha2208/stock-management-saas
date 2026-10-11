
import { useEffect, useState } from "react"
import api from "../api/axios"

function StockUpdateForm({ products, onSuccess, onCancel }) {
  const [productId, setProductId] = useState("")
  const [movementType, setMovementType] = useState("PURCHASE_IN")
  const [warehouseId, setWarehouseId] = useState("")
  const [supplierId, setSupplierId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [notes, setNotes] = useState("")

  const [warehouses, setWarehouses] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const selectedProduct = products.find(
    (product) => String(product.id) === productId
  )

  const isPurchase = movementType === "PURCHASE_IN"

  useEffect(() => {
    let active = true

    const fetchAllPages = async (endpoint) => {
      const records = []
      let nextUrl = endpoint

      while (nextUrl) {
        const response = await api.get(nextUrl)
        const data = response.data

        if (Array.isArray(data)) {
          records.push(...data)
          break
        }

        if (!Array.isArray(data?.results)) {
          throw new Error("Unexpected API response.")
        }

        records.push(...data.results)
        nextUrl = data.next || null
      }

      return records
    }

    const loadOptions = async () => {
      setLoadingData(true)
      setError("")

      try {
        const [warehouseData, supplierData] =
          await Promise.all([
            fetchAllPages("warehouses/"),
            fetchAllPages("suppliers/"),
          ])

        if (!active) return

        setWarehouses(
          warehouseData.filter((warehouse) => warehouse.is_active)
        )
        setSuppliers(supplierData)
      } catch {
        if (active) {
          setError(
            "Unable to load warehouses or suppliers. Please refresh."
          )
        }
      } finally {
        if (active) setLoadingData(false)
      }
    }

    loadOptions()

    return () => {
      active = false
    }
  }, [])

  const handleProductChange = (event) => {
    const id = event.target.value
    const product = products.find(
      (item) => String(item.id) === id
    )

    setProductId(id)
    setSupplierId(
      product?.supplier != null
        ? String(product.supplier)
        : ""
    )
    setUnitCost(
      product?.purchase_price != null
        ? String(product.purchase_price)
        : ""
    )
    setError("")
  }

  const getErrorMessage = (err) => {
    const status = err.response?.status
    const details = err.response?.data

    if (status === 401) {
      return "Your session has expired. Please log in again."
    }

    if (status === 403) {
      return "You do not have permission to record this stock movement."
    }

    if (status === 404) {
      return "Stock movement API not found. Check the API configuration."
    }

    if (details?.detail) {
      return Array.isArray(details.detail)
        ? details.detail.join(", ")
        : String(details.detail)
    }

    if (typeof details === "string") {
      return details
    }

    if (details && typeof details === "object") {
      return Object.entries(details)
        .map(([field, messages]) => {
          const message = Array.isArray(messages)
            ? messages.join(", ")
            : String(messages)

          return `${field}: ${message}`
        })
        .join(" | ")
    }

    return "Unable to update stock. Please try again."
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")

    const amount = Number(quantity)

    if (!productId) {
      setError("Please select a product.")
      return
    }

    if (!warehouseId) {
      setError("Please select a warehouse.")
      return
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Quantity must be a positive whole number.")
      return
    }

    if (isPurchase && !supplierId) {
      setError("Please select a supplier.")
      return
    }

    if (
      isPurchase &&
      (unitCost.trim() === "" ||
        !Number.isFinite(Number(unitCost)) ||
        Number(unitCost) < 0)
    ) {
      setError("Enter a valid purchase unit cost.")
      return
    }

    setLoading(true)

    try {
      const payload = {
        product: Number(productId),
        movement_type: movementType,
        quantity: amount,
        notes: notes.trim(),
      }

      if (isPurchase) {
        payload.to_warehouse = Number(warehouseId)
        payload.supplier = Number(supplierId)
        payload.unit_cost = unitCost.trim()
      } else {
        payload.from_warehouse = Number(warehouseId)
      }

      await api.post("stock-movements/", payload)

      setProductId("")
      setMovementType("PURCHASE_IN")
      setWarehouseId("")
      setSupplierId("")
      setQuantity("")
      setUnitCost("")
      setNotes("")

      onSuccess?.()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h3 className="mb-2 text-xl font-semibold text-slate-800">
        Update Product Stock
      </h3>

      <p className="mb-6 text-sm text-slate-500">
        Record stock purchases or sales for a warehouse.
        Every successful update is saved in stock movement history.
      </p>

      {loadingData ? (
        <p className="text-sm text-slate-500">
          Loading warehouses and suppliers...
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="stock-product"
              className="mb-1 block text-sm font-medium"
            >
              Select Product
            </label>

            <select
              id="stock-product"
              value={productId}
              onChange={handleProductChange}
              required
              className="w-full rounded-lg border border-slate-300 p-3"
            >
              <option value="">Choose a product</option>

              {products
                .filter((product) => product.is_active)
                .map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — Total stock:{" "}
                    {product.stock_quantity}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="movement-type"
              className="mb-1 block text-sm font-medium"
            >
              Movement Type
            </label>

            <select
              id="movement-type"
              value={movementType}
              onChange={(event) => {
                setMovementType(event.target.value)
                setError("")
              }}
              className="w-full rounded-lg border border-slate-300 p-3"
            >
              <option value="PURCHASE_IN">
                Stock In (Purchase)
              </option>
              <option value="SALE_OUT">
                Stock Out (Sale)
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="stock-warehouse"
              className="mb-1 block text-sm font-medium"
            >
              {isPurchase
                ? "Destination Warehouse"
                : "Source Warehouse"}
            </label>

            <select
              id="stock-warehouse"
              value={warehouseId}
              onChange={(event) =>
                setWarehouseId(event.target.value)
              }
              required
              className="w-full rounded-lg border border-slate-300 p-3"
            >
              <option value="">Choose a warehouse</option>

              {warehouses.map((warehouse) => (
                <option
                  key={warehouse.id}
                  value={warehouse.id}
                >
                  {warehouse.name}
                </option>
              ))}
            </select>

            {warehouses.length === 0 && (
              <p className="mt-1 text-sm text-amber-600">
                No active warehouses are available.
              </p>
            )}
          </div>

          {isPurchase && (
            <>
              <div>
                <label
                  htmlFor="stock-supplier"
                  className="mb-1 block text-sm font-medium"
                >
                  Supplier
                </label>

                <select
                  id="stock-supplier"
                  value={supplierId}
                  onChange={(event) =>
                    setSupplierId(event.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 p-3"
                >
                  <option value="">Choose a supplier</option>

                  {suppliers.map((supplier) => (
                    <option
                      key={supplier.id}
                      value={supplier.id}
                    >
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="stock-unit-cost"
                  className="mb-1 block text-sm font-medium"
                >
                  Purchase Unit Cost (₹)
                </label>

                <input
                  id="stock-unit-cost"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={unitCost}
                  onChange={(event) =>
                    setUnitCost(event.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 p-3"
                  placeholder="Enter purchase cost per unit"
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="stock-quantity"
              className="mb-1 block text-sm font-medium"
            >
              Quantity
            </label>

            <input
              id="stock-quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) =>
                setQuantity(event.target.value)
              }
              required
              className="w-full rounded-lg border border-slate-300 p-3"
              placeholder="Enter quantity"
            />
          </div>

          {selectedProduct && (
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
              <p className="font-medium">
                {selectedProduct.name}
              </p>

              <p className="mt-1">
                Current total stock across warehouses:{" "}
                {selectedProduct.stock_quantity}
              </p>

              <p className="mt-1">
                {isPurchase
                  ? "The purchased quantity will be added to the selected warehouse."
                  : "The sold quantity will be removed from the selected warehouse."}
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="stock-notes"
              className="mb-1 block text-sm font-medium"
            >
              Notes (Optional)
            </label>

            <textarea
              id="stock-notes"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              rows={3}
              className="w-full rounded-lg border border-slate-300 p-3"
              placeholder="Example: New shipment received"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-600"
            >
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading || warehouses.length === 0}
              className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading
                ? "Updating..."
                : isPurchase
                  ? "Add Stock"
                  : "Remove Stock"}
            </button>

            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default StockUpdateForm
