
import { useState } from "react"
import api from "../api/axios"

function StockUpdateForm({ products, onSuccess, onCancel }) {
  const [productId, setProductId] = useState("")
  const [movementType, setMovementType] = useState("IN")
  const [quantity, setQuantity] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")

    const amount = Number(quantity)

    if (!productId) {
      setError("Please select a product.")
      return
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Quantity must be a positive whole number.")
      return
    }

    setLoading(true)

    try {
      await api.post("products/update-stock/", {
        product: Number(productId),
        movement_type: movementType,
        quantity: amount,
        notes: notes.trim(),
      })

      setProductId("")
      setMovementType("IN")
      setQuantity("")
      setNotes("")

      onSuccess?.()
    } catch (err) {
      const details = err.response?.data

      if (err.response?.status === 403) {
        setError("You do not have permission to update stock.")
      } else if (details?.detail) {
        setError(
          Array.isArray(details.detail)
            ? details.detail.join(", ")
            : String(details.detail)
        )
      } else {
        setError("Unable to update stock. Please check the details.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h3 className="mb-6 text-xl font-semibold text-slate-800">
        Update Product Stock
      </h3>

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
            onChange={(event) => setProductId(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 p-3"
          >
            <option value="">Choose a product</option>

            {products
              .filter((product) => product.is_active)
              .map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — Current stock: {product.stock_quantity}
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
            onChange={(event) => setMovementType(event.target.value)}
            className="w-full rounded-lg border border-slate-300 p-3"
          >
            <option value="IN">Stock In (Add Stock)</option>
            <option value="OUT">Stock Out (Remove Stock)</option>
          </select>
        </div>

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
            onChange={(event) => setQuantity(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 p-3"
            placeholder="Enter quantity"
          />
        </div>

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
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 p-3"
            placeholder="Example: New stock received"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Updating..." : "Update Stock"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default StockUpdateForm
