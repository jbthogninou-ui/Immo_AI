import { useState } from 'react'
import {
  Ban, Building2, CheckCircle2, Download, FileWarning, MoreVertical, Play, Search, ShieldCheck,
  XCircle,
} from 'lucide-react'
import {
  Badge, Button, Card, ConfirmDialog, Dropdown, DropdownItem, DropdownSeparator,
  EmptyState, Input, Modal, Pagination, Table, Textarea, type Column,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { useAgencies, useAgencyMutations, useDocuments, useDocumentMutations } from '@/hooks/useQueries'
import { documentApi } from '@/api/endpoints'
import { AGENCY_STATUS } from '@/utils/constants'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Agency } from '@/types'

const CATEGORY_LABELS: Record<string, string> = {
  AGENCY_LEGAL: 'Justificatif légal (RCCM / IFU)',
  IDENTITY_CIP: 'Pièce d\'identité (CIP)',
  CONTRACT: 'Contrat',
  MANDATE: 'Mandat',
  PROPERTY_TITLE: 'Titre de propriété',
  OTHER: 'Autre',
}

const DOC_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  VERIFIED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
}

/** Pièces justificatives déposées par l'agence — consultées avant toute validation. */
function AgencyDocuments({ agencyId }: { agencyId: string }) {
  const { data, isLoading } = useDocuments({ entity_type: 'AGENCY', entity_id: agencyId })
  const { verify } = useDocumentMutations()
  const documents = data?.items ?? []

  return (
    <div className="pt-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-content-subtle">
        <ShieldCheck className="h-3.5 w-3.5" /> Pièces justificatives
      </p>

      {isLoading && <p className="text-sm text-content-muted">Chargement…</p>}

      {!isLoading && documents.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-red-500/40 bg-red-500/5 p-3 text-xs text-red-500">
          <FileWarning className="h-4 w-4 shrink-0" />
          Aucun document déposé — la validation sera refusée par le serveur tant qu'aucun
          justificatif n'est fourni.
        </div>
      )}

      <div className="space-y-2">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-content">{doc.filename}</p>
              <p className="text-2xs text-content-subtle">
                {CATEGORY_LABELS[doc.category] ?? doc.category} · {formatDate(doc.created_at)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge tone={DOC_STATUS_TONE[doc.status] ?? 'neutral'} size="sm">
                {doc.status === 'VERIFIED' ? 'Vérifié' : doc.status === 'REJECTED' ? 'Rejeté' : 'En attente'}
              </Badge>
              <button
                type="button"
                onClick={() => documentApi.download(doc.id, doc.filename)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-surface-2 hover:text-content"
                aria-label="Télécharger"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              {doc.status === 'PENDING' && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={verify.isPending}
                    onClick={() => verify.mutate({ id: doc.id, approve: true })}
                  >
                    Valider
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500"
                    loading={verify.isPending}
                    onClick={() => verify.mutate({ id: doc.id, approve: false, reason: 'Document illisible ou non conforme.' })}
                  >
                    Rejeter
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const TABS = [
  { value: '', label: 'Toutes' },
  { value: 'PENDING_VALIDATION', label: 'À valider' },
  { value: 'ACTIVE', label: 'Actives' },
  { value: 'SUSPENDED', label: 'Suspendues' },
  { value: 'REJECTED', label: 'Rejetées' },
]

/** Supervision des agences — validation, suspension, réactivation. */
export function AgenciesPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [rejecting, setRejecting] = useState<Agency | null>(null)
  const [suspending, setSuspending] = useState<Agency | null>(null)
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState<Agency | null>(null)

  const debounced = useDebounce(search)
  const { data, isLoading } = useAgencies({
    q: debounced || undefined, status: status || undefined, page, size: 15,
  })
  const { validate, suspend, activate } = useAgencyMutations()

  const columns: Column<Agency>[] = [
    {
      key: 'name',
      header: 'Agence',
      render: (agency) => (
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lagoon-600 font-mono text-xs font-bold text-brass-300">
            {agency.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-content">{agency.name}</p>
            <p className="truncate text-2xs text-content-subtle">{agency.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'city', header: 'Ville', hideOnMobile: true,
      render: (agency) => <span className="text-sm text-content-muted">{agency.city ?? '—'}</span>,
    },
    {
      key: 'rccm', header: 'RCCM', hideOnMobile: true,
      render: (agency) => (
        <span className="font-mono text-2xs text-content-subtle">
          {agency.registration_number ?? 'non fourni'}
        </span>
      ),
    },
    {
      key: 'created', header: 'Inscription', hideOnMobile: true,
      render: (agency) => (
        <span className="font-mono text-2xs text-content-subtle">{formatDate(agency.created_at)}</span>
      ),
    },
    {
      key: 'status', header: 'Statut',
      render: (agency) => {
        const tone = AGENCY_STATUS[agency.status]
        return <Badge tone={tone.tone} size="sm">{tone.label}</Badge>
      },
    },
    {
      key: 'actions', header: '', className: 'w-12',
      render: (agency) => (
        <Dropdown
          trigger={
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-surface-2 hover:text-content">
              <MoreVertical className="h-4 w-4" />
            </span>
          }
        >
          {(close) => (
            <>
              <DropdownItem onClick={() => { close(); setDetail(agency) }}>Voir le dossier</DropdownItem>
              <DropdownSeparator />
              {agency.status === 'PENDING_VALIDATION' && (
                <>
                  <DropdownItem
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    onClick={() => { close(); validate.mutate({ id: agency.id, approve: true }) }}
                  >
                    Valider l'agence
                  </DropdownItem>
                  <DropdownItem danger icon={<XCircle className="h-4 w-4" />} onClick={() => { close(); setRejecting(agency) }}>
                    Rejeter la demande
                  </DropdownItem>
                </>
              )}
              {agency.status === 'ACTIVE' && (
                <DropdownItem danger icon={<Ban className="h-4 w-4" />} onClick={() => { close(); setSuspending(agency) }}>
                  Suspendre
                </DropdownItem>
              )}
              {agency.status === 'SUSPENDED' && (
                <DropdownItem icon={<Play className="h-4 w-4" />} onClick={() => { close(); activate.mutate(agency.id) }}>
                  Réactiver
                </DropdownItem>
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
        eyebrow="Plateforme"
        title="Agences"
        description="Validez les nouvelles inscriptions et surveillez l'état de chaque agence partenaire."
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder="Rechercher une agence"
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setStatus(tab.value); setPage(1) }}
                className={cn(
                  'whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                  status === tab.value ? 'bg-lagoon-600 text-white' : 'text-content-muted hover:bg-surface-2 hover:text-content',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <Table
          columns={columns}
          rows={data?.items ?? []}
          loading={isLoading}
          rowKey={(agency) => agency.id}
          empty={<EmptyState title="Aucune agence" description="Les inscriptions apparaîtront ici." icon={<Building2 className="h-6 w-6" />} />}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} label="agences" onChange={setPage} />}
      </Card>

      {/* Dossier détaillé */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name} description={detail?.email} size="md">
        {detail && (
          <dl className="space-y-3 text-sm">
            {[
              ['Statut', AGENCY_STATUS[detail.status].label],
              ['Téléphone', detail.phone ?? '—'],
              ['Adresse', detail.address ?? '—'],
              ['Ville', detail.city ?? '—'],
              ['RCCM', detail.registration_number ?? 'non fourni'],
              ['Identifiant fiscal', detail.tax_id ?? 'non fourni'],
              ['Site web', detail.website ?? '—'],
              ['Inscrite le', formatDate(detail.created_at)],
              ['Validée le', detail.validated_at ? formatDate(detail.validated_at) : 'non validée'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-line pb-2.5">
                <dt className="text-content-muted">{label}</dt>
                <dd className="text-right font-medium text-content">{value}</dd>
              </div>
            ))}
            {detail.description && (
              <p className="pt-2 text-content-muted text-pretty">{detail.description}</p>
            )}
            <AgencyDocuments agencyId={detail.id} />
          </dl>
        )}
      </Modal>

      {/* Rejet motivé */}
      <Modal
        open={!!rejecting}
        onClose={() => { setRejecting(null); setReason('') }}
        title="Rejeter cette demande"
        description={rejecting?.name}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setRejecting(null); setReason('') }}>Annuler</Button>
            <Button
              variant="danger"
              loading={validate.isPending}
              onClick={() => {
                if (!rejecting) return
                validate.mutate(
                  { id: rejecting.id, approve: false, reason },
                  { onSuccess: () => { setRejecting(null); setReason('') } },
                )
              }}
            >
              Rejeter
            </Button>
          </>
        }
      >
        <Textarea
          label="Motif du rejet"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Documents légaux incomplets, RCCM non fourni…"
          hint="Ce motif est transmis au dirigeant de l'agence."
          rows={4}
        />
      </Modal>

      <Modal
        open={!!suspending}
        onClose={() => { setSuspending(null); setReason('') }}
        title="Suspendre cette agence"
        description={suspending?.name}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setSuspending(null); setReason('') }}>Annuler</Button>
            <Button
              variant="danger"
              loading={suspend.isPending}
              onClick={() => {
                if (!suspending) return
                suspend.mutate(
                  { id: suspending.id, reason: reason || 'Suspension administrative' },
                  { onSuccess: () => { setSuspending(null); setReason('') } },
                )
              }}
            >
              Suspendre
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-content-muted text-pretty">
          Les agents et le dirigeant de cette agence ne pourront plus se connecter tant que la
          suspension est active.
        </p>
        <Textarea
          label="Motif"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
        />
      </Modal>
    </div>
  )
}