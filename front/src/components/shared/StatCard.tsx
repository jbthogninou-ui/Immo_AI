import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * Indicateur chiffré.
 * La valeur est en display serif — c'est le chiffre qu'on lit d'abord,
 * pas le libellé.
 */
export function StatCard({
  label, value, delta, hint, icon, index = 0, accent, footer,
}: {
  label: string
  value: ReactNode
  delta?: number
  hint?: string
  icon?: ReactNode
  index?: number
  accent?: boolean
  footer?: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-5 shadow-card transition-all duration-300 hover:shadow-lift',
        accent
          ? 'border-transparent bg-brand-gradient text-white'
          : 'border-line bg-surface',
      )}
    >
      {accent && <div className="absolute inset-0 bg-grain opacity-[0.06]" />}

      <div className="relative flex items-start justify-between gap-3">
        <p
          className={cn(
            'font-mono text-2xs uppercase tracking-[0.16em]',
            accent ? 'text-brass-200' : 'text-content-subtle',
          )}
        >
          {label}
        </p>
        {icon && (
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              accent ? 'bg-white/10 text-brass-300' : 'bg-surface-2 text-lagoon-600 dark:text-brass-300',
            )}
          >
            {icon}
          </span>
        )}
      </div>

      <p
        className={cn(
          'relative mt-3 font-display text-3xl font-semibold leading-none tracking-tight',
          accent ? 'text-white' : 'text-content',
        )}
      >
        {value}
      </p>

      <div className="relative mt-2.5 flex items-center gap-2">
        {delta !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-2xs font-semibold',
              delta >= 0
                ? 'bg-lagoon-500/15 text-lagoon-600 dark:text-lagoon-300'
                : 'bg-laterite-500/15 text-laterite-500',
              accent && 'bg-white/15 text-white',
            )}
          >
            {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)} %
          </span>
        )}
        {hint && (
          <span className={cn('text-xs', accent ? 'text-white/60' : 'text-content-subtle')}>{hint}</span>
        )}
      </div>

      {footer && <div className="relative mt-4">{footer}</div>}
    </motion.div>
  )
}
