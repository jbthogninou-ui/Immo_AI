import { Fragment } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, ExternalLink, LogOut } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { Logo } from './Logo'
import { NAVIGATION, WORKSPACE_LABEL } from './navigation'
import { cn } from '@/utils/cn'
import { ROLE_LABEL } from '@/utils/constants'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/store/uiStore'

/** Barre latérale du tableau de bord. Repliable sur desktop, tiroir sur mobile. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const navigate = useNavigate()

  if (!user) return null
  const items = NAVIGATION[user.role] ?? []
  const collapsed = sidebarCollapsed

  async function handleLogout() {
    await logout()
    navigate('/connexion')
  }

  return (
    <div className={cn('flex h-full flex-col bg-lagoon-800 text-white', collapsed ? 'w-[76px]' : 'w-[268px]')}>
      {/* En-tête */}
      <div className={cn('flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-4', collapsed && 'justify-center px-2')}>
        <Logo invert compact={collapsed} to="/" />
        {!collapsed && (
          <button
            onClick={toggleSidebar}
            aria-label="Replier la barre latérale"
            className="ml-auto hidden rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white lg:block"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={toggleSidebar}
          aria-label="Déplier la barre latérale"
          className="mx-auto mt-3 hidden rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white lg:block"
        >
          <ChevronLeft className="h-4 w-4 rotate-180" />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Navigation principale">
        {items.map((item, index) => {
          const Icon = item.icon
          const showSection = !collapsed && item.section && items[index - 1]?.section !== item.section

          return (
            <Fragment key={item.to}>
              {showSection && (
                <p className="px-3 pb-1.5 pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-brass-400/70 first:pt-0">
                  {item.section}
                </p>
              )}
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    isActive ? 'text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-xl bg-lagoon-600"
                        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                      />
                    )}
                    {isActive && !collapsed && (
                      <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brass-500" />
                    )}
                    <Icon className="relative h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span className="relative truncate">{item.label}</span>}
                  </>
                )}
              </NavLink>
            </Fragment>
          )
        })}
      </nav>

      {/* Pied : accès au site public, identité, déconnexion */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <NavLink
          to="/"
          onClick={onNavigate}
          className={cn(
            'mb-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/50 transition-colors hover:bg-white/5 hover:text-white',
            collapsed && 'justify-center px-0',
          )}
          title="Voir le site public"
        >
          <ExternalLink className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Site public</span>}
        </NavLink>

        <div className={cn('flex items-center gap-3 rounded-xl bg-white/5 p-2.5', collapsed && 'justify-center p-2')}>
          <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{user.full_name}</p>
                <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-brass-400/80">
                  {ROLE_LABEL[user.role]}
                </p>
              </div>
              <button
                onClick={handleLogout}
                aria-label="Se déconnecter"
                title="Se déconnecter"
                className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        {!collapsed && (
          <p className="mt-2 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/25">
            {WORKSPACE_LABEL[user.role]}
          </p>
        )}
      </div>
    </div>
  )
}
