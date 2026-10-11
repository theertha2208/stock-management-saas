
import { useEffect, useState } from "react"
import api from "../api/axios"

const emptyForm = { name: "", description: "" }

function Categories() {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadCategories = async () => {
    setLoading(true)
    try {
      const response = await api.get("categories/")
      setCategories(
        Array.isArray(response.data)
          ? response.data
          : response.data.results ?? []
      )
    } catch {
      setError("Unable to load categories.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")
    setMessage("")
    setSaving(true)

    try {
      if (editingId !== null) {
        await api.patch(`categories/${editingId}/`, form)
        setMessage("Category updated successfully.")
      } else {
        await api.post("categories/", form)
        setMessage("Category added successfully.")
      }

      resetForm()
      await loadCategories()
    } catch (err) {
      const details = err.response?.data
      setError(
        err.response?.status === 403
          ? "You do not have permission to manage categories."
          : details
            ? JSON.stringify(details)
            : "Unable to save category."
      )
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (category) => {
    setEditingId(category.id)
    setForm({
      name: category.name ?? "",
      description: category.description ?? "",
    })
    setError("")
    setMessage("")
  }

  const handleDelete = async (category) => {
    if (!window.confirm(`Delete category "${category.name}"?`)) {
      return
    }

    setError("")
    setMessage("")

    try {
      await api.delete(`categories/${category.id}/`)
      if (editingId === category.id) resetForm()
      setMessage("Category deleted successfully.")
      await loadCategories()
    } catch (err) {
      setError(
        err.response?.status === 403
          ? "You do not have permission to delete categories."
          : "Unable to delete category. It may be used by products."
      )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">
          Categories
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Organize your inventory into product categories.
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-lg font-semibold">
          {editingId !== null ? "Edit Category" : "Add Category"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Category Name
            </label>
            <input
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              required
              className="w-full rounded-lg border border-slate-300 p-3"
              placeholder="Example: Electronics"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              className="w-full rounded-lg border border-slate-300 p-3"
              placeholder="Optional description"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId !== null
                  ? "Update Category"
                  : "Add Category"}
            </button>

            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-5 py-3"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-4 text-sm text-green-600">
            {message}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h3 className="font-semibold">Category List</h3>
        </div>

        {loading ? (
          <p className="p-6 text-slate-500">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4">Name</th>
                  <th className="px-5 py-4">Description</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-slate-500">
                      No categories found.
                    </td>
                  </tr>
                ) : (
                  categories.map((category) => (
                    <tr key={category.id} className="border-t">
                      <td className="px-5 py-4 font-medium">
                        {category.name}
                      </td>
                      <td className="px-5 py-4">
                        {category.description || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(category)}
                            className="rounded bg-amber-500 px-3 py-2 text-white"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(category)}
                            className="rounded bg-red-600 px-3 py-2 text-white"
                          >
                            Delete
                          </button>
                        </div>
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

export default Categories
