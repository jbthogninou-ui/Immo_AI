import { Bell, CheckCheck } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Skeleton } from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { useNotificationMutations, useNotifications } from '@/hooks/useQueries'
import { formatDateTime, formatRelative } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { NotificationType } from '@/types'

const TYPE_LABEL: Record<NotificationType, string> = {
  INVITATION: 'Invitation',
  ACCOUNT_VALIDATION: 'Validation de compte',
  NEW_MESSAGE: 'Message',
  VISIT: 'Visite',
  TRANSACTION: 'Transaction',
  DOCUMENT: 'Document',
  SYSTEM: 'Système',
}

export function NotificationsPage() {
  const { data, isLoading } = useNotifications({ size: 50 })
  const { markRead } = useNotificationMutations()
  const items = data?.items ?? []
  const unread = items.filter((item) => !item.is_read).length

  return (
    <div>
      <PageHeader
        eyebrow="Suivi"
        title="Notifications"
        description="Demandes de visite, messages, validations de dossier et transactions."
        actions={
          unread > 0 && (
            <Button
              variant="outline"
              icon={<CheckCheck className="h-4 w-4" />}
              onClick={() => markRead.mutate({ all: true })}
            >
              Tout marquer comme lu
            </Button>
          )
        }
      />

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-16" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Rien de neuf"
            description="Vos notifications apparaîtront ici dès qu'une action vous concerne."
            icon={<Bell className="h-6 w-6" />}
          />
        ) : (
          <div className="divide-y divide-line">
            {items.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  'flex gap-4 px-5 py-4 transition-colors hover:bg-surface-2',
                  !notification.is_read && 'bg-lagoon-50/50 dark:bg-lagoon-800/20',
                )}
              >
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    notification.is_read ? 'bg-line-strong' : 'bg-brass-500',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-sm font-semibold text-content">{notification.title}</p>
                    <Badge tone="neutral" size="sm">{TYPE_LABEL[notification.type]}</Badge>
                    <span className="ml-auto font-mono text-2xs text-content-subtle">
                      {formatRelative(notification.created_at)}
                    </span>
                  </div>
                  {notification.body && (
                    <p className="mt-1 text-sm text-content-muted text-pretty">{notification.body}</p>
                  )}
                  <p className="mt-1.5 font-mono text-2xs text-content-subtle">
                    {formatDateTime(notification.created_at)}
                  </p>
                </div>
                {!notification.is_read && (
                  <button
                    onClick={() => markRead.mutate({ ids: [notification.id] })}
                    className="shrink-0 self-start rounded-lg px-2.5 py-1.5 font-mono text-2xs uppercase tracking-[0.1em] text-lagoon-600 transition-colors hover:bg-surface-2 dark:text-brass-300"
                  >
                    Marquer lu
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
