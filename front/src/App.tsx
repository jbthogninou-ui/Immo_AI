import { useEffect } from 'react'
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppRoutes } from '@/routes'
import { ToastViewport } from '@/components/ui'
import { AssistantWidget } from '@/components/ai/AssistantWidget'
import { useAuthStore } from '@/store/authStore'
import { useToastStore, toast } from '@/store/toastStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Inutile de réessayer une requête refusée : le résultat sera le même.
        const status = error?.response?.status
        if (status === 401 || status === 403 || status === 404) return false
        return failureCount < 2
      },
    },
    mutations: { retry: false },
  },
})

/** Remet la page en haut à chaque navigation. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

/** Réagit à l'expiration de session signalée par le client HTTP. */
function SessionWatcher() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    function onExpired() {
      queryClient.clear()
      if (!pathname.startsWith('/connexion')) {
        toast.warning('Session expirée', 'Reconnectez-vous pour continuer.')
        navigate('/connexion', { replace: true })
      }
    }
    window.addEventListener('immoflow:session-expired', onExpired)
    return () => window.removeEventListener('immoflow:session-expired', onExpired)
  }, [navigate, pathname])

  return null
}

function Shell() {
  const bootstrap = useAuthStore((state) => state.bootstrap)
  const { toasts, dismiss } = useToastStore()

  // Rejoue la session au premier chargement.
  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  return (
    <>
      <ScrollToTop />
      <SessionWatcher />
      <AppRoutes />
      <AssistantWidget />
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
