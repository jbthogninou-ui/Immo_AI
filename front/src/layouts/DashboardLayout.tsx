import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LogOut, Menu, Search, Settings, Sparkles, User } from 'lucide-react'
import { Avatar, Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui'
import { Sidebar } from '@/components/layout/Sidebar'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { NotificationCenter } from '@/components/layout/NotificationCenter'
import { WORKSPACE_LABEL } from '@/components/layout/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/store/uiStore'
import { ROLE_LABEL } from '@/utils/constants'
import { cn } from '@/utils/cn'

/** Gabarit des espaces connectés : barre latérale + barre supérieure. */
export function DashboardLayout() {
  const { user, logout } = useAuth()
  const { sidebarCollapsed, setAssistantOpen } = useUIStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

  if (!user) return null

  async function handleLogout() {
    await logout()
    navigate('/connexion')
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Barre latérale desktop */}
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <Sidebar />
      </div>

      {/* Tiroir mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-[80] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="absolute inset-y-0 left-0"
            >
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className={cn('flex min-w-0 flex-1 flex-col', sidebarCollapsed && 'lg:max-w-[calc(100%-76px)]')}>
        {/* Barre supérieure */}
        <header className="sticky top-0 z-40 border-b border-line glass">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-content-muted lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <p className="font-mono text-2xs uppercase tracking-[0.16em] text-content-subtle">
                {WORKSPACE_LABEL[user.role]}
              </p>
              <p className="truncate font-display text-base font-semibold tracking-tight text-content">
                Bonjour, {user.full_name.split(' ')[0]}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setAssistantOpen(true)}
                className="hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-content-subtle transition-colors hover:border-brass-500 hover:text-content md:flex"
              >
                <Search className="h-4 w-4" />
                <span>Demander à l'assistant</span>
                <kbd className="ml-2 rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-content-subtle">
                  ⌘K
                </kbd>
              </button>

              <button
                onClick={() => setAssistantOpen(true)}
                aria-label="Ouvrir l'assistant"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-brass-600 transition-colors hover:border-brass-500 md:hidden"
              >
                <Sparkles className="h-[18px] w-[18px]" />
              </button>

              <ThemeToggle />
              <NotificationCenter />

              <Dropdown
                trigger={<Avatar name={user.full_name} src={user.avatar_url} size="md" className="cursor-pointer" />}
              >
                {(close) => (
                  <>
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold text-content">{user.full_name}</p>
                      <p className="truncate text-xs text-content-subtle">{user.email}</p>
                      <p className="mt-1 font-mono text-2xs uppercase tracking-[0.12em] text-brass-600 dark:text-brass-300">
                        {ROLE_LABEL[user.role]}
                      </p>
                    </div>
                    <DropdownSeparator />
                    <DropdownItem icon={<User className="h-4 w-4" />} onClick={() => { close(); navigate('/profil') }}>
                      Mon profil
                    </DropdownItem>
                    <DropdownItem icon={<Settings className="h-4 w-4" />} onClick={() => { close(); navigate('/profil') }}>
                      Préférences
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem danger icon={<LogOut className="h-4 w-4" />} onClick={handleLogout}>
                      Se déconnecter
                    </DropdownItem>
                  </>
                )}
              </Dropdown>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
