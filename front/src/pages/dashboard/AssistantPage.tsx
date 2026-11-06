import { useState } from 'react'
import { Calculator, FileText, Gauge, Sparkles } from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, Input, Select, Textarea } from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAIMutations, useProperties, usePropertyTypes } from '@/hooks/useQueries'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/store/uiStore'
import { toast } from '@/store/toastStore'
import { AMENITIES, CITIES } from '@/utils/constants'
import { formatCompactPrice, formatPrice } from '@/utils/format'
import { cn } from '@/utils/cn'

/**
 * Atelier IA en pleine page.
 * L'assistant flottant sert aux questions rapides ; cette page sert aux
 * traitements où l'on veut voir le détail du calcul.
 * Outil professionnel (estimation, rédaction, contrôle d'annonce) : réservé
 * aux agences/agents. Les clients ont l'assistant conversationnel, qui reste
 * centré sur la recherche de biens.
 */
export function AssistantPage() {
  const { setAssistantOpen } = useUIStore()
  const { isClient } = useAuth()
  const { data: types } = usePropertyTypes()
  const { data: properties } = useProperties({ size: 100 })
  const { estimate, describe, analyze } = useAIMutations()

  const [form, setForm] = useState<Record<string, any>>({
    city: 'Cotonou', listing_type: 'SALE', area: 200,
  })
  const [amenities, setAmenities] = useState<string[]>([])
  const [analyzeId, setAnalyzeId] = useState('')

  const set = (patch: Record<string, any>) => setForm((current) => ({ ...current, ...patch }))

  const payload = () => ({
    property_type: types?.find((type) => type.id === form.property_type_id)?.name,
    city: form.city,
    district: form.district || undefined,
    area: form.area ? Number(form.area) : undefined,
    bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
    rooms: form.rooms ? Number(form.rooms) : undefined,
    listing_type: form.listing_type,
    amenities,
  })

  if (isClient) {
    return (
      <div>
        <PageHeader
          eyebrow="Assistance"
          title="Assistant immobilier"
          description="Posez vos questions sur les biens, les visites ou vos démarches."
        />
        <EmptyState
          title="Utilisez l'assistant conversationnel"
          description="L'estimation de prix et la rédaction d'annonces sont réservées aux agences et agents. Pour trouver un bien ou poser une question, ouvrez l'assistant en bas à droite."
          action={
            <Button icon={<Sparkles className="h-4 w-4" />} onClick={() => setAssistantOpen(true)}>
              Ouvrir l'assistant
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Assistance"
        title="Atelier IA"
        description="Estimation de prix, rédaction d'annonce et contrôle qualité. Chaque résultat affiche la méthode qui l'a produit."
        actions={
          <Button variant="outline" icon={<Sparkles className="h-4 w-4" />} onClick={() => setAssistantOpen(true)}>
            Ouvrir l'assistant conversationnel
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ------------------------- Caractéristiques ------------------- */}
        <Card className="lg:row-span-2">
          <CardHeader eyebrow="Données d'entrée" title="Caractéristiques du bien" subtitle="Servent à l'estimation comme à la rédaction" />
          <div className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Type de bien"
                value={form.property_type_id ?? ''}
                onChange={(event) => set({ property_type_id: event.target.value })}
                options={(types ?? []).map((type) => ({ value: type.id, label: type.name }))}
                placeholder="Sélectionner"
              />
              <Select
                label="Opération"
                value={form.listing_type}
                onChange={(event) => set({ listing_type: event.target.value })}
                options={[{ value: 'SALE', label: 'Vente' }, { value: 'RENT', label: 'Location' }]}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Ville"
                value={form.city}
                onChange={(event) => set({ city: event.target.value })}
                options={CITIES.map((city) => ({ value: city, label: city }))}
              />
              <Input label="Quartier" value={form.district ?? ''} onChange={(event) => set({ district: event.target.value })} placeholder="Fidjrossè" />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Surface (m²)" type="number" className="font-mono" value={form.area ?? ''} onChange={(event) => set({ area: event.target.value })} />
              <Input label="Pièces" type="number" className="font-mono" value={form.rooms ?? ''} onChange={(event) => set({ rooms: event.target.value })} />
              <Input label="Chambres" type="number" className="font-mono" value={form.bedrooms ?? ''} onChange={(event) => set({ bedrooms: event.target.value })} />
            </div>

            <div>
              <span className="mb-2 block text-sm font-semibold text-content">Équipements</span>
              <div className="flex flex-wrap gap-1.5">
                {AMENITIES.map((amenity) => {
                  const active = amenities.includes(amenity)
                  return (
                    <button
                      key={amenity}
                      type="button"
                      onClick={() =>
                        setAmenities(active ? amenities.filter((item) => item !== amenity) : [...amenities, amenity])
                      }
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                        active
                          ? 'border-lagoon-600 bg-lagoon-600 text-white'
                          : 'border-line bg-surface text-content-muted hover:border-line-strong',
                      )}
                    >
                      {amenity}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button
                loading={estimate.isPending}
                icon={<Calculator className="h-4 w-4" />}
                onClick={() => estimate.mutate(payload())}
              >
                Estimer le prix
              </Button>
              <Button
                variant="outline"
                loading={describe.isPending}
                icon={<FileText className="h-4 w-4" />}
                onClick={() => describe.mutate({ ...payload(), tone: 'professionnel', max_words: 180 })}
              >
                Rédiger l'annonce
              </Button>
            </div>
          </div>
        </Card>

        {/* ---------------------------- Estimation ---------------------- */}
        <Card>
          <CardHeader eyebrow="Résultat" title="Estimation de prix" />
          <div className="p-5">
            {estimate.data ? (
              <div>
                <p className="font-display text-4xl font-semibold tracking-tight text-content">
                  {formatPrice(estimate.data.suggested_price, estimate.data.currency)}
                </p>
                <p className="mt-2 font-mono text-sm text-content-muted">
                  {formatCompactPrice(estimate.data.price_range_min)} — {formatCompactPrice(estimate.data.price_range_max)}
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-brass-500 transition-all duration-700"
                      style={{ width: `${estimate.data.confidence * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-content-subtle">
                    confiance {Math.round(estimate.data.confidence * 100)} %
                  </span>
                </div>

                <p className="mt-4 rounded-xl border border-line bg-surface-2 p-3.5 text-sm leading-relaxed text-content-muted text-pretty">
                  {estimate.data.explanation}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="neutral" size="sm">{estimate.data.comparables_count} comparable(s)</Badge>
                  <Badge tone="brass" size="sm">{estimate.data.method}</Badge>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-content-subtle text-pretty">
                Renseignez les caractéristiques puis lancez l'estimation. Le calcul s'appuie
                d'abord sur les biens comparables de votre portefeuille.
              </p>
            )}
          </div>
        </Card>

        {/* ---------------------------- Rédaction ----------------------- */}
        <Card>
          <CardHeader eyebrow="Résultat" title="Annonce rédigée" />
          <div className="p-5">
            {describe.data ? (
              <div>
                {describe.data.title_suggestion && (
                  <p className="font-display text-lg font-semibold tracking-tight text-content">
                    {describe.data.title_suggestion}
                  </p>
                )}
                <Textarea
                  className="mt-3"
                  rows={8}
                  defaultValue={describe.data.description}
                  key={describe.data.description}
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {describe.data.highlights.map((highlight) => (
                    <Badge key={highlight} tone="brass" size="sm">{highlight}</Badge>
                  ))}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ml-auto"
                    onClick={() => {
                      navigator.clipboard.writeText(describe.data!.description)
                      toast.success('Description copiée')
                    }}
                  >
                    Copier
                  </Button>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-content-subtle text-pretty">
                La description générée reste modifiable avant publication. Relisez-la toujours :
                elle décrit un bien réel.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* ------------------------ Contrôle d'annonce -------------------- */}
      <Card className="mt-4">
        <CardHeader eyebrow="Contrôle qualité" title="Analyser une annonce publiée" subtitle="Complétude des champs et qualité rédactionnelle" />
        <div className="p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1">
              <Select
                label="Bien à analyser"
                value={analyzeId}
                onChange={(event) => setAnalyzeId(event.target.value)}
                options={(properties?.items ?? []).map((property) => ({
                  value: property.id,
                  label: `${property.reference} — ${property.title.slice(0, 45)}`,
                }))}
                placeholder="Sélectionner un bien"
              />
            </div>
            <Button
              loading={analyze.isPending}
              icon={<Gauge className="h-4 w-4" />}
              onClick={() => {
                if (!analyzeId) {
                  toast.error('Aucun bien sélectionné', 'Choisissez le bien à analyser.')
                  return
                }
                analyze.mutate({ property_id: analyzeId })
              }}
            >
              Analyser
            </Button>
          </div>

          {analyze.data && (
            <div className="mt-6 grid gap-5 md:grid-cols-[auto_1fr]">
              <div className="text-center">
                <p
                  className={cn(
                    'font-display text-5xl font-semibold tracking-tight',
                    analyze.data.score >= 80 ? 'text-lagoon-600 dark:text-lagoon-300'
                      : analyze.data.score >= 55 ? 'text-brass-600 dark:text-brass-300'
                      : 'text-laterite-500',
                  )}
                >
                  {analyze.data.score}
                </p>
                <p className="mt-1 font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">
                  sur 100
                </p>
              </div>

              <div className="space-y-4">
                {analyze.data.missing_fields.length > 0 && (
                  <div>
                    <p className="font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">
                      Champs manquants
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {analyze.data.missing_fields.map((field) => (
                        <Badge key={field} tone="warning" size="sm">{field}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {analyze.data.quality_issues.length > 0 && (
                  <div>
                    <p className="font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">
                      Points de vigilance
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {analyze.data.quality_issues.map((issue) => (
                        <li key={issue} className="flex gap-2 text-sm text-content-muted">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-laterite-500" />
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">
                    Recommandations
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {analyze.data.suggestions.map((suggestion) => (
                      <li key={suggestion} className="flex gap-2 text-sm text-content-muted">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lagoon-500" />
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
