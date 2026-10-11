
import { useEffect, useMemo, useState } from "react"
import api from "../api/axios"
import { useAuth } from "../context/AuthContext"

const emptyForm = {
  name: "",
  code: "",
  address: "",
  is_active: true,
}

function Warehouses() {
  const { canManageInventory } = useAuth()

  const [warehouses, setWarehouses] = useState([])
  const [stockLevels, setStockLevels] = useState([])
  const [search, setSearch] = useState("")
  const [selectedWarehouse, setSelectedWarehouse] = useState(null)
  const [editingWarehouse, setEditingWarehouse] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function fetchAllPages(url) {
    let results = []
    let next = url

    while (next) {
      const response = await api.get(next)
      const data = response.data

      if (Array.isArray(data)) {
        results = [...results, ...data]
        break
      }

      results = [...results, ...(data.results || [])]
      next = data.next
    }

    return results
  }

  async function loadData() {
    setLoading(true)
    setError("")

    try {
      const [warehouseData, stockData] = await Promise.all([
        fetchAllPages("warehouses/"),
        fetchAllPages("stock-levels/"),
      ])

      setWarehouses(warehouseData)
      setStockLevels(stockData)
    } catch {
      setError("Unable to load warehouse information.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredWarehouses = useMemo(() => {
    const term = search.toLowerCase().trim()

    return warehouses.filter((warehouse) =>
      `${warehouse.name} ${warehouse.code} ${warehouse.address}`
        .toLowerCase()
        .includes(term)
    )
  }, [warehouses, search])

  const selectedStock = useMemo(() => {
    if (!selectedWarehouse) return []

    return stockLevels.filter(
      (stock) => stock.warehouse === selectedWarehouse.id
    )
  }, [stockLevels, selectedWarehouse])

  const selectedTotal = selectedStock.reduce(
    (total, stock) => total + Number(stock.stock_value || 0),
    0
  )

  function openCreate() {
    setEditingWarehouse(null)
    setForm(emptyForm)
    setError("")
    setSuccess("")
    setShowForm(true)
  }

  function openEdit(warehouse) {
    setEditingWarehouse(warehouse)
    setForm({
      name: warehouse.name,
      code: warehouse.code,
      address: warehouse.address || "",
      is_active: warehouse.is_active,
    })
    setError("")
    setSuccess("")
    setShowForm(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")

    try {
      if (editingWarehouse) {
        await api.patch(
          `warehouses/${editingWarehouse.id}/`,
          form
        )
        setSuccess("Warehouse updated successfully.")
      } else {
        await api.post("warehouses/", form)
        setSuccess("Warehouse created successfully.")
      }

      setShowForm(false)
      setEditingWarehouse(null)
      await loadData()
    } catch (err) {
      const details = err.response?.data
      setError(
        details?.detail ||
          JSON.stringify(details) ||
          "Unable to save warehouse."
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(warehouse) {
    setError("")
    setSuccess("")

    try {
      await api.patch(`warehouses/${warehouse.id}/`, {
        is_active: !warehouse.is_active,
      })
      setSuccess("Warehouse status updated.")
      await loadData()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to update warehouse status."
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Warehouses
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage locations and track stock across warehouses.
          </p>
        </div>

        {canManageInventory && (
          <button
            onClick={openCreate}
            className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
          >
            + Add Warehouse
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 p-4 text-green-700">
          {success}
        </div>
      )}

      {showForm && canManageInventory && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl bg-white p-6 shadow-sm"
        >
          <h3 className="text-lg font-semibold">
            {editingWarehouse ? "Edit Warehouse" : "Add Warehouse"}
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              required
              placeholder="Warehouse name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              className="rounded-lg border border-slate-300 p-3"
            />

            <input
              required
              placeholder="Warehouse code"
              value={form.code}
              onChange={(e) =>
                setForm({
                  ...form,
                  code: e.target.value.toUpperCase(),
                })
              }
              className="rounded-lg border border-slate-300 p-3"
            />

            <textarea
              placeholder="Warehouse address"
              value={form.address}
              onChange={(e) =>
                setForm({ ...form, address: e.target.value })
              }
              className="rounded-lg border border-slate-300 p-3 md:col-span-2"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Warehouse"}
            </button>

            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border px-5 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <input
          type="search"
          placeholder="Search warehouses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-300 p-3 md:max-w-md"
        />

        {loading ? (
          <p className="mt-6 text-slate-500">
            Loading warehouses...
          </p>
        ) : filteredWarehouses.length === 0 ? (
          <p className="mt-6 text-slate-500">
            No warehouses found.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-3">Warehouse</th>
                  <th className="p-3">Code</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredWarehouses.map((warehouse) => (
                  <tr
                    key={warehouse.id}
                    className="border-b border-slate-100"
                  >
                    <td className="p-3 font-medium">
                      {warehouse.name}
                    </td>
                    <td className="p-3">{warehouse.code}</td>
                    <td className="p-3">
                      {warehouse.is_active ? "Active" : "Inactive"}
                    </td>
                    <td className="space-x-3 p-3">
                      <button
                        onClick={() =>
                          setSelectedWarehouse(warehouse)
                        }
                        className="font-medium text-blue-600"
                      >
                        View Stock
                      </button>

                      {canManageInventory && (
                        <>
                          <button
                            onClick={() => openEdit(warehouse)}
                            className="text-slate-700"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => toggleActive(warehouse)}
                            className="text-amber-700"
                          >
                            {warehouse.is_active
                              ? "Deactivate"
                              : "Activate"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedWarehouse && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Stock — {selectedWarehouse.name}
            </h3>

            <button
              onClick={() => setSelectedWarehouse(null)}
              className="text-slate-500"
            >
              Close
            </button>
          </div>

          <p className="mt-2 font-semibold text-blue-700">
            Inventory Value: ₹{selectedTotal.toLocaleString("en-IN")}
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Quantity</th>
                  <th className="p-3">Average Cost</th>
                  <th className="p-3">Value</th>
                </tr>
              </thead>

              <tbody>
                {selectedStock.map((stock) => (
                  <tr key={stock.id} className="border-b">
                    <td className="p-3">{stock.product_name}</td>
                    <td className="p-3">{stock.product_sku}</td>
                    <td className="p-3">{stock.quantity}</td>
                    <td className="p-3">
                      ₹{Number(stock.average_unit_cost).toLocaleString("en-IN")}
                    </td>
                    <td className="p-3">
                      ₹{Number(stock.stock_value).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedStock.length === 0 && (
              <p className="py-5 text-slate-500">
                No stock records for this warehouse.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Warehouses
