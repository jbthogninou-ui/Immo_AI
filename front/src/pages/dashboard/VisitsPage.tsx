import { useState } from 'react'
import { CalendarCheck, CalendarPlus, Check, MoreVertical, X } from 'lucide-react'
import {
  Badge, Button, Card, Dropdown, DropdownItem, DropdownSeparator, EmptyState,
  Input, Modal, Pagination, Table, Textarea, type Column,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { useVisits, useVisitMutations } from '@/hooks/useQueries'
import { VISIT_STATUS } from '@/utils/constants'
import { formatDateTime, formatRelative } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Visit } from '@/types'

const TABS = [
  { value: '', label: 'Toutes' },
  { value: 'REQUESTED', label: 'Demandées' },
  { value: 'CONFIRMED', label: 'Confirmées' },
  { value: 'COMPLETED', label: 'Effectuées' },
  { value: 'CANCELLED', label: 'Annulées' },
]

/** Agenda des visites : demandes, confirmations, comptes rendus. */
export function VisitsPage() {
  const { isClient, isOwner } = useAuth()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [completing, setCompleting] = useState<Visit | null>(null)
  const [feedback, setFeedback] = useState('')
  const [rating, setRating] = useState(5)
  const [rescheduling, setRescheduling] = useState<Visit | null>(null)
  const [newDate, setNewDate] = useState('')

  const { data, isLoading } = useVisits({ status: status || undefined, page, size: 15 })
  const { decide, complete, cancel } = useVisitMutations()
  const readOnly = isClient || isOwner

  const columns: Column<Visit>[] = [
    {
      key: 'date', header: 'Créneau',
      render: (visit) => (
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-surface-2 font-mono">
            <span className="text-2xs leading-none text-content-subtle">
              {new Date(visit.scheduled_at).toLocaleDateString('fr-FR', { month: 'short' })}
            </span>
            <span className="text-sm font-bold leading-none text-content">
              {new Date(visit.scheduled_at).getDate()}
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-content">{formatDateTime(visit.scheduled_at)}</p>
            <p className="text-2xs text-content-subtle">
              {visit.duration_minutes} min · {formatRelative(visit.scheduled_at)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'property', header: 'Bien', hideOnMobile: true,
      render: (visit) => (
        <span className="font-mono text-2xs text-content-muted">{visit.property_id.slice(-10)}</span>
      ),
    },
    {
      key: 'message', header: 'Message du client', hideOnMobile: true,
      render: (visit) => (
        <span className="line-clamp-2 text-xs text-content-muted">
          {visit.client_message ?? '—'}
        </span>
      ),
    },
    {
      key: 'status', header: 'Statut',
      render: (visit) => {
        const tone = VISIT_STATUS[visit.status]
        return (
          <div>
            <Badge tone={tone.tone} size="sm">{tone.label}</Badge>
            {visit.rating && (
              <span className="mt-1 block font-mono text-2xs text-brass-600 dark:text-brass-300">
                {visit.rating}/5
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'actions', header: '', className: 'w-12',
      render: (visit) => {
        const closed = ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(visit.status)
        return (
          <Dropdown
            trigger={
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-surface-2 hover:text-content">
                <MoreVertical className="h-4 w-4" />
              </span>
            }
          >
            {(close) => (
              <>
                {!readOnly && visit.status === 'REQUESTED' && (
                  <>
                    <DropdownItem
                      icon={<Check className="h-4 w-4" />}
                      onClick={() => { close(); decide.mutate({ id: visit.id, approve: true }) }}
                    >
                      Confirmer la visite
                    </DropdownItem>
                    <DropdownItem onClick={() => { close(); setRescheduling(visit) }}>
                      Proposer un autre créneau
                    </DropdownItem>
                    <DropdownItem
                      danger
                      icon={<X className="h-4 w-4" />}
                      onClick={() => { close(); decide.mutate({ id: visit.id, approve: false, reason: 'Créneau indisponible' }) }}
                    >
                      Refuser
                    </DropdownItem>
                    <DropdownSeparator />
                  </>
                )}
                {!readOnly && ['CONFIRMED', 'RESCHEDULED'].includes(visit.status) && (
                  <DropdownItem icon={<CalendarCheck className="h-4 w-4" />} onClick={() => { close(); setCompleting(visit) }}>
                    Clôturer la visite
                  </DropdownItem>
                )}
                {!closed && (
                  <DropdownItem danger onClick={() => { close(); cancel.mutate({ id: visit.id }) }}>
                    Annuler
                  </DropdownItem>
                )}
                {closed && <DropdownItem onClick={close}>Aucune action possible</DropdownItem>}
              </>
            )}
          </Dropdown>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Agenda"
        title={isClient ? 'Mes visites' : 'Visites'}
        description={
          isClient
            ? "Suivez vos demandes et les créneaux confirmés par les agents."
            : isOwner
              ? "Les visites programmées sur les biens que vous avez confiés."
              : "Confirmez les demandes, reprogrammez si besoin, puis clôturez avec un compte rendu."
        }
      />

      <Card className="mb-4 p-3">
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatus(tab.value); setPage(1) }}
              className={cn(
                'whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors',
                status === tab.value ? 'bg-lagoon-600 text-white' : 'text-content-muted hover:bg-surface-2 hover:text-content',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <Table
          columns={columns}
          rows={data?.items ?? []}
          loading={isLoading}
          rowKey={(visit) => visit.id}
          empty={
            <EmptyState
              title="Aucune visite"
              description={isClient ? "Demandez une visite depuis la fiche d'un bien du catalogue." : "Les demandes de visite de vos clients apparaîtront ici."}
              icon={<CalendarPlus className="h-6 w-6" />}
            />
          }
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} label="visites" onChange={setPage} />}
      </Card>

      {/* Clôture */}
      <Modal
        open={!!completing}
        onClose={() => { setCompleting(null); setFeedback('') }}
        title="Clôturer la visite"
        description="Le compte rendu reste visible par l'agence et le propriétaire."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setCompleting(null); setFeedback('') }}>Annuler</Button>
            <Button
              loading={complete.isPending}
              onClick={() => {
                if (!completing) return
                complete.mutate(
                  { id: completing.id, feedback: feedback || undefined, rating },
                  { onSuccess: () => { setCompleting(null); setFeedback('') } },
                )
              }}
            >
              Clôturer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <span className="mb-2 block text-sm font-semibold text-content">Intérêt du client</span>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onClick={() => setRating(value)}
                  className={cn(
                    'h-10 flex-1 rounded-lg border font-mono text-sm font-semibold transition-colors',
                    rating === value
                      ? 'border-brass-500 bg-brass-500 text-ink'
                      : 'border-line bg-surface text-content-muted hover:border-line-strong',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            label="Compte rendu"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="Client très intéressé, offre attendue cette semaine."
            rows={4}
          />
        </div>
      </Modal>

      {/* Reprogrammation */}
      <Modal
        open={!!rescheduling}
        onClose={() => { setRescheduling(null); setNewDate('') }}
        title="Proposer un autre créneau"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setRescheduling(null); setNewDate('') }}>Annuler</Button>
            <Button
              loading={decide.isPending}
              onClick={() => {
                if (!rescheduling || !newDate) return
                decide.mutate(
                  { id: rescheduling.id, approve: true, scheduled_at: new Date(newDate).toISOString() },
                  { onSuccess: () => { setRescheduling(null); setNewDate('') } },
                )
              }}
            >
              Proposer ce créneau
            </Button>
          </>
        }
      >
        <Input
          type="datetime-local"
          label="Nouveau créneau"
          value={newDate}
          onChange={(event) => setNewDate(event.target.value)}
          min={new Date(Date.now() + 3600_000).toISOString().slice(0, 16)}
          hint="Le client est averti du changement."
        />
      </Modal>
    </div>
  )
}
