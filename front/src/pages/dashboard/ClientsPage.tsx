import { useState } from 'react'
import { Handshake, MoreVertical, Plus, Search, Trash2 } from 'lucide-react'
import {
  Avatar, Badge, Button, Card, ConfirmDialog, Dropdown, DropdownItem, EmptyState,
  Input, Modal, Pagination, Table, Textarea, type Column,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { useClients, useClientMutations } from '@/hooks/useQueries'
import { toast } from '@/store/toastStore'
import { formatCompactPrice, formatDate } from '@/utils/format'
import type { Client } from '@/types'

/** CRM : fiches clients, budget, préférences et suivi. */
export function ClientsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState<Client | null>(null)

  const debounced = useDebounce(search)
  const { data, isLoading } = useClients({ q: debounced || undefined, page, size: 15 })
  const { remove } = useClientMutations()

  const columns: Column<Client>[] = [
    {
      key: 'client', header: 'Client',
      render: (client) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${client.first_name} ${client.last_name}`} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-content">
              {client.first_name} {client.last_name}
            </p>
            <p className="truncate text-2xs text-content-subtle">{client.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone', header: 'Téléphone', hideOnMobile: true,
      render: (client) => <span className="font-mono text-2xs text-content-muted">{client.phone ?? '—'}</span>,
    },
    {
      key: 'budget', header: 'Budget',
      render: (client) => (
        <span className="font-mono text-xs text-content">
          {client.budget_max
            ? `${client.budget_min ? `${formatCompactPrice(client.budget_min)} – ` : "jusqu'à "}${formatCompactPrice(client.budget_max)}`
            : '—'}
        </span>
      ),
    },
    {
      key: 'source', header: 'Origine', hideOnMobile: true,
      render: (client) => <span className="text-sm text-content-muted">{client.source ?? '—'}</span>,
    },
    {
      key: 'created', header: 'Ajouté le', hideOnMobile: true,
      render: (client) => (
        <span className="font-mono text-2xs text-content-subtle">{formatDate(client.created_at)}</span>
      ),
    },
    {
      key: 'status', header: 'Suivi',
      render: (client) => (
        <Badge tone={client.is_active ? 'success' : 'neutral'} size="sm" dot>
          {client.is_active ? 'Actif' : 'Dormant'}
        </Badge>
      ),
    },
    {
      key: 'actions', header: '', className: 'w-12',
      render: (client) => (
        <Dropdown
          trigger={
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-surface-2 hover:text-content">
              <MoreVertical className="h-4 w-4" />
            </span>
          }
        >
          {(close) => (
            <>
              <DropdownItem onClick={() => { close(); setEditing(client); setFormOpen(true) }}>
                Modifier la fiche
              </DropdownItem>
              <DropdownItem danger icon={<Trash2 className="h-4 w-4" />} onClick={() => { close(); setDeleting(client) }}>
                Supprimer
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
        eyebrow="Commercial"
        title="Clients"
        description="Chaque client est rattaché à l'agent qui l'a créé. Budget et préférences alimentent les recherches."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setFormOpen(true) }}>
            Ajouter un client
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <Input
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1) }}
          placeholder="Rechercher par nom, email ou téléphone"
          icon={<Search className="h-4 w-4" />}
        />
      </Card>

      <Card>
        <Table
          columns={columns}
          rows={data?.items ?? []}
          loading={isLoading}
          rowKey={(client) => client.id}
          empty={
            <EmptyState
              title="Aucun client"
              description="Ajoutez un client pour suivre ses recherches, ses visites et ses demandes."
              icon={<Handshake className="h-6 w-6" />}
              action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>Ajouter un client</Button>}
            />
          }
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} label="clients" onChange={setPage} />}
      </Card>

      <ClientFormModal
        open={formOpen}
        client={editing}
        onClose={() => { setFormOpen(false); setEditing(null) }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Supprimer ce client ?"
        description={deleting ? `${deleting.first_name} ${deleting.last_name}` : undefined}
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

function ClientFormModal({
  open, client, onClose,
}: {
  open: boolean
  client: Client | null
  onClose: () => void
}) {
  const { create, update } = useClientMutations()
  const [form, setForm] = useState<Record<string, any>>({})
  const key = client?.id ?? 'new'
  const [lastKey, setLastKey] = useState(key)

  if (open && lastKey !== key) {
    setLastKey(key)
    setForm(client ? { ...client } : {})
  }

  const set = (patch: Record<string, any>) => setForm((current) => ({ ...current, ...patch }))

  function submit() {
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error('Champs obligatoires', 'Nom, prénom et adresse email sont requis.')
      return
    }
    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone || undefined,
      city: form.city || undefined,
      source: form.source || undefined,
      notes: form.notes || undefined,
      budget_min: form.budget_min ? Number(form.budget_min) : undefined,
      budget_max: form.budget_max ? Number(form.budget_max) : undefined,
    }
    if (client) update.mutate({ id: client.id, payload }, { onSuccess: onClose })
    else create.mutate(payload, { onSuccess: onClose })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? 'Modifier la fiche client' : 'Nouveau client'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={create.isPending || update.isPending} onClick={submit}>
            {client ? 'Enregistrer' : 'Ajouter le client'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Prénom" value={form.first_name ?? ''} onChange={(event) => set({ first_name: event.target.value })} />
          <Input label="Nom" value={form.last_name ?? ''} onChange={(event) => set({ last_name: event.target.value })} />
        </div>
        <Input label="Adresse email" type="email" value={form.email ?? ''} onChange={(event) => set({ email: event.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Téléphone" value={form.phone ?? ''} onChange={(event) => set({ phone: event.target.value })} />
          <Input label="Ville" value={form.city ?? ''} onChange={(event) => set({ city: event.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Budget minimum (FCFA)" type="number" className="font-mono" value={form.budget_min ?? ''} onChange={(event) => set({ budget_min: event.target.value })} />
          <Input label="Budget maximum (FCFA)" type="number" className="font-mono" value={form.budget_max ?? ''} onChange={(event) => set({ budget_max: event.target.value })} />
        </div>
        <Input label="Origine du contact" value={form.source ?? ''} onChange={(event) => set({ source: event.target.value })} placeholder="Site web, recommandation, salon…" />
        <Textarea label="Notes" value={form.notes ?? ''} onChange={(event) => set({ notes: event.target.value })} rows={3} placeholder="Contexte, contraintes, préférences de quartier…" />
      </div>
    </Modal>
  )
}
