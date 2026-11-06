import { useState } from 'react'
import { MoreVertical, Plus, Search, Trash2, UserX, Users } from 'lucide-react'
import {
  Avatar, Badge, Button, Card, ConfirmDialog, Dropdown, DropdownItem, DropdownSeparator,
  EmptyState, Input, Modal, Pagination, Select, Table, type Column,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { useAgencies, useUserMutations, useUsers } from '@/hooks/useQueries'
import { ROLE_LABEL } from '@/utils/constants'
import { formatDate, formatRelative } from '@/utils/format'
import { toast } from '@/store/toastStore'
import type { User } from '@/types'

const ROLE_TONE: Record<string, 'brass' | 'info' | 'success' | 'neutral'> = {
  SUPER_ADMIN: 'brass', AGENCY: 'info', AGENT: 'success', OWNER: 'neutral', CLIENT: 'neutral',
}

/** Gestion des comptes : lecture, création, modification de rôle/statut, désactivation, suppression. */
export function UsersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const debounced = useDebounce(search)
  const { data, isLoading } = useUsers({ q: debounced || undefined, page, size: 20 })
  const { deactivate, remove } = useUserMutations()

  const columns: Column<User>[] = [
    {
      key: 'user', header: 'Utilisateur',
      render: (user) => (
        <div className="flex items-center gap-3">
          <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-content">{user.full_name}</p>
            <p className="truncate text-2xs text-content-subtle">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role', header: 'Rôle',
      render: (user) => (
        <Badge tone={ROLE_TONE[user.role] ?? 'neutral'} size="sm">{ROLE_LABEL[user.role]}</Badge>
      ),
    },
    {
      key: 'phone', header: 'Téléphone', hideOnMobile: true,
      render: (user) => <span className="font-mono text-2xs text-content-muted">{user.phone ?? '—'}</span>,
    },
    {
      key: 'status', header: 'Statut',
      render: (user) => (
        <Badge tone={user.is_active && user.status === 'ACTIVE' ? 'success' : 'warning'} size="sm" dot>
          {user.status === 'ACTIVE' ? 'Actif' : user.status === 'PENDING' ? 'En attente' : 'Inactif'}
        </Badge>
      ),
    },
    {
      key: 'last', header: 'Dernière connexion', hideOnMobile: true,
      render: (user) => (
        <span className="font-mono text-2xs text-content-subtle">
          {user.last_login_at ? formatRelative(user.last_login_at) : 'jamais'}
        </span>
      ),
    },
    {
      key: 'created', header: 'Inscrit le', hideOnMobile: true,
      render: (user) => (
        <span className="font-mono text-2xs text-content-subtle">{formatDate(user.created_at)}</span>
      ),
    },
    {
      key: 'actions', header: '', className: 'w-12',
      render: (user) => (
        <Dropdown
          trigger={
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-surface-2 hover:text-content">
              <MoreVertical className="h-4 w-4" />
            </span>
          }
        >
          {(close) => (
            <>
              <DropdownItem onClick={() => { close(); setEditing(user) }}>
                Modifier rôle / statut
              </DropdownItem>
              {user.is_active && (
                <DropdownItem
                  icon={<UserX className="h-4 w-4" />}
                  onClick={() => { close(); deactivate.mutate(user.id) }}
                >
                  Désactiver
                </DropdownItem>
              )}
              <DropdownSeparator />
              <DropdownItem
                icon={<Trash2 className="h-4 w-4" />}
                danger
                onClick={() => { close(); setDeleting(user) }}
              >
                Supprimer définitivement
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
        eyebrow="Plateforme"
        title="Utilisateurs"
        description="Tous les comptes, tous rôles confondus."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Créer un compte
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <Input
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1) }}
          placeholder="Rechercher par nom ou adresse email"
          icon={<Search className="h-4 w-4" />}
        />
      </Card>

      <Card>
        <Table
          columns={columns}
          rows={data?.items ?? []}
          loading={isLoading}
          rowKey={(user) => user.id}
          empty={<EmptyState title="Aucun utilisateur" icon={<Users className="h-6 w-6" />} />}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} label="utilisateurs" onChange={setPage} />}
      </Card>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Supprimer ce compte ?"
        description={`${deleting?.full_name} (${deleting?.email}) sera définitivement supprimé. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        tone="danger"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) }) }}
      />
    </div>
  )
}

function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: agencies } = useAgencies({ size: 100 })
  const { create } = useUserMutations()
  const [form, setForm] = useState({ email: '', full_name: '', phone: '', role: 'CLIENT', agency_id: '' })

  const needsAgency = form.role === 'AGENCY' || form.role === 'AGENT'

  function submit() {
    if (!form.email || !form.full_name) {
      toast.error('Champs manquants', 'Email et nom complet sont obligatoires.')
      return
    }
    if (needsAgency && !form.agency_id) {
      toast.error('Agence requise', 'Ce rôle doit être rattaché à une agence.')
      return
    }
    create.mutate(
      {
        email: form.email, full_name: form.full_name, phone: form.phone || undefined,
        role: form.role, agency_id: needsAgency ? form.agency_id : undefined,
      },
      { onSuccess: () => { setForm({ email: '', full_name: '', phone: '', role: 'CLIENT', agency_id: '' }); onClose() } },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Créer un compte">
      <div className="space-y-4">
        <Input
          label="Nom complet" value={form.full_name}
          onChange={(event) => setForm({ ...form, full_name: event.target.value })}
        />
        <Input
          label="Email" type="email" value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <Input
          label="Téléphone (optionnel)" value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
        <Select
          label="Rôle"
          value={form.role}
          onChange={(event) => setForm({ ...form, role: event.target.value })}
          options={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))}
        />
        {needsAgency && (
          <Select
            label="Agence"
            value={form.agency_id}
            onChange={(event) => setForm({ ...form, agency_id: event.target.value })}
            options={[
              { value: '', label: 'Sélectionner une agence' },
              ...(agencies?.items ?? []).map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        )}
        <p className="text-xs text-content-subtle">
          Un email d'activation avec lien de définition de mot de passe sera envoyé automatiquement.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={create.isPending} onClick={submit}>Créer et envoyer l'invitation</Button>
        </div>
      </div>
    </Modal>
  )
}

function EditUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { update } = useUserMutations()
  const [role, setRole] = useState(user.role)
  const [status, setStatus] = useState(user.status)

  function submit() {
    update.mutate(
      { id: user.id, payload: { role, status, is_active: status !== 'DEACTIVATED' && status !== 'SUSPENDED' } },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal open onClose={onClose} title={`Modifier — ${user.full_name}`}>
      <div className="space-y-4">
        <Select
          label="Rôle"
          value={role}
          onChange={(event) => setRole(event.target.value as User['role'])}
          options={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <Select
          label="Statut"
          value={status}
          onChange={(event) => setStatus(event.target.value as User['status'])}
          options={[
            { value: 'ACTIVE', label: 'Actif' },
            { value: 'PENDING', label: 'En attente' },
            { value: 'SUSPENDED', label: 'Suspendu' },
            { value: 'DEACTIVATED', label: 'Désactivé' },
          ]}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={update.isPending} onClick={submit}>Enregistrer</Button>
        </div>
      </div>
    </Modal>
  )
}
