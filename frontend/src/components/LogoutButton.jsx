
function LogoutButton() {
  const handleLogout = () => {
    sessionStorage.removeItem("access_token")
    sessionStorage.removeItem("refresh_token")

    window.location.replace("/login")
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700"
    >
      Logout
    </button>
  )
}

export default LogoutButton
