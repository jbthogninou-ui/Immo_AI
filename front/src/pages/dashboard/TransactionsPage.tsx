import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { KeyRound, MoreVertical, Plus } from 'lucide-react'
import {
  Badge, Button, Card, Dropdown, DropdownItem, EmptyState, Input, Modal,
  Pagination, Select, Tab, TabList, Table, Tabs, Textarea, type Column,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { useAuth } from '@/hooks/useAuth'
import {
  useClients, useProperties, useRentals, useSales, useTransactionMutations,
} from '@/hooks/useQueries'
import { toast } from '@/store/toastStore'
import { RENTAL_STATUS, SALE_STATUS } from '@/utils/constants'
import { formatCompactPrice, formatDate, formatPrice } from '@/utils/format'
import type { Rental, Sale } from '@/types'

/** Ventes et locations. L'onglet ouvert dépend de la route empruntée. */
export function TransactionsPage() {
  const { pathname } = useLocation()
  const { isClient, isOwner } = useAuth()
  const initial = pathname.endsWith('/locations') ? 'rentals' : 'sales'
  const [tab, setTab] = useState<string>(initial)
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)

  const { data: sales, isLoading: loadingSales } = useSales({ page, size: 15 })
  const { data: rentals, isLoading: loadingRentals } = useRentals({ page, size: 15 })
  const { updateSale, updateRental } = useTransactionMutations()
  const readOnly = isClient || isOwner

  const totalSales = (sales?.items ?? [])
    .filter((sale) => sale.status === 'COMPLETED')
    .reduce((sum, sale) => sum + sale.amount, 0)
  const totalCommission = (sales?.items ?? [])
    .filter((sale) => sale.status === 'COMPLETED')
    .reduce((sum, sale) => sum + (sale.commission_amount ?? 0), 0)
  const monthlyRent = (rentals?.items ?? [])
    .filter((rental) => rental.status === 'ACTIVE')
    .reduce((sum, rental) => sum + rental.monthly_rent, 0)

  const saleColumns: Column<Sale>[] = [
    {
      key: 'ref', header: 'Référence',
      render: (sale) => (
        <div>
          <span className="font-mono text-xs font-semibold text-content">{sale.reference}</span>
          <span className="block text-2xs text-content-subtle">{formatDate(sale.created_at)}</span>
        </div>
      ),
    },
    {
      key: 'amount', header: 'Montant',
      render: (sale) => (
        <span className="font-mono text-sm font-semibold text-content">
          {formatPrice(sale.amount, sale.currency)}
        </span>
      ),
    },
    {
      key: 'commission', header: 'Commission', hideOnMobile: true,
      render: (sale) => (
        <span className="font-mono text-xs text-content-muted">
          {sale.commission_amount ? formatCompactPrice(sale.commission_amount) : '—'}
          {sale.commission_rate && (
            <span className="block text-2xs text-content-subtle">{sale.commission_rate} %</span>
          )}
        </span>
      ),
    },
    {
      key: 'signed', header: 'Signature', hideOnMobile: true,
      render: (sale) => (
        <span className="font-mono text-2xs text-content-subtle">
          {sale.signed_at ? formatDate(sale.signed_at) : 'non signée'}
        </span>
      ),
    },
    {
      key: 'status', header: 'Statut',
      render: (sale) => {
        const tone = SALE_STATUS[sale.status]
        return <Badge tone={tone.tone} size="sm">{tone.label}</Badge>
      },
    },
    {
      key: 'actions', header: '', className: 'w-12',
      render: (sale) => (
        <Dropdown
          trigger={
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-surface-2 hover:text-content">
              <MoreVertical className="h-4 w-4" />
            </span>
          }
        >
          {(close) =>
            readOnly || sale.status === 'COMPLETED' ? (
              <DropdownItem onClick={close}>
                {sale.status === 'COMPLETED' ? 'Vente figée' : 'Consultation seule'}
              </DropdownItem>
            ) : (
              <>
                <DropdownItem
                  onClick={() => {
                    close()
                    updateSale.mutate({
                      id: sale.id,
                      payload: { status: 'COMPLETED', completed_at: new Date().toISOString() },
                    })
                  }}
                >
                  Marquer comme finalisée
                </DropdownItem>
                <DropdownItem
                  danger
                  onClick={() => { close(); updateSale.mutate({ id: sale.id, payload: { status: 'CANCELLED' } }) }}
                >
                  Annuler la vente
                </DropdownItem>
              </>
            )
          }
        </Dropdown>
      ),
    },
  ]

  const rentalColumns: Column<Rental>[] = [
    {
      key: 'ref', header: 'Référence',
      render: (rental) => (
        <div>
          <span className="font-mono text-xs font-semibold text-content">{rental.reference}</span>
          <span className="block text-2xs text-content-subtle">
            du {formatDate(rental.start_date)}
          </span>
        </div>
      ),
    },
    {
      key: 'rent', header: 'Loyer',
      render: (rental) => (
        <span className="font-mono text-sm font-semibold text-content">
          {formatPrice(rental.monthly_rent, rental.currency)}
          <span className="block text-2xs font-normal text-content-subtle">par mois</span>
        </span>
      ),
    },
    {
      key: 'deposit', header: 'Caution', hideOnMobile: true,
      render: (rental) => (
        <span className="font-mono text-xs text-content-muted">
          {rental.deposit_amount ? formatCompactPrice(rental.deposit_amount) : '—'}
        </span>
      ),
    },
    {
      key: 'duration', header: 'Durée', hideOnMobile: true,
      render: (rental) => (
        <span className="font-mono text-xs text-content-muted">
          {rental.duration_months ? `${rental.duration_months} mois` : '—'}
        </span>
      ),
    },
    {
      key: 'status', header: 'Statut',
      render: (rental) => {
        const tone = RENTAL_STATUS[rental.status]
        return <Badge tone={tone.tone} size="sm">{tone.label}</Badge>
      },
    },
    {
      key: 'actions', header: '', className: 'w-12',
      render: (rental) => (
        <Dropdown
          trigger={
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-content-subtle transition-colors hover:bg-surface-2 hover:text-content">
              <MoreVertical className="h-4 w-4" />
            </span>
          }
        >
          {(close) =>
            readOnly ? (
              <DropdownItem onClick={close}>Consultation seule</DropdownItem>
            ) : (
              <>
                {rental.status === 'DRAFT' && (
                  <DropdownItem onClick={() => { close(); updateRental.mutate({ id: rental.id, payload: { status: 'ACTIVE' } }) }}>
                    Activer le bail
                  </DropdownItem>
                )}
                {rental.status === 'ACTIVE' && (
                  <DropdownItem danger onClick={() => { close(); updateRental.mutate({ id: rental.id, payload: { status: 'TERMINATED' } }) }}>
                    Résilier le bail
                  </DropdownItem>
                )}
                {!['DRAFT', 'ACTIVE'].includes(rental.status) && (
                  <DropdownItem onClick={close}>Aucune action possible</DropdownItem>
                )}
              </>
            )
          }
        </Dropdown>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Commercial"
        title="Transactions"
        description="Ventes et locations. Le statut d'une transaction pilote automatiquement celui du bien."
        actions={
          !readOnly && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
              {tab === 'sales' ? 'Enregistrer une vente' : 'Enregistrer une location'}
            </Button>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Volume vendu" value={formatCompactPrice(totalSales)} hint="ventes finalisées" accent index={0} />
        <StatCard label="Commissions perçues" value={formatCompactPrice(totalCommission)} index={1} />
        <StatCard label="Loyers mensuels" value={formatCompactPrice(monthlyRent)} hint="baux actifs" index={2} />
      </div>

      <Tabs value={tab} onChange={(value) => { setTab(value); setPage(1) }}>
        <TabList className="mb-4">
          <Tab value="sales" count={sales?.total}>Ventes</Tab>
          <Tab value="rentals" count={rentals?.total}>Locations</Tab>
        </TabList>

        <Card>
          {tab === 'sales' ? (
            <>
              <Table
                columns={saleColumns}
                rows={sales?.items ?? []}
                loading={loadingSales}
                rowKey={(sale) => sale.id}
                empty={<EmptyState title="Aucune vente" description="Les ventes enregistrées apparaîtront ici." icon={<KeyRound className="h-6 w-6" />} />}
              />
              {sales && <Pagination page={sales.page} pages={sales.pages} total={sales.total} label="ventes" onChange={setPage} />}
            </>
          ) : (
            <>
              <Table
                columns={rentalColumns}
                rows={rentals?.items ?? []}
                loading={loadingRentals}
                rowKey={(rental) => rental.id}
                empty={<EmptyState title="Aucune location" description="Les baux enregistrés apparaîtront ici." icon={<KeyRound className="h-6 w-6" />} />}
              />
              {rentals && <Pagination page={rentals.page} pages={rentals.pages} total={rentals.total} label="locations" onChange={setPage} />}
            </>
          )}
        </Card>
      </Tabs>

      <TransactionFormModal kind={tab} open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  )
}

function TransactionFormModal({
  kind, open, onClose,
}: {
  kind: string
  open: boolean
  onClose: () => void
}) {
  const { data: properties } = useProperties({ size: 100 })
  const { data: clients } = useClients({ size: 100 })
  const { createSale, createRental } = useTransactionMutations()
  const [form, setForm] = useState<Record<string, any>>({ commission_rate: 5 })

  const set = (patch: Record<string, any>) => setForm((current) => ({ ...current, ...patch }))
  const isSale = kind === 'sales'

  function submit() {
    if (!form.property_id || !form.client_id) {
      toast.error('Champs obligatoires', 'Sélectionnez un bien et un client.')
      return
    }
    if (isSale) {
      if (!form.amount) {
        toast.error('Montant manquant', 'Indiquez le montant de la vente.')
        return
      }
      createSale.mutate(
        {
          property_id: form.property_id,
          client_id: form.client_id,
          amount: Number(form.amount),
          commission_rate: form.commission_rate ? Number(form.commission_rate) : undefined,
          notes: form.notes || undefined,
        },
        { onSuccess: () => { setForm({ commission_rate: 5 }); onClose() } },
      )
    } else {
      if (!form.monthly_rent || !form.start_date) {
        toast.error('Champs obligatoires', 'Le loyer et la date de début sont requis.')
        return
      }
      createRental.mutate(
        {
          property_id: form.property_id,
          client_id: form.client_id,
          monthly_rent: Number(form.monthly_rent),
          charges: form.charges ? Number(form.charges) : undefined,
          deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : undefined,
          start_date: form.start_date,
          duration_months: form.duration_months ? Number(form.duration_months) : undefined,
          notes: form.notes || undefined,
        },
        { onSuccess: () => { setForm({}); onClose() } },
      )
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isSale ? 'Enregistrer une vente' : 'Enregistrer une location'}
      description={
        isSale
          ? 'Le bien passe automatiquement en réservé, puis en vendu à la finalisation.'
          : "Le bien passe en loué dès que le bail est activé."
      }
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={createSale.isPending || createRental.isPending} onClick={submit}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Bien concerné"
          value={form.property_id ?? ''}
          onChange={(event) => set({ property_id: event.target.value })}
          options={(properties?.items ?? []).map((property) => ({
            value: property.id,
            label: `${property.reference} — ${property.title.slice(0, 45)}`,
          }))}
          placeholder="Sélectionner un bien"
        />

        <Select
          label="Client"
          value={form.client_id ?? ''}
          onChange={(event) => set({ client_id: event.target.value })}
          options={(clients?.items ?? []).map((client) => ({
            value: client.id,
            label: `${client.first_name} ${client.last_name}`,
          }))}
          placeholder="Sélectionner un client"
        />

        {isSale ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Montant de la vente (FCFA)"
              type="number"
              className="font-mono"
              value={form.amount ?? ''}
              onChange={(event) => set({ amount: event.target.value })}
            />
            <Input
              label="Taux de commission (%)"
              type="number"
              step="0.5"
              className="font-mono"
              value={form.commission_rate ?? ''}
              onChange={(event) => set({ commission_rate: event.target.value })}
              hint={
                form.amount && form.commission_rate
                  ? `Soit ${formatCompactPrice((Number(form.amount) * Number(form.commission_rate)) / 100)}`
                  : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Loyer mensuel (FCFA)" type="number" className="font-mono" value={form.monthly_rent ?? ''} onChange={(event) => set({ monthly_rent: event.target.value })} />
              <Input label="Charges (FCFA)" type="number" className="font-mono" value={form.charges ?? ''} onChange={(event) => set({ charges: event.target.value })} />
              <Input label="Caution (FCFA)" type="number" className="font-mono" value={form.deposit_amount ?? ''} onChange={(event) => set({ deposit_amount: event.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Date de début" type="date" value={form.start_date ?? ''} onChange={(event) => set({ start_date: event.target.value })} />
              <Input label="Durée (mois)" type="number" className="font-mono" value={form.duration_months ?? ''} onChange={(event) => set({ duration_months: event.target.value })} />
            </div>
          </>
        )}

        <Textarea label="Notes" value={form.notes ?? ''} onChange={(event) => set({ notes: event.target.value })} rows={3} />
      </div>
    </Modal>
  )
}
