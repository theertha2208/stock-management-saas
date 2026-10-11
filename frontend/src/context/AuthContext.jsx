
import {
  useEffect,
  useState,
} from "react"

import api from "../api/axios"
import { AuthContext } from "./auth-context"

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function loadUser() {
      try {
        const response = await api.get("me/")

        if (active) {
          setUser(response.data)
        }
      } catch {
        if (active) {
          setError("Unable to verify your account.")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadUser()

    return () => {
      active = false
    }
  }, [])

  const canManageInventory =
    user?.role === "ADMIN" || user?.role === "MANAGER"

  const isAdmin = user?.role === "ADMIN"

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        canManageInventory,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
