
import { useEffect, useMemo, useState } from "react"

import api from "../api/axios"
import { useAuth } from "../context/auth-context"

import AddProductForm from "../components/AddProductForm"
import EditProductForm from "../components/EditProductForm"
import StockUpdateForm from "../components/StockUpdateForm"

function Products() {
  const { canManageInventory } = useAuth()

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [stockFilter, setStockFilter] = useState("all")

  const [showAddForm, setShowAddForm] = useState(false)
  const [showStockForm, setShowStockForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

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

    const loadData = async () => {
      setLoading(true)
      setError("")

      try {
        const [productData, categoryData, supplierData] =
          await Promise.all([
            fetchAllPages("products/"),
            fetchAllPages("categories/"),
            fetchAllPages("suppliers/"),
          ])

        if (active) {
          setProducts(productData)
          setCategories(categoryData)
          setSuppliers(supplierData)
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.status === 401
              ? "Your session has expired. Please log in again."
              : "Unable to load inventory data."
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadData()

    return () => {
      active = false
    }
  }, [refreshKey])

  const categoryNames = useMemo(
    () =>
      Object.fromEntries(
        categories.map((category) => [
          category.id,
          category.name,
        ])
      ),
    [categories]
  )

  const supplierNames = useMemo(
    () =>
      Object.fromEntries(
        suppliers.map((supplier) => [
          supplier.id,
          supplier.name,
        ])
      ),
    [suppliers]
  )

  const getStockStatus = (product) => {
    if (!product.is_active) return "inactive"

    const stock = Number(product.stock_quantity)
    const reorder = Number(product.reorder_level)

    if (stock <= 0) return "out"
    if (stock <= reorder) return "low"

    return "available"
  }

  const filteredProducts = products.filter((product) => {
    const term = search.trim().toLowerCase()

    const matchesSearch =
      product.name.toLowerCase().includes(term) ||
      product.sku.toLowerCase().includes(term)

    const matchesCategory =
      !categoryFilter ||
      String(product.category ?? "") === categoryFilter

    const matchesStock =
      stockFilter === "all" ||
      getStockStatus(product) === stockFilter

    return matchesSearch && matchesCategory && matchesStock
  })

  const handleSuccess = () => {
    setShowAddForm(false)
    setShowStockForm(false)
    setEditingProduct(null)
    setRefreshKey((previous) => previous + 1)
  }

  const openEditForm = (product) => {
    if (!canManageInventory) return

    setEditingProduct(product)
    setShowAddForm(false)
    setShowStockForm(false)
  }

  const handleToggleActive = async (product) => {
    if (!canManageInventory) return

    const action = product.is_active
      ? "deactivate"
      : "activate"

    if (
      !window.confirm(
        `Are you sure you want to ${action} "${product.name}"?`
      )
    ) {
      return
    }

    setError("")

    try {
      await api.patch(`products/${product.id}/`, {
        is_active: !product.is_active,
      })

      handleSuccess()
    } catch (err) {
      setError(
        err.response?.status === 403
          ? "You do not have permission to change product status."
          : "Unable to update product status."
      )
    }
  }

  const statusStyles = {
    available: "bg-green-100 text-green-700",
    low: "bg-amber-100 text-amber-700",
    out: "bg-red-100 text-red-700",
    inactive: "bg-slate-100 text-slate-600",
  }

  const statusLabels = {
    available: "In Stock",
    low: "Low Stock",
    out: "Out of Stock",
    inactive: "Inactive",
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Products
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {canManageInventory
              ? "Manage and monitor your company's inventory."
              : "View your company's inventory."}
          </p>
        </div>

        {canManageInventory && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setShowAddForm((previous) => !previous)
                setShowStockForm(false)
                setEditingProduct(null)
              }}
              className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
            >
              {showAddForm ? "Close Add Form" : "+ Add Product"}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowStockForm((previous) => !previous)
                setShowAddForm(false)
                setEditingProduct(null)
              }}
              className="rounded-lg bg-green-600 px-5 py-2.5 font-medium text-white hover:bg-green-700"
            >
              {showStockForm ? "Close Stock Form" : "Update Stock"}
            </button>
          </div>
        )}
      </div>

      {canManageInventory && showAddForm && (
        <AddProductForm
          onSuccess={handleSuccess}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {canManageInventory && showStockForm && (
        <StockUpdateForm
          products={products}
          onSuccess={handleSuccess}
          onCancel={() => setShowStockForm(false)}
        />
      )}

      {canManageInventory && editingProduct && (
        <EditProductForm
          key={editingProduct.id}
          product={editingProduct}
          onSuccess={handleSuccess}
          onCancel={() => setEditingProduct(null)}
        />
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-red-600"
        >
          {error}
        </p>
      )}

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label
              htmlFor="product-search"
              className="mb-1 block text-sm font-medium"
            >
              Search Products
            </label>

            <input
              id="product-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or SKU"
              className="w-full rounded-lg border border-slate-300 p-3"
            />
          </div>

          <div>
            <label
              htmlFor="category-filter"
              className="mb-1 block text-sm font-medium"
            >
              Category
            </label>

            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 p-3"
            >
              <option value="">All Categories</option>

              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="stock-filter"
              className="mb-1 block text-sm font-medium"
            >
              Stock Status
            </label>

            <select
              id="stock-filter"
              value={stockFilter}
              onChange={(event) =>
                setStockFilter(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 p-3"
            >
              <option value="all">All Products</option>
              <option value="available">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800">
            Product List
          </h3>

          <span className="text-sm text-slate-500">
            {filteredProducts.length} products
          </span>
        </div>

        {loading ? (
          <p className="p-8 text-center text-slate-500">
            Loading products...
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">SKU</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Supplier</th>
                  <th className="px-5 py-4">Price</th>
                  <th className="px-5 py-4">Stock</th>
                  <th className="px-5 py-4">Status</th>

                  {canManageInventory && (
                    <th className="px-5 py-4">Actions</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManageInventory ? 8 : 7}
                      className="px-5 py-12 text-center text-slate-500"
                    >
                      No matching products found.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const status = getStockStatus(product)

                    return (
                      <tr
                        key={product.id}
                        className="border-t border-slate-100"
                      >
                        <td className="px-5 py-4 font-medium">
                          {product.name}
                        </td>

                        <td className="px-5 py-4">
                          {product.sku}
                        </td>

                        <td className="px-5 py-4">
                          {categoryNames[product.category] || "—"}
                        </td>

                        <td className="px-5 py-4">
                          {supplierNames[product.supplier] || "—"}
                        </td>

                        <td className="px-5 py-4">
                          ₹{Number(product.selling_price).toLocaleString(
                            "en-IN",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {product.stock_quantity}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[status]}`}
                          >
                            {statusLabels[status]}
                          </span>
                        </td>

                        {canManageInventory && (
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openEditForm(product)}
                                className="rounded bg-amber-500 px-3 py-2 text-white hover:bg-amber-600"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleActive(product)
                                }
                                className={`rounded px-3 py-2 text-white ${
                                  product.is_active
                                    ? "bg-slate-600 hover:bg-slate-700"
                                    : "bg-green-600 hover:bg-green-700"
                                }`}
                              >
                                {product.is_active
                                  ? "Deactivate"
                                  : "Activate"}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Products
