
import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import api from "../api/axios"

function getErrorMessage(error) {
  const data = error.response?.data

  if (!data) {
    return "Unable to connect to the server."
  }

  if (typeof data.detail === "string") {
    return data.detail
  }

  if (typeof data === "object") {
    const firstValue = Object.values(data)[0]

    if (Array.isArray(firstValue)) {
      return firstValue.join(", ")
    }

    if (typeof firstValue === "string") {
      return firstValue
    }
  }

  return "Something went wrong. Please try again."
}

function AcceptInvitation() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")

  const [invitation, setInvitation] = useState(null)
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [form, setForm] = useState({
    username: "",
    first_name: "",
    last_name: "",
    password: "",
    confirm_password: "",
  })

  useEffect(() => {
    let active = true

    async function checkInvitation() {
      if (!token) {
        setError("Invitation token is missing.")
        setChecking(false)
        return
      }

      try {
        const response = await api.get(
          "v1/invitations/details/",
          { params: { token } }
        )

        if (active) {
          setInvitation(response.data)
          setError("")
        }
      } catch (err) {
        if (active) {
          setError(getErrorMessage(err))
        }
      } finally {
        if (active) {
          setChecking(false)
        }
      }
    }

    checkInvitation()

    return () => {
      active = false
    }
  }, [token])

  function handleChange(event) {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setSuccess("")

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.")
      return
    }

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.")
      return
    }

    setSubmitting(true)

    try {
      await api.post("v1/invitations/accept/", {
        token,
        ...form,
      })

      setSuccess(
        "Your account has been created successfully. You can now log in."
      )

      setInvitation(null)

      // Clear the invitation token from the browser URL.
      window.history.replaceState(
        {},
        "",
        "/accept-invitation"
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Stock Management SaaS
          </h1>

          <p className="mt-2 text-slate-500">
            Employee Invitation
          </p>
        </div>

        {checking && (
          <p className="text-center text-slate-600">
            Verifying invitation...
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {success && (
          <div className="space-y-5 text-center">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
              {success}
            </div>

            <Link
              to="/login"
              className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
            >
              Go to Login
            </Link>
          </div>
        )}

        {!checking && invitation && !success && (
          <>
            <div className="mb-6 rounded-xl bg-blue-50 p-4">
              <p className="text-sm text-slate-600">
                You have been invited to join:
              </p>

              <h2 className="mt-1 text-xl font-bold text-blue-900">
                {invitation.company_name}
              </h2>

              <div className="mt-3 space-y-1 text-sm text-slate-700">
                <p>
                  <strong>Email:</strong> {invitation.email}
                </p>

                <p>
                  <strong>Role:</strong> {invitation.role}
                </p>

                <p>
                  <strong>Expires:</strong>{" "}
                  {new Date(
                    invitation.expires_at
                  ).toLocaleString()}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="mb-1 block text-sm font-medium"
                >
                  Username
                </label>

                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  maxLength={150}
                  value={form.username}
                  onChange={handleChange}
                  autoComplete="username"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="first_name"
                    className="mb-1 block text-sm font-medium"
                  >
                    First Name
                  </label>

                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    value={form.first_name}
                    onChange={handleChange}
                    maxLength={150}
                    autoComplete="given-name"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="last_name"
                    className="mb-1 block text-sm font-medium"
                  >
                    Last Name
                  </label>

                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    value={form.last_name}
                    onChange={handleChange}
                    maxLength={150}
                    autoComplete="family-name"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm font-medium"
                >
                  Password
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm_password"
                  className="mb-1 block text-sm font-medium"
                >
                  Confirm Password
                </label>

                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  required
                  value={form.confirm_password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Creating Account..."
                  : "Accept Invitation & Create Account"}
              </button>
            </form>
          </>
        )}

        {!checking && !invitation && !success && (
          <div className="text-center">
            <p className="mb-4 text-sm text-slate-500">
              Please contact your company administrator
              if you need a new invitation.
            </p>

            <Link
              to="/login"
              className="font-medium text-blue-600 hover:underline"
            >
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default AcceptInvitation
