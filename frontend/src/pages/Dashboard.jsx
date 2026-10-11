
import { useEffect, useState } from "react"
import api from "../api/axios"
import { useAuth } from "../context/auth-context"

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value)

async function fetchAllPages(endpoint) {
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

function Dashboard() {
  const { user, canManageInventory } = useAuth()

  const [stockLevels, setStockLevels] = useState([])
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    const loadDashboard = async () => {
      setLoading(true)
      setError("")

      try {
        const requests = [
          fetchAllPages("v1/products/"),
          fetchAllPages("v1/stock-levels/"),
        ]

        if (canManageInventory) {
          requests.push(
            fetchAllPages("v1/suppliers/"),
            fetchAllPages("v1/categories/")
          )
        }

        const results = await Promise.all(requests)

        if (!active) return

        setProducts(results[0])
        setStockLevels(results[1])
        setSuppliers(canManageInventory ? results[2] : [])
        setCategories(canManageInventory ? results[3] : [])
      } catch (err) {
        if (active) {
          console.error(err)
          setError("Unable to load dashboard data.")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      active = false
    }
  }, [canManageInventory])

  const quantities = new Map()

  for (const level of stockLevels) {
    const productId =
      typeof level.product === "object"
        ? level.product?.id
        : level.product

    const key = String(productId)

    quantities.set(
      key,
      (quantities.get(key) || 0) +
        Number(level.quantity || 0)
    )
  }

  const getQuantity = (product) =>
    quantities.get(String(product.id)) || 0

  const activeProducts = products.filter(
    (product) => product.is_active !== false
  )

  const lowStockProducts = activeProducts.filter(
    (product) =>
      getQuantity(product) <= Number(product.reorder_level || 0)
  )

  const totalStock = activeProducts.reduce(
    (sum, product) => sum + getQuantity(product),
    0
  )

  const inventoryValue = stockLevels.reduce(
    (sum, level) =>
      sum +
      Number(level.quantity || 0) *
        Number(level.average_unit_cost || 0),
    0
  )

  const cards = [
    {
      title: "Total Products",
      value: products.length,
      color: "text-blue-600",
    },
    {
      title: "Low Stock Products",
      value: lowStockProducts.length,
      color: "text-orange-500",
    },
    {
      title: "Total Stock Units",
      value: totalStock,
      color: "text-cyan-600",
    },
    ...(canManageInventory
      ? [
          {
            title: "Total Suppliers",
            value: suppliers.length,
            color: "text-green-600",
          },
          {
            title: "Total Categories",
            value: categories.length,
            color: "text-purple-600",
          },
          {
            title: "Inventory Value",
            value: formatCurrency(inventoryValue),
            color: "text-indigo-600",
          },
        ]
      : []),
  ]

  const dashboardTitle =
    user?.role === "ADMIN"
      ? "Admin Dashboard"
      : user?.role === "MANAGER"
        ? "Manager Dashboard"
        : "Staff Dashboard"

  if (loading) {
    return (
      <p className="p-4 text-slate-500 sm:p-8">
        Loading dashboard...
      </p>
    )
  }

  if (error) {
    return (
      <p role="alert" className="p-4 text-red-600 sm:p-8">
        {error}
      </p>
    )
  }

  return (
    <div className="min-w-0 w-full space-y-6 sm:space-y-8">
      {/* Dashboard heading */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 sm:text-2xl">
          {dashboardTitle}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Live inventory summary for your company.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className="min-w-0 rounded-xl bg-white p-4 shadow-sm sm:p-6"
          >
            <p className="text-sm text-slate-500">
              {card.title}
            </p>

            <h3
              className={`mt-3 break-words text-2xl font-bold sm:text-3xl ${card.color}`}
            >
              {card.value}
            </h3>
          </div>
        ))}
      </div>

      {/* Low stock alerts */}
      <div className="min-w-0 overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <h3 className="text-lg font-semibold text-slate-800">
            Low Stock Alerts
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Products at or below their reorder level.
          </p>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="min-w-[650px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-4 sm:px-5">
                  Product
                </th>
                <th className="px-4 py-4 sm:px-5">
                  SKU
                </th>
                <th className="px-4 py-4 sm:px-5">
                  Current Stock
                </th>
                <th className="px-4 py-4 sm:px-5">
                  Reorder Level
                </th>
                <th className="px-4 py-4 sm:px-5">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {lowStockProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-green-600"
                  >
                    All active products have sufficient stock.
                  </td>
                </tr>
              ) : (
                lowStockProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="border-t border-slate-100"
                  >
                    <td className="px-4 py-4 font-medium sm:px-5">
                      {product.name}
                    </td>

                    <td className="px-4 py-4 sm:px-5">
                      {product.sku}
                    </td>

                    <td className="px-4 py-4 sm:px-5">
                      {getQuantity(product)}
                    </td>

                    <td className="px-4 py-4 sm:px-5">
                      {product.reorder_level}
                    </td>

                    <td className="px-4 py-4 sm:px-5">
                      <span className="font-medium text-red-600">
                        {getQuantity(product) <= 0
                          ? "Out of Stock"
                          : "Low Stock"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
