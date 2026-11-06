import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

/** En-tête standard des pages de tableau de bord. */
export function PageHeader({
  eyebrow, title, description, actions, className,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}
    >
      <div className="min-w-0">
        {eyebrow && <span className="eyebrow mb-2">{eyebrow}</span>}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-content sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-content-muted text-pretty">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </motion.div>
  )
}
