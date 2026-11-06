import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, Download, FileWarning, MessageSquare, MoreVertical, ScanFace, Search, ShieldCheck,
  UserCog, UserPlus, UserSquare2, XCircle,
} from 'lucide-react'
import {
  Avatar, Badge, Button, Card, Dropdown, DropdownItem, DropdownSeparator, EmptyState,
  Input, Modal, Pagination, Select, Table, Textarea, type Column,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import {
  useAgents, useDocuments, useDocumentMutations, useOwners, useOwnerMutations,
  useMessagingMutations,
} from '@/hooks/useQueries'
import { documentApi } from '@/api/endpoints'
import { toast } from '@/store/toastStore'
import { OWNER_STATUS } from '@/utils/constants'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Owner } from '@/types'

const CATEGORY_LABELS: Record<string, string> = {
  IDENTITY_CIP: "Pièce d'identité",
  IDENTITY_SELFIE: 'Photo du visage',
  OTHER: 'Autre document',
}

/**
 * Comparaison visuelle carte / selfie — la vérification reste manuelle et
 * volontairement humaine : l'agent juge lui-même si c'est la même personne.
 */
function OwnerIdentityCheck({ owner }: { owner: Owner }) {
  const { data, isLoading } = useDocuments({ entity_type: 'OWNER', entity_id: owner.id })
  const { verify } = useDocumentMutations()
  const documents = data?.items ?? []
  const idCard = documents.find((d) => d.category === 'IDENTITY_CIP')
  const selfie = documents.find((d) => d.category === 'IDENTITY_SELFIE')

  if (isLoading) return <p className="text-sm text-content-muted">Chargement…</p>

  if (!idCard && !selfie) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-red-500/40 bg-red-500/5 p-3 text-xs text-red-500">
        <FileWarning className="h-4 w-4 shrink-0" />
        Aucune pièce d'identité ni photo déposée pour le moment.
      </div>
    )
  }

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-content-subtle">
        <ScanFace className="h-3.5 w-3.5" /> Comparez la pièce et la photo
      </p>
      <div className="grid grid-cols-2 gap-3">
        {[{ doc: idCard, label: CATEGORY_LABELS.IDENTITY_CIP }, { doc: selfie, label: CATEGORY_LABELS.IDENTITY_SELFIE }].map(
          ({ doc, label }) => (
            <div key={label} className="overflow-hidden rounded-xl border border-line">
              <div className="flex aspect-square items-center justify-center bg-surface-2">
                {doc ? (
                  doc.mime_type.startsWith('image/') ? (
                    <img src={doc.url} alt={label} className="h-full w-full object-cover" />
                  ) : (
                    <button type="button" onClick={() => documentApi.download(doc.id, doc.filename)} className="text-xs text-lagoon-600 underline">
                      Voir le PDF
                    </button>
                  )
                ) : (
                  <span className="text-2xs text-content-subtle">Non fourni</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-2">
                <span className="truncate text-2xs text-content-subtle">{label}</span>
                {doc && (
                  <Badge tone={doc.status === 'VERIFIED' ? 'success' : doc.status === 'REJECTED' ? 'danger' : 'warning'} size="sm">
                    {doc.status === 'VERIFIED' ? 'Vérifié' : doc.status === 'REJECTED' ? 'Rejeté' : 'En attente'}
                  </Badge>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      {idCard && selfie && (idCard.status === 'PENDING' || selfie.status === 'PENDING') && (
        <div className="mt-3 flex gap-2.5">
          <Button
            size="sm"
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            loading={verify.isPending}
            onClick={() => {
              verify.mutate({ id: idCard.id, approve: true })
              verify.mutate({ id: selfie.id, approve: true })
            }}
          >
            C'est la même personne
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500"
            loading={verify.isPending}
            onClick={() => {
              verify.mutate({ id: idCard.id, approve: false, reason: 'Le visage ne correspond pas à la pièce déposée.' })
              verify.mutate({ id: selfie.id, approve: false, reason: 'Le visage ne correspond pas à la pièce déposée.' })
            }}
          >
            Ça ne correspond pas
          </Button>
        </div>
      )}
    </div>
  )
}

const TABS = [
  { value: '', label: 'Tous' },
  { value: 'PENDING_VERIFICATION', label: 'À vérifier' },
  { value: 'ACTIVE', label: 'Vérifiés' },
  { value: 'INVITED', label: 'Invités' },
]

/** Portefeuille de propriétaires : invitation, vérification du dossier. */
export function OwnersPage() {
  const { isAgency, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [rejecting, setRejecting] = useState<Owner | null>(null)
  const [assigning, setAssigning] = useState<Owner | null>(null)
  const [selectedAgent, setSelectedAgent] = useState('')
  const [detail, setDetail] = useState<Owner | null>(null)
  const [reason, setReason] = useState('')

  const debounced = useDebounce(search)
  const { data, isLoading } = useOwners({
    q: debounced || undefined, status: status || undefined, page, size: 15,
  })
  const { data: agents } = useAgents({ size: 100 })
  const { verify, update } = useOwnerMutations()
  const { create: createConversation } = useMessagingMutations()
  const canVerify = isAgency || isSuperAdmin
  const canAssign = isAgency || isSuperAdmin

  function contactOwner(owner: Owner) {
    if (!owner.user_id) {
      toast.error(
        'Compte non actif',
        "Ce propriétaire n'a pas encore de compte utilisateur (invitation non acceptée).",
      )
      return
    }
    createConversation.mutate(
      { type: 'OWNER_AGENT', participant_ids: [owner.user_id] },
      {
        onSuccess: (conversation) => navigate(`../messages?conversation=${conversation.id}`),
      },
    )
  }

  const columns: Column<Owner>[] = [
    {
      key: 'owner', header: 'Propriétaire',
      render: (owner) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${owner.first_name} ${owner.last_name}`} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-content">
              {owner.first_name} {owner.last_name}
            </p>
            <p className="truncate text-2xs text-content-subtle">{owner.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone', header: 'Téléphone', hideOnMobile: true,
      render: (owner) => <span className="font-mono text-2xs text-content-muted">{owner.phone}</span>,
    },
    {
      key: 'city', header: 'Ville', hideOnMobile: true,
      render: (owner) => <span className="text-sm text-content-muted">{owner.city ?? '—'}</span>,
    },
    {
      key: 'cip', header: 'Pièce d’identité', hideOnMobile: true,
      render: (owner) => (
        <span className="font-mono text-2xs text-content-subtle">
          {owner.national_id_number ?? 'non fournie'}
        </span>
      ),
    },
    {
      key: 'status', header: 'Statut',
      render: (owner) => {
        const tone = OWNER_STATUS[owner.status]
        return (
          <div>
            <Badge tone={tone.tone} size="sm">{tone.label}</Badge>
            {owner.verified_at && (
              <span className="mt-1 block font-mono text-2xs text-content-subtle">
                {formatDate(owner.verified_at)}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'agent', header: 'Agent', hideOnMobile: true,
      render: (owner) => {
        const assignedAgent = (agents?.items ?? []).find((agent) => agent.id === owner.agent_id)
        return assignedAgent ? (
          <span className="text-sm text-content-muted">
            {assignedAgent.user?.full_name ?? assignedAgent.user?.email ?? 'Agent'}
          </span>
        ) : canAssign ? (
          <button
            type="button"
            onClick={() => { setAssigning(owner); setSelectedAgent('') }}
            className="flex items-center gap-1.5 text-xs font-semibold text-lagoon-600 hover:text-lagoon-700 dark:text-brass-300"
          >
            <UserCog className="h-3.5 w-3.5" />
            Affecter un agent
          </button>
        ) : (
          <span className="text-2xs text-content-subtle">Non affecté</span>
        )
      },
    },
    {
      key: 'actions', header: '', className: 'w-12',
      render: (owner) => (
        <Dropdown
          trigger={
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-surface-2 hover:text-content">
              <MoreVertical className="h-4 w-4" />
            </span>
          }
        >
          {(close) => (
            <>
              {canVerify && owner.status === 'PENDING_VERIFICATION' && (
                <>
                  <DropdownItem
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    onClick={() => { close(); verify.mutate({ id: owner.id, approve: true }) }}
                  >
                    Valider le dossier
                  </DropdownItem>
                  <DropdownItem danger icon={<XCircle className="h-4 w-4" />} onClick={() => { close(); setRejecting(owner) }}>
                    Rejeter le dossier
                  </DropdownItem>
                  <DropdownSeparator />
                </>
              )}
              <DropdownItem
                icon={<MessageSquare className="h-4 w-4" />}
                onClick={() => { close(); contactOwner(owner) }}
              >
                Envoyer un message
              </DropdownItem>
              {canAssign && (
                <DropdownItem
                  icon={<UserCog className="h-4 w-4" />}
                  onClick={() => { close(); setAssigning(owner); setSelectedAgent(owner.agent_id ?? '') }}
                >
                  {owner.agent_id ? 'Réaffecter un agent' : 'Affecter un agent'}
                </DropdownItem>
              )}
              <DropdownItem onClick={() => { close(); setDetail(owner) }}>Voir la fiche</DropdownItem>
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
        title="Propriétaires"
        description="Invitez les propriétaires, contrôlez leur pièce d'identité et suivez leurs biens."
        actions={
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
            Inviter un propriétaire
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder="Rechercher un propriétaire"
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
          rowKey={(owner) => owner.id}
          empty={
            <EmptyState
              title="Aucun propriétaire"
              description="Invitez un propriétaire pour lui rattacher des biens."
              icon={<UserSquare2 className="h-6 w-6" />}
            />
          }
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} label="propriétaires" onChange={setPage} />}
      </Card>

      <InviteOwnerModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.first_name} ${detail.last_name}` : undefined}
        description={detail?.email}
        size="md"
      >
        {detail && (
          <div className="space-y-5">
            <dl className="space-y-2.5 text-sm">
              {[
                ['Statut', OWNER_STATUS[detail.status].label],
                ['Téléphone', detail.phone ?? '—'],
                ['Ville', detail.city ?? '—'],
                ['Adresse', detail.address ?? '—'],
                ['Inscrit le', formatDate(detail.created_at)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-line pb-2">
                  <dt className="text-content-muted">{label}</dt>
                  <dd className="text-right font-medium text-content">{value}</dd>
                </div>
              ))}
            </dl>

            <OwnerIdentityCheck owner={detail} />

            {detail.status === 'PENDING_VERIFICATION' && canVerify && (
              <div className="flex gap-2.5 border-t border-line pt-4">
                <Button
                  fullWidth
                  loading={verify.isPending}
                  onClick={() => verify.mutate({ id: detail.id, approve: true }, { onSuccess: () => setDetail(null) })}
                >
                  Valider le dossier complet
                </Button>
                <Button
                  fullWidth
                  variant="ghost"
                  className="text-red-500"
                  onClick={() => { setRejecting(detail); setDetail(null) }}
                >
                  Rejeter
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!rejecting}
        onClose={() => { setRejecting(null); setReason('') }}
        title="Rejeter ce dossier"
        description={rejecting ? `${rejecting.first_name} ${rejecting.last_name}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setRejecting(null); setReason('') }}>Annuler</Button>
            <Button
              variant="danger"
              loading={verify.isPending}
              onClick={() => {
                if (!rejecting) return
                verify.mutate(
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
          placeholder="Pièce d'identité illisible, informations incohérentes…"
          hint="Le propriétaire reçoit ce motif et peut redéposer son dossier."
          rows={4}
        />
      </Modal>

      <Modal
        open={!!assigning}
        onClose={() => { setAssigning(null); setSelectedAgent('') }}
        title="Affecter un agent"
        description={assigning ? `${assigning.first_name} ${assigning.last_name}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setAssigning(null); setSelectedAgent('') }}>Annuler</Button>
            <Button
              loading={update.isPending}
              disabled={!selectedAgent}
              onClick={() => {
                if (!assigning) return
                update.mutate(
                  { id: assigning.id, payload: { agent_id: selectedAgent } },
                  { onSuccess: () => { setAssigning(null); setSelectedAgent('') } },
                )
              }}
            >
              Affecter
            </Button>
          </>
        }
      >
        <Select
          label="Agent responsable"
          value={selectedAgent}
          onChange={(event) => setSelectedAgent(event.target.value)}
          options={(agents?.items ?? []).map((agent) => ({
            value: agent.id,
            label: agent.user?.full_name ?? agent.user?.email ?? 'Agent',
          }))}
          placeholder="Sélectionner un agent"
        />
        <p className="mt-2 text-xs text-content-subtle text-pretty">
          Ce propriétaire recevra ses prochaines communications de cet agent, et pourra lui
          envoyer des messages directement.
        </p>
      </Modal>
    </div>
  )
}

function InviteOwnerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { invite } = useOwnerMutations()
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', city: '', notes: '',
  })

  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }))

  function submit() {
    if (!form.first_name || !form.last_name || !form.email || !form.phone) {
      toast.error('Champs obligatoires', 'Nom, prénom, email et téléphone sont requis.')
      return
    }
    invite.mutate(
      { ...form, city: form.city || undefined, notes: form.notes || undefined },
      {
        onSuccess: () => {
          setForm({ first_name: '', last_name: '', email: '', phone: '', city: '', notes: '' })
          onClose()
        },
      },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Inviter un propriétaire"
      description="Il complètera son dossier et déposera sa pièce d'identité avant validation."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={invite.isPending} onClick={submit}>Envoyer l'invitation</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Prénom" value={form.first_name} onChange={(event) => set({ first_name: event.target.value })} />
          <Input label="Nom" value={form.last_name} onChange={(event) => set({ last_name: event.target.value })} />
        </div>
        <Input label="Adresse email" type="email" value={form.email} onChange={(event) => set({ email: event.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Téléphone" value={form.phone} onChange={(event) => set({ phone: event.target.value })} placeholder="+229 97 00 00 00" />
          <Input label="Ville" value={form.city} onChange={(event) => set({ city: event.target.value })} placeholder="Cotonou" />
        </div>
        <Textarea label="Notes internes" value={form.notes} onChange={(event) => set({ notes: event.target.value })} rows={3} />
      </div>
    </Modal>
  )
}