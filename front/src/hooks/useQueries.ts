/* ============================================================
   Hooks TanStack Query — les clés sont centralisées ici pour que
   l'invalidation après mutation reste prévisible.
   ============================================================ */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminApi, agencyApi, agentApi, aiApi, clientApi, documentApi, messagingApi,
  notificationApi, ownerApi, propertyApi, transactionApi, visitApi,
} from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { toast } from '@/store/toastStore'
import type { PropertyFilters } from '@/types'

export const keys = {
  properties: (filters: unknown) => ['properties', filters] as const,
  publicProperties: (filters: unknown) => ['public-properties', filters] as const,
  property: (id: string) => ['property', id] as const,
  propertyTypes: ['property-types'] as const,
  agencies: (params: unknown) => ['agencies', params] as const,
  agency: (id: string) => ['agency', id] as const,
  agencyStats: (id: string) => ['agency-stats', id] as const,
  agents: (params: unknown) => ['agents', params] as const,
  owners: (params: unknown) => ['owners', params] as const,
  clients: (params: unknown) => ['clients', params] as const,
  visits: (params: unknown) => ['visits', params] as const,
  sales: (params: unknown) => ['sales', params] as const,
  rentals: (params: unknown) => ['rentals', params] as const,
  contracts: (params: unknown) => ['contracts', params] as const,
  documents: (params: unknown) => ['documents', params] as const,
  conversations: ['conversations'] as const,
  messages: (id: string) => ['messages', id] as const,
  notifications: (params: unknown) => ['notifications', params] as const,
  unreadCount: ['notifications', 'unread'] as const,
  favorites: (clientId: string) => ['favorites', clientId] as const,
  searchHistory: (clientId: string) => ['search-history', clientId] as const,
  requests: (params: unknown) => ['client-requests', params] as const,
  auditLogs: (params: unknown) => ['audit-logs', params] as const,
  platformStats: ['platform-stats'] as const,
  users: (params: unknown) => ['users', params] as const,
}

/** Signale l'échec d'une mutation de façon homogène. */
function onMutationError(fallback: string) {
  return (error: unknown) => toast.error(fallback, errorMessage(error))
}

/* ------------------------------- Biens ------------------------------ */
export const useProperties = (filters: PropertyFilters = {}) =>
  useQuery({ queryKey: keys.properties(filters), queryFn: () => propertyApi.list(filters) })

export const usePublicProperties = (filters: PropertyFilters = {}) =>
  useQuery({ queryKey: keys.publicProperties(filters), queryFn: () => propertyApi.publicList(filters) })

export const useProperty = (id: string | undefined, isPublic = false) =>
  useQuery({
    queryKey: keys.property(id ?? ''),
    queryFn: () => (isPublic ? propertyApi.publicGet(id!) : propertyApi.get(id!)),
    enabled: !!id,
  })

export const usePropertyTypes = () =>
  useQuery({ queryKey: keys.propertyTypes, queryFn: propertyApi.types, staleTime: 30 * 60_000 })

export const usePropertyImages = (propertyId: string | null | undefined) =>
  useQuery({
    queryKey: ['property-images', propertyId],
    queryFn: () => propertyApi.images(propertyId!),
    enabled: !!propertyId,
  })

export function usePropertyMutations() {
  const client = useQueryClient()
  const invalidate = () => {
    client.invalidateQueries({ queryKey: ['properties'] })
    client.invalidateQueries({ queryKey: ['public-properties'] })
  }

  return {
    create: useMutation({
      mutationFn: propertyApi.create,
      onSuccess: (property) => {
        invalidate()
        toast.success('Bien enregistré', `${property.reference} créé en brouillon.`)
      },
      onError: onMutationError("Le bien n'a pas pu être créé"),
    }),
    update: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
        propertyApi.update(id, payload),
      onSuccess: (property) => {
        invalidate()
        client.invalidateQueries({ queryKey: keys.property(property.id) })
        toast.success('Modifications enregistrées')
      },
      onError: onMutationError("Les modifications n'ont pas été enregistrées"),
    }),
    publish: useMutation({
      mutationFn: ({ id, publish }: { id: string; publish: boolean }) =>
        propertyApi.publish(id, publish),
      onSuccess: (property) => {
        invalidate()
        client.invalidateQueries({ queryKey: keys.property(property.id) })
        toast.success(property.is_published ? 'Bien publié' : 'Bien retiré du catalogue')
      },
      onError: onMutationError('Publication impossible'),
    }),
    changeStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: string }) =>
        propertyApi.changeStatus(id, status),
      onSuccess: () => {
        invalidate()
        toast.success('Statut mis à jour')
      },
      onError: onMutationError('Changement de statut refusé'),
    }),
    remove: useMutation({
      mutationFn: propertyApi.remove,
      onSuccess: () => {
        invalidate()
        toast.success('Bien supprimé')
      },
      onError: onMutationError('Suppression impossible'),
    }),
    uploadImage: useMutation({
      mutationFn: ({ id, file, isCover, caption }: { id: string; file: File; isCover?: boolean; caption?: string }) =>
        propertyApi.uploadImage(id, file, { is_cover: isCover, caption }),
      onSuccess: (_result, variables) => {
        client.invalidateQueries({ queryKey: ['property-images', variables.id] })
        invalidate()
      },
      onError: onMutationError("La photo n'a pas pu être envoyée"),
    }),
    removeImage: useMutation({
      mutationFn: ({ id, imageId }: { id: string; imageId: string }) => propertyApi.removeImage(id, imageId),
      onSuccess: (_result, variables) => {
        client.invalidateQueries({ queryKey: ['property-images', variables.id] })
        invalidate()
      },
      onError: onMutationError('Suppression de la photo impossible'),
    }),
  }
}

/* ------------------------------ Agences ----------------------------- */
export const useAgencies = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: keys.agencies(params), queryFn: () => agencyApi.list(params) })

export const useMyAgency = (enabled = true) =>
  useQuery({ queryKey: ['my-agency'], queryFn: agencyApi.mine, enabled })

export const useAgencyStats = (id: string | null | undefined) =>
  useQuery({ queryKey: keys.agencyStats(id ?? ''), queryFn: () => agencyApi.stats(id!), enabled: !!id })

export function useAgencyMutations() {
  const client = useQueryClient()
  const invalidate = () => client.invalidateQueries({ queryKey: ['agencies'] })

  return {
    validate: useMutation({
      mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
        agencyApi.validate(id, approve, reason),
      onSuccess: (agency) => {
        invalidate()
        toast.success(agency.status === 'ACTIVE' ? 'Agence validée' : 'Agence rejetée')
      },
      onError: onMutationError('Action impossible'),
    }),
    suspend: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) => agencyApi.suspend(id, reason),
      onSuccess: () => { invalidate(); toast.success('Agence suspendue') },
      onError: onMutationError('Suspension impossible'),
    }),
    activate: useMutation({
      mutationFn: agencyApi.activate,
      onSuccess: () => { invalidate(); toast.success('Agence réactivée') },
      onError: onMutationError('Réactivation impossible'),
    }),
    update: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
        agencyApi.update(id, payload),
      onSuccess: () => {
        client.invalidateQueries({ queryKey: ['my-agency'] })
        toast.success('Agence mise à jour')
      },
      onError: onMutationError('Mise à jour impossible'),
    }),
  }
}

/* ------------------------------- Agents ----------------------------- */
export const useAgents = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: keys.agents(params), queryFn: () => agentApi.list(params) })

export function useAgentMutations() {
  const client = useQueryClient()
  const invalidate = () => client.invalidateQueries({ queryKey: ['agents'] })

  return {
    invite: useMutation({
      mutationFn: agentApi.invite,
      onSuccess: (data) => {
        invalidate()
        toast.success('Invitation envoyée', `${data.agent.user?.full_name} recevra un lien d'activation.`)
      },
      onError: onMutationError("L'invitation n'a pas pu être envoyée"),
    }),
    suspend: useMutation({
      mutationFn: agentApi.suspend,
      onSuccess: () => { invalidate(); toast.success('Agent suspendu') },
      onError: onMutationError('Action impossible'),
    }),
    activate: useMutation({
      mutationFn: agentApi.activate,
      onSuccess: () => { invalidate(); toast.success('Agent activé') },
      onError: onMutationError('Action impossible'),
    }),
    remove: useMutation({
      mutationFn: agentApi.remove,
      onSuccess: () => { invalidate(); toast.success('Agent retiré de l’équipe') },
      onError: onMutationError('Suppression impossible'),
    }),
    updateInvitation: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
        agentApi.updateInvitation(id, payload),
      onSuccess: () => { invalidate(); toast.success('Invitation corrigée') },
      onError: onMutationError("L'invitation n'a pas pu être modifiée"),
    }),
    resendInvitation: useMutation({
      mutationFn: agentApi.resendInvitation,
      onSuccess: () => { invalidate() },
      onError: onMutationError("Le lien n'a pas pu être régénéré"),
    }),
  }
}

/* --------------------------- Propriétaires -------------------------- */
export const useOwners = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: keys.owners(params), queryFn: () => ownerApi.list(params) })

export const useOwner = (id: string | null | undefined) =>
  useQuery({ queryKey: ['owner', id], queryFn: () => ownerApi.get(id!), enabled: !!id })

export function useOwnerMutations() {
  const client = useQueryClient()
  const invalidate = () => client.invalidateQueries({ queryKey: ['owners'] })

  return {
    invite: useMutation({
      mutationFn: ownerApi.invite,
      onSuccess: (data) => {
        invalidate()
        toast.success('Propriétaire invité', `${data.owner.first_name} ${data.owner.last_name} doit compléter son dossier.`)
      },
      onError: onMutationError("L'invitation n'a pas pu être envoyée"),
    }),
    verify: useMutation({
      mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
        ownerApi.verify(id, approve, reason),
      onSuccess: (owner) => {
        invalidate()
        toast.success(owner.status === 'ACTIVE' ? 'Dossier validé' : 'Dossier rejeté')
      },
      onError: onMutationError('Vérification impossible'),
    }),
    update: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
        ownerApi.update(id, payload),
      onSuccess: () => { invalidate(); toast.success('Propriétaire mis à jour') },
      onError: onMutationError('Mise à jour impossible'),
    }),
  }
}

/* ------------------------------ Clients ----------------------------- */
export const useClients = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: keys.clients(params), queryFn: () => clientApi.list(params) })

export const useFavorites = (clientId: string | null | undefined) =>
  useQuery({
    queryKey: keys.favorites(clientId ?? ''),
    queryFn: () => clientApi.favorites(clientId!, { size: 50 }),
    enabled: !!clientId,
  })

export const useSearchHistory = (clientId: string | null | undefined) =>
  useQuery({
    queryKey: keys.searchHistory(clientId ?? ''),
    queryFn: () => clientApi.searchHistory(clientId!, { size: 20 }),
    enabled: !!clientId,
  })

export const useClientRequests = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: keys.requests(params), queryFn: () => clientApi.requests(params) })

export function useClientMutations() {
  const client = useQueryClient()
  const invalidate = () => client.invalidateQueries({ queryKey: ['clients'] })

  return {
    create: useMutation({
      mutationFn: clientApi.create,
      onSuccess: () => { invalidate(); toast.success('Client ajouté au CRM') },
      onError: onMutationError("Le client n'a pas pu être créé"),
    }),
    update: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
        clientApi.update(id, payload),
      onSuccess: () => { invalidate(); toast.success('Fiche client mise à jour') },
      onError: onMutationError('Mise à jour impossible'),
    }),
    remove: useMutation({
      mutationFn: clientApi.remove,
      onSuccess: () => { invalidate(); toast.success('Client supprimé') },
      onError: onMutationError('Suppression impossible'),
    }),
    toggleFavorite: useMutation({
      mutationFn: ({ clientId, propertyId, active }: { clientId: string; propertyId: string; active: boolean }) =>
        active ? clientApi.removeFavorite(clientId, propertyId) : clientApi.addFavorite(clientId, propertyId),
      onSuccess: (_data, variables) => {
        client.invalidateQueries({ queryKey: keys.favorites(variables.clientId) })
        toast.success(variables.active ? 'Retiré des favoris' : 'Ajouté aux favoris')
      },
      onError: onMutationError('Action impossible'),
    }),
    createRequest: useMutation({
      mutationFn: ({ clientId, payload }: { clientId: string; payload: { subject: string; message?: string; property_id?: string } }) =>
        clientApi.createRequest(clientId, payload),
      onSuccess: () => {
        client.invalidateQueries({ queryKey: ['client-requests'] })
        toast.success('Demande envoyée', "Un agent vous répond sous 24 h.")
      },
      onError: onMutationError("La demande n'a pas pu être envoyée"),
    }),
  }
}

/* ------------------------------ Visites ----------------------------- */
export const useVisits = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: keys.visits(params), queryFn: () => visitApi.list(params) })

export function useVisitMutations() {
  const client = useQueryClient()
  const invalidate = () => client.invalidateQueries({ queryKey: ['visits'] })

  return {
    request: useMutation({
      mutationFn: visitApi.request,
      onSuccess: () => { invalidate(); toast.success('Visite demandée', "L'agent vous confirme le créneau.") },
      onError: onMutationError('Demande refusée'),
    }),
    decide: useMutation({
      mutationFn: ({ id, approve, reason, scheduled_at }: { id: string; approve: boolean; reason?: string; scheduled_at?: string }) =>
        visitApi.decide(id, { approve, reason, scheduled_at }),
      onSuccess: (visit) => {
        invalidate()
        toast.success(visit.status === 'REJECTED' ? 'Visite refusée' : 'Visite confirmée')
      },
      onError: onMutationError('Action impossible'),
    }),
    complete: useMutation({
      mutationFn: ({ id, feedback, rating }: { id: string; feedback?: string; rating?: number }) =>
        visitApi.complete(id, { feedback, rating }),
      onSuccess: () => { invalidate(); toast.success('Visite clôturée') },
      onError: onMutationError('Clôture impossible'),
    }),
    cancel: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason?: string }) => visitApi.cancel(id, reason),
      onSuccess: () => { invalidate(); toast.success('Visite annulée') },
      onError: onMutationError('Annulation impossible'),
    }),
  }
}

/* --------------------------- Transactions --------------------------- */
export const useSales = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: keys.sales(params), queryFn: () => transactionApi.sales(params) })

export const useRentals = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: keys.rentals(params), queryFn: () => transactionApi.rentals(params) })

export const useContracts = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: keys.contracts(params), queryFn: () => transactionApi.contracts(params) })

export function useContractMutations() {
  const client = useQueryClient()
  const invalidate = () => client.invalidateQueries({ queryKey: ['contracts'] })

  return {
    create: useMutation({
      mutationFn: transactionApi.createContract,
      onSuccess: (contract) => { invalidate(); toast.success('Contrat généré', contract.reference) },
      onError: onMutationError("Le contrat n'a pas pu être généré"),
    }),
    sign: useMutation({
      mutationFn: ({ id, signature }: { id: string; signature: string }) =>
        transactionApi.signContract(id, signature),
      onSuccess: () => { invalidate(); toast.success('Signature enregistrée') },
      onError: onMutationError('Signature impossible'),
    }),
  }
}

export function useTransactionMutations() {
  const client = useQueryClient()

  return {
    createSale: useMutation({
      mutationFn: transactionApi.createSale,
      onSuccess: (sale) => {
        client.invalidateQueries({ queryKey: ['sales'] })
        client.invalidateQueries({ queryKey: ['properties'] })
        toast.success('Vente enregistrée', `${sale.reference} — le bien passe en réservé.`)
      },
      onError: onMutationError("La vente n'a pas pu être créée"),
    }),
    updateSale: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
        transactionApi.updateSale(id, payload),
      onSuccess: () => {
        client.invalidateQueries({ queryKey: ['sales'] })
        client.invalidateQueries({ queryKey: ['properties'] })
        toast.success('Vente mise à jour')
      },
      onError: onMutationError('Mise à jour impossible'),
    }),
    createRental: useMutation({
      mutationFn: transactionApi.createRental,
      onSuccess: (rental) => {
        client.invalidateQueries({ queryKey: ['rentals'] })
        toast.success('Location enregistrée', rental.reference)
      },
      onError: onMutationError("La location n'a pas pu être créée"),
    }),
    updateRental: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
        transactionApi.updateRental(id, payload),
      onSuccess: () => {
        client.invalidateQueries({ queryKey: ['rentals'] })
        client.invalidateQueries({ queryKey: ['properties'] })
        toast.success('Location mise à jour')
      },
      onError: onMutationError('Mise à jour impossible'),
    }),
  }
}

/* ----------------------------- Documents ---------------------------- */
export const useDocuments = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: keys.documents(params), queryFn: () => documentApi.list(params) })

export function useDocumentMutations() {
  const client = useQueryClient()
  const invalidate = () => client.invalidateQueries({ queryKey: ['documents'] })

  return {
    upload: useMutation({
      mutationFn: documentApi.upload,
      onSuccess: (document) => { invalidate(); toast.success('Document déposé', document.filename) },
      onError: onMutationError('Dépôt impossible'),
    }),
    verify: useMutation({
      mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
        documentApi.verify(id, approve, reason),
      onSuccess: (document) => {
        invalidate()
        toast.success(document.status === 'VERIFIED' ? 'Document validé' : 'Document rejeté')
      },
      onError: onMutationError('Vérification impossible'),
    }),
    remove: useMutation({
      mutationFn: documentApi.remove,
      onSuccess: () => { invalidate(); toast.success('Document supprimé') },
      onError: onMutationError('Suppression impossible'),
    }),
  }
}

/* ---------------------------- Messagerie ---------------------------- */
export const useConversations = () =>
  useQuery({ queryKey: keys.conversations, queryFn: () => messagingApi.conversations({ size: 50 }) })

export const useMessages = (conversationId: string | null) =>
  useQuery({
    queryKey: keys.messages(conversationId ?? ''),
    queryFn: () => messagingApi.messages(conversationId!, { size: 100 }),
    enabled: !!conversationId,
  })

export function useMessagingMutations() {
  const client = useQueryClient()

  return {
    create: useMutation({
      mutationFn: messagingApi.create,
      onSuccess: () => client.invalidateQueries({ queryKey: keys.conversations }),
      onError: onMutationError('Impossible de démarrer la conversation'),
    }),
    send: useMutation({
      mutationFn: ({
        conversationId, content, type, attachment,
      }: {
        conversationId: string; content?: string; type?: string
        attachment?: { url: string; name: string; mime: string; size: number }
      }) => messagingApi.send(conversationId, {
        type: type ?? 'TEXT',
        content,
        attachment_url: attachment?.url,
        attachment_name: attachment?.name,
        attachment_mime: attachment?.mime,
        attachment_size: attachment?.size,
      }),
      onSuccess: (_data, variables) => {
        client.invalidateQueries({ queryKey: keys.messages(variables.conversationId) })
        client.invalidateQueries({ queryKey: keys.conversations })
      },
      onError: onMutationError("Le message n'est pas parti"),
    }),
    uploadAttachment: useMutation({
      mutationFn: ({ conversationId, file }: { conversationId: string; file: File }) =>
        messagingApi.uploadAttachment(conversationId, file),
      onError: onMutationError("La pièce jointe n'a pas pu être envoyée"),
    }),
    markRead: useMutation({
      mutationFn: messagingApi.markRead,
      onSuccess: () => client.invalidateQueries({ queryKey: keys.conversations }),
    }),
  }
}

/* --------------------------- Notifications -------------------------- */
export const useNotifications = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: keys.notifications(params), queryFn: () => notificationApi.list(params) })

export const useUnreadCount = (enabled = true) =>
  useQuery({
    queryKey: keys.unreadCount,
    queryFn: notificationApi.unreadCount,
    enabled,
    refetchInterval: 60_000,
  })

export function useNotificationMutations() {
  const client = useQueryClient()
  return {
    markRead: useMutation({
      mutationFn: notificationApi.markRead,
      onSuccess: () => {
        client.invalidateQueries({ queryKey: ['notifications'] })
      },
    }),
  }
}

/* -------------------------------- IA -------------------------------- */
export function useAIMutations() {
  return {
    describe: useMutation({
      mutationFn: aiApi.describe,
      onError: onMutationError("La description n'a pas pu être générée"),
    }),
    estimate: useMutation({
      mutationFn: aiApi.estimate,
      onError: onMutationError("L'estimation n'a pas pu être calculée"),
    }),
    assistant: useMutation({
      mutationFn: aiApi.assistant,
      onError: onMutationError("L'assistant n'a pas pu répondre"),
    }),
    analyze: useMutation({
      mutationFn: aiApi.analyzeListing,
      onError: onMutationError("L'analyse n'a pas pu être réalisée"),
    }),
  }
}

/* --------------------------- Administration ------------------------- */
export const usePlatformStats = () =>
  useQuery({ queryKey: keys.platformStats, queryFn: adminApi.stats })

export const useAuditLogs = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: keys.auditLogs(params), queryFn: () => adminApi.auditLogs(params) })

export const useUsers = (params: Record<string, unknown> = {}) =>
  useQuery({ queryKey: keys.users(params), queryFn: () => adminApi.users(params) })

export function useUserMutations() {
  const client = useQueryClient()
  const invalidate = () => client.invalidateQueries({ queryKey: ['users'] })

  return {
    create: useMutation({
      mutationFn: adminApi.createUser,
      onSuccess: (user) => { invalidate(); toast.success('Compte créé', `Un email d'activation a été envoyé à ${user.email}.`) },
      onError: onMutationError('Création impossible'),
    }),
    update: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
        adminApi.updateUser(id, payload),
      onSuccess: () => { invalidate(); toast.success('Utilisateur mis à jour') },
      onError: onMutationError('Mise à jour impossible'),
    }),
    deactivate: useMutation({
      mutationFn: adminApi.deactivateUser,
      onSuccess: () => { invalidate(); toast.success('Compte désactivé') },
      onError: onMutationError('Désactivation impossible'),
    }),
    remove: useMutation({
      mutationFn: adminApi.deleteUser,
      onSuccess: () => { invalidate(); toast.success('Compte supprimé') },
      onError: onMutationError('Suppression impossible'),
    }),
  }
}