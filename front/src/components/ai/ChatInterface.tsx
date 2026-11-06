import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Building2, Download, ImageIcon, Paperclip, Plus, Search, Send,
} from 'lucide-react'
import { Avatar, Badge, Button, EmptyState, Spinner } from '@/components/ui'
import { cn } from '@/utils/cn'
import { formatFileSize, formatRelative, formatTime } from '@/utils/format'
import { useConversations, useMessages, useMessagingMutations } from '@/hooks/useQueries'
import { useAuth } from '@/hooks/useAuth'
import { messagingApi } from '@/api/endpoints'
import { toast } from '@/store/toastStore'
import type { Conversation } from '@/types'

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024 // 25 Mo

const TYPE_LABEL: Record<string, string> = {
  CLIENT_AGENT: 'Client',
  OWNER_AGENT: 'Propriétaire',
  AGENT_AGENCY: 'Interne',
  SUPPORT: 'Support',
}

/**
 * Messagerie du produit : liste des conversations à gauche, fil à droite.
 * Sur mobile, les deux panneaux s'échangent — la liste puis le fil.
 */
export function ChatInterface({ className }: { className?: string }) {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeId, setActiveId] = useState<string | null>(searchParams.get('conversation'))
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [sendingFile, setSendingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const { data: conversationPage, isLoading } = useConversations()
  const { data: messagePage, isLoading: loadingMessages } = useMessages(activeId)
  const { send, markRead, uploadAttachment } = useMessagingMutations()

  const conversations = conversationPage?.items ?? []
  // L'API renvoie les messages du plus récent au plus ancien (pagination par
  // curseur) : on les remet dans l'ordre chronologique pour un affichage
  // façon WhatsApp (anciens en haut, nouveaux en bas).
  const messages = [...(messagePage?.items ?? [])].reverse()
  const active = conversations.find((item) => item.id === activeId) ?? null
  // L'autre participant (pas soi-même) — affiché en en-tête façon WhatsApp.
  const otherParticipant = active?.participants.find((p) => p.user_id !== user?.id) ?? null

  // Une conversation ciblée depuis une autre page (ex. "Envoyer un message"
  // depuis la fiche d'un propriétaire) a priorité sur la sélection automatique.
  useEffect(() => {
    const target = searchParams.get('conversation')
    if (target && target !== activeId) {
      setActiveId(target)
      setSearchParams((params) => { params.delete('conversation'); return params }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Sélection automatique de la première conversation sur grand écran.
  useEffect(() => {
    if (!activeId && conversations.length && window.innerWidth >= 768) {
      setActiveId(conversations[0].id)
    }
  }, [conversations, activeId])

  useEffect(() => {
    if (activeId) markRead.mutate(activeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, activeId])

  const filtered = conversations.filter((conversation) =>
    !search || (conversation.subject ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  function submit() {
    const content = draft.trim()
    if (!content || !activeId) return
    setDraft('')
    send.mutate({ conversationId: activeId, content })
  }

  async function sendFile(file: File) {
    if (!activeId) return
    if (file.size > MAX_ATTACHMENT_SIZE) {
      toast.error('Fichier trop lourd', `${file.name} dépasse 25 Mo.`)
      return
    }
    setSendingFile(true)
    try {
      const uploaded = await uploadAttachment.mutateAsync({ conversationId: activeId, file })
      send.mutate({
        conversationId: activeId,
        type: file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT',
        attachment: { url: uploaded.key, name: uploaded.name, mime: uploaded.mime, size: uploaded.size },
      })
    } finally {
      setSendingFile(false)
    }
  }

  return (
    <div
      className={cn(
        'flex h-[calc(100vh-11rem)] min-h-[520px] overflow-hidden rounded-2xl border border-line bg-surface shadow-card',
        className,
      )}
    >
      {/* ----------------------- Liste des conversations ------------------ */}
      <aside
        className={cn(
          'w-full shrink-0 flex-col border-r border-line md:flex md:w-80',
          activeId ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="shrink-0 border-b border-line p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une conversation"
              className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-sm text-content placeholder:text-content-subtle focus:border-lagoon-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Aucune conversation"
              description="Les échanges avec vos clients et propriétaires apparaîtront ici."
            />
          ) : (
            filtered.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === activeId}
                onSelect={() => setActiveId(conversation.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* ------------------------------- Fil ----------------------------- */}
      <section className={cn('flex min-w-0 flex-1 flex-col', activeId ? 'flex' : 'hidden md:flex')}>
        {!active ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              title="Sélectionnez une conversation"
              description="Choisissez un échange dans la liste pour afficher les messages."
            />
          </div>
        ) : (
          <>
            <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
              <button
                onClick={() => setActiveId(null)}
                className="rounded-lg p-1.5 text-content-muted md:hidden"
                aria-label="Retour à la liste"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Avatar name={otherParticipant?.full_name ?? active.subject ?? 'Conversation'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-content">
                  {otherParticipant?.full_name ?? active.subject ?? 'Conversation'}
                </p>
                <p className="truncate font-mono text-2xs uppercase tracking-[0.12em] text-content-subtle">
                  {otherParticipant?.email ?? TYPE_LABEL[active.type] ?? active.type}
                  {active.property_id && ' · bien rattaché'}
                </p>
              </div>
              {active.property_id && (
                <a
                  href={`/biens/${active.property_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
                >
                  <Badge tone="brass" size="sm" className="cursor-pointer hover:opacity-80">
                    <Building2 className="h-3 w-3" />
                    Voir le bien
                  </Badge>
                </a>
              )}
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto bg-surface-2/40 px-4 py-5">
              {loadingMessages ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : (
                messages.map((message, index) => {
                  const mine = message.sender_id === user?.id
                  const previous = messages[index - 1]
                  const grouped = previous?.sender_id === message.sender_id
                  const sameDay = previous
                    && new Date(previous.created_at).toDateString() === new Date(message.created_at).toDateString()

                  return (
                    <div key={message.id}>
                      {!sameDay && (
                        <div className="my-4 flex items-center justify-center">
                          <span className="rounded-full bg-surface px-3 py-1 font-mono text-2xs uppercase tracking-wide text-content-subtle shadow-sm">
                            {formatRelative(message.created_at)}
                          </span>
                        </div>
                      )}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22 }}
                        className={cn('flex', mine ? 'justify-end' : 'justify-start', grouped && !(!sameDay) && 'mt-1')}
                      >
                        <div className={cn('max-w-[78%]', mine && 'items-end')}>
                          <div
                            className={cn(
                              'rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
                              mine
                                ? 'rounded-br-md bg-lagoon-600 text-white'
                                : 'rounded-bl-md border border-line bg-surface text-content',
                            )}
                          >
                            {message.type === 'DOCUMENT' || message.type === 'IMAGE' ? (
                              <button
                                type="button"
                                onClick={() => message.attachment_url && messagingApi.downloadAttachment(
                                  activeId!, message.attachment_url,
                                  message.attachment_name ?? 'fichier',
                                  message.attachment_mime ?? 'application/octet-stream',
                                )}
                                className="flex items-center gap-3 text-left"
                              >
                                <span className={cn(
                                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                                  mine ? 'bg-white/15' : 'bg-surface-2',
                                )}>
                                  {message.type === 'IMAGE'
                                    ? <ImageIcon className="h-4 w-4" />
                                    : <Paperclip className="h-4 w-4" />}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold">{message.attachment_name}</span>
                                  <span className={cn('flex items-center gap-1 text-2xs', mine ? 'text-white/70' : 'text-content-subtle')}>
                                    {formatFileSize(message.attachment_size)} · <Download className="h-3 w-3" /> Télécharger
                                  </span>
                                </span>
                              </button>
                            ) : (
                              <p className="whitespace-pre-wrap text-pretty">{message.content}</p>
                            )}
                          </div>
                          <p
                            className={cn(
                              'mt-1 px-1 font-mono text-2xs text-content-subtle',
                              mine ? 'text-right' : 'text-left',
                            )}
                          >
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </motion.div>
                    </div>
                  )
                })
              )}
              <div ref={endRef} />
            </div>

            <div className="shrink-0 border-t border-line p-3">
              <div className="flex items-end gap-2 rounded-xl border border-line bg-surface-2 p-2 focus-within:border-lagoon-500">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) sendFile(file)
                    event.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sendingFile}
                  aria-label="Joindre un fichier"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-surface hover:text-lagoon-600 disabled:opacity-50"
                >
                  {sendingFile ? <Spinner size="sm" /> : <Plus className="h-4.5 w-4.5" />}
                </button>
                <textarea
                  value={draft}
                  rows={1}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      submit()
                    }
                  }}
                  placeholder="Écrivez votre message"
                  className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-content placeholder:text-content-subtle focus:outline-none"
                />
                <Button
                  size="icon"
                  disabled={!draft.trim() || send.isPending}
                  onClick={submit}
                  aria-label="Envoyer le message"
                  className="h-9 w-9 rounded-lg"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function ConversationRow({
  conversation, active, onSelect,
}: {
  conversation: Conversation
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 border-b border-line/60 px-3 py-3 text-left transition-colors',
        active ? 'bg-lagoon-50 dark:bg-lagoon-800/40' : 'hover:bg-surface-2',
      )}
    >
      <Avatar name={conversation.subject ?? 'C'} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold text-content">
            {conversation.subject ?? 'Conversation'}
          </p>
          <span className="shrink-0 font-mono text-2xs text-content-subtle">
            {formatRelative(conversation.last_message_at)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-mono text-2xs uppercase tracking-[0.12em] text-content-subtle">
            {TYPE_LABEL[conversation.type] ?? conversation.type}
          </span>
          {conversation.unread_count > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brass-500 px-1.5 font-mono text-2xs font-bold text-ink">
              {conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}