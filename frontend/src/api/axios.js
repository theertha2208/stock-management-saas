
import axios from "axios"

const API_BASE_URL = "http://127.0.0.1:8000/api/"

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
})

// Attach the access token to API requests
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token")

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

// Refresh an expired access token once, then retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url === "token/" ||
      originalRequest.url === "token/refresh/"
    ) {
      return Promise.reject(error)
    }

    const refreshToken = sessionStorage.getItem("refresh_token")

    if (!refreshToken) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const response = await axios.post(
        `${API_BASE_URL}token/refresh/`,
        { refresh: refreshToken }
      )

      const newAccessToken = response.data.access

      sessionStorage.setItem("access_token", newAccessToken)

      if (response.data.refresh) {
        sessionStorage.setItem(
          "refresh_token",
          response.data.refresh
        )
      }

      originalRequest.headers.Authorization =
        `Bearer ${newAccessToken}`

      return api(originalRequest)
    } catch (refreshError) {
      sessionStorage.removeItem("access_token")
      sessionStorage.removeItem("refresh_token")

      if (window.location.pathname !== "/login") {
        window.location.replace("/login")
      }

      return Promise.reject(refreshError)
    }
  }
)

export default api
