import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'
import type { ApiError } from '@/types'

export const API_URL = import.meta.env.VITE_API_URL || '/api/v1'
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

const ACCESS_KEY = 'immoflow-access-token'
const REFRESH_KEY = 'immoflow-refresh-token'

/* ------------------------------------------------------------------ */
/* Stockage des jetons                                                 */
/* ------------------------------------------------------------------ */
export const tokenStorage = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

/* ------------------------------------------------------------------ */
/* Requête sortante : ajout du jeton, sauf sur les routes publiques    */
/* ------------------------------------------------------------------ */
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/accept-invitation',
  '/owners/register',
  '/owners/accept-invitation',
  '/public/',
]

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const url = config.url ?? ''
  const isPublic = PUBLIC_PATHS.some((path) => url.includes(path))
  const token = tokenStorage.access
  if (token && !isPublic) {
    config.headers.Authorization = `Bearer ${token}`
  }
   // Le Content-Type par défaut de l'instance (application/json) casse les
  // envois de fichiers : Axios sérialise alors le FormData en JSON au lieu
  // de le laisser tel quel avec son boundary multipart, et le backend reçoit
  // un corps illisible (422). On le retire pour laisser le navigateur poser
  // automatiquement le bon `multipart/form-data; boundary=...`.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }

  return config
})
  

/* ------------------------------------------------------------------ */
/* Réponse : renouvellement transparent du jeton expiré                */
/*                                                                     */
/* Les requêtes qui échouent en 401 pendant un renouvellement sont      */
/* mises en file d'attente puis rejouées, pour qu'un rafraîchissement   */
/* de page chargeant six widgets ne déclenche pas six refresh.          */
/* ------------------------------------------------------------------ */
let isRefreshing = false
let queue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = []

function flushQueue(error: unknown, token: string | null) {
  queue.forEach(({ resolve, reject }) => (error || !token ? reject(error) : resolve(token)))
  queue = []
}

/** Déconnexion forcée — l'application écoute cet évènement. */
function forceLogout() {
  tokenStorage.clear()
  window.dispatchEvent(new CustomEvent('immoflow:session-expired'))
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const status = error.response?.status

    const isAuthRoute = (original?.url ?? '').includes('/auth/')
    if (status === 401 && original && !original._retry && !isAuthRoute) {
      const refreshToken = tokenStorage.refresh
      if (!refreshToken) {
        forceLogout()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({
            resolve: (token) => {
              original.headers.Authorization = `Bearer ${token}`
              resolve(api(original))
            },
            reject,
          })
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        // Appel direct (hors instance) pour ne pas repasser par l'intercepteur.
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        tokenStorage.set(data.access_token, data.refresh_token)
        flushQueue(null, data.access_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return api(original)
      } catch (refreshError) {
        flushQueue(refreshError, null)
        forceLogout()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

/* ------------------------------------------------------------------ */
/* Message d'erreur lisible                                            */
/* ------------------------------------------------------------------ */
export function errorMessage(error: unknown, fallback = 'Une erreur est survenue.'): string {
  if (axios.isAxiosError<ApiError>(error)) {
    if (error.code === 'ERR_NETWORK') {
      return "L'API est injoignable. Vérifiez que le backend est démarré, ou activez le mode démonstration."
    }
    const payload = error.response?.data?.error
    if (payload?.message) {
      const details = payload.details
      if (Array.isArray(details) && details.length) {
        const first = details[0] as { msg?: string }
        if (first?.msg) return `${payload.message} ${first.msg}`
      }
      if (details && typeof details === 'object' && 'missing' in details) {
        const missing = (details as { missing: string[] }).missing
        return `${payload.message} Manquant : ${missing.join(', ')}.`
      }
      return payload.message
    }
  }
  if (error instanceof Error) return error.message
  return fallback
}

/** Sérialise les filtres en query string en retirant les valeurs vides. */
export function toParams(input: Record<string, any>) {
  const params: Record<string, string | number | boolean> = {}
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params[key] = value as string | number | boolean
  })
  return params
}


/**
 * Réécrit un lien d'invitation sur l'origine réellement servie.
 *
 * Le backend construit ses liens à partir de FRONTEND_BASE_URL. Si cette
 * variable n'a pas été alignée sur le déploiement (port 3000 laissé par
 * défaut alors que Vite écoute sur 5173, par exemple), le lien renvoie une
 * page introuvable. On conserve le chemin et le jeton, on corrige l'hôte.
 */
export function normalizeInvitationUrl(url: string | null | undefined): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return `${window.location.origin}${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}
