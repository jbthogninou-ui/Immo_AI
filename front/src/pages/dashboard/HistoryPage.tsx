import { Link } from 'react-router-dom'
import { History, Search } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Skeleton } from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { useSearchHistory } from '@/hooks/useQueries'
import { formatDateTime, formatRelative } from '@/utils/format'

/** Historique des recherches — alimenté automatiquement par l'assistant. */
export function HistoryPage() {
  const { user } = useAuth()
  const { data, isLoading } = useSearchHistory(user?.client_id)
  const items = data?.items ?? []

  return (
    <div>
      <PageHeader
        eyebrow="Ma recherche"
        title="Historique"
        description="Vos recherches passées. Relancez-en une pour voir si de nouveaux biens correspondent."
      />

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Aucune recherche enregistrée"
            description="Vos recherches sont conservées automatiquement pour vous éviter de les retaper."
            icon={<History className="h-6 w-6" />}
            action={<Link to="/biens"><Button>Lancer une recherche</Button></Link>}
          />
        ) : (
          <div className="divide-y divide-line">
            {items.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-content-subtle">
                  <Search className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-content">« {entry.query} »</p>
                  <p className="font-mono text-2xs text-content-subtle">
                    {formatDateTime(entry.created_at)} · {formatRelative(entry.created_at)}
                  </p>
                </div>
                <Badge tone={entry.results_count > 0 ? 'success' : 'neutral'} size="sm">
                  {entry.results_count} résultat{entry.results_count > 1 ? 's' : ''}
                </Badge>
                <Link to={`/biens?q=${encodeURIComponent(entry.query)}&smart=1`}>
                  <Button size="sm" variant="outline">Relancer</Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
