import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Badge, Button, Drawer, Select } from '@/components/ui'
import { AMENITIES, CITIES, DISTRICTS, SORT_OPTIONS } from '@/utils/constants'
import { cn } from '@/utils/cn'
import type { PropertyFilters as Filters, PropertyType } from '@/types'

/** Panneau de filtres du catalogue. Tiroir sur mobile, colonne sur desktop. */
export function PropertyFiltersPanel({
  filters, onChange, types, resultCount,
}: {
  filters: Filters
  onChange: (filters: Filters) => void
  types?: PropertyType[]
  resultCount?: number
}) {
  const [open, setOpen] = useState(false)

  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch, page: 1 })
  const reset = () => onChange({ sort: '-created_at', page: 1, size: filters.size })

  const activeCount = [
    filters.city, filters.district, filters.listing_type, filters.property_type_id,
    filters.min_price, filters.max_price, filters.min_area, filters.bedrooms,
  ].filter(Boolean).length

  const districts = filters.city ? (DISTRICTS[filters.city] ?? []) : []

  const body = (
    <div className="space-y-6">
      <Select
        label="Opération"
        value={filters.listing_type ?? ''}
        onChange={(event) => set({ listing_type: (event.target.value || undefined) as any })}
        options={[{ value: 'SALE', label: 'À vendre' }, { value: 'RENT', label: 'À louer' }]}
        placeholder="Vente ou location"
      />

      <Select
        label="Type de bien"
        value={filters.property_type_id ?? ''}
        onChange={(event) => set({ property_type_id: event.target.value || undefined })}
        options={(types ?? []).map((type) => ({ value: type.id, label: type.name }))}
        placeholder="Tous les types"
      />

      <Select
        label="Ville"
        value={filters.city ?? ''}
        onChange={(event) => set({ city: event.target.value || undefined, district: undefined })}
        options={CITIES.map((city) => ({ value: city, label: city }))}
        placeholder="Toutes les villes"
      />

      {districts.length > 0 && (
        <Select
          label="Quartier"
          value={filters.district ?? ''}
          onChange={(event) => set({ district: event.target.value || undefined })}
          options={districts.map((district) => ({ value: district, label: district }))}
          placeholder="Tous les quartiers"
        />
      )}

      {/* Budget : deux champs, unité rappelée pour éviter les ambiguïtés */}
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-content">Budget (FCFA)</span>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Minimum"
            value={filters.min_price ?? ''}
            onChange={(event) => set({ min_price: event.target.value ? Number(event.target.value) : undefined })}
            className="h-11 w-full rounded-xl border border-line bg-surface px-3 font-mono text-sm text-content focus:border-lagoon-500 focus:outline-none focus:ring-2 focus:ring-lagoon-500/20"
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="Maximum"
            value={filters.max_price ?? ''}
            onChange={(event) => set({ max_price: event.target.value ? Number(event.target.value) : undefined })}
            className="h-11 w-full rounded-xl border border-line bg-surface px-3 font-mono text-sm text-content focus:border-lagoon-500 focus:outline-none focus:ring-2 focus:ring-lagoon-500/20"
          />
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-content">Chambres (minimum)</span>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => set({ bedrooms: filters.bedrooms === count ? undefined : count })}
              className={cn(
                'h-10 flex-1 rounded-lg border font-mono text-sm font-semibold transition-colors',
                filters.bedrooms === count
                  ? 'border-lagoon-600 bg-lagoon-600 text-white'
                  : 'border-line bg-surface text-content-muted hover:border-line-strong hover:text-content',
              )}
            >
              {count}{count === 5 ? '+' : ''}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-content">Surface minimale</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="m²"
          value={filters.min_area ?? ''}
          onChange={(event) => set({ min_area: event.target.value ? Number(event.target.value) : undefined })}
          className="h-11 w-full rounded-xl border border-line bg-surface px-3 font-mono text-sm text-content focus:border-lagoon-500 focus:outline-none focus:ring-2 focus:ring-lagoon-500/20"
        />
      </div>

      <div>
        <span className="mb-2 block text-sm font-semibold text-content">Équipements</span>
        <div className="flex flex-wrap gap-1.5">
          {AMENITIES.slice(0, 10).map((amenity) => (
            <button
              key={amenity}
              type="button"
              onClick={() => set({ q: filters.q === amenity ? undefined : amenity })}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                filters.q === amenity
                  ? 'border-brass-500 bg-brass-500/15 text-brass-700 dark:text-brass-300'
                  : 'border-line bg-surface text-content-muted hover:border-line-strong hover:text-content',
              )}
            >
              {amenity}
            </button>
          ))}
        </div>
      </div>

      {activeCount > 0 && (
        <Button variant="ghost" fullWidth onClick={reset} icon={<X className="h-4 w-4" />}>
          Effacer les filtres
        </Button>
      )}
    </div>
  )

  return (
    <>
      {/* Barre mobile */}
      <div className="flex items-center gap-2 lg:hidden">
        <Button variant="outline" onClick={() => setOpen(true)} icon={<SlidersHorizontal className="h-4 w-4" />}>
          Filtres
          {activeCount > 0 && <Badge tone="brass" size="sm">{activeCount}</Badge>}
        </Button>
        <select
          value={filters.sort ?? '-created_at'}
          onChange={(event) => set({ sort: event.target.value })}
          className="h-11 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-content"
          aria-label="Trier"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="Filtrer les biens" side="left">
        {body}
        <div className="mt-6">
          <Button fullWidth onClick={() => setOpen(false)}>
            Voir {resultCount ?? ''} résultat{(resultCount ?? 0) > 1 ? 's' : ''}
          </Button>
        </div>
      </Drawer>

      {/* Colonne desktop */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold tracking-tight text-content">Filtres</h2>
            {activeCount > 0 && <Badge tone="brass" size="sm">{activeCount} actifs</Badge>}
          </div>
          {body}
        </div>
      </aside>
    </>
  )
}
