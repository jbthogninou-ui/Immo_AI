import { useState } from 'react'
import {
  Ban, Copy, ExternalLink, Link2, Mail, MoreVertical, Pencil, Play, Search,
  Send, Trash2, UserPlus, Users,
} from 'lucide-react'
import {
  Avatar, Badge, Button, Card, ConfirmDialog, Dropdown, DropdownItem, DropdownSeparator,
  EmptyState, Input, Modal, Pagination, Switch, Table, type Column,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { useAgents, useAgentMutations } from '@/hooks/useQueries'
import { normalizeInvitationUrl } from '@/api/client'
import { toast } from '@/store/toastStore'
import { AGENT_STATUS } from '@/utils/constants'
import { formatDate } from '@/utils/format'
import type { Agent } from '@/types'

/** Gestion de l'équipe : invitation, droits, suspension. */
export function AgentsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleting, setDeleting] = useState<Agent | null>(null)
  const [editing, setEditing] = useState<Agent | null>(null)
  const [linkFor, setLinkFor] = useState<{ agent: Agent; url: string } | null>(null)

  const debounced = useDebounce(search)
  const { data, isLoading } = useAgents({ q: debounced || undefined, page, size: 15 })
  const { suspend, activate, remove, resendInvitation } = useAgentMutations()

  /** Régénère un lien d'activation et l'affiche pour copie.
   *  Le lien précédent est invalidé côté serveur. */
  function regenerateLink(agent: Agent) {
    resendInvitation.mutate(agent.id, {
      onSuccess: (data) =>
        setLinkFor({ agent, url: normalizeInvitationUrl(data.invitation_url) }),
    })
  }

  const columns: Column<Agent>[] = [
    {
      key: 'agent', header: 'Agent',
      render: (agent) => (
        <div className="flex items-center gap-3">
          <Avatar name={agent.user?.full_name} src={agent.user?.avatar_url} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-content">{agent.user?.full_name ?? '—'}</p>
            <p className="truncate text-2xs text-content-subtle">{agent.user?.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'job', header: 'Fonction', hideOnMobile: true,
      render: (agent) => <span className="text-sm text-content-muted">{agent.job_title ?? '—'}</span>,
    },
    {
      key: 'rights', header: 'Droits', hideOnMobile: true,
      render: (agent) => (
        <div className="flex flex-wrap gap-1">
          {agent.can_manage_owners && <Badge tone="neutral" size="sm">Propriétaires</Badge>}
          {agent.can_publish_properties && <Badge tone="neutral" size="sm">Publication</Badge>}
          {!agent.can_manage_owners && !agent.can_publish_properties && (
            <span className="text-2xs text-content-subtle">Lecture seule</span>
          )}
        </div>
      ),
    },
    {
      key: 'activated', header: 'Activé le', hideOnMobile: true,
      render: (agent) => (
        <span className="font-mono text-2xs text-content-subtle">
          {agent.activated_at ? formatDate(agent.activated_at) : 'en attente'}
        </span>
      ),
    },
    {
      key: 'status', header: 'Statut',
      render: (agent) => {
        const tone = AGENT_STATUS[agent.status]
        return <Badge tone={tone.tone} size="sm">{tone.label}</Badge>
      },
    },
    {
      key: 'actions', header: '', className: 'w-12',
      render: (agent) => (
        <Dropdown
          trigger={
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-surface-2 hover:text-content">
              <MoreVertical className="h-4 w-4" />
            </span>
          }
        >
          {(close) => (
            <>
              {agent.status === 'INVITED' && (
                <>
                  <DropdownItem
                    icon={<Link2 className="h-4 w-4" />}
                    onClick={() => { close(); regenerateLink(agent) }}
                  >
                    Obtenir un nouveau lien
                  </DropdownItem>
                  <DropdownItem
                    icon={<Pencil className="h-4 w-4" />}
                    onClick={() => { close(); setEditing(agent) }}
                  >
                    Corriger l'invitation
                  </DropdownItem>
                  <DropdownSeparator />
                </>
              )}
              {agent.status === 'ACTIVE' && (
                <DropdownItem danger icon={<Ban className="h-4 w-4" />} onClick={() => { close(); suspend.mutate(agent.id) }}>
                  Suspendre
                </DropdownItem>
              )}
              {agent.status !== 'ACTIVE' && (
                <DropdownItem icon={<Play className="h-4 w-4" />} onClick={() => { close(); activate.mutate(agent.id) }}>
                  Activer
                </DropdownItem>
              )}
              <DropdownSeparator />
              <DropdownItem danger icon={<Trash2 className="h-4 w-4" />} onClick={() => { close(); setDeleting(agent) }}>
                Retirer de l'équipe
              </DropdownItem>
            </>
          )}
        </Dropdown>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Équipe"
        title="Agents"
        description="Invitez vos collaborateurs et définissez ce que chacun peut faire."
        actions={
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
            Inviter un agent
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <Input
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1) }}
          placeholder="Rechercher un agent"
          icon={<Search className="h-4 w-4" />}
        />
      </Card>

      <Card>
        <Table
          columns={columns}
          rows={data?.items ?? []}
          loading={isLoading}
          rowKey={(agent) => agent.id}
          empty={
            <EmptyState
              title="Aucun agent"
              description="Invitez votre premier collaborateur pour lui confier des biens et des clients."
              icon={<Users className="h-6 w-6" />}
              action={<Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>Inviter un agent</Button>}
            />
          }
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} label="agents" onChange={setPage} />}
      </Card>

      <InviteAgentModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <EditInvitationModal agent={editing} onClose={() => setEditing(null)} />

      <InvitationLinkModal
        data={linkFor}
        onClose={() => setLinkFor(null)}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Retirer cet agent ?"
        description={
          deleting?.status === 'INVITED'
            ? `${deleting?.user?.full_name} n'a jamais activé son compte : il sera entièrement supprimé et son adresse email redeviendra disponible.`
            : `${deleting?.user?.full_name} a été actif : son compte est désactivé et conservé, pour ne pas rompre le lien avec les biens et transactions qu'il a traités.`
        }
        confirmLabel="Retirer"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }}
      />
    </div>
  )
}

function InviteAgentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { invite } = useAgentMutations()
  const [form, setForm] = useState({ email: '', full_name: '', phone: '', job_title: '' })
  const [rights, setRights] = useState({ owners: true, publish: true })
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null)

  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }))

  function submit() {
    if (!form.email || !form.full_name) {
      toast.error('Champs obligatoires', "Le nom et l'adresse email sont requis.")
      return
    }
    invite.mutate(
      {
        email: form.email,
        full_name: form.full_name,
        phone: form.phone || undefined,
        job_title: form.job_title || undefined,
        can_manage_owners: rights.owners,
        can_publish_properties: rights.publish,
      },
      {
        onSuccess: (data) => {
          if (data.invitation_url) setInvitationUrl(normalizeInvitationUrl(data.invitation_url))
          else close()
        },
      },
    )
  }

  function close() {
    setForm({ email: '', full_name: '', phone: '', job_title: '' })
    setInvitationUrl(null)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={invitationUrl ? 'Invitation créée' : 'Inviter un agent'}
      description={invitationUrl ? undefined : "L'agent reçoit un lien d'activation valable 48 heures."}
      size="md"
      footer={
        invitationUrl ? (
          <Button onClick={close}>Terminé</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>Annuler</Button>
            <Button loading={invite.isPending} icon={<Send className="h-4 w-4" />} onClick={submit}>
              Envoyer l'invitation
            </Button>
          </>
        )
      }
    >
      {invitationUrl ? (
        <div>
          <p className="text-sm text-content-muted text-pretty">
            Transmettez ce lien à votre collaborateur. Il est valable 48 heures et lui
            permet de choisir son mot de passe.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-3">
            <code className="min-w-0 flex-1 break-all text-2xs">{invitationUrl}</code>
            <Button
              size="sm"
              variant="secondary"
              icon={<Copy className="h-3.5 w-3.5" />}
              onClick={() => {
                navigator.clipboard.writeText(invitationUrl)
                toast.success('Lien copié')
              }}
            >
              Copier
            </Button>
          </div>
          <p className="mt-3 rounded-xl border border-brass-500/30 bg-brass-500/10 p-3.5 text-xs leading-relaxed text-content-muted text-pretty">
            Un email est envoyé automatiquement si un serveur SMTP est configuré côté API.
            Sinon, ce lien reste le moyen de transmettre l'invitation — vous pouvez le
            régénérer à tout moment depuis le menu de l'agent.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <Input label="Nom complet" value={form.full_name} onChange={(event) => set({ full_name: event.target.value })} placeholder="Koffi Mensah" />
          <Input label="Adresse email" type="email" value={form.email} onChange={(event) => set({ email: event.target.value })} placeholder="agent@agence.bj" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Téléphone" value={form.phone} onChange={(event) => set({ phone: event.target.value })} placeholder="+229 97 00 00 00" />
            <Input label="Fonction" value={form.job_title} onChange={(event) => set({ job_title: event.target.value })} placeholder="Négociateur" />
          </div>

          <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-4">
            <p className="font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">
              Droits accordés
            </p>
            <Switch
              checked={rights.owners}
              onChange={(value) => setRights({ ...rights, owners: value })}
              label="Gérer les propriétaires"
              description="Inviter des propriétaires et suivre leurs dossiers"
            />
            <Switch
              checked={rights.publish}
              onChange={(value) => setRights({ ...rights, publish: value })}
              label="Publier des biens"
              description="Mettre une annonce en ligne sur le catalogue public"
            />
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ==========================================================
   Correction d'une invitation en attente
   ========================================================== */
function EditInvitationModal({
  agent, onClose,
}: {
  agent: Agent | null
  onClose: () => void
}) {
  const { updateInvitation } = useAgentMutations()
  const [form, setForm] = useState<Record<string, any>>({})
  const [rights, setRights] = useState({ owners: true, publish: true })
  const [lastId, setLastId] = useState<string | null>(null)

  // Recharge les valeurs à chaque changement d'agent édité.
  if (agent && lastId !== agent.id) {
    setLastId(agent.id)
    setForm({
      full_name: agent.user?.full_name ?? '',
      email: agent.user?.email ?? '',
      phone: agent.user?.phone ?? '',
      job_title: agent.job_title ?? '',
    })
    setRights({ owners: agent.can_manage_owners, publish: agent.can_publish_properties })
  }

  const set = (patch: Record<string, any>) => setForm((current) => ({ ...current, ...patch }))

  function submit() {
    if (!agent) return
    if (!form.email || !form.full_name) {
      toast.error('Champs obligatoires', "Le nom et l'adresse email sont requis.")
      return
    }
    updateInvitation.mutate(
      {
        id: agent.id,
        payload: {
          email: form.email,
          full_name: form.full_name,
          phone: form.phone || undefined,
          job_title: form.job_title || undefined,
          can_manage_owners: rights.owners,
          can_publish_properties: rights.publish,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal
      open={!!agent}
      onClose={onClose}
      title="Corriger l'invitation"
      description="Tant que l'agent n'a pas activé son compte, ses informations restent modifiables ici."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={updateInvitation.isPending} onClick={submit}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Nom complet"
          value={form.full_name ?? ''}
          onChange={(event) => set({ full_name: event.target.value })}
        />
        <Input
          label="Adresse email"
          type="email"
          value={form.email ?? ''}
          onChange={(event) => set({ email: event.target.value })}
          hint="Changer l'adresse invalide le lien déjà envoyé : pensez à en régénérer un."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Téléphone" value={form.phone ?? ''} onChange={(event) => set({ phone: event.target.value })} />
          <Input label="Fonction" value={form.job_title ?? ''} onChange={(event) => set({ job_title: event.target.value })} />
        </div>

        <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-4">
          <p className="font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">
            Droits accordés
          </p>
          <Switch
            checked={rights.owners}
            onChange={(value) => setRights({ ...rights, owners: value })}
            label="Gérer les propriétaires"
          />
          <Switch
            checked={rights.publish}
            onChange={(value) => setRights({ ...rights, publish: value })}
            label="Publier des biens"
          />
        </div>
      </div>
    </Modal>
  )
}

/* ==========================================================
   Lien d'activation régénéré
   ========================================================== */
function InvitationLinkModal({
  data, onClose,
}: {
  data: { agent: Agent; url: string } | null
  onClose: () => void
}) {
  const email = data?.agent.user?.email ?? ''
  const name = data?.agent.user?.full_name ?? ''

  const mailto =
    `mailto:${email}?subject=${encodeURIComponent('Votre accès ImmoFlow AI')}` +
    `&body=${encodeURIComponent(
      `Bonjour ${name},\n\nVotre compte agent a été créé sur ImmoFlow AI. ` +
        `Ouvrez ce lien pour choisir votre mot de passe et activer votre accès :\n\n${data?.url}\n\n` +
        `Ce lien est valable 48 heures.\n\nBien cordialement.`,
    )}`

  return (
    <Modal
      open={!!data}
      onClose={onClose}
      title="Lien d'activation"
      description={`Pour ${name} — valable 48 heures. Le lien précédent n'est plus valable.`}
      size="md"
      footer={<Button onClick={onClose}>Terminé</Button>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-3">
          <code className="min-w-0 flex-1 break-all text-2xs">{data?.url}</code>
          <Button
            size="sm"
            variant="secondary"
            icon={<Copy className="h-3.5 w-3.5" />}
            onClick={() => {
              navigator.clipboard.writeText(data?.url ?? '')
              toast.success('Lien copié', 'Transmettez-le à votre collaborateur.')
            }}
          >
            Copier
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <a href={mailto}>
            <Button variant="outline" size="sm" icon={<Mail className="h-4 w-4" />}>
              Ouvrir dans ma messagerie
            </Button>
          </a>
          <a href={data?.url} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="sm" icon={<ExternalLink className="h-4 w-4" />}>
              Tester le lien
            </Button>
          </a>
        </div>

        <p className="rounded-xl border border-brass-500/30 bg-brass-500/10 p-3.5 text-xs leading-relaxed text-content-muted text-pretty">
          <strong className="text-content">Pourquoi ce lien s'affiche ici.</strong> L'envoi
          automatique par email nécessite un serveur SMTP configuré côté API
          (variables <code>SMTP_*</code>). Tant que ce n'est pas le cas, ce lien est le
          moyen fiable de transmettre l'invitation.
        </p>
      </div>
    </Modal>
  )
}
