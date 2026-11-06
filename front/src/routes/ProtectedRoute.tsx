import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { homeRouteFor } from '@/utils/permissions'
import type { UserRole } from '@/types'

/**
 * Garde de route.
 *
 * Tant que la session n'a pas été vérifiée au démarrage, on affiche un
 * indicateur : rediriger trop tôt déconnecterait un utilisateur valide qui
 * vient de rafraîchir la page.
 */
export function ProtectedRoute({
  children, roles,
}: {
  children: ReactNode
  roles?: UserRole[]
}) {
  const { user, isAuthenticated, isBootstrapping } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center">
          <Spinner className="mx-auto h-6 w-6" />
          <p className="mt-3 font-mono text-2xs uppercase tracking-[0.16em] text-content-subtle">
            Vérification de la session
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/connexion?next=${next}`} replace />
  }

  // Rôle non autorisé : on renvoie vers l'espace de la personne, pas vers une
  // page d'erreur — elle n'a rien fait de mal, elle s'est juste trompée d'URL.
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeRouteFor(user.role)} replace />
  }

  return <>{children}</>
}

/** Empêche un utilisateur déjà connecté de revenir sur les écrans d'auth. */
export function GuestRoute({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isBootstrapping } = useAuth()

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (isAuthenticated && user) {
    return <Navigate to={homeRouteFor(user.role)} replace />
  }

  return <>{children}</>
}
