
import { useCallback, useEffect, useState } from "react"
import api from "../api/axios"

const emptyInvite = {
  email: "",
  role: "STAFF",
}

const emptyEdit = {
  username: "",
  first_name: "",
  last_name: "",
  email: "",
  role: "STAFF",
  is_active: true,
}

function getErrorMessage(error, fallback) {
  const data = error.response?.data

  if (error.response?.status === 403) {
    return "Only company administrators can perform this action."
  }

  if (!data) {
    return error.message || fallback
  }

  if (typeof data.detail === "string") {
    return data.detail
  }

  return Object.entries(data)
    .map(([field, value]) => {
      const message = Array.isArray(value)
        ? value.join(", ")
        : String(value)

      return `${field}: ${message}`
    })
    .join(" | ")
}

function StatusBadge({ status }) {
  const styles = {
    PENDING: "bg-amber-100 text-amber-800",
    ACCEPTED: "bg-green-100 text-green-800",
    EXPIRED: "bg-red-100 text-red-800",
    REVOKED: "bg-slate-100 text-slate-700",
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || styles.REVOKED
      }`}
    >
      {status}
    </span>
  )
}

function UserManagement() {
  const [users, setUsers] = useState([])
  const [invitations, setInvitations] = useState([])

  const [inviteForm, setInviteForm] = useState(emptyInvite)
  const [editForm, setEditForm] = useState(emptyEdit)
  const [editingId, setEditingId] = useState(null)

  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      const allUsers = []
      let nextUrl = "company-users/"

      while (nextUrl) {
        const response = await api.get(nextUrl)
        const data = response.data

        if (Array.isArray(data)) {
          allUsers.push(...data)
          break
        }

        if (!Array.isArray(data?.results)) {
          throw new Error("Unexpected employee API response.")
        }

        allUsers.push(...data.results)
        nextUrl = data.next || null
      }

      const invitationResponse = await api.get(
        "v1/invitations/"
      )

      const invitationData = invitationResponse.data

      setUsers(allUsers)

      setInvitations(
        Array.isArray(invitationData)
          ? invitationData
          : invitationData.results || []
      )
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to load employee information."
        )
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  function handleInviteChange(event) {
    const { name, value } = event.target

    setInviteForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  async function handleInvite(event) {
    event.preventDefault()

    setInviting(true)
    setError("")
    setMessage("")

    try {
      await api.post("v1/invitations/", {
        email: inviteForm.email.trim(),
        role: inviteForm.role,
      })

      setInviteForm(emptyInvite)

      setMessage(
        "Invitation created successfully. The invitation email is available in your Django terminal during development."
      )

      await loadData()
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to send invitation.")
      )
    } finally {
      setInviting(false)
    }
  }

  function handleEdit(user) {
    setEditingId(user.id)

    setEditForm({
      username: user.username,
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email,
      role: user.role,
      is_active: user.is_active,
    })

    setError("")
    setMessage("")
  }

  function handleEditChange(event) {
    const { name, value } = event.target

    setEditForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(emptyEdit)
  }

  async function handleUpdate(event) {
    event.preventDefault()

    if (editingId === null) {
      return
    }

    setSaving(true)
    setError("")
    setMessage("")

    try {
      await api.patch(
        `company-users/${editingId}/`,
        {
          username: editForm.username,
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          email: editForm.email,
          role: editForm.role,
        }
      )

      cancelEdit()
      setMessage("Employee updated successfully.")

      await loadData()
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to update employee.")
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(user) {
    const action = user.is_active
      ? "deactivate"
      : "activate"

    if (
      !window.confirm(
        `Are you sure you want to ${action} ${user.username}?`
      )
    ) {
      return
    }

    setError("")
    setMessage("")

    try {
      await api.patch(
        `company-users/${user.id}/`,
        {
          is_active: !user.is_active,
        }
      )

      setMessage(
        `Employee ${
          user.is_active ? "deactivated" : "activated"
        } successfully.`
      )

      await loadData()
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to update employee status."
        )
      )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">
          User Management
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Invite employees and manage their access to your company.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
        >
          {message}
        </div>
      )}

      {/* INVITE EMPLOYEE */}

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800">
          Invite Employee
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Invite a Manager or Staff member by email.
          They will create their own username and password.
        </p>

        <form
          onSubmit={handleInvite}
          className="mt-5 space-y-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="invite-email"
                className="mb-1 block text-sm font-medium"
              >
                Employee Email
              </label>

              <input
                id="invite-email"
                name="email"
                type="email"
                required
                value={inviteForm.email}
                onChange={handleInviteChange}
                placeholder="employee@example.com"
                className="w-full rounded-lg border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="invite-role"
                className="mb-1 block text-sm font-medium"
              >
                Employee Role
              </label>

              <select
                id="invite-role"
                name="role"
                value={inviteForm.role}
                onChange={handleInviteChange}
                className="w-full rounded-lg border border-slate-300 p-3"
              >
                <option value="STAFF">Staff</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={inviting}
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {inviting
              ? "Sending Invitation..."
              : "Send Invitation"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-500">
          Development mode: invitation emails are printed in
          the Django terminal. Real email delivery will be
          configured before deployment.
        </p>
      </div>

      {/* INVITATION HISTORY */}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <h3 className="font-semibold">
            Invitation History
          </h3>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="p-6 text-slate-500">
            Loading invitations...
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-4">Email</th>
                  <th className="px-5 py-4">Role</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Expires</th>
                </tr>
              </thead>

              <tbody>
                {invitations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-6 text-center text-slate-500"
                    >
                      No invitations found.
                    </td>
                  </tr>
                ) : (
                  invitations.map((invitation) => (
                    <tr
                      key={invitation.id}
                      className="border-t border-slate-100"
                    >
                      <td className="px-5 py-4">
                        {invitation.email}
                      </td>

                      <td className="px-5 py-4">
                        {invitation.role}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={invitation.status}
                        />
                      </td>

                      <td className="px-5 py-4">
                        {new Date(
                          invitation.expires_at
                        ).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT EMPLOYEE */}

      {editingId !== null && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-5 text-lg font-semibold">
            Edit Employee
          </h3>

          <form
            onSubmit={handleUpdate}
            className="space-y-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["username", "Username"],
                ["first_name", "First Name"],
                ["last_name", "Last Name"],
                ["email", "Email"],
              ].map(([name, label]) => (
                <div key={name}>
                  <label
                    htmlFor={`edit-${name}`}
                    className="mb-1 block text-sm font-medium"
                  >
                    {label}
                  </label>

                  <input
                    id={`edit-${name}`}
                    name={name}
                    type={
                      name === "email" ? "email" : "text"
                    }
                    value={editForm[name]}
                    onChange={handleEditChange}
                    required={
                      name === "username" ||
                      name === "email"
                    }
                    className="w-full rounded-lg border border-slate-300 p-3"
                  />
                </div>
              ))}
            </div>

            <div>
              <label
                htmlFor="edit-role"
                className="mb-1 block text-sm font-medium"
              >
                Role
              </label>

              <select
                id="edit-role"
                name="role"
                value={editForm.role}
                onChange={handleEditChange}
                className="w-full rounded-lg border border-slate-300 p-3"
              >
                <option value="STAFF">Staff</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : "Update Employee"}
              </button>

              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-slate-300 px-5 py-3"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EMPLOYEE LIST */}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h3 className="font-semibold">
            Employee List
          </h3>
        </div>

        {loading ? (
          <p className="p-6 text-slate-500">
            Loading employees...
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-4">Username</th>
                  <th className="px-5 py-4">Email</th>
                  <th className="px-5 py-4">Role</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-6 text-center text-slate-500"
                    >
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-t border-slate-100"
                    >
                      <td className="px-5 py-4 font-medium">
                        {user.username}
                      </td>

                      <td className="px-5 py-4">
                        {user.email}
                      </td>

                      <td className="px-5 py-4">
                        {user.role}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={
                            user.is_active
                              ? "font-medium text-green-600"
                              : "font-medium text-red-600"
                          }
                        >
                          {user.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(user)}
                            className="rounded-lg bg-amber-500 px-3 py-2 text-white hover:bg-amber-600"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              toggleStatus(user)
                            }
                            className={`rounded-lg px-3 py-2 text-white ${
                              user.is_active
                                ? "bg-slate-600 hover:bg-slate-700"
                                : "bg-green-600 hover:bg-green-700"
                            }`}
                          >
                            {user.is_active
                              ? "Deactivate"
                              : "Activate"}
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

export default UserManagement
