import { useState } from 'react'
import { Download, FileSignature, MoreVertical, Plus } from 'lucide-react'
import {
  Badge, Button, Card, Dropdown, DropdownItem, EmptyState, Modal, Pagination, Select, Table,
  type Column,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { SignaturePad } from '@/components/shared/SignaturePad'
import { useAuth } from '@/hooks/useAuth'
import { useClients, useContractMutations, useContracts, useProperties } from '@/hooks/useQueries'
import { transactionApi } from '@/api/endpoints'
import { toast } from '@/store/toastStore'
import { formatDate } from '@/utils/format'
import type { Contract } from '@/types'

const KIND_LABEL: Record<string, string> = {
  SALE_DEED: 'Vente', LEASE: 'Bail', MANDATE: 'Mandat',
}
const STATUS_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral', PENDING_SIGNATURE: 'warning', SIGNED: 'success', TERMINATED: 'danger',
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon', PENDING_SIGNATURE: 'En attente de signature', SIGNED: 'Signé', TERMINATED: 'Résilié',
}

/** Contrats : génération automatique depuis un bien, double signature électronique, téléchargement. */
export function ContractsPage() {
  const { isClient, isAgency, isAgent } = useAuth()
  const canGenerate = isAgency || isAgent
  const [page, setPage] = useState(1)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [signing, setSigning] = useState<Contract | null>(null)

  const { data, isLoading } = useContracts({ page, size: 15 })

  const columns: Column<Contract>[] = [
    {
      key: 'title', header: 'Contrat',
      render: (contract) => (
        <div>
          <p className="font-medium text-content">{contract.title}</p>
          <p className="font-mono text-2xs text-content-subtle">{contract.reference}</p>
        </div>
      ),
    },
    { key: 'kind', header: 'Type', render: (contract) => KIND_LABEL[contract.kind] ?? contract.kind },
    {
      key: 'status', header: 'Statut',
      render: (contract) => (
        <Badge tone={STATUS_TONE[contract.status]}>{STATUS_LABEL[contract.status] ?? contract.status}</Badge>
      ),
    },
    {
      key: 'signatures', header: 'Signatures', hideOnMobile: true,
      render: (contract) => (
        <div className="flex items-center gap-1.5 text-2xs text-content-subtle">
          <span className={contract.agent_signature ? 'text-lagoon-600' : ''}>Agence {contract.agent_signature ? '✓' : '—'}</span>
          <span>·</span>
          <span className={contract.client_signature ? 'text-lagoon-600' : ''}>Client {contract.client_signature ? '✓' : '—'}</span>
        </div>
      ),
    },
    {
      key: 'created_at', header: 'Généré le', hideOnMobile: true,
      render: (contract) => formatDate(contract.created_at),
    },
    {
      key: 'actions', header: '', className: 'w-12',
      render: (contract) => {
        const iSigned = isClient ? !!contract.client_signature : !!contract.agent_signature
        const canSign = !iSigned && (isClient ? contract.status !== 'TERMINATED' : contract.status !== 'TERMINATED')
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
                {canSign && (
                  <DropdownItem
                    icon={<FileSignature className="h-4 w-4" />}
                    onClick={() => { close(); setSigning(contract) }}
                  >
                    Signer
                  </DropdownItem>
                )}
                <DropdownItem
                  icon={<Download className="h-4 w-4" />}
                  onClick={() => { close(); transactionApi.downloadContract(contract.id, contract.reference) }}
                >
                  Télécharger
                </DropdownItem>
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
        eyebrow="Dossiers"
        title="Contrats"
        description="Généré automatiquement depuis un bien, signé électroniquement par l'agence/l'agent et par le client, puis téléchargeable par les deux."
        actions={canGenerate ? (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setGenerateOpen(true)}>
            Générer un contrat
          </Button>
        ) : undefined}
      />

      <Card>
        {isLoading ? (
          <Table columns={columns} rows={[]} rowKey={(c) => c.id} loading />
        ) : (data?.items ?? []).length === 0 ? (
          <EmptyState
            icon={<FileSignature className="h-6 w-6" />}
            title="Aucun contrat"
            description={canGenerate
              ? "Générez un contrat depuis un bien et un client, puis faites-le signer."
              : "Vos contrats apparaîtront ici dès qu'une agence en aura généré un pour vous."}
          />
        ) : (
          <Table columns={columns} rows={data?.items ?? []} rowKey={(c) => c.id} />
        )}
      </Card>

      {data && data.pages > 1 && (
        <div className="mt-4">
          <Pagination page={data.page} pages={data.pages} total={data.total} label="contrats" onChange={setPage} />
        </div>
      )}

      {canGenerate && <GenerateModal open={generateOpen} onClose={() => setGenerateOpen(false)} />}
      {signing && (
        <SignModal
          contract={signing}
          asClient={isClient}
          onClose={() => setSigning(null)}
        />
      )}
    </div>
  )
}

function GenerateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: properties } = useProperties({ size: 100 })
  const { data: clients } = useClients({ size: 100 })
  const { create } = useContractMutations()

  const [propertyId, setPropertyId] = useState('')
  const [clientId, setClientId] = useState('')
  const [kind, setKind] = useState('SALE_DEED')

  function submit() {
    if (!propertyId) {
      toast.error('Bien requis', 'Sélectionnez le bien concerné par le contrat.')
      return
    }
    create.mutate(
      { kind, property_id: propertyId, client_id: clientId || undefined },
      { onSuccess: () => { setPropertyId(''); setClientId(''); onClose() } },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Générer un contrat">
      <div className="space-y-4">
        <p className="text-sm text-content-subtle">
          Le texte du contrat est rédigé automatiquement à partir du bien, du client et de
          l'agence. Vous pourrez l'ajuster avant signature si besoin.
        </p>
        <Select
          label="Type de contrat"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          options={[
            { value: 'SALE_DEED', label: 'Contrat de vente' },
            { value: 'LEASE', label: 'Contrat de bail (location)' },
            { value: 'MANDATE', label: 'Mandat de gestion' },
          ]}
        />
        <Select
          label="Bien concerné"
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
          options={[
            { value: '', label: 'Sélectionner un bien' },
            ...(properties?.items ?? []).map((p) => ({ value: p.id, label: `${p.reference} — ${p.title}` })),
          ]}
        />
        <Select
          label="Client (optionnel — pourra être signé côté client une fois défini)"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          options={[
            { value: '', label: 'Aucun client pour le moment' },
            ...(clients?.items ?? []).map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name} — ${c.email}` })),
          ]}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={create.isPending} onClick={submit}>Générer le contrat</Button>
        </div>
      </div>
    </Modal>
  )
}

function SignModal({
  contract, asClient, onClose,
}: { contract: Contract; asClient: boolean; onClose: () => void }) {
  const { sign } = useContractMutations()
  const [signature, setSignature] = useState<string | null>(null)

  function submit() {
    if (!signature) {
      toast.error('Signature requise', 'Signez dans le cadre avant de valider.')
      return
    }
    sign.mutate({ id: contract.id, signature }, { onSuccess: onClose })
  }

  return (
    <Modal open onClose={onClose} title={`Signer — ${contract.title}`}>
      <div className="space-y-4">
        <div className="max-h-48 overflow-y-auto rounded-xl border border-line bg-surface-2 p-4 text-sm text-content-subtle">
          {contract.content}
        </div>
        <p className="text-sm text-content">
          En signant ci-dessous {asClient ? 'en tant que client' : "au nom de l'agence"}, vous
          acceptez les termes du contrat présenté.
        </p>
        <SignaturePad onChange={setSignature} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={sign.isPending} onClick={submit}>Valider ma signature</Button>
        </div>
      </div>
    </Modal>
  )
}
