import { useState } from 'react'
import { ScrollText, Search } from 'lucide-react'
import { Badge, Card, EmptyState, Input, Pagination, Select, Table, type Column } from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuditLogs } from '@/hooks/useQueries'
import { formatDateTime } from '@/utils/format'
import type { AuditLog } from '@/types'

const RESOURCES = [
  { value: 'property', label: 'Biens' },
  { value: 'owner', label: 'Propriétaires' },
  { value: 'agent', label: 'Agents' },
  { value: 'client', label: 'Clients' },
  { value: 'visit', label: 'Visites' },
  { value: 'sale', label: 'Ventes' },
  { value: 'document', label: 'Documents' },
  { value: 'user', label: 'Comptes' },
]

/** Journal d'audit — chaque action sensible et son auteur. */
export function AuditLogsPage() {
  const [resource, setResource] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAuditLogs({
    resource_type: resource || undefined, page, size: 20,
  })

  const rows = (data?.items ?? []).filter(
    (log) => !search || log.action.toLowerCase().includes(search.toLowerCase()),
  )

  const columns: Column<AuditLog>[] = [
    {
      key: 'action', header: 'Action',
      render: (log) => (
        <div>
          <span className="font-mono text-xs font-semibold text-content">{log.action}</span>
          <span className="block text-2xs text-content-subtle">
            {(log.payload as any)?.actor ?? log.resource_type ?? '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'resource', header: 'Ressource', hideOnMobile: true,
      render: (log) => (
        <span className="font-mono text-2xs text-content-muted">
          {log.resource_type ?? '—'}
          <span className="block text-content-subtle">{log.resource_id?.slice(-8) ?? ''}</span>
        </span>
      ),
    },
    {
      key: 'status', header: 'Résultat',
      render: (log) => (
        <Badge tone={log.status === 'SUCCESS' ? 'success' : 'danger'} size="sm">
          {log.status === 'SUCCESS' ? 'Réussi' : 'Échec'}
        </Badge>
      ),
    },
    {
      key: 'ip', header: 'Adresse IP', hideOnMobile: true,
      render: (log) => <span className="font-mono text-2xs text-content-subtle">{log.ip_address ?? '—'}</span>,
    },
    {
      key: 'request', header: 'Requête', hideOnMobile: true,
      render: (log) => <span className="font-mono text-2xs text-content-subtle">{log.request_id ?? '—'}</span>,
    },
    {
      key: 'date', header: 'Horodatage',
      render: (log) => (
        <span className="font-mono text-2xs text-content-muted">{formatDateTime(log.created_at)}</span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Conformité"
        title="Journal d'audit"
        description="Qui a fait quoi, quand, depuis quelle adresse. Les enregistrements ne sont ni modifiables ni supprimables."
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filtrer par action (property.publish, auth.login…)"
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="w-full sm:w-56">
            <Select
              value={resource}
              onChange={(event) => { setResource(event.target.value); setPage(1) }}
              options={RESOURCES}
              placeholder="Toutes les ressources"
            />
          </div>
        </div>
      </Card>

      <Card>
        <Table
          columns={columns}
          rows={rows}
          loading={isLoading}
          compact
          rowKey={(log) => log.id}
          empty={<EmptyState title="Aucune action enregistrée" icon={<ScrollText className="h-6 w-6" />} />}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} label="entrées" onChange={setPage} />}
      </Card>
    </div>
  )
}
