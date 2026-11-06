import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Building2, CalendarCheck, Clock, FileWarning, Heart, Home, KeyRound,
  Search, TrendingUp, UserCheck, Users,
} from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton } from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { ColumnChart, DonutChart, TrendChart } from '@/components/charts'
import { useAuth } from '@/hooks/useAuth'
import {
  useAgencies, useAgencyStats, useClients, useDocuments, useFavorites, useOwner, useOwners,
  usePlatformStats, useProperties, usePropertyTypes, usePublicProperties,
  useRentals, useSales, useVisits,
} from '@/hooks/useQueries'
import { formatCompactPrice, formatDateTime, formatNumber, formatPrice } from '@/utils/format'
import { PROPERTY_STATUS, VISIT_STATUS } from '@/utils/constants'
import { homeRouteFor } from '@/utils/permissions'
import { cn } from '@/utils/cn'
import type { Property, Sale, Visit } from '@/types'

/* ==========================================================================
   Toutes les séries de ce tableau de bord sont calculées à partir des données
   réellement retournées par l'API. Chaque rôle voit donc ses propres chiffres :
   un agent obtient les courbes de SON portefeuille, un propriétaire l'audience
   de SES annonces, un client son propre parcours.
   ========================================================================== */

const MONTHS = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** Les N derniers mois, du plus ancien au plus récent. */
function lastMonths(count = 6) {
  const now = new Date()
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1)
    return { key: `${date.getFullYear()}-${date.getMonth()}`, month: MONTHS[date.getMonth()] }
  })
}

/** Compte les enregistrements par mois de création. */
interface Dated {
  created_at: string
}

function monthlySeries(
  buckets: ReturnType<typeof lastMonths>,
  datasets: Array<{ key: string; rows: Dated[] }>,
) {
  return buckets.map(({ key, month }) => {
    const point: Record<string, string | number> = { month }
    datasets.forEach((dataset) => {
      point[dataset.key] = dataset.rows.filter((row) => {
        const date = new Date(row.created_at)
        return `${date.getFullYear()}-${date.getMonth()}` === key
      }).length
    })
    return point
  })
}

export function OverviewPage() {
  const { user, isSuperAdmin, isAgency, isAgent, isOwner, isClient } = useAuth()
  const base = homeRouteFor(user?.role)
  const buckets = useMemo(() => lastMonths(6), [])

  /* ---------------- Sources de données, restreintes par rôle -------------- */
  const { data: platform } = usePlatformStats()
  const { data: allAgencies } = useAgencies(isSuperAdmin ? { size: 100 } : {})
  const { data: agencyStats } = useAgencyStats(isAgency || isAgent ? user?.agency_id : null)

  // Échantillon large pour les agrégats ; l'affichage n'en montre qu'une part.
  // 100 est le maximum accepté par l'API (`size` plafonné côté serveur) :
  // demander davantage renverrait une erreur de validation, donc un écran vide.
  const { data: propertyPage, isLoading: loadingProperties } = useProperties(
    isClient ? { size: 1 } : { size: 100, sort: '-updated_at' },
  )
  const { data: catalog } = usePublicProperties(isClient ? { size: 100 } : { size: 1 })
  const { data: visitPage } = useVisits({ size: 100 })
  const { data: salePage } = useSales({ size: 100 })
  const { data: rentalPage } = useRentals({ size: 100 })
  const { data: clientPage } = useClients(isAgency || isAgent ? { size: 100 } : {})
  const { data: ownerPage } = useOwners(isAgency || isAgent ? { size: 100 } : {})
  const { data: documentPage } = useDocuments(isAgency || isAgent ? { size: 100 } : {})
  const { data: favorites } = useFavorites(isClient ? user?.client_id : null)
  const { data: types } = usePropertyTypes()
  const { data: myOwnerProfile } = useOwner(isOwner ? user?.owner_id : null)

  const properties = propertyPage?.items ?? []
  const visits = visitPage?.items ?? []
  const sales = salePage?.items ?? []
  const rentals = rentalPage?.items ?? []

  /* ------------------------------- Agrégats ------------------------------ */
  const upcoming = visits
    .filter((visit) => ['REQUESTED', 'CONFIRMED', 'RESCHEDULED'].includes(visit.status))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

  const completedSales = sales.filter((sale) => sale.status === 'COMPLETED')
  const salesVolume = completedSales.reduce((total, sale) => total + Number(sale.amount), 0)
  const commissions = completedSales.reduce(
    (total, sale) => total + Number(sale.commission_amount ?? 0), 0,
  )
  const monthlyRent = rentals
    .filter((rental) => rental.status === 'ACTIVE')
    .reduce((total, rental) => total + Number(rental.monthly_rent), 0)

  const PALETTE = ['#0E4D45', '#C8963E', '#157A6E', '#D6AC5F', '#6FB0A3', '#A87A2C']

  /** Répartition réelle du portefeuille par type de bien. */
  const portfolioByType = useMemo(() => {
    if (!types?.length) return []
    const counts = new Map<string, number>()
    properties.forEach((property) => {
      const label = types.find((type) => type.id === property.property_type_id)?.name ?? 'Autre'
      counts.set(label, (counts.get(label) ?? 0) + 1)
    })
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value], index) => ({ name, value, color: PALETTE[index % PALETTE.length] }))
  }, [properties, types])

  /** Répartition réelle par ville. */
  const byCity = useMemo(() => {
    const source = isClient ? (catalog?.items ?? []) : properties
    const counts = new Map<string, number>()
    source.forEach((property) => {
      counts.set(property.city ?? 'Non renseignée', (counts.get(property.city ?? 'Non renseignée') ?? 0) + 1)
    })
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([city, biens]) => ({ city, biens }))
  }, [properties, catalog, isClient])

  /** Répartition par statut — la lecture utile pour un propriétaire. */
  const byStatus = useMemo(() => {
    const colors: Record<string, string> = {
      AVAILABLE: '#157A6E', RESERVED: '#C8963E', SOLD: '#0E4D45',
      RENTED: '#6FB0A3', DRAFT: '#A8B5B1', ARCHIVED: '#7A8A86',
    }
    const counts = new Map<string, number>()
    properties.forEach((property) => {
      counts.set(property.status, (counts.get(property.status) ?? 0) + 1)
    })
    return [...counts.entries()].map(([status, value]) => ({
      name: PROPERTY_STATUS[status as keyof typeof PROPERTY_STATUS]?.label ?? status,
      value,
      color: colors[status] ?? '#A8B5B1',
    }))
  }, [properties])

  const activitySeries = useMemo(
    () => monthlySeries(buckets, [
      { key: 'visites', rows: visits },
      { key: 'biens', rows: properties },
      { key: 'transactions', rows: [...sales, ...rentals] },
    ]),
    [buckets, visits, properties, sales, rentals],
  )

  const commercialSeries = useMemo(
    () => monthlySeries(buckets, [{ key: 'ventes', rows: sales }, { key: 'locations', rows: rentals }]),
    [buckets, sales, rentals],
  )

  const visitSeries = useMemo(
    () => monthlySeries(buckets, [{ key: 'visites', rows: visits }]),
    [buckets, visits],
  )

  const platformSeries = useMemo(
    () => monthlySeries(buckets, [{ key: 'agences', rows: allAgencies?.items ?? [] }]),
    [buckets, allAgencies],
  )

  const pendingAgencies = (allAgencies?.items ?? []).filter((a) => a.status === 'PENDING_VALIDATION')
  const pendingDocuments = (documentPage?.items ?? []).filter((d) => d.status === 'PENDING')
  const pendingOwners = (ownerPage?.items ?? []).filter((o) => o.status === 'PENDING_VERIFICATION')

  /* --------------------------- Indicateurs par rôle ---------------------- */
  const stats = isSuperAdmin
    ? [
        { label: 'Agences actives', value: formatNumber(platform?.agencies_active), icon: <Building2 className="h-4 w-4" />, hint: `sur ${formatNumber(platform?.agencies)} inscrites`, accent: true },
        { label: 'En attente de validation', value: formatNumber(pendingAgencies.length), icon: <UserCheck className="h-4 w-4" />, hint: pendingAgencies.length ? 'à traiter' : 'rien à traiter' },
        { label: 'Utilisateurs', value: formatNumber(platform?.users), icon: <Users className="h-4 w-4" /> },
        { label: 'Biens sur la plateforme', value: formatNumber(platform?.properties), icon: <Home className="h-4 w-4" /> },
      ]
    : isAgency
      ? [
          { label: 'Biens publiés', value: formatNumber(agencyStats?.published_properties), icon: <Home className="h-4 w-4" />, hint: `sur ${formatNumber(agencyStats?.properties)} au portefeuille`, accent: true },
          { label: 'Volume vendu', value: formatCompactPrice(salesVolume), icon: <KeyRound className="h-4 w-4" />, hint: `${completedSales.length} vente(s) finalisée(s)` },
          { label: 'Commissions', value: formatCompactPrice(commissions), icon: <TrendingUp className="h-4 w-4" /> },
          { label: 'À traiter', value: formatNumber((agencyStats?.visits_pending ?? 0) + pendingDocuments.length + pendingOwners.length), icon: <FileWarning className="h-4 w-4" />, hint: 'visites, dossiers, pièces' },
        ]
      : isAgent
        ? [
            { label: 'Mes biens', value: formatNumber(propertyPage?.total), icon: <Home className="h-4 w-4" />, hint: `${properties.filter((p) => p.is_published).length} en ligne`, accent: true },
            { label: 'Visites à venir', value: formatNumber(upcoming.length), icon: <CalendarCheck className="h-4 w-4" />, hint: `${visits.filter((v) => v.status === 'REQUESTED').length} à confirmer` },
            { label: 'Mes clients', value: formatNumber(clientPage?.total), icon: <Users className="h-4 w-4" /> },
            { label: 'Volume finalisé', value: formatCompactPrice(salesVolume), icon: <TrendingUp className="h-4 w-4" />, hint: `${completedSales.length} vente(s)` },
          ]
        : isOwner
          ? [
              { label: 'Mes biens confiés', value: formatNumber(propertyPage?.total), icon: <Home className="h-4 w-4" />, hint: `${properties.filter((p) => p.is_published).length} en ligne`, accent: true },
              { label: 'Consultations', value: formatNumber(properties.reduce((total, p) => total + p.views_count, 0)), icon: <TrendingUp className="h-4 w-4" />, hint: 'toutes annonces confondues' },
              { label: 'Visites programmées', value: formatNumber(upcoming.length), icon: <CalendarCheck className="h-4 w-4" /> },
              { label: 'Revenus locatifs', value: formatCompactPrice(monthlyRent), icon: <KeyRound className="h-4 w-4" />, hint: 'par mois, baux actifs' },
            ]
          : [
              { label: 'Biens en favoris', value: formatNumber(favorites?.total), icon: <Heart className="h-4 w-4" />, accent: true },
              { label: 'Visites planifiées', value: formatNumber(upcoming.length), icon: <CalendarCheck className="h-4 w-4" />, hint: `${visits.filter((v) => v.status === 'REQUESTED').length} en attente de réponse` },
              { label: 'Catalogue disponible', value: formatNumber(catalog?.total), icon: <Search className="h-4 w-4" />, hint: 'biens publiés' },
              { label: 'Visites effectuées', value: formatNumber(visits.filter((v) => v.status === 'COMPLETED').length), icon: <TrendingUp className="h-4 w-4" /> },
            ]

  return (
    <div>
      <PageHeader
        eyebrow="Vue d'ensemble"
        title={
          isSuperAdmin ? 'Pilotage de la plateforme'
            : isAgency ? "Activité de l'agence"
            : isAgent ? 'Mon activité'
            : isOwner ? 'Suivi de mes biens'
            : 'Ma recherche'
        }
        description={
          isSuperAdmin ? "État des agences, des comptes et du catalogue à l'échelle nationale."
            : isAgency ? 'Portefeuille, transactions et dossiers en attente de votre décision.'
            : isAgent ? 'Vos biens, vos clients et les visites que vous devez traiter.'
            : isOwner ? "L'audience de vos annonces et l'avancement de chaque bien confié."
            : 'Vos favoris, vos visites et ce que propose le catalogue.'
        }
        actions={
          isClient ? (
            <Link to="/biens"><Button icon={<Search className="h-4 w-4" />}>Parcourir le catalogue</Button></Link>
          ) : isSuperAdmin ? (
            <Link to="/admin/agences"><Button icon={<Building2 className="h-4 w-4" />}>Gérer les agences</Button></Link>
          ) : (
            <Link to={`${base}/biens`}>
              <Button icon={<Home className="h-4 w-4" />}>
                {isOwner ? 'Voir mes biens' : 'Gérer les biens'}
              </Button>
            </Link>
          )
        }
      />

      {isOwner && myOwnerProfile && myOwnerProfile.status !== 'ACTIVE' && (
        <div className={cn(
          'mb-6 flex items-start gap-3 rounded-2xl border p-4 text-sm',
          myOwnerProfile.status === 'REJECTED'
            ? 'border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400'
            : 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300',
        )}>
          {myOwnerProfile.status === 'REJECTED' ? (
            <FileWarning className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <Clock className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="font-semibold">
              {myOwnerProfile.status === 'REJECTED'
                ? 'Votre dossier a été rejeté'
                : 'Votre dossier est en cours de vérification'}
            </p>
            <p className="mt-0.5 text-content-muted text-pretty">
              {myOwnerProfile.status === 'REJECTED'
                ? myOwnerProfile.rejection_reason ?? "Contactez votre agence pour connaître le motif et redéposer votre dossier."
                : "L'agence compare votre pièce d'identité et votre photo. Vous recevrez un email dès l'activation de votre compte."}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => <StatCard key={stat.label} {...stat} index={index} />)}
      </div>

      {/* ------------------------------ Graphiques ------------------------- */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            eyebrow={isClient ? 'Mon parcours' : 'Activité'}
            title={
              isSuperAdmin ? "Inscriptions d'agences"
                : isClient ? 'Mes visites par mois'
                : isOwner ? 'Visites sur mes biens'
                : 'Visites, biens et transactions'
            }
            subtitle="Six derniers mois · vos données"
          />
          <div className="p-4">
            {isSuperAdmin ? (
              <TrendChart data={platformSeries} keys={[{ key: 'agences', label: 'Agences inscrites' }]} height={280} />
            ) : isClient || isOwner ? (
              <TrendChart data={visitSeries} keys={[{ key: 'visites', label: 'Visites' }]} height={280} />
            ) : (
              <TrendChart
                data={activitySeries}
                keys={[
                  { key: 'visites', label: 'Visites' },
                  { key: 'biens', label: 'Biens ajoutés', color: '#C8963E' },
                  { key: 'transactions', label: 'Transactions', color: '#6FB0A3' },
                ]}
                height={280}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Répartition"
            title={
              isSuperAdmin || isClient ? 'Biens par ville'
                : isOwner ? 'Statut de mes biens'
                : 'Portefeuille par type'
            }
          />
          <div className="p-4">
            {isSuperAdmin || isClient ? (
              byCity.length ? (
                <ColumnChart data={byCity} xKey="city" keys={[{ key: 'biens', label: 'Biens' }]} height={280} />
              ) : (
                <EmptyState title="Pas encore de données" description="La répartition apparaîtra dès que des biens seront publiés." />
              )
            ) : isOwner ? (
              byStatus.length ? (
                <DonutChart data={byStatus} height={280} />
              ) : (
                <EmptyState title="Aucun bien confié" description="Votre agence enregistrera ici les biens que vous lui confiez." icon={<Home className="h-6 w-6" />} />
              )
            ) : portfolioByType.length ? (
              <DonutChart data={portfolioByType} height={280} />
            ) : (
              <EmptyState title="Portefeuille vide" description="Ajoutez un premier bien pour voir la répartition." icon={<Home className="h-6 w-6" />} />
            )}
          </div>
        </Card>
      </div>

      {/* Volet commercial : réservé aux rôles qui vendent */}
      {(isAgency || isAgent) && (
        <Card className="mt-4">
          <CardHeader eyebrow="Commercial" title="Ventes et locations par mois" subtitle="Vos transactions" />
          <div className="p-4">
            <ColumnChart
              data={commercialSeries}
              xKey="month"
              keys={[
                { key: 'ventes', label: 'Ventes' },
                { key: 'locations', label: 'Locations', color: '#C8963E' },
              ]}
              height={250}
            />
          </div>
        </Card>
      )}

      {/* ----------------------------- Listes d'action --------------------- */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {isSuperAdmin && (
          <Card>
            <CardHeader
              eyebrow="À traiter"
              title="Agences en attente de validation"
              action={<Link to="/admin/agences"><Button size="sm" variant="ghost" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>Tout voir</Button></Link>}
            />
            <div className="divide-y divide-line">
              {pendingAgencies.length === 0 ? (
                <EmptyState title="Aucune demande en attente" description="Toutes les inscriptions ont été traitées." icon={<UserCheck className="h-6 w-6" />} />
              ) : (
                pendingAgencies.slice(0, 5).map((agency) => (
                  <div key={agency.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lagoon-600 font-mono text-xs font-bold text-brass-300">
                      {agency.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-content">{agency.name}</p>
                      <p className="truncate text-xs text-content-subtle">
                        {agency.city} · déposée le {formatDateTime(agency.created_at)}
                      </p>
                    </div>
                    <Badge tone="warning" size="sm">À valider</Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {(isAgency || isAgent) && (
          <Card>
            <CardHeader
              eyebrow="À traiter"
              title="Dossiers en attente"
              action={<Link to={`${base}/documents`}><Button size="sm" variant="ghost" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>Documents</Button></Link>}
            />
            <div className="divide-y divide-line">
              {pendingOwners.length === 0 && pendingDocuments.length === 0 ? (
                <EmptyState title="Rien en attente" description="Tous les dossiers et toutes les pièces ont été traités." icon={<UserCheck className="h-6 w-6" />} />
              ) : (
                <>
                  {pendingOwners.slice(0, 3).map((owner) => (
                    <div key={owner.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-content">
                          {owner.first_name} {owner.last_name}
                        </p>
                        <p className="text-xs text-content-subtle">Dossier propriétaire à vérifier</p>
                      </div>
                      <Badge tone="warning" size="sm">À vérifier</Badge>
                    </div>
                  ))}
                  {pendingDocuments.slice(0, 3).map((document) => (
                    <div key={document.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-content">{document.filename}</p>
                        <p className="text-xs text-content-subtle">Pièce en attente de validation</p>
                      </div>
                      <Badge tone="warning" size="sm">En attente</Badge>
                    </div>
                  ))}
                </>
              )}
            </div>
          </Card>
        )}

        <Card>
          <CardHeader
            eyebrow="Agenda"
            title={isOwner ? 'Visites de mes biens' : isClient ? 'Mes prochaines visites' : 'Prochaines visites'}
            action={<Link to={`${base}/visites`}><Button size="sm" variant="ghost" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>Tout voir</Button></Link>}
          />
          <div className="divide-y divide-line">
            {upcoming.length === 0 ? (
              <EmptyState
                title="Aucune visite programmée"
                description={isClient ? "Demandez une visite depuis la fiche d'un bien du catalogue." : 'Les demandes de visite apparaîtront ici.'}
                icon={<CalendarCheck className="h-6 w-6" />}
              />
            ) : (
              upcoming.slice(0, 5).map((visit) => <VisitRow key={visit.id} visit={visit} />)
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow={isClient ? 'Catalogue' : 'Portefeuille'}
            title={isClient ? 'Biens récemment publiés' : 'Derniers biens modifiés'}
            action={
              <Link to={isClient ? '/biens' : `${base}/biens`}>
                <Button size="sm" variant="ghost" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>Tout voir</Button>
              </Link>
            }
          />
          <div className="divide-y divide-line">
            {loadingProperties ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-14" />)}
              </div>
            ) : (isClient ? (catalog?.items ?? []) : properties).length === 0 ? (
              <EmptyState
                title="Aucun bien"
                description={isOwner ? "Votre agence enregistrera ici les biens que vous lui confiez." : 'Les biens créés apparaîtront ici.'}
                icon={<Home className="h-6 w-6" />}
              />
            ) : (
              (isClient ? catalog!.items : properties).slice(0, 5).map((property) => (
                <PropertyRow key={property.id} property={property} />
              ))
            )}
          </div>
        </Card>
      </div>

      {(isAgency || isAgent) && sales.some((sale) => sale.status === 'IN_PROGRESS') && (
        <Card className="mt-4">
          <CardHeader
            eyebrow="Transactions"
            title="Ventes en cours"
            action={
              <Link to={`${base}/${isAgent ? 'ventes' : 'transactions'}`}>
                <Button size="sm" variant="ghost" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>Tout voir</Button>
              </Link>
            }
          />
          <div className="divide-y divide-line">
            {sales.filter((sale) => sale.status === 'IN_PROGRESS').slice(0, 4).map((sale) => (
              <SaleRow key={sale.id} sale={sale} />
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/* ------------------------------ Sous-composants -------------------------- */
function VisitRow({ visit }: { visit: Visit }) {
  const status = VISIT_STATUS[visit.status]
  const date = new Date(visit.scheduled_at)
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-surface-2 font-mono">
        <span className="text-2xs leading-none text-content-subtle">
          {date.toLocaleDateString('fr-FR', { month: 'short' })}
        </span>
        <span className="text-sm font-bold leading-none text-content">{date.getDate()}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-content">{formatDateTime(visit.scheduled_at)}</p>
        <p className="truncate text-xs text-content-subtle">{visit.duration_minutes} min</p>
      </div>
      <Badge tone={status.tone} size="sm">{status.label}</Badge>
    </div>
  )
}

function PropertyRow({ property }: { property: Property }) {
  const status = PROPERTY_STATUS[property.status]
  const cover = property.images?.[0]
  return (
    <Link to={`/biens/${property.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2">
      <span className="h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-lagoon-800">
        {cover && <img src={cover.thumbnail_url ?? cover.url} alt="" className="h-full w-full object-cover" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-content">{property.title}</p>
        <p className="truncate font-mono text-2xs text-content-subtle">
          {property.reference} · {property.district ?? property.city}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-xs font-semibold text-content">
          {formatCompactPrice(property.price, property.currency)}
        </p>
        <Badge tone={status.tone} size="sm" className="mt-1">{status.label}</Badge>
      </div>
    </Link>
  )
}

function SaleRow({ sale }: { sale: Sale }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <span className="font-mono text-xs font-semibold text-brass-600 dark:text-brass-300">
        {sale.reference}
      </span>
      {sale.commission_rate && (
        <span className="text-sm text-content-muted">Commission {sale.commission_rate} %</span>
      )}
      <span className="ml-auto font-display text-lg font-semibold tracking-tight text-content">
        {formatPrice(sale.amount, sale.currency)}
      </span>
      <Badge tone="info" size="sm">En cours</Badge>
    </div>
  )
}