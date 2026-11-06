import type { UserProfile, UserRole } from '@/types'

/** Vérifie une permission granulaire (« property:create »). */
export function can(user: UserProfile | null, permission: string): boolean {
  if (!user) return false
  if (user.role === 'SUPER_ADMIN') return true
  return user.permissions?.includes(permission) ?? false
}

export function hasRole(user: UserProfile | null, ...roles: UserRole[]): boolean {
  return !!user && roles.includes(user.role)
}

/** Membre interne d'une agence : dirigeant ou agent. */
export function isAgencyStaff(user: UserProfile | null): boolean {
  return hasRole(user, 'AGENCY', 'AGENT', 'SUPER_ADMIN')
}

/** Page d'atterrissage après connexion, selon le rôle. */
export function homeRouteFor(role: UserRole | undefined): string {
  switch (role) {
    case 'SUPER_ADMIN': return '/admin'
    case 'AGENCY': return '/agence'
    case 'AGENT': return '/agent'
    case 'OWNER': return '/proprietaire'
    case 'CLIENT': return '/espace-client'
    default: return '/'
  }
}
