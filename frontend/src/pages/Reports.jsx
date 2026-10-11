
import { useCallback, useEffect, useState } from "react"
import api from "../api/axios"

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const movementLabels = {
  PURCHASE_IN: "Purchase In",
  SALE_OUT: "Sale Out",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Adjustment",
  RETURN: "Return",
  IN: "Legacy Stock In",
  OUT: "Legacy Stock Out",
}

async function fetchReports() {
  const [
    summaryResponse,
    lowStockResponse,
    warehouseResponse,
    movementResponse,
  ] = await Promise.all([
    api.get("v1/reports/summary/"),
    api.get("v1/reports/low-stock/"),
    api.get("v1/reports/warehouses/"),
    api.get("v1/reports/movements/"),
  ])

  return {
    summary: summaryResponse.data,
    lowStock: lowStockResponse.data,
    warehouses: warehouseResponse.data,
    movements: movementResponse.data,
  }
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold text-slate-800">
        {value}
      </p>
    </div>
  )
}

function Reports() {
  const [summary, setSummary] = useState(null)
  const [lowStock, setLowStock] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [movements, setMovements] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const applyReportData = useCallback((data) => {
    setSummary(data.summary)
    setLowStock(data.lowStock)
    setWarehouses(data.warehouses)
    setMovements(data.movements)
  }, [])

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const data = await fetchReports()
      applyReportData(data)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load reports. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }, [applyReportData])

  useEffect(() => {
    let active = true

    async function loadInitialReports() {
      try {
        const data = await fetchReports()

        if (active) {
          applyReportData(data)
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.detail ||
              "Unable to load reports. Please try again."
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadInitialReports()

    return () => {
      active = false
    }
  }, [applyReportData])

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-8 text-slate-600 shadow-sm">
        Loading inventory reports...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Inventory Reports
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Stock overview, valuation, low-stock alerts, and movement activity.
          </p>
        </div>

        <button
          type="button"
          onClick={loadReports}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Refresh Reports
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
        >
          {error}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Total Products"
            value={summary.total_products}
          />
          <StatCard
            label="Total Stock Units"
            value={summary.total_stock_quantity}
          />
          <StatCard
            label="Inventory Value"
            value={formatMoney(summary.total_stock_value)}
          />
          <StatCard
            label="Active Warehouses"
            value={summary.total_warehouses}
          />
          <StatCard
            label="Low-Stock Products"
            value={summary.low_stock_products}
          />
          <StatCard
            label="Stock Movements"
            value={summary.total_movements}
          />
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-800">
            Low-Stock Alerts
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">Available</th>
                <th className="px-5 py-3">Reorder Level</th>
                <th className="px-5 py-3">Shortage</th>
              </tr>
            </thead>

            <tbody>
              {lowStock.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-6 text-center text-slate-500"
                  >
                    No low-stock products found.
                  </td>
                </tr>
              ) : (
                lowStock.map((product) => (
                  <tr
                    key={product.id}
                    className="border-t border-slate-100"
                  >
                    <td className="px-5 py-3 font-medium">
                      {product.name}
                    </td>
                    <td className="px-5 py-3">
                      {product.sku}
                    </td>
                    <td className="px-5 py-3">
                      {product.stock_quantity}
                    </td>
                    <td className="px-5 py-3">
                      {product.reorder_level}
                    </td>
                    <td className="px-5 py-3 font-semibold text-red-600">
                      {product.shortage}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-800">
            Warehouse Valuation
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-5 py-3">Warehouse</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Products In Stock</th>
                <th className="px-5 py-3">Total Units</th>
                <th className="px-5 py-3">Stock Value</th>
              </tr>
            </thead>

            <tbody>
              {warehouses.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-6 text-center text-slate-500"
                  >
                    No warehouses found.
                  </td>
                </tr>
              ) : (
                warehouses.map((warehouse) => (
                  <tr
                    key={warehouse.id}
                    className="border-t border-slate-100"
                  >
                    <td className="px-5 py-3 font-medium">
                      {warehouse.name}
                    </td>
                    <td className="px-5 py-3">
                      {warehouse.code}
                    </td>
                    <td className="px-5 py-3">
                      {warehouse.product_count}
                    </td>
                    <td className="px-5 py-3">
                      {warehouse.total_quantity}
                    </td>
                    <td className="px-5 py-3 font-semibold">
                      {formatMoney(warehouse.total_value)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-800">
            Stock Movement Statistics
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-5 py-3">Movement Type</th>
                <th className="px-5 py-3">Transactions</th>
                <th className="px-5 py-3">Total Quantity</th>
              </tr>
            </thead>

            <tbody>
              {!movements?.by_type?.length ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-6 text-center text-slate-500"
                  >
                    No stock movements found.
                  </td>
                </tr>
              ) : (
                movements.by_type.map((item) => (
                  <tr
                    key={item.movement_type}
                    className="border-t border-slate-100"
                  >
                    <td className="px-5 py-3 font-medium">
                      {movementLabels[item.movement_type] ||
                        item.movement_type}
                    </td>
                    <td className="px-5 py-3">
                      {item.count}
                    </td>
                    <td className="px-5 py-3">
                      {item.total_quantity}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default Reports
