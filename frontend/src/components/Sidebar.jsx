
import { useState } from "react"
import { NavLink } from "react-router-dom"
import { useAuth } from "../context/auth-context"

const menuItems = [
  { name: "Dashboard", icon: "📊", path: "/" },
  { name: "Products", icon: "📦", path: "/products" },
  { name: "Warehouses", icon: "🏬", path: "/warehouses" },
  {
    name: "Categories",
    icon: "📁",
    path: "/categories",
    management: true,
  },
  {
    name: "Suppliers",
    icon: "🚚",
    path: "/suppliers",
    management: true,
  },
  {
    name: "Stock Movements",
    icon: "🔄",
    path: "/stock-movements",
  },
  {
    name: "Reports",
    icon: "📈",
    path: "/reports",
    management: true,
  },
  {
    name: "User Management",
    icon: "👥",
    path: "/users",
    adminOnly: true,
  },
]

function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)

  const { isAdmin, canManageInventory, user } = useAuth()

  const visibleItems = menuItems.filter((item) => {
    if (item.adminOnly) return isAdmin
    if (item.management) return canManageInventory
    return true
  })

  const roleLabel =
    user?.role === "ADMIN"
      ? "Admin"
      : user?.role === "MANAGER"
        ? "Manager"
        : "Staff"

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        className="fixed left-3 top-3 z-40 rounded-lg bg-slate-900 px-4 py-3 text-white shadow-lg md:hidden"
      >
        ☰
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto bg-slate-900 p-6 text-white transition-transform duration-200 md:static md:min-h-screen md:shrink-0 md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            Stock Manager
          </h2>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation menu"
            className="text-xl md:hidden"
          >
            ✕
          </button>
        </div>

        <p className="mb-8 text-sm text-slate-400">
          {roleLabel} Workspace
        </p>

        <nav className="space-y-3">
          {visibleItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === "/"}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `flex items-center rounded-lg px-4 py-3 transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <span className="mr-3">{item.icon}</span>
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}

export default Sidebar
