import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Building2, MapPin, Search, Sparkles, Wallet } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/utils/cn'
import { CITIES } from '@/utils/constants'

export interface SearchValues {
  q: string
  city: string
  listing_type: string
  max_price: string
}

const BUDGETS = [
  { value: '', label: 'Tous budgets' },
  { value: '25000000', label: "Jusqu'à 25 M" },
  { value: '60000000', label: "Jusqu'à 60 M" },
  { value: '120000000', label: "Jusqu'à 120 M" },
  { value: '250000000', label: "Jusqu'à 250 M" },
]

const EXAMPLES = [
  'Villa 4 chambres à Fidjrossè',
  'Appartement meublé Haie Vive',
  'Terrain titré à Godomey',
  'Bureau 180 m² Ganhi',
]

/**
 * Barre de recherche principale.
 *
 * Deux modes : recherche par critères (listes déroulantes) ou saisie
 * en langage naturel confiée à l'assistant. Le basculement est explicite
 * pour que l'utilisateur sache toujours ce qu'il interroge.
 */
export function SearchBar({
  onSearch, onAskAssistant, className, defaultValues, variant = 'hero',
}: {
  onSearch: (values: SearchValues) => void
  onAskAssistant?: (query: string) => void
  className?: string
  defaultValues?: Partial<SearchValues>
  variant?: 'hero' | 'inline'
}) {
  const [smart, setSmart] = useState(false)
  const [values, setValues] = useState<SearchValues>({
    q: defaultValues?.q ?? '',
    city: defaultValues?.city ?? '',
    listing_type: defaultValues?.listing_type ?? '',
    max_price: defaultValues?.max_price ?? '',
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (smart && onAskAssistant) onAskAssistant(values.q)
    else onSearch(values)
  }

  const field = 'h-12 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-sm text-content ' +
    'transition-colors focus:border-lagoon-500 focus:outline-none focus:ring-2 focus:ring-lagoon-500/20'

  return (
    <div className={cn('w-full', className)}>
      {/* Bascule critères / langage naturel */}
      {onAskAssistant && (
        <div className="mb-3 inline-flex rounded-xl border border-line bg-surface p-1 shadow-card">
          {[
            { key: false, label: 'Par critères', icon: <Search className="h-3.5 w-3.5" /> },
            { key: true, label: 'Recherche intelligente', icon: <Sparkles className="h-3.5 w-3.5" /> },
          ].map((mode) => (
            <button
              key={String(mode.key)}
              type="button"
              onClick={() => setSmart(mode.key)}
              className={cn(
                'relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors',
                smart === mode.key ? 'text-white' : 'text-content-muted hover:text-content',
              )}
            >
              {smart === mode.key && (
                <motion.span
                  layoutId="search-mode"
                  className="absolute inset-0 rounded-lg bg-lagoon-600"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative flex items-center gap-2">{mode.icon}{mode.label}</span>
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={submit}
        className={cn(
          'rounded-2xl border border-line bg-surface p-2 shadow-lift',
          variant === 'hero' && 'sm:p-2.5',
        )}
      >
        {smart ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Sparkles className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brass-500" />
              <input
                value={values.q}
                onChange={(event) => setValues({ ...values, q: event.target.value })}
                placeholder="Décrivez le bien recherché — ex. maison 4 chambres proche centre, budget 60 millions"
                className={field}
                aria-label="Recherche en langage naturel"
              />
            </div>
            <Button type="submit" size="lg" variant="brass" icon={<Sparkles className="h-4 w-4" />}>
              Demander
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
              <input
                value={values.q}
                onChange={(event) => setValues({ ...values, q: event.target.value })}
                placeholder="Quartier, référence, mot-clé"
                className={field}
                aria-label="Mot-clé"
              />
            </div>

            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
              <select
                value={values.city}
                onChange={(event) => setValues({ ...values, city: event.target.value })}
                className={cn(field, 'appearance-none')}
                aria-label="Ville"
              >
                <option value="">Toutes les villes</option>
                {CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>

            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
              <select
                value={values.listing_type}
                onChange={(event) => setValues({ ...values, listing_type: event.target.value })}
                className={cn(field, 'appearance-none')}
                aria-label="Type d'opération"
              >
                <option value="">Vente ou location</option>
                <option value="SALE">À vendre</option>
                <option value="RENT">À louer</option>
              </select>
            </div>

            <div className="relative">
              <Wallet className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
              <select
                value={values.max_price}
                onChange={(event) => setValues({ ...values, max_price: event.target.value })}
                className={cn(field, 'appearance-none')}
                aria-label="Budget maximum"
              >
                {BUDGETS.map((budget) => (
                  <option key={budget.value} value={budget.value}>{budget.label}</option>
                ))}
              </select>
            </div>

            <Button type="submit" size="lg" className="lg:px-6" icon={<Search className="h-4 w-4" />}>
              <span className="lg:hidden">Rechercher</span>
              <span className="hidden lg:inline">Chercher</span>
            </Button>
          </div>
        )}
      </form>

      {smart && variant === 'hero' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">Essayez</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setValues({ ...values, q: example })}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-content-muted transition-colors hover:border-brass-500 hover:text-content"
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
