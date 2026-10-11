
import { useEffect, useState } from "react"
import api from "../api/axios"

const emptyForm = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
}

const fields = [
  { name: "name", label: "Supplier Name", required: true },
  { name: "contact_person", label: "Contact Person" },
  { name: "phone", label: "Phone" },
  { name: "email", label: "Email", type: "email" },
  { name: "address", label: "Address" },
]

function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadSuppliers = async () => {
    setLoading(true)
    try {
      const response = await api.get("suppliers/")
      setSuppliers(
        Array.isArray(response.data)
          ? response.data
          : response.data.results ?? []
      )
    } catch {
      setError("Unable to load suppliers.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSuppliers()
  }, [])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError("")
    setMessage("")

    try {
      if (editingId !== null) {
        await api.patch(`suppliers/${editingId}/`, form)
        setMessage("Supplier updated successfully.")
      } else {
        await api.post("suppliers/", form)
        setMessage("Supplier added successfully.")
      }

      resetForm()
      await loadSuppliers()
    } catch (err) {
      const details = err.response?.data
      setError(
        err.response?.status === 403
          ? "You do not have permission to manage suppliers."
          : details
            ? JSON.stringify(details)
            : "Unable to save supplier."
      )
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (supplier) => {
    setEditingId(supplier.id)
    setForm({
      name: supplier.name ?? "",
      contact_person: supplier.contact_person ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
    })
    setError("")
    setMessage("")
  }

  const handleDelete = async (supplier) => {
    if (!window.confirm(`Delete supplier "${supplier.name}"?`)) {
      return
    }

    setError("")
    setMessage("")

    try {
      await api.delete(`suppliers/${supplier.id}/`)
      if (editingId === supplier.id) resetForm()
      setMessage("Supplier deleted successfully.")
      await loadSuppliers()
    } catch (err) {
      setError(
        err.response?.status === 403
          ? "You do not have permission to delete suppliers."
          : "Unable to delete supplier. It may be linked to products."
      )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">
          Suppliers
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage the suppliers for your company's products.
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-lg font-semibold">
          {editingId !== null ? "Edit Supplier" : "Add Supplier"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.name}>
              <label
                htmlFor={`supplier-${field.name}`}
                className="mb-1 block text-sm font-medium"
              >
                {field.label}
              </label>

              {field.name === "address" ? (
                <textarea
                  id={`supplier-${field.name}`}
                  value={form[field.name]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      [field.name]: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 p-3"
                />
              ) : (
                <input
                  id={`supplier-${field.name}`}
                  type={field.type || "text"}
                  value={form[field.name]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      [field.name]: e.target.value,
                    })
                  }
                  required={field.required}
                  className="w-full rounded-lg border border-slate-300 p-3"
                />
              )}
            </div>
          ))}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId !== null
                  ? "Update Supplier"
                  : "Add Supplier"}
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
          <h3 className="font-semibold">Supplier List</h3>
        </div>

        {loading ? (
          <p className="p-6 text-slate-500">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4">Supplier</th>
                  <th className="px-5 py-4">Contact</th>
                  <th className="px-5 py-4">Phone</th>
                  <th className="px-5 py-4">Email</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>

              <tbody>
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      No suppliers found.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((supplier) => (
                    <tr key={supplier.id} className="border-t">
                      <td className="px-5 py-4 font-medium">
                        {supplier.name}
                      </td>
                      <td className="px-5 py-4">
                        {supplier.contact_person || "—"}
                      </td>
                      <td className="px-5 py-4">
                        {supplier.phone || "—"}
                      </td>
                      <td className="px-5 py-4">
                        {supplier.email || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(supplier)}
                            className="rounded bg-amber-500 px-3 py-2 text-white"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(supplier)}
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

export default Suppliers
