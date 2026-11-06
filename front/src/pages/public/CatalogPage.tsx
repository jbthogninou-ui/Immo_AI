import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { Badge, Button, EmptyState, Pagination } from '@/components/ui'
import { PropertyCard, PropertyCardSkeleton } from '@/components/property/PropertyCard'
import { PropertyFiltersPanel } from '@/components/property/PropertyFilters'
import { SearchBar, type SearchValues } from '@/components/property/SearchBar'
import { useAIMutations, usePropertyTypes, usePublicProperties } from '@/hooks/useQueries'
import { SORT_OPTIONS } from '@/utils/constants'
import type { PropertyFilters } from '@/types'

/** Catalogue public : filtres, tri, pagination et recherche assistée. */
export function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const { data: types } = usePropertyTypes()
  const { assistant } = useAIMutations()
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)

  const filters = useMemo<PropertyFilters>(() => {
    const raw = Object.fromEntries(params.entries())
    return {
      q: raw.q || undefined,
      city: raw.city || undefined,
      district: raw.district || undefined,
      listing_type: (raw.listing_type as any) || undefined,
      property_type_id: raw.property_type_id || undefined,
      min_price: raw.min_price ? Number(raw.min_price) : undefined,
      max_price: raw.max_price ? Number(raw.max_price) : undefined,
      min_area: raw.min_area ? Number(raw.min_area) : undefined,
      bedrooms: raw.bedrooms ? Number(raw.bedrooms) : undefined,
      sort: raw.sort || '-created_at',
      page: raw.page ? Number(raw.page) : 1,
      size: 12,
    }
  }, [params])

  const { data, isLoading, isFetching } = usePublicProperties(filters)

  function apply(next: PropertyFilters) {
    const search = new URLSearchParams()
    Object.entries(next).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && key !== 'size') search.set(key, String(value))
    })
    setParams(search)
  }

  // Recherche en langage naturel arrivant de la page d'accueil.
  useEffect(() => {
    const smart = params.get('smart')
    const query = params.get('q')
    if (!smart || !query) return
    assistant.mutate(
      { query, include_results: true, limit: 12 },
      {
        onSuccess: (result) => {
          setAiAnswer(result.answer)
          const criteria = result.criteria
          const next: PropertyFilters = {
            city: criteria.city ?? undefined,
            district: criteria.district ?? undefined,
            listing_type: criteria.listing_type ?? undefined,
            bedrooms: criteria.bedrooms ?? undefined,
            max_price: criteria.max_price ?? undefined,
            min_area: criteria.min_area ?? undefined,
            sort: '-created_at',
            page: 1,
          }
          apply(next)
        },
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('smart')])

  function handleSearch(values: SearchValues) {
    setAiAnswer(null)
    apply({
      ...filters,
      q: values.q || undefined,
      city: values.city || undefined,
      listing_type: (values.listing_type as any) || undefined,
      max_price: values.max_price ? Number(values.max_price) : undefined,
      page: 1,
    })
  }

  function askAssistant(query: string) {
    if (!query.trim()) return
    assistant.mutate(
      { query, include_results: true, limit: 12 },
      {
        onSuccess: (result) => {
          setAiAnswer(result.answer)
          apply({
            city: result.criteria.city ?? undefined,
            district: result.criteria.district ?? undefined,
            listing_type: result.criteria.listing_type ?? undefined,
            bedrooms: result.criteria.bedrooms ?? undefined,
            max_price: result.criteria.max_price ?? undefined,
            min_area: result.criteria.min_area ?? undefined,
            sort: '-created_at',
            page: 1,
          })
        },
      },
    )
  }

  const items = data?.items ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <span className="eyebrow mb-3">Catalogue</span>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-content sm:text-4xl">
          {data ? `${data.total} bien${data.total > 1 ? 's' : ''} disponible${data.total > 1 ? 's' : ''}` : 'Catalogue immobilier'}
        </h1>
        <p className="mt-2 max-w-2xl text-content-muted text-pretty">
          Tous les biens publiés par les agences partenaires. Décrivez ce que vous cherchez en une
          phrase ou affinez avec les filtres.
        </p>
      </header>

      <div className="mb-6">
        <SearchBar
          variant="inline"
          onSearch={handleSearch}
          onAskAssistant={askAssistant}
          defaultValues={{
            q: filters.q ?? '',
            city: filters.city ?? '',
            listing_type: filters.listing_type ?? '',
            max_price: filters.max_price ? String(filters.max_price) : '',
          }}
        />
      </div>

      {/* Réponse de l'assistant */}
      {aiAnswer && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-start gap-3.5 rounded-2xl border border-brass-500/30 bg-brass-500/10 p-4"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brass-500 text-ink">
            <Sparkles className="h-4 w-4" />
          </span>
          <p className="flex-1 text-sm leading-relaxed text-content text-pretty">{aiAnswer}</p>
          <button
            onClick={() => setAiAnswer(null)}
            aria-label="Masquer la réponse"
            className="shrink-0 rounded p-1 text-content-subtle transition-colors hover:text-content"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <PropertyFiltersPanel
          filters={filters}
          onChange={apply}
          types={types}
          resultCount={data?.total}
        />

        <div>
          <div className="mb-4 hidden items-center justify-between lg:flex">
            <p className="text-sm text-content-muted">
              {isFetching ? 'Actualisation…' : `${data?.total ?? 0} résultat${(data?.total ?? 0) > 1 ? 's' : ''}`}
            </p>
            <select
              value={filters.sort}
              onChange={(event) => apply({ ...filters, sort: event.target.value, page: 1 })}
              className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-content"
              aria-label="Trier les résultats"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => <PropertyCardSkeleton key={index} />)}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface py-8">
              <EmptyState
                title="Aucun bien ne correspond"
                description="Élargissez le budget ou la zone, ou décrivez votre besoin à l'assistant pour qu'il propose des alternatives."
                action={<Button variant="outline" onClick={() => setParams(new URLSearchParams())}>Effacer les filtres</Button>}
              />
            </div>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((property, index) => (
                  <PropertyCard key={property.id} property={property} index={index} />
                ))}
              </div>

              {data && data.pages > 1 && (
                <div className="mt-6 rounded-2xl border border-line bg-surface">
                  <Pagination
                    page={data.page}
                    pages={data.pages}
                    total={data.total}
                    label="biens"
                    onChange={(page) => {
                      apply({ ...filters, page })
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
