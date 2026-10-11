
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import api from "../api/axios"

const initialForm = {
  company_name: "",
  first_name: "",
  last_name: "",
  username: "",
  email: "",
  password: "",
  confirm_password: "",
}

function Signup() {
  const navigate = useNavigate()

  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))

    setFieldErrors((previous) => ({
      ...previous,
      [name]: undefined,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")
    setFieldErrors({})

    if (form.password !== form.confirm_password) {
      setFieldErrors({
        confirm_password: ["Passwords do not match."],
      })
      return
    }

    setLoading(true)

    try {
      const {
        confirm_password,
        ...registrationData
      } = form

      await api.post("v1/register/", registrationData)

      navigate("/login", {
        replace: true,
        state: {
          message:
            "Company registered successfully. Sign in with your administrator account.",
        },
      })
    } catch (err) {
      const data = err.response?.data

      if (data && typeof data === "object") {
        setFieldErrors(data)

        setError(
          data.detail ||
            data.non_field_errors?.[0] ||
            "Please correct the highlighted fields."
        )
      } else {
        setError(
          "Unable to register your company. Please try again."
        )
      }
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    {
      name: "company_name",
      label: "Company Name",
      placeholder: "Example: ABC Trading",
      required: true,
    },
    {
      name: "first_name",
      label: "First Name",
      placeholder: "Your first name",
    },
    {
      name: "last_name",
      label: "Last Name",
      placeholder: "Your last name",
    },
    {
      name: "username",
      label: "Admin Username",
      placeholder: "Choose a username",
      required: true,
    },
    {
      name: "email",
      label: "Email Address",
      placeholder: "admin@company.com",
      type: "email",
      required: true,
    },
    {
      name: "password",
      label: "Password",
      placeholder: "Create a secure password",
      type: "password",
      required: true,
    },
    {
      name: "confirm_password",
      label: "Confirm Password",
      placeholder: "Re-enter your password",
      type: "password",
      required: true,
    },
  ]

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-lg sm:p-8">
        <h1 className="text-center text-2xl font-bold text-slate-800">
          Create Company Account
        </h1>

        <p className="mt-2 text-center text-sm text-slate-500">
          Register your business and create its administrator account.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5"
        >
          {fields.map((field) => (
            <div key={field.name}>
              <label
                htmlFor={field.name}
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                {field.label}
              </label>

              <input
                id={field.name}
                name={field.name}
                type={field.type || "text"}
                value={form[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                required={Boolean(field.required)}
                minLength={
                  field.name === "password" ? 8 : undefined
                }
                autoComplete={
                  field.name === "email"
                    ? "email"
                    : field.name === "password"
                      ? "new-password"
                      : undefined
                }
                aria-invalid={Boolean(fieldErrors[field.name])}
                className={`w-full rounded-lg border px-4 py-3 outline-none focus:border-blue-500 ${
                  fieldErrors[field.name]
                    ? "border-red-400"
                    : "border-slate-300"
                }`}
              />

              {fieldErrors[field.name] && (
                <p className="mt-1 text-sm text-red-600">
                  {Array.isArray(fieldErrors[field.name])
                    ? fieldErrors[field.name].join(" ")
                    : String(fieldErrors[field.name])}
                </p>
              )}
            </div>
          ))}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading
              ? "Creating Company..."
              : "Create Company Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-blue-600 hover:underline"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Signup
