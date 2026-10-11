
import { useEffect, useState } from "react"
import api from "../api/axios"

const initialForm = {
  name: "",
  sku: "",
  description: "",
  category: "",
  supplier: "",
  purchase_price: "",
  selling_price: "",
  reorder_level: "5",
}

function AddProductForm({ onSuccess, onCancel }) {
  const [form, setForm] = useState(initialForm)
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    const fetchOptions = async () => {
      try {
        const [categoryResponse, supplierResponse] =
          await Promise.all([
            api.get("categories/"),
            api.get("suppliers/"),
          ])

        if (!active) return

        setCategories(
          Array.isArray(categoryResponse.data)
            ? categoryResponse.data
            : categoryResponse.data.results ?? []
        )

        setSuppliers(
          Array.isArray(supplierResponse.data)
            ? supplierResponse.data
            : supplierResponse.data.results ?? []
        )
      } catch {
        if (active) {
          setError("Unable to load categories or suppliers.")
        }
      } finally {
        if (active) setLoadingOptions(false)
      }
    }

    fetchOptions()

    return () => {
      active = false
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")
    setSaving(true)

    try {
      await api.post("products/", {
        ...form,
        category: form.category
          ? Number(form.category)
          : null,
        supplier: form.supplier
          ? Number(form.supplier)
          : null,
        purchase_price: form.purchase_price,
        selling_price: form.selling_price,
        reorder_level: Number(form.reorder_level),
      })

      setForm(initialForm)
      onSuccess?.()
    } catch (err) {
      const details = err.response?.data

      if (err.response?.status === 403) {
        setError("You do not have permission to add products.")
      } else if (details && typeof details === "object") {
        setError(
          Object.entries(details)
            .map(([field, messages]) =>
              `${field}: ${
                Array.isArray(messages)
                  ? messages.join(", ")
                  : String(messages)
              }`
            )
            .join(" | ")
        )
      } else {
        setError("Unable to add product. Please try again.")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h3 className="mb-6 text-xl font-semibold text-slate-800">
        Add New Product
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="add-name" className="mb-1 block text-sm font-medium">
            Product Name
          </label>
          <input
            id="add-name"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 p-3"
            placeholder="Enter product name"
          />
        </div>

        <div>
          <label htmlFor="add-sku" className="mb-1 block text-sm font-medium">
            SKU
          </label>
          <input
            id="add-sku"
            name="sku"
            value={form.sku}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 p-3"
            placeholder="Enter unique product code"
          />
        </div>

        <div>
          <label
            htmlFor="add-description"
            className="mb-1 block text-sm font-medium"
          >
            Description
          </label>
          <textarea
            id="add-description"
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-lg border border-slate-300 p-3"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="add-category"
              className="mb-1 block text-sm font-medium"
            >
              Category
            </label>
            <select
              id="add-category"
              name="category"
              value={form.category}
              onChange={handleChange}
              disabled={loadingOptions}
              className="w-full rounded-lg border border-slate-300 p-3"
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="add-supplier"
              className="mb-1 block text-sm font-medium"
            >
              Supplier
            </label>
            <select
              id="add-supplier"
              name="supplier"
              value={form.supplier}
              onChange={handleChange}
              disabled={loadingOptions}
              className="w-full rounded-lg border border-slate-300 p-3"
            >
              <option value="">No supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="add-purchase-price"
              className="mb-1 block text-sm font-medium"
            >
              Purchase Price (₹)
            </label>
            <input
              id="add-purchase-price"
              name="purchase_price"
              type="number"
              min="0"
              step="0.01"
              value={form.purchase_price}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 p-3"
            />
          </div>

          <div>
            <label
              htmlFor="add-selling-price"
              className="mb-1 block text-sm font-medium"
            >
              Selling Price (₹)
            </label>
            <input
              id="add-selling-price"
              name="selling_price"
              type="number"
              min="0"
              step="0.01"
              value={form.selling_price}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-300 p-3"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="add-reorder-level"
            className="mb-1 block text-sm font-medium"
          >
            Reorder Level
          </label>
          <input
            id="add-reorder-level"
            name="reorder_level"
            type="number"
            min="0"
            step="1"
            value={form.reorder_level}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 p-3"
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
            disabled={saving || loadingOptions || Boolean(error && loadingOptions)}
            className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Product"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-5 py-3"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddProductForm
