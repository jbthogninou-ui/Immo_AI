/* ============================================================
   Librairie UI — composants de base partagés par tout le produit.
   Chaque composant s'appuie sur les jetons de design (surface,
   line, content) et n'écrit jamais de couleur de thème en dur.
   ============================================================ */
import {
  createContext, forwardRef, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle, Check, ChevronDown, Info, Loader2, Search, X, XCircle,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { initials } from '@/utils/format'
import type { Tone } from '@/utils/constants'

/* ==========================================================
   Button
   ========================================================== */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'brass'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-lagoon-600 text-white hover:bg-lagoon-700 active:bg-lagoon-800 shadow-card hover:shadow-lift dark:bg-lagoon-500 dark:hover:bg-lagoon-400',
  brass:
    'bg-brass-500 text-ink hover:bg-brass-400 active:bg-brass-600 shadow-card hover:shadow-brass',
  secondary:
    'bg-surface-2 text-content hover:bg-surface-3 border border-line',
  outline:
    'border border-line-strong text-content hover:border-lagoon-500 hover:text-lagoon-600 dark:hover:text-lagoon-300 bg-transparent',
  ghost:
    'text-content-muted hover:text-content hover:bg-surface-2',
  danger:
    'bg-laterite-500 text-white hover:bg-laterite-600 shadow-card',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-14 px-9 text-base gap-2.5',
  icon: 'h-10 w-10 justify-center',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, icon, iconRight, fullWidth, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center rounded-xl font-semibold tracking-tight',
        'transition-all duration-200 ease-swift',
        'disabled:pointer-events-none disabled:opacity-50',
        'active:scale-[0.98]',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full justify-center',
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  )
})

/* ==========================================================
   Input / Textarea / Select
   ========================================================== */
const FIELD_BASE =
  'w-full rounded-xl border bg-surface px-4 text-sm text-content placeholder:text-content-subtle ' +
  'transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ' +
  'border-line hover:border-line-strong focus:border-lagoon-500 focus:outline-none ' +
  'focus:ring-2 focus:ring-lagoon-500/20'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  icon?: ReactNode
  suffix?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, error, icon, suffix, id, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-content">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-content-subtle">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(
            FIELD_BASE, 'h-11',
            icon && 'pl-10',
            suffix && 'pr-12',
            error && 'border-laterite-500 focus:border-laterite-500 focus:ring-laterite-500/20',
            className,
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-content-subtle">
            {suffix}
          </span>
        )}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-laterite-500">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-content-subtle">{hint}</p>
      ) : null}
    </div>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, label, hint, error, id, rows = 4, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 block text-sm font-semibold text-content">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        className={cn(FIELD_BASE, 'resize-y py-3 leading-relaxed', error && 'border-laterite-500', className)}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-laterite-500">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-content-subtle">{hint}</p>
      ) : null}
    </div>
  )
})

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, error, options, placeholder, id, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 block text-sm font-semibold text-content">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          className={cn(FIELD_BASE, 'h-11 appearance-none pr-10', error && 'border-laterite-500', className)}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-laterite-500">{error}</p>}
    </div>
  )
})

/* ==========================================================
   Switch
   ========================================================== */
export function Switch({
  checked, onChange, label, description, disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
}) {
  return (
    <label className={cn('flex items-start gap-3', disabled ? 'opacity-60' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-300',
          checked ? 'bg-lagoon-600' : 'bg-line-strong',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-semibold text-content">{label}</span>}
          {description && <span className="block text-xs text-content-muted">{description}</span>}
        </span>
      )}
    </label>
  )
}

/* ==========================================================
   Badge
   ========================================================== */
const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-content-muted border-line',
  success: 'bg-lagoon-50 text-lagoon-700 border-lagoon-200 dark:bg-lagoon-800/40 dark:text-lagoon-200 dark:border-lagoon-600',
  warning: 'bg-brass-50 text-brass-700 border-brass-200 dark:bg-brass-800/30 dark:text-brass-200 dark:border-brass-700',
  danger: 'bg-laterite-400/10 text-laterite-600 border-laterite-400/30 dark:text-laterite-400',
  info: 'bg-lagoon-100/60 text-lagoon-600 border-lagoon-200 dark:bg-lagoon-700/40 dark:text-lagoon-200 dark:border-lagoon-600',
  brass: 'bg-brass-500/15 text-brass-700 border-brass-500/30 dark:text-brass-300',
}

export function Badge({
  children, tone = 'neutral', className, dot, size = 'md',
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  dot?: boolean
  size?: 'sm' | 'md'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/* ==========================================================
   Card
   ========================================================== */
export function Card({
  children, className, hover, as: Tag = 'div', ...props
}: {
  children: ReactNode
  className?: string
  hover?: boolean
  as?: any
  [key: string]: any
}) {
  return (
    <Tag
      className={cn(
        'rounded-2xl border border-line bg-surface shadow-card',
        hover && 'transition-all duration-300 ease-swift hover:-translate-y-0.5 hover:shadow-lift hover:border-line-strong',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({
  title, subtitle, action, className, eyebrow,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
  eyebrow?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-line px-5 py-4', className)}>
      <div className="min-w-0">
        {eyebrow && <span className="eyebrow mb-1.5">{eyebrow}</span>}
        <h3 className="truncate font-display text-lg font-semibold tracking-tight text-content">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-content-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ==========================================================
   Avatar
   ========================================================== */
export function Avatar({
  name, src, size = 'md', className, ring,
}: {
  name?: string | null
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  ring?: boolean
}) {
  const sizes = {
    xs: 'h-6 w-6 text-2xs',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-xl',
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-lagoon-600 font-bold uppercase tracking-wide text-brass-200',
        ring && 'ring-2 ring-surface',
        sizes[size],
        className,
      )}
      title={name ?? undefined}
    >
      {src ? (
        <img src={src} alt={name ?? ''} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  )
}

/* ==========================================================
   Modal
   ========================================================== */
export function Modal({
  open, onClose, title, description, children, footer, size = 'md',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={cn(
              'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-line',
              'bg-surface shadow-lift sm:rounded-2xl', sizes[size],
            )}
          >
            {(title || description) && (
              <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
                <div>
                  {title && (
                    <h2 className="font-display text-xl font-semibold tracking-tight text-content">{title}</h2>
                  )}
                  {description && <p className="mt-1 text-sm text-content-muted">{description}</p>}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fermer"
                  className="rounded-lg p-1.5 text-content-subtle transition-colors hover:bg-surface-2 hover:text-content"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && (
              <div className="flex items-center justify-end gap-3 border-t border-line bg-surface-2/60 px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/* ==========================================================
   Drawer
   ========================================================== */
export function Drawer({
  open, onClose, title, children, side = 'right', width = 'max-w-lg', footer,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  side?: 'right' | 'left'
  width?: string
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: side === 'right' ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: side === 'right' ? '100%' : '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className={cn(
              'absolute inset-y-0 flex w-full flex-col border-line bg-surface shadow-lift',
              side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
              width,
            )}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-line px-6 py-5">
                <h2 className="font-display text-lg font-semibold tracking-tight text-content">{title}</h2>
                <button
                  onClick={onClose}
                  aria-label="Fermer"
                  className="rounded-lg p-1.5 text-content-subtle transition-colors hover:bg-surface-2 hover:text-content"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && (
              <div className="flex items-center justify-end gap-3 border-t border-line px-6 py-4">{footer}</div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}

/* ==========================================================
   Dropdown
   ========================================================== */
export function Dropdown({
  trigger, children, align = 'right', className,
}: {
  trigger: ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'left' | 'right'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {trigger}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'absolute z-50 mt-2 min-w-[13rem] overflow-hidden rounded-xl border border-line',
              'bg-surface p-1.5 shadow-lift',
              align === 'right' ? 'right-0' : 'left-0',
              className,
            )}
          >
            {typeof children === 'function' ? children(() => setOpen(false)) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function DropdownItem({
  children, onClick, icon, danger, className,
}: {
  children: ReactNode
  onClick?: () => void
  icon?: ReactNode
  danger?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
        danger
          ? 'text-laterite-500 hover:bg-laterite-400/10'
          : 'text-content-muted hover:bg-surface-2 hover:text-content',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export const DropdownSeparator = () => <div className="my-1.5 h-px bg-line" />

/* ==========================================================
   Table
   ========================================================== */
export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T, index: number) => ReactNode
  className?: string
  headerClassName?: string
  /** Masqué sous 768 px pour garder les tableaux lisibles sur mobile. */
  hideOnMobile?: boolean
}

export function Table<T>({
  columns, rows, loading, empty, onRowClick, rowKey, compact,
}: {
  columns: Column<T>[]
  rows: T[]
  loading?: boolean
  empty?: ReactNode
  onRowClick?: (row: T) => void
  rowKey: (row: T, index: number) => string
  compact?: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton h-12 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!rows.length) {
    return <div className="p-10">{empty ?? <EmptyState title="Aucun élément" />}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'whitespace-nowrap px-4 py-3 text-left font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-content-subtle',
                  column.hideOnMobile && 'hidden md:table-cell',
                  column.headerClassName,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-line/70 transition-colors last:border-0',
                onRowClick && 'cursor-pointer hover:bg-surface-2/70',
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-4 align-middle text-content',
                    compact ? 'py-2.5' : 'py-3.5',
                    column.hideOnMobile && 'hidden md:table-cell',
                    column.className,
                  )}
                >
                  {column.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ==========================================================
   Pagination
   ========================================================== */
export function Pagination({
  page, pages, total, onChange, label = 'éléments',
}: {
  page: number
  pages: number
  total: number
  onChange: (page: number) => void
  label?: string
}) {
  if (pages <= 1) {
    return (
      <div className="px-4 py-3 text-xs text-content-subtle">
        {total} {label}
      </div>
    )
  }

  const windowStart = Math.max(1, Math.min(page - 2, pages - 4))
  const visible = Array.from({ length: Math.min(5, pages) }, (_, index) => windowStart + index)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-xs text-content-subtle">
        Page {page} sur {pages} · {total} {label}
      </p>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Précédent
        </Button>
        {visible.map((value) => (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={cn(
              'h-9 min-w-9 rounded-lg px-2.5 font-mono text-xs font-semibold transition-colors',
              value === page
                ? 'bg-lagoon-600 text-white'
                : 'text-content-muted hover:bg-surface-2 hover:text-content',
            )}
          >
            {value}
          </button>
        ))}
        <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Suivant
        </Button>
      </div>
    </div>
  )
}

/* ==========================================================
   Tabs
   ========================================================== */
const TabsContext = createContext<{ value: string; setValue: (value: string) => void } | null>(null)

export function Tabs({
  value, onChange, children, className,
}: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <TabsContext.Provider value={{ value, setValue: onChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('no-scrollbar flex gap-1 overflow-x-auto border-b border-line', className)}>
      {children}
    </div>
  )
}

export function Tab({ value, children, count }: { value: string; children: ReactNode; count?: number }) {
  const context = useContext(TabsContext)!
  const active = context.value === value

  return (
    <button
      type="button"
      onClick={() => context.setValue(value)}
      className={cn(
        'relative whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition-colors',
        active ? 'text-lagoon-600 dark:text-brass-300' : 'text-content-subtle hover:text-content',
      )}
    >
      <span className="flex items-center gap-2">
        {children}
        {count !== undefined && (
          <span className={cn(
            'rounded-full px-1.5 py-0.5 font-mono text-2xs',
            active ? 'bg-lagoon-600/10 text-lagoon-600 dark:bg-brass-500/20 dark:text-brass-300' : 'bg-surface-2 text-content-subtle',
          )}>
            {count}
          </span>
        )}
      </span>
      {active && (
        <motion.span
          layoutId="tab-underline"
          className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brass-500"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
    </button>
  )
}

/* ==========================================================
   États : vide, chargement, erreur
   ========================================================== */
export function EmptyState({
  title, description, icon, action, className,
}: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface-2 text-content-subtle">
        {icon ?? <Search className="h-6 w-6" />}
      </div>
      <h3 className="font-display text-lg font-semibold tracking-tight text-content">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-content-muted text-pretty">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-xl', className)} />
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-lagoon-500', className)} />
}

/* ==========================================================
   Toasts
   ========================================================== */
const TOAST_ICON: Record<string, ReactNode> = {
  success: <Check className="h-4 w-4" />,
  error: <XCircle className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
}

const TOAST_STYLE: Record<string, string> = {
  success: 'border-lagoon-500/40 bg-lagoon-600 text-white',
  error: 'border-laterite-500/40 bg-laterite-500 text-white',
  warning: 'border-brass-500/40 bg-brass-500 text-ink',
  info: 'border-line bg-surface text-content',
}

export function ToastViewport({
  toasts, onDismiss,
}: {
  toasts: Array<{ id: string; title: string; description?: string; tone: string }>
  onDismiss: (id: string) => void
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2.5">
      <AnimatePresence>
        {toasts.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lift',
              TOAST_STYLE[item.tone],
            )}
          >
            <span className="mt-0.5 shrink-0">{TOAST_ICON[item.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-xs opacity-90 text-pretty">{item.description}</p>
              )}
            </div>
            <button
              onClick={() => onDismiss(item.id)}
              aria-label="Fermer"
              className="shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ==========================================================
   Boîte de confirmation
   ========================================================== */
export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel = 'Confirmer', tone = 'primary', loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  tone?: 'primary' | 'danger'
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-content-muted">
        Cette action sera immédiatement appliquée et visible par les personnes concernées.
      </p>
    </Modal>
  )
}
