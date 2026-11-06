import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutDashboard, LogOut, Menu, User, X } from 'lucide-react'
import { Avatar, Button, Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { homeRouteFor } from '@/utils/permissions'
import { ROLE_LABEL } from '@/utils/constants'

const LINKS = [
  { to: '/biens', label: 'Catalogue' },
  { to: '/#services', label: 'Services' },
  { to: '/#temoignages', label: 'Témoignages' },
]

/** En-tête du site public. Devient opaque au défilement. */
export function PublicHeader() {
  const { isAuthenticated, user, logout } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300 ease-swift',
        scrolled ? 'border-b border-line glass py-2' : 'border-b border-transparent py-3.5',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Navigation">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'text-lagoon-600 dark:text-brass-300' : 'text-content-muted hover:text-content',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle className="hidden sm:flex" />

          {isAuthenticated && user ? (
            <Dropdown
              trigger={
                <span className="flex items-center gap-2 rounded-xl border border-line bg-surface py-1.5 pl-1.5 pr-3 transition-colors hover:border-line-strong">
                  <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
                  <span className="hidden text-sm font-semibold text-content sm:block">
                    {user.full_name.split(' ')[0]}
                  </span>
                </span>
              }
            >
              {(close) => (
                <>
                  <div className="px-3 py-2">
                    <p className="text-sm font-semibold text-content">{user.full_name}</p>
                    <p className="font-mono text-2xs uppercase tracking-[0.12em] text-content-subtle">
                      {ROLE_LABEL[user.role]}
                    </p>
                  </div>
                  <DropdownSeparator />
                  <DropdownItem
                    icon={<LayoutDashboard className="h-4 w-4" />}
                    onClick={() => { close(); navigate(homeRouteFor(user.role)) }}
                  >
                    Mon tableau de bord
                  </DropdownItem>
                  <DropdownItem
                    icon={<User className="h-4 w-4" />}
                    onClick={() => { close(); navigate('/profil') }}
                  >
                    Mon profil
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem danger icon={<LogOut className="h-4 w-4" />} onClick={handleLogout}>
                    Se déconnecter
                  </DropdownItem>
                </>
              )}
            </Dropdown>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" size="sm" onClick={() => navigate('/connexion')}>
                Se connecter
              </Button>
              <Button size="sm" onClick={() => navigate('/inscription')}>
                Créer un compte
              </Button>
            </div>
          )}

          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-content-muted lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-canvas lg:hidden"
          >
            <div className="flex items-center justify-between px-4 py-4">
              <Logo />
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Fermer le menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-line"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 px-4 py-4">
              {LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-4 py-3.5 font-display text-xl font-semibold tracking-tight text-content transition-colors hover:bg-surface-2"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2 border-t border-line px-4 pt-5">
              <ThemeToggle className="self-start" />
              {isAuthenticated && user ? (
                <Button fullWidth onClick={() => { setMenuOpen(false); navigate(homeRouteFor(user.role)) }}>
                  Mon tableau de bord
                </Button>
              ) : (
                <>
                  <Button fullWidth onClick={() => { setMenuOpen(false); navigate('/connexion') }}>
                    Se connecter
                  </Button>
                  <Button fullWidth variant="outline" onClick={() => { setMenuOpen(false); navigate('/inscription') }}>
                    Créer un compte
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
