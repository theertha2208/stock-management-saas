
import { useState } from "react"
import { Link } from "react-router-dom"
import api from "../api/axios"

function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (event) => {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await api.post("token/", {
        username,
        password,
      })

      sessionStorage.setItem(
        "access_token",
        response.data.access
      )

      sessionStorage.setItem(
        "refresh_token",
        response.data.refresh
      )

      window.location.replace("/")
    } catch (err) {
      setError(
        err.response?.status === 401
          ? "Invalid username or password."
          : "Unable to sign in. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-center text-2xl font-bold text-slate-800">
          Stock Manager
        </h1>

        <p className="mb-8 text-center text-slate-500">
          Sign in to manage your company's inventory
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Username
            </label>

            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoComplete="username"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              placeholder="Enter password"
            />
          </div>

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
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-6 text-center">
          <p className="text-sm text-slate-600">
            Don't have a company account?
          </p>

          <Link
            to="/signup"
            className="mt-3 inline-block font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            Create Company Account
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Login
