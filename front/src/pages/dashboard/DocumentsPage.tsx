import { useRef, useState } from 'react'
import { CheckCircle2, Download, FileText, MoreVertical, Trash2, Upload, XCircle } from 'lucide-react'
import {
  Badge, Button, Card, ConfirmDialog, Dropdown, DropdownItem, DropdownSeparator,
  EmptyState, Modal, Pagination, Select, Table, Textarea, type Column,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { useDocuments, useDocumentMutations } from '@/hooks/useQueries'
import { documentApi } from '@/api/endpoints'
import { toast } from '@/store/toastStore'
import { DOCUMENT_CATEGORY_LABEL, DOCUMENT_STATUS } from '@/utils/constants'
import { formatDate, formatFileSize } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { DocumentFile } from '@/types'

const TABS = [
  { value: '', label: 'Tous' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'VERIFIED', label: 'Validés' },
  { value: 'REJECTED', label: 'Rejetés' },
]

/** Coffre documentaire : dépôt, vérification, téléchargement contrôlé. */
export function DocumentsPage() {
  const { isAgency, isSuperAdmin } = useAuth()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [rejecting, setRejecting] = useState<DocumentFile | null>(null)
  const [deleting, setDeleting] = useState<DocumentFile | null>(null)
  const [reason, setReason] = useState('')

  const { data, isLoading } = useDocuments({ status: status || undefined, page, size: 15 })
  const { verify, remove } = useDocumentMutations()
  // Une agence déjà vérifiée n'a plus besoin de redéposer son justificatif
  // légal : on désactive le dépôt pour éviter la confusion.
  const alreadyVerified = isAgency
    && (data?.items ?? []).some((doc) => doc.category === 'AGENCY_LEGAL' && doc.status === 'VERIFIED')
  const canVerify = isAgency || isSuperAdmin

  const columns: Column<DocumentFile>[] = [
    {
      key: 'file', header: 'Document',
      render: (document) => (
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-lagoon-600 dark:text-brass-300">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-content">{document.filename}</p>
            <p className="font-mono text-2xs text-content-subtle">
              {formatFileSize(document.size_bytes)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'category', header: 'Catégorie',
      render: (document) => (
        <Badge tone="neutral" size="sm">
          {DOCUMENT_CATEGORY_LABEL[document.category] ?? document.category}
        </Badge>
      ),
    },
    {
      key: 'entity', header: 'Rattaché à', hideOnMobile: true,
      render: (document) => (
        <span className="font-mono text-2xs text-content-muted">
          {document.entity_type.toLowerCase()}
          <span className="block text-content-subtle">{document.entity_id.slice(-8)}</span>
        </span>
      ),
    },
    {
      key: 'date', header: 'Déposé le', hideOnMobile: true,
      render: (document) => (
        <span className="font-mono text-2xs text-content-subtle">{formatDate(document.created_at)}</span>
      ),
    },
    {
      key: 'status', header: 'Statut',
      render: (document) => {
        const tone = DOCUMENT_STATUS[document.status]
        return (
          <div>
            <Badge tone={tone.tone} size="sm">{tone.label}</Badge>
            {document.rejection_reason && (
              <span className="mt-1 block max-w-[16rem] text-2xs text-laterite-500">
                {document.rejection_reason}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'actions', header: '', className: 'w-12',
      render: (document) => (
        <Dropdown
          trigger={
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-surface-2 hover:text-content">
              <MoreVertical className="h-4 w-4" />
            </span>
          }
        >
          {(close) => (
            <>
              <DropdownItem
                icon={<Download className="h-4 w-4" />}
                onClick={() => { close(); documentApi.download(document.id, document.filename) }}
              >
                Télécharger
              </DropdownItem>
              {canVerify && document.status === 'PENDING' && (
                <>
                  <DropdownSeparator />
                  <DropdownItem
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    onClick={() => { close(); verify.mutate({ id: document.id, approve: true }) }}
                  >
                    Valider
                  </DropdownItem>
                  <DropdownItem danger icon={<XCircle className="h-4 w-4" />} onClick={() => { close(); setRejecting(document) }}>
                    Rejeter
                  </DropdownItem>
                </>
              )}
              {canVerify && (
                <>
                  <DropdownSeparator />
                  <DropdownItem danger icon={<Trash2 className="h-4 w-4" />} onClick={() => { close(); setDeleting(document) }}>
                    Supprimer
                  </DropdownItem>
                </>
              )}
            </>
          )}
        </Dropdown>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Dossiers"
        title="Documents"
        description="Pièces d'identité, titres de propriété, mandats et contrats. Le téléchargement est contrôlé et journalisé."
        actions={
          <Button
            icon={<Upload className="h-4 w-4" />}
            disabled={alreadyVerified}
            title={alreadyVerified ? 'Votre justificatif légal est déjà vérifié.' : undefined}
            onClick={() => setUploadOpen(true)}
          >
            {alreadyVerified ? 'Documents vérifiés' : 'Déposer un document'}
          </Button>
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
          rowKey={(document) => document.id}
          empty={
            <EmptyState
              title="Aucun document"
              description="Déposez une pièce pour compléter un dossier propriétaire ou un bien."
              icon={<FileText className="h-6 w-6" />}
              action={<Button icon={<Upload className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>Déposer un document</Button>}
            />
          }
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} label="documents" onChange={setPage} />}
      </Card>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />

      <Modal
        open={!!rejecting}
        onClose={() => { setRejecting(null); setReason('') }}
        title="Rejeter ce document"
        description={rejecting?.filename}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setRejecting(null); setReason('') }}>Annuler</Button>
            <Button
              variant="danger"
              loading={verify.isPending}
              onClick={() => {
                if (!rejecting) return
                verify.mutate(
                  { id: rejecting.id, approve: false, reason },
                  { onSuccess: () => { setRejecting(null); setReason('') } },
                )
              }}
            >
              Rejeter
            </Button>
          </>
        }
      >
        <Textarea
          label="Motif du rejet"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Document illisible, merci de renvoyer un scan net."
          hint="Le déposant reçoit ce motif et peut déposer une nouvelle version."
          rows={4}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Supprimer ce document ?"
        description={deleting?.filename}
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

function UploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const { upload } = useDocumentMutations()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState('IDENTITY_CIP')

  // Le rattachement (à quel propriétaire/agence/client) ne se saisit jamais à
  // la main : il se déduit automatiquement du compte connecté, pour éviter
  // toute erreur de saisie (identifiant invalide, mauvaise entité...).
  const entityType = user?.owner_id ? 'OWNER' : user?.client_id ? 'CLIENT' : 'AGENCY'
  const entityId = user?.owner_id ?? user?.client_id ?? user?.agency_id ?? ''

  function submit() {
    if (!file) {
      toast.error('Aucun fichier', 'Sélectionnez un fichier à déposer.')
      return
    }
    if (!entityId) {
      toast.error('Compte incomplet', "Impossible de déterminer le rattachement de ce document.")
      return
    }
    upload.mutate(
      { file, entity_type: entityType, entity_id: entityId, category },
      { onSuccess: () => { setFile(null); onClose() } },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Déposer un document"
      description="Formats acceptés : PDF, images, documents bureautiques. 25 Mo maximum."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={upload.isPending} onClick={submit}>Déposer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-10 transition-colors hover:border-brass-500"
        >
          <Upload className="h-6 w-6 text-content-subtle" />
          <span className="text-sm font-semibold text-content">
            {file ? file.name : 'Choisir un fichier'}
          </span>
          <span className="font-mono text-2xs text-content-subtle">
            {file ? formatFileSize(file.size) : 'PDF, JPG, PNG, DOCX…'}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />

        <Select
          label="Catégorie"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          options={Object.entries(DOCUMENT_CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
        />
      </div>
    </Modal>
  )
}
