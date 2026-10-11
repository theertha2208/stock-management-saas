
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"

import api from "../api/axios"

const AuthContext = createContext(null)

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

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider")
  }

  return context
}
