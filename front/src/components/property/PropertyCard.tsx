import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bath, BedDouble, Heart, MapPin, Maximize, Eye } from 'lucide-react'
import { Badge } from '@/components/ui'
import { cn } from '@/utils/cn'
import { formatArea, formatPrice } from '@/utils/format'
import { LISTING_TYPE, PROPERTY_STATUS } from '@/utils/constants'
import type { Property } from '@/types'

/**
 * Carte de bien.
 *
 * Signature visuelle : l'encadrement « fiche cadastrale » (équerres de
 * laiton qui s'écartent au survol) et la référence en monospace sur un
 * onglet, comme sur un dossier foncier.
 */
export function PropertyCard({
  property, to, isFavorite, onToggleFavorite, index = 0, compact,
}: {
  property: Property
  to?: string
  isFavorite?: boolean
  onToggleFavorite?: (property: Property) => void
  index?: number
  compact?: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const cover = property.images?.find((image) => image.is_cover) ?? property.images?.[0]
  const status = PROPERTY_STATUS[property.status]
  const href = to ?? `/biens/${property.id}`
  const isRent = property.listing_type === 'RENT'

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] }}
      className="group h-full"
    >
      <Link
        to={href}
        className={cn(
          'cadastre flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface',
          'shadow-card transition-all duration-400 ease-swift',
          'hover:-translate-y-1 hover:border-line-strong hover:shadow-lift',
        )}
      >
        {/* ---------------------------- Visuel ---------------------------- */}
        <div className={cn('relative overflow-hidden bg-lagoon-800', compact ? 'aspect-[16/10]' : 'aspect-[4/3]')}>
          {/* Repli sous l'image : dégradé de marque, jamais de vide blanc */}
          <div className="absolute inset-0 bg-brand-gradient" />
          {cover && (
            <img
              src={cover.thumbnail_url ?? cover.url}
              alt={property.title}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              className={cn(
                'relative h-full w-full object-cover transition-all duration-700 ease-swift',
                'group-hover:scale-[1.06]',
                loaded ? 'opacity-100' : 'opacity-0',
              )}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent" />

          {/* Étiquettes */}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-surface/95 px-2.5 py-1 text-2xs font-bold uppercase tracking-[0.12em] text-lagoon-700 backdrop-blur">
              {LISTING_TYPE[property.listing_type].short}
            </span>
            {property.status !== 'AVAILABLE' && (
              <Badge tone={status.tone} size="sm" className="bg-surface/95 backdrop-blur">
                {status.label}
              </Badge>
            )}
          </div>

          {onToggleFavorite && (
            <button
              type="button"
              aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              onClick={(event) => {
                event.preventDefault()
                onToggleFavorite(property)
              }}
              className={cn(
                'absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full',
                'bg-surface/90 backdrop-blur transition-all duration-200 hover:scale-110',
                isFavorite ? 'text-laterite-500' : 'text-content-muted hover:text-laterite-500',
              )}
            >
              <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
            </button>
          )}

          {/* Prix + référence, posés sur le visuel */}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
            <div>
              <p className="font-display text-2xl font-semibold leading-none tracking-tight text-white">
                {formatPrice(property.price, property.currency)}
                {isRent && <span className="ml-1 text-sm font-normal text-white/70">/mois</span>}
              </p>
              {property.charges ? (
                <p className="mt-1 text-2xs text-white/70">
                  + {formatPrice(property.charges, property.currency)} de charges
                </p>
              ) : null}
            </div>
            <span className="shrink-0 rounded-md bg-brass-500/90 px-2 py-1 font-mono text-2xs font-semibold tracking-tight text-ink">
              {property.reference.split('-').slice(-1)[0]}
            </span>
          </div>
        </div>

        {/* ---------------------------- Contenu --------------------------- */}
        <div className="flex flex-1 flex-col p-4">
          <h3 className="font-display text-base font-semibold leading-snug tracking-tight text-content transition-colors group-hover:text-lagoon-600 dark:group-hover:text-brass-300">
            {property.title}
          </h3>

          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-content-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-brass-500" />
            <span className="truncate">
              {[property.district, property.city].filter(Boolean).join(', ') || 'Localisation à préciser'}
            </span>
          </p>

          {/* Caractéristiques : une ligne de données, en monospace */}
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3.5 font-mono text-xs text-content-muted">
            {property.area ? (
              <span className="flex items-center gap-1.5">
                <Maximize className="h-3.5 w-3.5 text-content-subtle" />
                {formatArea(property.area)}
              </span>
            ) : null}
            {property.bedrooms ? (
              <span className="flex items-center gap-1.5">
                <BedDouble className="h-3.5 w-3.5 text-content-subtle" />
                {property.bedrooms} ch.
              </span>
            ) : null}
            {property.bathrooms ? (
              <span className="flex items-center gap-1.5">
                <Bath className="h-3.5 w-3.5 text-content-subtle" />
                {property.bathrooms} sdb
              </span>
            ) : null}
            {property.views_count > 0 && (
              <span className="ml-auto flex items-center gap-1.5 text-content-subtle">
                <Eye className="h-3.5 w-3.5" />
                {property.views_count}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.article>
  )
}

/** Squelette calé sur les proportions réelles de la carte. */
export function PropertyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="skeleton aspect-[4/3]" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-5 w-4/5 rounded-lg" />
        <div className="skeleton h-4 w-2/3 rounded-lg" />
        <div className="skeleton h-4 w-1/2 rounded-lg" />
      </div>
    </div>
  )
}
