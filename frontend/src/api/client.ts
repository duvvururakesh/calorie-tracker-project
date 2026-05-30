import axios from 'axios'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  r => r,
  err => {
    const requestUrl = err.config?.url || ''
    const isAuthProbe = requestUrl.includes('/auth/me')
    const isPublicRoute = ['/login', '/signup'].includes(window.location.pathname)
    if (err.response?.status === 401 && !isAuthProbe && !isPublicRoute) {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
