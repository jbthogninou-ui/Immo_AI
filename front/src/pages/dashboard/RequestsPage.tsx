import { useState } from 'react'
import { ClipboardList, Plus } from 'lucide-react'
import {
  Badge, Button, Card, EmptyState, Input, Modal, Skeleton, Textarea,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { useClientMutations, useClientRequests } from '@/hooks/useQueries'
import { toast } from '@/store/toastStore'
import { formatDateTime, formatRelative } from '@/utils/format'

/** Demandes adressées à l'agence par le client. */
export function RequestsPage() {
  const { user, isClient } = useAuth()
  const { data, isLoading } = useClientRequests({ size: 50 })
  const { createRequest } = useClientMutations()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  const items = data?.items ?? []

  function submit() {
    if (!subject.trim()) {
      toast.error('Objet manquant', 'Indiquez en une phrase ce que vous recherchez.')
      return
    }
    if (!user?.client_id) return
    createRequest.mutate(
      { clientId: user.client_id, payload: { subject, message: message || undefined } },
      { onSuccess: () => { setOpen(false); setSubject(''); setMessage('') } },
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow={isClient ? 'Mon dossier' : 'Commercial'}
        title={isClient ? 'Mes demandes' : 'Demandes clients'}
        description={
          isClient
            ? "Vos demandes de renseignements et de recherche. Un agent vous répond sous 24 heures."
            : "Les demandes adressées par les clients de l'agence."
        }
        actions={
          isClient && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              Nouvelle demande
            </Button>
          )
        }
      />

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Aucune demande"
            description={isClient ? "Décrivez ce que vous cherchez : un agent vous recontacte." : "Les demandes des clients apparaîtront ici."}
            icon={<ClipboardList className="h-6 w-6" />}
            action={isClient && <Button onClick={() => setOpen(true)}>Nouvelle demande</Button>}
          />
        ) : (
          <div className="divide-y divide-line">
            {items.map((request) => (
              <div key={request.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-sm font-semibold text-content">{request.subject}</p>
                  <Badge tone={request.status === 'OPEN' ? 'warning' : 'success'} size="sm">
                    {request.status === 'OPEN' ? 'En cours' : 'Traitée'}
                  </Badge>
                  <span className="ml-auto font-mono text-2xs text-content-subtle">
                    {formatRelative(request.created_at)}
                  </span>
                </div>
                {request.message && (
                  <p className="mt-1.5 text-sm text-content-muted text-pretty">{request.message}</p>
                )}
                <p className="mt-2 font-mono text-2xs text-content-subtle">
                  {formatDateTime(request.created_at)}
                  {request.property_id && ` · bien ${request.property_id.slice(-8)}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouvelle demande"
        description="Un agent de l'agence prend en charge votre demande."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button loading={createRequest.isPending} onClick={submit}>Envoyer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Objet"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Recherche villa 4 chambres à Fidjrossè"
          />
          <Textarea
            label="Détails"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            placeholder="Budget, quartiers souhaités, délai, contraintes particulières…"
          />
        </div>
      </Modal>
    </div>
  )
}
