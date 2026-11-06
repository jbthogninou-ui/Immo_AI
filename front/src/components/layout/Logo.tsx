import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'

/**
 * Marque : le sigle reprend l'équerre du toit et la ligne d'horizon
 * de la lagune, en laiton sur fond vert profond.
 */
export function Logo({
  to = '/', className, invert, compact,
}: {
  to?: string
  className?: string
  invert?: boolean
  compact?: boolean
}) {
  return (
    <Link to={to} className={cn('group flex items-center gap-2.5', className)}>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-lagoon-600 transition-transform duration-300 group-hover:scale-105">
        <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
          <path d="M7 19.5 16 9l9 10.5" fill="none" stroke="#C8963E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.5 18v6h11v-6" fill="none" stroke="#F5E9CF" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={cn('font-display text-lg font-semibold tracking-tight', invert ? 'text-white' : 'text-content')}>
            ImmoFlow
            <span className="ml-1 text-brass-500">AI</span>
          </span>
          <span className={cn('mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em]', invert ? 'text-white/50' : 'text-content-subtle')}>
            Plateforme immobilière
          </span>
        </span>
      )}
    </Link>
  )
}
