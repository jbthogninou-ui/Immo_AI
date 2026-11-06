import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/api/endpoints'
import { tokenStorage } from '@/api/client'
import type { UserProfile } from '@/types'

interface AuthState {
  user: UserProfile | null
  isAuthenticated: boolean
  /** Vrai tant que la session n'a pas été vérifiée au premier chargement. */
  isBootstrapping: boolean

  login: (email: string, password: string) => Promise<UserProfile>
  logout: (allDevices?: boolean) => Promise<void>
  refreshProfile: () => Promise<UserProfile | null>
  bootstrap: () => Promise<void>
  setUser: (user: UserProfile | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isBootstrapping: true,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      login: async (email, password) => {
        const tokens = await authApi.login({ email, password })
        tokenStorage.set(tokens.access_token, tokens.refresh_token)
        const user = await authApi.me()
        set({ user, isAuthenticated: true, isBootstrapping: false })
        return user
      },

      logout: async (allDevices = false) => {
        try {
          await authApi.logout({ refresh_token: tokenStorage.refresh, all_devices: allDevices })
        } catch {
          // La session est fermée côté client quoi qu'il arrive.
        }
        tokenStorage.clear()
        set({ user: null, isAuthenticated: false })
      },

      refreshProfile: async () => {
        if (!tokenStorage.access) return null
        try {
          const user = await authApi.me()
          set({ user, isAuthenticated: true })
          return user
        } catch {
          tokenStorage.clear()
          set({ user: null, isAuthenticated: false })
          return null
        }
      },

      /** Rejoue la session au démarrage : jeton présent → profil rechargé. */
      bootstrap: async () => {
        if (!tokenStorage.access) {
          set({ user: null, isAuthenticated: false, isBootstrapping: false })
          return
        }
        await get().refreshProfile()
        set({ isBootstrapping: false })
      },
    }),
    {
      name: 'immoflow-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
)

/* Le client HTTP signale une session expirée : on nettoie l'état global. */
if (typeof window !== 'undefined') {
  window.addEventListener('immoflow:session-expired', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false })
  })
}
