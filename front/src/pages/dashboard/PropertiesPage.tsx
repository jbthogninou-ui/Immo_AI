import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Eye, EyeOff, FileText, Grid3x3, Home, ImagePlus, List, MoreVertical, Pencil, Plus, Search,
  Sparkles, Star, Trash2, UploadCloud, X,
} from 'lucide-react'
import {
  Badge, Button, Card, ConfirmDialog, Dropdown, DropdownItem, DropdownSeparator,
  EmptyState, Input, Modal, Pagination, Select, Table, Textarea, type Column,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { PropertyCard, PropertyCardSkeleton } from '@/components/property/PropertyCard'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import {
  useAIMutations, useDocumentMutations, useDocuments, useOwners, useProperties,
  usePropertyImages, usePropertyMutations, usePropertyTypes,
} from '@/hooks/useQueries'
import { documentApi } from '@/api/endpoints'
import { toast } from '@/store/toastStore'
import { formatArea, formatCompactPrice, formatDate, formatFileSize } from '@/utils/format'
import { AMENITIES, CITIES, LISTING_TYPE, PROPERTY_STATUS } from '@/utils/constants'
import { cn } from '@/utils/cn'
import type { Property } from '@/types'

const MAX_IMAGE_SIZE = 15 * 1024 * 1024 // 15 Mo
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024 // 25 Mo, aligné sur la limite backend

const DOCUMENT_CATEGORIES = [
  { value: 'PROPERTY_TITLE', label: 'Titre de propriété' },
  { value: 'OTHER', label: 'Autre document' },
]

const STATUS_TABS = [
  { value: '', label: 'Tous' },
  { value: 'AVAILABLE', label: 'Disponibles' },
  { value: 'DRAFT', label: 'Brouillons' },
  { value: 'RESERVED', label: 'Réservés' },
  { value: 'SOLD', label: 'Vendus' },
  { value: 'RENTED', label: 'Loués' },
]

/**
 * Gestion des biens.
 * Vue tableau pour piloter, vue galerie pour vérifier le rendu public.
 */
export function PropertiesPage() {
  const { isOwner, isAgent, can } = useAuth()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'table' | 'grid'>('table')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Property | null>(null)
  const [deleting, setDeleting] = useState<Property | null>(null)

  const debounced = useDebounce(search)
  const { data, isLoading } = useProperties({
    q: debounced || undefined,
    status: (status || undefined) as any,
    page,
    size: 12,
    sort: '-updated_at',
  })
  const { publish, changeStatus, remove } = usePropertyMutations()

  const readOnly = isOwner || !can('property:update')

  const columns: Column<Property>[] = [
    {
      key: 'title',
      header: 'Bien',
      render: (property) => (
        <div className="flex items-center gap-3">
          <span className="h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-lagoon-800">
            {property.images?.[0] && (
              <img
                src={property.images[0].thumbnail_url ?? property.images[0].url}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
          </span>
          <div className="min-w-0">
            <Link to={`/biens/${property.id}`} className="block truncate text-sm font-semibold text-content hover:text-lagoon-600 dark:hover:text-brass-300">
              {property.title}
            </Link>
            <span className="font-mono text-2xs text-content-subtle">{property.reference}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Localisation',
      hideOnMobile: true,
      render: (property) => (
        <span className="text-sm text-content-muted">
          {property.district ?? '—'}
          <span className="block text-2xs text-content-subtle">{property.city}</span>
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Opération',
      hideOnMobile: true,
      render: (property) => (
        <Badge tone="neutral" size="sm">{LISTING_TYPE[property.listing_type].short}</Badge>
      ),
    },
    {
      key: 'price',
      header: 'Prix',
      render: (property) => (
        <span className="font-mono text-sm font-semibold text-content">
          {formatCompactPrice(property.price, property.currency)}
          {property.listing_type === 'RENT' && (
            <span className="block text-2xs font-normal text-content-subtle">par mois</span>
          )}
        </span>
      ),
    },
    {
      key: 'area',
      header: 'Surface',
      hideOnMobile: true,
      render: (property) => (
        <span className="font-mono text-sm text-content-muted">{formatArea(property.area)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (property) => {
        const tone = PROPERTY_STATUS[property.status]
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge tone={tone.tone} size="sm">{tone.label}</Badge>
            {property.is_published && (
              <span className="font-mono text-2xs text-lagoon-500">en ligne</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'updated',
      header: 'Mise à jour',
      hideOnMobile: true,
      render: (property) => (
        <span className="font-mono text-2xs text-content-subtle">{formatDate(property.updated_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (property) => (
        <Dropdown
          trigger={
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-surface-2 hover:text-content">
              <MoreVertical className="h-4 w-4" />
            </span>
          }
        >
          {(close) => (
            <>
              <DropdownItem icon={<Eye className="h-4 w-4" />} onClick={() => { close(); window.open(`/biens/${property.id}`, '_blank') }}>
                Voir la fiche publique
              </DropdownItem>
              {!readOnly && (
                <>
                  <DropdownItem icon={<Pencil className="h-4 w-4" />} onClick={() => { close(); setEditing(property); setFormOpen(true) }}>
                    Modifier
                  </DropdownItem>
                  <DropdownItem
                    icon={property.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    onClick={() => { close(); publish.mutate({ id: property.id, publish: !property.is_published }) }}
                  >
                    {property.is_published ? 'Retirer du catalogue' : 'Publier'}
                  </DropdownItem>
                  <DropdownSeparator />
                  {property.status !== 'SOLD' && (
                    <DropdownItem onClick={() => { close(); changeStatus.mutate({ id: property.id, status: 'RESERVED' }) }}>
                      Marquer comme réservé
                    </DropdownItem>
                  )}
                  <DropdownItem onClick={() => { close(); changeStatus.mutate({ id: property.id, status: 'ARCHIVED' }) }}>
                    Archiver
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem danger icon={<Trash2 className="h-4 w-4" />} onClick={() => { close(); setDeleting(property) }}>
                    Supprimer
                  </DropdownItem>
                </>
              )}
            </>
          )}
        </Dropdown>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Portefeuille"
        title={isOwner ? 'Mes biens' : isAgent ? 'Mes biens' : 'Biens de l’agence'}
        description={
          isOwner
            ? "Les biens que vous avez confiés à l'agence et leur état d'avancement."
            : "Créez, publiez et suivez chaque bien du portefeuille."
        }
        actions={
          !readOnly && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setFormOpen(true) }}>
              Ajouter un bien
            </Button>
          )
        }
      />

      {/* Barre d'outils */}
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder="Rechercher par titre, référence ou quartier"
              icon={<Search className="h-4 w-4" />}
            />
          </div>

          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setStatus(tab.value); setPage(1) }}
                className={cn(
                  'whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                  status === tab.value
                    ? 'bg-lagoon-600 text-white'
                    : 'text-content-muted hover:bg-surface-2 hover:text-content',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex gap-1 rounded-lg border border-line p-1">
            <button
              onClick={() => setView('table')}
              aria-label="Vue tableau"
              className={cn('rounded p-1.5 transition-colors', view === 'table' ? 'bg-surface-2 text-content' : 'text-content-subtle')}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('grid')}
              aria-label="Vue galerie"
              className={cn('rounded p-1.5 transition-colors', view === 'grid' ? 'bg-surface-2 text-content' : 'text-content-subtle')}
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      {view === 'grid' ? (
        isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => <PropertyCardSkeleton key={index} />)}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {(data?.items ?? []).map((property, index) => (
              <PropertyCard key={property.id} property={property} index={index} />
            ))}
          </div>
        )
      ) : (
        <Card>
          <Table
            columns={columns}
            rows={data?.items ?? []}
            loading={isLoading}
            rowKey={(property) => property.id}
            empty={
              <EmptyState
                title="Aucun bien pour l'instant"
                description={readOnly ? "Les biens qui vous sont rattachés apparaîtront ici." : "Ajoutez un premier bien pour commencer à publier."}
                icon={<Home className="h-6 w-6" />}
                action={!readOnly && (
                  <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
                    Ajouter un bien
                  </Button>
                )}
              />
            }
          />
          {data && (
            <Pagination page={data.page} pages={data.pages} total={data.total} label="biens" onChange={setPage} />
          )}
        </Card>
      )}

      <PropertyFormModal
        open={formOpen}
        property={editing}
        onClose={() => { setFormOpen(false); setEditing(null) }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Supprimer ce bien ?"
        description={deleting?.title}
        confirmLabel="Supprimer"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }}
      />
    </div>
  )
}

/* ==========================================================
   Formulaire de bien — création et édition
   ========================================================== */
function PropertyFormModal({
  open, property, onClose,
}: {
  open: boolean
  property: Property | null
  onClose: () => void
}) {
  const { data: types } = usePropertyTypes()
  const { data: owners } = useOwners({ size: 100 })
  const { create, update, uploadImage, removeImage } = usePropertyMutations()
  const { describe, estimate } = useAIMutations()
  const { data: existingImages } = usePropertyImages(property?.id)
  const { data: existingDocuments } = useDocuments({
    entity_type: 'PROPERTY',
    entity_id: property?.id ?? '00000000-0000-0000-0000-000000000000',
  })
  const { upload: uploadDocument, remove: removeDocument } = useDocumentMutations()

  const [form, setForm] = useState<Record<string, any>>({})
  const [amenities, setAmenities] = useState<string[]>([])
  // Photos choisies avant que le bien n'existe encore côté serveur (mode création).
  const [stagedPhotos, setStagedPhotos] = useState<{ file: File; preview: string }[]>([])
  // Documents (titre de propriété, etc.) choisis avant que le bien n'existe encore.
  const [stagedDocuments, setStagedDocuments] = useState<{ file: File; category: string }[]>([])

  // Réinitialise à chaque ouverture pour ne pas hériter d'un bien précédent.
  const key = property?.id ?? 'new'
  const [lastKey, setLastKey] = useState(key)
  if (open && lastKey !== key) {
    setLastKey(key)
    setForm(
      property
        ? { ...property }
        : { listing_type: 'SALE', city: 'Cotonou', currency: 'XOF' },
    )
    setAmenities(property?.amenities ?? [])
    stagedPhotos.forEach((p) => URL.revokeObjectURL(p.preview))
    setStagedPhotos([])
    setStagedDocuments([])
  }

  const set = (patch: Record<string, any>) => setForm((current) => ({ ...current, ...patch }))

  function addPhotos(files: FileList | null) {
    if (!files) return
    const accepted: { file: File; preview: string }[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast.error('Fichier ignoré', `${file.name} n'est pas une image.`)
        continue
      }
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error('Fichier trop lourd', `${file.name} dépasse 15 Mo.`)
        continue
      }
      accepted.push({ file, preview: URL.createObjectURL(file) })
    }
    if (accepted.length) setStagedPhotos((current) => [...current, ...accepted])
  }

  function removeStagedPhoto(index: number) {
    setStagedPhotos((current) => {
      URL.revokeObjectURL(current[index].preview)
      return current.filter((_, i) => i !== index)
    })
  }

  async function uploadStagedPhotos(propertyId: string) {
    for (const [index, photo] of stagedPhotos.entries()) {
      await uploadImage.mutateAsync({ id: propertyId, file: photo.file, isCover: index === 0 })
    }
    stagedPhotos.forEach((p) => URL.revokeObjectURL(p.preview))
    setStagedPhotos([])
  }

  function addDocuments(files: FileList | null, category: string) {
    if (!files) return
    const accepted: { file: File; category: string }[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_DOCUMENT_SIZE) {
        toast.error('Fichier trop lourd', `${file.name} dépasse 25 Mo.`)
        continue
      }
      accepted.push({ file, category })
    }
    if (accepted.length) setStagedDocuments((current) => [...current, ...accepted])
  }

  function removeStagedDocument(index: number) {
    setStagedDocuments((current) => current.filter((_, i) => i !== index))
  }

  async function uploadStagedDocuments(propertyId: string) {
    for (const doc of stagedDocuments) {
      await uploadDocument.mutateAsync({
        file: doc.file, entity_type: 'PROPERTY', entity_id: propertyId, category: doc.category,
      })
    }
    setStagedDocuments([])
  }

  function submit() {
    const payload = {
      title: form.title,
      description: form.description,
      listing_type: form.listing_type,
      property_type_id: form.property_type_id || undefined,
      owner_id: form.owner_id || undefined,
      address: form.address,
      district: form.district,
      city: form.city,
      price: Number(form.price),
      area: form.area ? Number(form.area) : undefined,
      land_area: form.land_area ? Number(form.land_area) : undefined,
      rooms: form.rooms ? Number(form.rooms) : undefined,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
      year_built: form.year_built ? Number(form.year_built) : undefined,
      amenities,
    }

    if (!payload.title || !payload.price) {
      toast.error('Champs obligatoires', 'Le titre et le prix sont requis.')
      return
    }

    if (property) {
      update.mutate({ id: property.id, payload }, { onSuccess: onClose })
    } else {
      create.mutate(payload, {
        onSuccess: async (created) => {
          if (stagedPhotos.length) {
            try {
              await uploadStagedPhotos(created.id)
            } catch {
              toast.error('Bien créé, photos non envoyées', 'Ajoutez-les depuis la fiche du bien.')
            }
          }
          if (stagedDocuments.length) {
            try {
              await uploadStagedDocuments(created.id)
            } catch {
              toast.error('Bien créé, documents non envoyés', 'Ajoutez-les depuis la fiche du bien.')
            }
          }
          onClose()
        },
      })
    }
  }

  function generateDescription() {
    describe.mutate(
      {
        property_type: types?.find((type) => type.id === form.property_type_id)?.name ?? 'bien',
        city: form.city,
        district: form.district,
        area: form.area ? Number(form.area) : undefined,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
        rooms: form.rooms ? Number(form.rooms) : undefined,
        listing_type: form.listing_type,
        amenities,
      },
      {
        onSuccess: (result) => {
          set({ description: result.description, title: form.title || result.title_suggestion })
          toast.success('Description générée', 'Relisez-la avant publication.')
        },
      },
    )
  }

  function suggestPrice() {
    estimate.mutate(
      {
        property_type: types?.find((type) => type.id === form.property_type_id)?.name,
        city: form.city,
        district: form.district,
        area: form.area ? Number(form.area) : 100,
        listing_type: form.listing_type,
        amenities,
      },
      {
        onSuccess: (result) => {
          set({ price: result.suggested_price })
          toast.success(
            'Prix suggéré',
            `${result.explanation.slice(0, 120)}…`,
          )
        },
      },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={property ? 'Modifier le bien' : 'Nouveau bien'}
      description={property?.reference ?? 'Le bien sera créé en brouillon, puis publiable après ajout des photos.'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={create.isPending || update.isPending} onClick={submit}>
            {property ? 'Enregistrer les modifications' : 'Créer le bien'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Input
          label="Titre de l'annonce"
          value={form.title ?? ''}
          onChange={(event) => set({ title: event.target.value })}
          placeholder="Villa contemporaine 4 chambres avec piscine"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Opération"
            value={form.listing_type ?? 'SALE'}
            onChange={(event) => set({ listing_type: event.target.value })}
            options={[
              { value: 'SALE', label: 'À vendre' },
              { value: 'RENT', label: 'À louer' },
              { value: 'BOTH', label: 'Vente ou location' },
            ]}
          />
          <Select
            label="Type de bien"
            value={form.property_type_id ?? ''}
            onChange={(event) => set({ property_type_id: event.target.value })}
            options={(types ?? []).map((type) => ({ value: type.id, label: type.name }))}
            placeholder="Sélectionner"
          />
        </div>

        <Select
          label="Propriétaire"
          value={form.owner_id ?? ''}
          onChange={(event) => set({ owner_id: event.target.value })}
          options={(owners?.items ?? [])
            // Le backend refuse un propriétaire encore au stade « invité ».
            .filter((owner) => ['ACTIVE', 'PENDING_VERIFICATION'].includes(owner.status))
            .map((owner) => ({
              value: owner.id,
              label: `${owner.first_name} ${owner.last_name}${owner.status === 'PENDING_VERIFICATION' ? ' — dossier à vérifier' : ''}`,
            }))}
          placeholder="Rattacher un propriétaire"
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Ville"
            value={form.city ?? ''}
            onChange={(event) => set({ city: event.target.value })}
            options={CITIES.map((city) => ({ value: city, label: city }))}
            placeholder="Sélectionner"
          />
          <Input
            label="Quartier"
            value={form.district ?? ''}
            onChange={(event) => set({ district: event.target.value })}
            placeholder="Fidjrossè"
          />
          <Input
            label="Adresse"
            value={form.address ?? ''}
            onChange={(event) => set({ address: event.target.value })}
            placeholder="Carré 1024"
          />
        </div>

        {/* Prix, avec estimation assistée */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-semibold text-content">
              {form.listing_type === 'RENT' ? 'Loyer mensuel (FCFA)' : 'Prix de vente (FCFA)'}
            </span>
            <button
              type="button"
              onClick={suggestPrice}
              disabled={estimate.isPending}
              className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.1em] text-brass-600 transition-colors hover:text-brass-700 disabled:opacity-50 dark:text-brass-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {estimate.isPending ? 'Calcul…' : 'Estimer le prix'}
            </button>
          </div>
          <Input
            type="number"
            inputMode="numeric"
            value={form.price ?? ''}
            onChange={(event) => set({ price: event.target.value })}
            placeholder="145000000"
            className="font-mono"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Surface habitable (m²)" type="number" value={form.area ?? ''} onChange={(event) => set({ area: event.target.value })} />
          <Input label="Surface terrain (m²)" type="number" value={form.land_area ?? ''} onChange={(event) => set({ land_area: event.target.value })} />
          <Input label="Année de construction" type="number" value={form.year_built ?? ''} onChange={(event) => set({ year_built: event.target.value })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Pièces" type="number" value={form.rooms ?? ''} onChange={(event) => set({ rooms: event.target.value })} />
          <Input label="Chambres" type="number" value={form.bedrooms ?? ''} onChange={(event) => set({ bedrooms: event.target.value })} />
          <Input label="Salles d'eau" type="number" value={form.bathrooms ?? ''} onChange={(event) => set({ bathrooms: event.target.value })} />
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

        <div>
          <span className="mb-2 block text-sm font-semibold text-content">Photos</span>

          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {/* Bien existant : galerie réelle, upload immédiat */}
            {property && (existingImages ?? []).map((image) => (
              <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl border border-line">
                <img src={image.thumbnail_url ?? image.url} alt="" className="h-full w-full object-cover" />
                {image.is_cover && (
                  <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-brass-500 px-1.5 py-0.5 text-2xs font-semibold text-ink">
                    <Star className="h-3 w-3 fill-current" /> Couverture
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage.mutate({ id: property.id, imageId: image.id })}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Supprimer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Nouveau bien : aperçus locaux, envoyés juste après la création */}
            {!property && stagedPhotos.map((photo, index) => (
              <div key={photo.preview} className="group relative aspect-square overflow-hidden rounded-xl border border-line">
                <img src={photo.preview} alt="" className="h-full w-full object-cover" />
                {index === 0 && (
                  <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-brass-500 px-1.5 py-0.5 text-2xs font-semibold text-ink">
                    <Star className="h-3 w-3 fill-current" /> Couverture
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeStagedPhoto(index)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Retirer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-content-subtle transition-colors hover:border-lagoon-500 hover:text-lagoon-600">
              <ImagePlus className="h-5 w-5" />
              <span className="text-2xs font-medium">Ajouter</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  if (property) {
                    Array.from(event.target.files ?? []).forEach((file, index) => {
                      if (file.size > MAX_IMAGE_SIZE) {
                        toast.error('Fichier trop lourd', `${file.name} dépasse 15 Mo.`)
                        return
                      }
                      uploadImage.mutate({
                        id: property.id,
                        file,
                        isCover: index === 0 && (existingImages?.length ?? 0) === 0,
                      })
                    })
                  } else {
                    addPhotos(event.target.files)
                  }
                  event.target.value = ''
                }}
              />
            </label>
          </div>
          <p className="mt-1.5 text-xs text-content-subtle">
            JPG ou PNG, 15 Mo max par photo. La première devient l'image de couverture.
          </p>
        </div>

        <div>
          <span className="mb-2 block text-sm font-semibold text-content">Documents</span>
          <div className="space-y-2">
            {/* Bien existant : documents réels déjà déposés */}
            {property && (existingDocuments?.items ?? []).map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => documentApi.download(doc.id, doc.filename)}
                  className="flex min-w-0 items-center gap-2.5 text-sm text-content hover:text-lagoon-600"
                >
                  <FileText className="h-4 w-4 shrink-0 text-content-subtle" />
                  <span className="truncate">{doc.filename}</span>
                  <span className="shrink-0 font-mono text-2xs text-content-subtle">{formatFileSize(doc.size_bytes)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeDocument.mutate(doc.id)}
                  className="shrink-0 rounded-lg p-1.5 text-content-subtle transition-colors hover:bg-surface-2 hover:text-red-500"
                  aria-label="Supprimer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Nouveau bien : documents mis en attente, envoyés juste après la création */}
            {!property && stagedDocuments.map((doc, index) => (
              <div key={`${doc.file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2.5 text-sm text-content">
                  <FileText className="h-4 w-4 shrink-0 text-content-subtle" />
                  <span className="truncate">{doc.file.name}</span>
                  <span className="shrink-0 font-mono text-2xs text-content-subtle">{formatFileSize(doc.file.size)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeStagedDocument(index)}
                  className="shrink-0 rounded-lg p-1.5 text-content-subtle transition-colors hover:bg-surface-2 hover:text-red-500"
                  aria-label="Retirer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line px-3 py-3 text-content-subtle transition-colors hover:border-lagoon-500 hover:text-lagoon-600">
              <UploadCloud className="h-4 w-4" />
              <span className="text-xs font-medium">Téléverser le titre de propriété ou un autre document</span>
              <input
                type="file"
                accept=".pdf,image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  if (property) {
                    Array.from(event.target.files ?? []).forEach((file) => {
                      if (file.size > MAX_DOCUMENT_SIZE) {
                        toast.error('Fichier trop lourd', `${file.name} dépasse 25 Mo.`)
                        return
                      }
                      uploadDocument.mutate({
                        file, entity_type: 'PROPERTY', entity_id: property.id, category: 'PROPERTY_TITLE',
                      })
                    })
                  } else {
                    addDocuments(event.target.files, 'PROPERTY_TITLE')
                  }
                  event.target.value = ''
                }}
              />
            </label>
          </div>
          <p className="mt-1.5 text-xs text-content-subtle">
            PDF ou image, 25 Mo max. Titre foncier, mandat, ou tout justificatif utile à la publication.
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-semibold text-content">Description</span>
            <button
              type="button"
              onClick={generateDescription}
              disabled={describe.isPending}
              className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.1em] text-brass-600 transition-colors hover:text-brass-700 disabled:opacity-50 dark:text-brass-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {describe.isPending ? 'Rédaction…' : 'Rédiger avec l’IA'}
            </button>
          </div>
          <Textarea
            value={form.description ?? ''}
            onChange={(event) => set({ description: event.target.value })}
            rows={6}
            placeholder="Décrivez le bien, son environnement et ses points forts."
            hint="120 à 200 mots donnent les meilleurs résultats sur le catalogue."
          />
        </div>
      </div>
    </Modal>
  )
}