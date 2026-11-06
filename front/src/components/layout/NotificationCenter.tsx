import { Bell, CheckCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Dropdown, EmptyState } from '@/components/ui'
import { cn } from '@/utils/cn'
import { formatRelative } from '@/utils/format'
import { useNotificationMutations, useNotifications, useUnreadCount } from '@/hooks/useQueries'
import type { NotificationType } from '@/types'

const TYPE_TONE: Record<NotificationType, string> = {
  INVITATION: 'bg-lagoon-100 text-lagoon-700 dark:bg-lagoon-800 dark:text-lagoon-200',
  ACCOUNT_VALIDATION: 'bg-lagoon-100 text-lagoon-700 dark:bg-lagoon-800 dark:text-lagoon-200',
  NEW_MESSAGE: 'bg-brass-100 text-brass-700 dark:bg-brass-800/40 dark:text-brass-200',
  VISIT: 'bg-brass-100 text-brass-700 dark:bg-brass-800/40 dark:text-brass-200',
  TRANSACTION: 'bg-lagoon-100 text-lagoon-700 dark:bg-lagoon-800 dark:text-lagoon-200',
  DOCUMENT: 'bg-laterite-400/15 text-laterite-600',
  SYSTEM: 'bg-surface-2 text-content-muted',
}

/** Cloche de notifications : compteur, liste, action « tout marquer comme lu ». */
export function NotificationCenter() {
  const { data: unread } = useUnreadCount()
  const { data } = useNotifications({ size: 8 })
  const { markRead } = useNotificationMutations()
  const count = unread?.unread ?? 0
  const items = data?.items ?? []

  return (
    <Dropdown
      align="right"
      className="w-[22rem] p-0"
      trigger={
        <span
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-content-muted transition-colors hover:border-line-strong hover:text-content"
          aria-label={`Notifications${count ? ` — ${count} non lues` : ''}`}
        >
          <Bell className="h-[18px] w-[18px]" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-laterite-500 px-1 font-mono text-[10px] font-bold text-white">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </span>
      }
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-display text-sm font-semibold tracking-tight text-content">Notifications</p>
            {count > 0 && (
              <button
                onClick={() => markRead.mutate({ all: true })}
                className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.1em] text-lagoon-600 transition-colors hover:text-lagoon-700 dark:text-brass-300"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tout lire
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <EmptyState
                title="Rien de neuf"
                description="Les demandes de visite et les messages apparaîtront ici."
                icon={<Bell className="h-6 w-6" />}
              />
            ) : (
              items.map((notification) => (
                <Link
                  key={notification.id}
                  to={notification.action_url ?? '#'}
                  onClick={() => {
                    if (!notification.is_read) markRead.mutate({ ids: [notification.id] })
                    close()
                  }}
                  className={cn(
                    'flex gap-3 border-b border-line/60 px-4 py-3 transition-colors last:border-0 hover:bg-surface-2',
                    !notification.is_read && 'bg-lagoon-50/60 dark:bg-lagoon-800/25',
                  )}
                >
                  <span className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', notification.is_read ? 'bg-transparent' : 'bg-brass-500')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-content">{notification.title}</p>
                      <span className="shrink-0 font-mono text-2xs text-content-subtle">
                        {formatRelative(notification.created_at)}
                      </span>
                    </div>
                    {notification.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-content-muted text-pretty">{notification.body}</p>
                    )}
                    <span className={cn('mt-1.5 inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]', TYPE_TONE[notification.type])}>
                      {notification.type.toLowerCase().replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>

          <Link
            to="/notifications"
            onClick={close}
            className="block border-t border-line px-4 py-2.5 text-center text-xs font-semibold text-lagoon-600 transition-colors hover:bg-surface-2 dark:text-brass-300"
          >
            Voir toutes les notifications
          </Link>
        </div>
      )}
    </Dropdown>
  )
}
