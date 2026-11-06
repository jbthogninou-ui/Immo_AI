import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Bath, BedDouble, Building2, CalendarPlus, Check, Compass, Heart,
  Layers, MapPin, Maximize, MessageSquare, Phone, Ruler, Share2,
} from 'lucide-react'
import { Badge, Button, Card, Input, Modal, Skeleton, Textarea } from '@/components/ui'
import { PropertyGallery } from '@/components/property/PropertyGallery'
import { PropertyCard } from '@/components/property/PropertyCard'
import { useAuth } from '@/hooks/useAuth'
import {
  useClientMutations, useFavorites, useMessagingMutations, useProperty, usePublicProperties,
  useVisitMutations,
} from '@/hooks/useQueries'
import { toast } from '@/store/toastStore'
import { formatArea, formatDate, formatPrice, formatNumber } from '@/utils/format'
import { LISTING_TYPE, PROPERTY_STATUS } from '@/utils/constants'
import { cn } from '@/utils/cn'

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated, isClient } = useAuth()
  const { data: property, isLoading } = useProperty(id, !isAuthenticated)
  const { data: favorites } = useFavorites(isClient ? user?.client_id : null)
  const { toggleFavorite } = useClientMutations()
  const { request } = useVisitMutations()
  const { create: createConversation } = useMessagingMutations()

  const [visitOpen, setVisitOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [visitDate, setVisitDate] = useState('')
  const [visitMessage, setVisitMessage] = useState('')
  const [contactMessage, setContactMessage] = useState('')

  const { data: similar } = usePublicProperties({
    city: property?.city ?? undefined, size: 3, sort: '-created_at',
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="aspect-[16/9] w-full" />
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-content">
          Ce bien n'est plus disponible
        </h1>
        <p className="mt-2 text-content-muted">
          Il a peut-être été vendu, loué ou retiré du catalogue.
        </p>
        <Button className="mt-6" onClick={() => navigate('/biens')}>
          Retour au catalogue
        </Button>
      </div>
    )
  }

  const isFavorite = favorites?.items.some((favorite) => favorite.property_id === property.id) ?? false
  const isRent = property.listing_type === 'RENT'
  const status = PROPERTY_STATUS[property.status]

  const specs = [
    { icon: Maximize, label: 'Surface habitable', value: formatArea(property.area) },
    { icon: Ruler, label: 'Surface du terrain', value: formatArea(property.land_area) },
    { icon: Layers, label: 'Pièces', value: property.rooms ? `${property.rooms} pièces` : '—' },
    { icon: BedDouble, label: 'Chambres', value: property.bedrooms ? `${property.bedrooms}` : '—' },
    { icon: Bath, label: "Salles d'eau", value: property.bathrooms ? `${property.bathrooms}` : '—' },
    { icon: Building2, label: 'Année de construction', value: property.year_built ? `${property.year_built}` : '—' },
  ].filter((spec) => spec.value !== '—')

  function submitVisit() {
    if (!visitDate) {
      toast.error('Choisissez une date', 'Indiquez le créneau qui vous convient.')
      return
    }
    request.mutate(
      {
        property_id: property!.id,
        scheduled_at: new Date(visitDate).toISOString(),
        duration_minutes: 45,
        client_message: visitMessage || undefined,
      },
      {
        onSuccess: () => {
          setVisitOpen(false)
          setVisitDate('')
          setVisitMessage('')
        },
      },
    )
  }

  function submitContact() {
    if (!user?.client_id) {
      navigate('/connexion')
      return
    }
    const recipientId = property!.agent_user_id ?? property!.agency_contact_user_id
    if (!recipientId) {
      toast.error(
        "Pas encore d'agent affecté",
        "Ce bien n'a pas encore d'agent assigné. Demandez une visite, l'agence vous répondra rapidement.",
      )
      return
    }
    // Crée (ou retrouve) la conversation avec l'agent en charge du bien, afin
    // que l'échange apparaisse dans la messagerie avec un accès direct au bien.
    createConversation.mutate(
      {
        type: 'CLIENT_AGENT',
        participant_ids: [recipientId],
        subject: `${property!.title} — ${property!.reference}`,
        property_id: property!.id,
        initial_message: contactMessage,
      },
      {
        onSuccess: (conversation) => {
          setContactOpen(false)
          setContactMessage('')
          navigate(`/espace-client/messages?conversation=${conversation.id}`)
        },
      },
    )
  }

  function share() {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: property!.title, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url)
      toast.success('Lien copié', "L'adresse du bien est dans le presse-papiers.")
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        to="/biens"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-content-muted transition-colors hover:text-content"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au catalogue
      </Link>

      <PropertyGallery images={property.images} title={property.title} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.65fr_1fr]">
        {/* -------------------------- Colonne principale ------------------- */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{LISTING_TYPE[property.listing_type].label}</Badge>
            <Badge tone={status.tone} dot>{status.label}</Badge>
            <span className="font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">
              Réf. {property.reference}
            </span>
          </div>

          <h1 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-content text-balance sm:text-4xl">
            {property.title}
          </h1>

          <p className="mt-3 flex items-center gap-2 text-content-muted">
            <MapPin className="h-4 w-4 shrink-0 text-brass-500" />
            {[property.address, property.district, property.city, property.country]
              .filter(Boolean)
              .join(' · ')}
          </p>

          {/* Caractéristiques */}
          {specs.length > 0 && (
            <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
              {specs.map((spec) => {
                const Icon = spec.icon
                return (
                  <div key={spec.label} className="bg-surface p-4">
                    <Icon className="h-4 w-4 text-brass-500" />
                    <p className="mt-2.5 font-mono text-2xs uppercase tracking-[0.12em] text-content-subtle">
                      {spec.label}
                    </p>
                    <p className="mt-1 font-display text-lg font-semibold tracking-tight text-content">
                      {spec.value}
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Description */}
          {property.description && (
            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold tracking-tight text-content">
                Description
              </h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-content-muted text-pretty">
                {property.description}
              </p>
            </section>
          )}

          {/* Équipements */}
          {property.amenities.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold tracking-tight text-content">
                Équipements
              </h2>
              <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {property.amenities.map((amenity) => (
                  <li
                    key={amenity}
                    className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm capitalize text-content"
                  >
                    <Check className="h-4 w-4 shrink-0 text-lagoon-500" />
                    {amenity}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Localisation — repère cartographique statique */}
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold tracking-tight text-content">
              Localisation
            </h2>
            <div className="relative mt-4 aspect-[16/9] overflow-hidden rounded-2xl border border-line bg-lagoon-800">
              <div className="absolute inset-0 blueprint opacity-20" />
              <div className="absolute inset-0 bg-gradient-to-br from-lagoon-800 via-lagoon-700/90 to-lagoon-600/80" />

              {/* Repère : cercle pulsé, cohérent avec l'assistant */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <span className="relative mx-auto flex h-14 w-14 items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-brass-500/30 animate-pulse-ring" />
                  <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-brass-500 text-ink">
                    <MapPin className="h-5 w-5" />
                  </span>
                </span>
                <p className="mt-4 font-display text-lg font-semibold text-white">
                  {property.district ?? property.city}
                </p>
                {property.latitude && property.longitude && (
                  <p className="mt-1 font-mono text-2xs uppercase tracking-[0.14em] text-brass-300">
                    {property.latitude.toFixed(4)}° N · {Math.abs(property.longitude).toFixed(4)}° E
                  </p>
                )}
              </div>

              {property.latitude && property.longitude && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${property.latitude}&mlon=${property.longitude}#map=16/${property.latitude}/${property.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute bottom-4 right-4 flex items-center gap-2 rounded-xl bg-surface/95 px-3.5 py-2.5 text-sm font-semibold text-content backdrop-blur transition-colors hover:bg-surface"
                >
                  <Compass className="h-4 w-4 text-brass-600" />
                  Ouvrir la carte
                </a>
              )}
            </div>
            <p className="mt-2 text-xs text-content-subtle">
              L'adresse exacte est communiquée par l'agent lors de la prise de rendez-vous.
            </p>
          </section>
        </div>

        {/* ------------------------------ Colonne d'action ------------------ */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="sticky top-24 space-y-4"
          >
            <Card className="cadastre overflow-hidden">
              <div className="bg-brand-gradient px-5 py-6">
                <p className="font-mono text-2xs uppercase tracking-[0.16em] text-brass-300">
                  {isRent ? 'Loyer mensuel' : 'Prix de vente'}
                </p>
                <p className="mt-2 font-display text-4xl font-semibold leading-none tracking-tight text-white">
                  {formatPrice(property.price, property.currency)}
                </p>
                {isRent && property.charges ? (
                  <p className="mt-2 text-sm text-white/60">
                    + {formatPrice(property.charges, property.currency)} de charges · caution{' '}
                    {formatPrice(property.deposit, property.currency)}
                  </p>
                ) : null}
                {property.area ? (
                  <p className="mt-2 font-mono text-xs text-white/50">
                    soit {formatNumber(Math.round(property.price / property.area))} FCFA/m²
                  </p>
                ) : null}
              </div>

              <div className="space-y-2.5 p-5">
                <Button
                  fullWidth
                  size="lg"
                  icon={<CalendarPlus className="h-4 w-4" />}
                  onClick={() => (isAuthenticated ? setVisitOpen(true) : navigate('/connexion'))}
                  disabled={!['AVAILABLE', 'RESERVED'].includes(property.status)}
                >
                  Demander une visite
                </Button>

                <Button
                  fullWidth
                  variant="outline"
                  icon={<MessageSquare className="h-4 w-4" />}
                  onClick={() => (isAuthenticated ? setContactOpen(true) : navigate('/connexion'))}
                >
                  Contacter l'agent
                </Button>

                <div className="flex gap-2.5 pt-1">
                  {isClient && user?.client_id && (
                    <Button
                      variant="secondary"
                      className="flex-1"
                      icon={<Heart className={cn('h-4 w-4', isFavorite && 'fill-current text-laterite-500')} />}
                      onClick={() =>
                        toggleFavorite.mutate({
                          clientId: user.client_id!,
                          propertyId: property.id,
                          active: isFavorite,
                        })
                      }
                    >
                      {isFavorite ? 'Retirer' : 'Favori'}
                    </Button>
                  )}
                  <Button variant="secondary" className="flex-1" icon={<Share2 className="h-4 w-4" />} onClick={share}>
                    Partager
                  </Button>
                </div>

                {!isAuthenticated && (
                  <p className="pt-2 text-center text-xs text-content-subtle text-pretty">
                    <Link to="/connexion" className="font-semibold text-lagoon-600 dark:text-brass-300">
                      Connectez-vous
                    </Link>{' '}
                    pour demander une visite ou échanger avec l'agent.
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <p className="font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">
                Informations
              </p>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-content-muted">Publié le</dt>
                  <dd className="font-mono text-content">{formatDate(property.published_at ?? property.created_at)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-content-muted">Consultations</dt>
                  <dd className="font-mono text-content">{formatNumber(property.views_count)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-content-muted">Référence</dt>
                  <dd className="font-mono text-content">{property.reference}</dd>
                </div>
              </dl>
              <p className="mt-4 flex items-center gap-2 border-t border-line pt-3.5 text-xs text-content-subtle">
                <Phone className="h-3.5 w-3.5 shrink-0 text-brass-500" />
                Les coordonnées directes sont transmises après confirmation de la visite.
              </p>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* --------------------------- Biens similaires -------------------- */}
      {similar && similar.items.filter((item) => item.id !== property.id).length > 0 && (
        <section className="mt-16 border-t border-line pt-10">
          <span className="eyebrow mb-3">Dans le même secteur</span>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-content">
            Autres biens à {property.city}
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {similar.items
              .filter((item) => item.id !== property.id)
              .slice(0, 3)
              .map((item, index) => (
                <PropertyCard key={item.id} property={item} index={index} />
              ))}
          </div>
        </section>
      )}

      {/* ------------------------------ Modales -------------------------- */}
      <Modal
        open={visitOpen}
        onClose={() => setVisitOpen(false)}
        title="Demander une visite"
        description={`${property.title} — ${property.reference}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setVisitOpen(false)}>Annuler</Button>
            <Button loading={request.isPending} onClick={submitVisit}>Envoyer la demande</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            type="datetime-local"
            label="Créneau souhaité"
            value={visitDate}
            onChange={(event) => setVisitDate(event.target.value)}
            min={new Date(Date.now() + 3600_000).toISOString().slice(0, 16)}
            hint="L'agent confirme ou vous propose un autre créneau."
          />
          <Textarea
            label="Message (facultatif)"
            value={visitMessage}
            onChange={(event) => setVisitMessage(event.target.value)}
            placeholder="Précisez vos disponibilités ou vos questions."
            rows={3}
          />
        </div>
      </Modal>

      <Modal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title="Contacter l'agent"
        description={`À propos de ${property.reference}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setContactOpen(false)}>Annuler</Button>
            <Button loading={createConversation.isPending} onClick={submitContact}>Envoyer</Button>
          </>
        }
      >
        <Textarea
          label="Votre message"
          value={contactMessage}
          onChange={(event) => setContactMessage(event.target.value)}
          placeholder="Bonjour, je souhaite recevoir le dossier complet de ce bien."
          rows={5}
        />
      </Modal>
    </div>
  )
}
