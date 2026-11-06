import { useAuthStore } from '@/store/authStore'
import { can, hasRole, isAgencyStaff } from '@/utils/permissions'
import type { UserRole } from '@/types'

/** Accès à la session courante et aux vérifications de droits. */
export function useAuth() {
  const { user, isAuthenticated, isBootstrapping, login, logout, refreshProfile } = useAuthStore()

  return {
    user,
    isAuthenticated,
    isBootstrapping,
    login,
    logout,
    refreshProfile,
    role: user?.role,
    can: (permission: string) => can(user, permission),
    hasRole: (...roles: UserRole[]) => hasRole(user, ...roles),
    isAgencyStaff: isAgencyStaff(user),
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
    isAgency: user?.role === 'AGENCY',
    isAgent: user?.role === 'AGENT',
    isOwner: user?.role === 'OWNER',
    isClient: user?.role === 'CLIENT',
  }
}
