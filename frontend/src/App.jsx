
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom"

import { AuthProvider, useAuth } from "./context/AuthContext"

import Sidebar from "./components/Sidebar"
import LogoutButton from "./components/LogoutButton"

import Dashboard from "./pages/Dashboard"
import Products from "./pages/Products"
import Warehouses from "./pages/Warehouses"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import AcceptInvitation from "./pages/AcceptInvitation"
import StockMovements from "./pages/StockMovements"
import Categories from "./pages/Categories"
import Suppliers from "./pages/Suppliers"
import UserManagement from "./pages/UserManagement"
import Reports from "./pages/Reports"

function DashboardLayout() {
  const { user, loading, error, isAdmin, canManageInventory } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-600">Loading your account...</p>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-red-600">
          {error || "Unable to load your account."}
        </p>
        <LogoutButton />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-4 bg-white px-8 py-5 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Stock Management SaaS
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {user.company_name || "Inventory Management"}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold text-slate-800">
                {user.first_name || user.username}
              </p>

              <p className="text-sm text-slate-500">
                {user.role}
              </p>
            </div>

            <LogoutButton />
          </div>
        </header>

        <main className="p-4 md:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/warehouses" element={<Warehouses />} />

            <Route
              path="/categories"
              element={
                canManageInventory
                  ? <Categories />
                  : <Navigate to="/" replace />
              }
            />

            <Route
              path="/suppliers"
              element={
                canManageInventory
                  ? <Suppliers />
                  : <Navigate to="/" replace />
              }
            />

            <Route
              path="/stock-movements"
              element={<StockMovements />}
            />

            <Route
              path="/reports"
              element={
                canManageInventory
                  ? <Reports />
                  : <Navigate to="/" replace />
              }
            />

            <Route
              path="/users"
              element={
                isAdmin
                  ? <UserManagement />
                  : <Navigate to="/" replace />
              }
            />

            <Route
              path="*"
              element={<Navigate to="/" replace />}
            />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  const isAuthenticated = Boolean(
    sessionStorage.getItem("access_token")
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated
              ? <Navigate to="/" replace />
              : <Login />
          }
        />

        <Route
          path="/signup"
          element={
            isAuthenticated
              ? <Navigate to="/" replace />
              : <Signup />
          }
        />

        <Route
          path="/accept-invitation"
          element={<AcceptInvitation />}
        />

        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <AuthProvider>
                <DashboardLayout />
              </AuthProvider>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
