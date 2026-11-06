/* ============================================================
   Couche d'accès à l'API — une fonction par endpoint du backend.
   Les composants n'appellent jamais Axios directement.
   ============================================================ */
import { api, toParams } from './client'
import type {
  Agency, AgencyStats, Agent, AppNotification, AssistantResult, AuditLog, Client,
  ClientRequest, Contract, Conversation, DescriptionResult, DocumentFile, EstimationResult,
  Favorite, ListingAnalysis, Message, Owner, Page, PlatformStats, Property, PropertyFilters,
  PropertyImage, PropertyType, RegisterResult, Rental, Sale, SearchHistoryEntry, TokenPair, User,
  UserProfile, Visit,
} from '@/types'

/* ------------------------------- Auth ------------------------------- */
export const authApi = {
  login: (payload: { email: string; password: string }) =>
    api.post<TokenPair>('/auth/login', payload).then((r) => r.data),

  register: (payload: {
    email: string; password?: string; full_name: string
    phone?: string; role: string; agency_name?: string
  }) => api.post<RegisterResult>('/auth/register', payload).then((r) => r.data),
 // Dépôt du justificatif légal d'une agence juste après son inscription,
  // via le jeton temporaire renvoyé par register() (le compte n'a pas
  // encore de mot de passe à ce stade).
  uploadAgencyRegistrationDocument: (payload: { file: File; token: string }) => {
    const form = new FormData()
    form.append('file', payload.file)
    form.append('token', payload.token)
    return api.post<DocumentFile>('/documents/agency-registration', form).then((r) => r.data)
  },
  refresh: (refresh_token: string) =>
    api.post<TokenPair>('/auth/refresh', { refresh_token }).then((r) => r.data),

  logout: (payload: { refresh_token?: string | null; all_devices?: boolean }) =>
    api.post('/auth/logout', payload).then((r) => r.data),

  me: () => api.get<UserProfile>('/auth/me').then((r) => r.data),

  updateProfile: (payload: Partial<Pick<User, 'full_name' | 'phone' | 'avatar_url' | 'locale'>>) =>
    api.patch<User>('/auth/me', payload).then((r) => r.data),

  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (payload: { token: string; new_password: string }) =>
    api.post<{ message: string }>('/auth/reset-password', payload).then((r) => r.data),

  changePassword: (payload: { current_password: string; new_password: string }) =>
    api.post<{ message: string }>('/auth/change-password', payload).then((r) => r.data),

  acceptInvitation: (payload: { token: string; password: string; full_name?: string }) =>
    api.post<User>('/auth/accept-invitation', payload).then((r) => r.data),

  sessions: () => api.get('/auth/sessions').then((r) => r.data),

  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<User>('/auth/me/avatar', form).then((r) => r.data)
  },
}

/* ------------------------------ Agences ----------------------------- */
export const agencyApi = {
  list: (params: Record<string, unknown> = {}) =>
    api.get<Page<Agency>>('/agencies', { params: toParams(params) }).then((r) => r.data),
  mine: () => api.get<Agency>('/agencies/me').then((r) => r.data),
  get: (id: string) => api.get<Agency>(`/agencies/${id}`).then((r) => r.data),
  create: (payload: Partial<Agency>) => api.post<Agency>('/agencies', payload).then((r) => r.data),
  update: (id: string, payload: Partial<Agency>) =>
    api.patch<Agency>(`/agencies/${id}`, payload).then((r) => r.data),
  validate: (id: string, approve: boolean, reason?: string) =>
    api.post<Agency>(`/agencies/${id}/validate`, { approve, reason }).then((r) => r.data),
  suspend: (id: string, reason: string) =>
    api.post<Agency>(`/agencies/${id}/suspend`, { reason }).then((r) => r.data),
  activate: (id: string) => api.post<Agency>(`/agencies/${id}/activate`).then((r) => r.data),
  stats: (id: string) => api.get<AgencyStats>(`/agencies/${id}/stats`).then((r) => r.data),
}

/* ------------------------------- Agents ----------------------------- */
export const agentApi = {
  list: (params: Record<string, unknown> = {}) =>
    api.get<Page<Agent>>('/agents', { params: toParams(params) }).then((r) => r.data),
  get: (id: string) => api.get<Agent>(`/agents/${id}`).then((r) => r.data),
  invite: (payload: {
    email: string; full_name: string; phone?: string; job_title?: string
    can_manage_owners?: boolean; can_publish_properties?: boolean
  }) => api.post<{ agent: Agent; invitation_url: string | null }>('/agents', payload).then((r) => r.data),
  update: (id: string, payload: Partial<Agent>) =>
    api.patch<Agent>(`/agents/${id}`, payload).then((r) => r.data),
  suspend: (id: string) => api.post<Agent>(`/agents/${id}/suspend`).then((r) => r.data),
  activate: (id: string) => api.post<Agent>(`/agents/${id}/activate`).then((r) => r.data),
  remove: (id: string) => api.delete(`/agents/${id}`).then((r) => r.data),
  resendInvitation: (id: string) =>
    api
      .post<{ message: string; invitation_url: string; expires_in_hours: number }>(
        `/agents/${id}/resend-invitation`,
      )
      .then((r) => r.data),

  /** Corrige une invitation encore en attente (email mal saisi, droits, fonction). */
  updateInvitation: (
    id: string,
    payload: {
      email?: string; full_name?: string; phone?: string; job_title?: string
      can_manage_owners?: boolean; can_publish_properties?: boolean
    },
  ) => api.patch<Agent>(`/agents/${id}/invitation`, payload).then((r) => r.data),
}

/* --------------------------- Propriétaires -------------------------- */
export const ownerApi = {
  list: (params: Record<string, unknown> = {}) =>
    api.get<Page<Owner>>('/owners', { params: toParams(params) }).then((r) => r.data),
  get: (id: string) => api.get<Owner>(`/owners/${id}`).then((r) => r.data),
  invite: (payload: {
    first_name: string; last_name: string; email: string
    phone: string; address?: string; city?: string; notes?: string
  }) => api.post<{ owner: Owner; invitation_url: string | null }>('/owners', payload).then((r) => r.data),
  selfRegister: (payload: Record<string, unknown>) =>
    api.post<Owner>('/owners/register', payload).then((r) => r.data),
  acceptInvitation: (payload: { token: string; password: string }) =>
    api.post<Owner>('/owners/accept-invitation', payload).then((r) => r.data),
  update: (id: string, payload: Partial<Owner>) =>
    api.patch<Owner>(`/owners/${id}`, payload).then((r) => r.data),
  completeProfile: (id: string, payload: Record<string, unknown>) =>
    api.post<Owner>(`/owners/${id}/complete-profile`, payload).then((r) => r.data),
  verify: (id: string, approve: boolean, reason?: string) =>
    api.post<Owner>(`/owners/${id}/verify`, { approve, reason }).then((r) => r.data),
  suspend: (id: string) => api.post<Owner>(`/owners/${id}/suspend`).then((r) => r.data),
}

/* ------------------------------ Clients ----------------------------- */
export const clientApi = {
  list: (params: Record<string, unknown> = {}) =>
    api.get<Page<Client>>('/clients', { params: toParams(params) }).then((r) => r.data),
  get: (id: string) => api.get<Client>(`/clients/${id}`).then((r) => r.data),
  create: (payload: Partial<Client>) => api.post<Client>('/clients', payload).then((r) => r.data),
  update: (id: string, payload: Partial<Client>) =>
    api.patch<Client>(`/clients/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/clients/${id}`).then((r) => r.data),
  assign: (id: string, agent_id: string, is_primary = true) =>
    api.post(`/clients/${id}/assign`, { agent_id, is_primary }).then((r) => r.data),
  favorites: (clientId: string, params: Record<string, unknown> = {}) =>
    api.get<Page<Favorite>>(`/clients/${clientId}/favorites`, { params: toParams(params) }).then((r) => r.data),
  addFavorite: (clientId: string, propertyId: string) =>
    api.post<Favorite>(`/clients/${clientId}/favorites/${propertyId}`).then((r) => r.data),
  removeFavorite: (clientId: string, propertyId: string) =>
    api.delete(`/clients/${clientId}/favorites/${propertyId}`).then((r) => r.data),
  searchHistory: (clientId: string, params: Record<string, unknown> = {}) =>
    api.get<Page<SearchHistoryEntry>>(`/clients/${clientId}/search-history`, { params: toParams(params) }).then((r) => r.data),
  createRequest: (clientId: string, payload: { subject: string; message?: string; property_id?: string }) =>
    api.post<ClientRequest>(`/clients/${clientId}/requests`, payload).then((r) => r.data),
  requests: (params: Record<string, unknown> = {}) =>
    api.get<Page<ClientRequest>>('/clients/requests/all', { params: toParams(params) }).then((r) => r.data),
}

/* ------------------------------- Biens ------------------------------ */
export const propertyApi = {
  list: (filters: PropertyFilters = {}) =>
    api.get<Page<Property>>('/properties', { params: toParams(filters) }).then((r) => r.data),
  publicList: (filters: PropertyFilters = {}) =>
    api.get<Page<Property>>('/public/properties', { params: toParams(filters) }).then((r) => r.data),
  get: (id: string) => api.get<Property>(`/properties/${id}`).then((r) => r.data),
  publicGet: (id: string) => api.get<Property>(`/public/properties/${id}`).then((r) => r.data),
  types: () => api.get<PropertyType[]>('/properties/types').then((r) => r.data),
  images: (id: string) => api.get<PropertyImage[]>(`/properties/${id}/images`).then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    api.post<Property>('/properties', payload).then((r) => r.data),
  update: (id: string, payload: Record<string, unknown>) =>
    api.patch<Property>(`/properties/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/properties/${id}`).then((r) => r.data),
  changeStatus: (id: string, status: string, reason?: string) =>
    api.post<Property>(`/properties/${id}/status`, { status, reason }).then((r) => r.data),
  publish: (id: string, publish = true) =>
    api.post<Property>(`/properties/${id}/publish`, null, { params: { publish } }).then((r) => r.data),
  addImage: (id: string, payload: { url: string; caption?: string; is_cover?: boolean }) =>
    api.post(`/properties/${id}/images`, payload).then((r) => r.data),
  uploadImage: (id: string, file: File, opts: { is_cover?: boolean; caption?: string } = {}) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post(`/properties/${id}/images/upload`, form, { params: opts })
      .then((r) => r.data)
  },
  removeImage: (id: string, imageId: string) =>
    api.delete(`/properties/${id}/images/${imageId}`).then((r) => r.data),
}

/* ------------------------------ Visites ----------------------------- */
export const visitApi = {
  list: (params: Record<string, unknown> = {}) =>
    api.get<Page<Visit>>('/visits', { params: toParams(params) }).then((r) => r.data),
  get: (id: string) => api.get<Visit>(`/visits/${id}`).then((r) => r.data),
  request: (payload: {
    property_id: string; scheduled_at: string; duration_minutes?: number
    client_message?: string; client_id?: string
  }) => api.post<Visit>('/visits', payload).then((r) => r.data),
  decide: (id: string, payload: { approve: boolean; reason?: string; scheduled_at?: string }) =>
    api.post<Visit>(`/visits/${id}/decision`, payload).then((r) => r.data),
  update: (id: string, payload: Record<string, unknown>) =>
    api.patch<Visit>(`/visits/${id}`, payload).then((r) => r.data),
  cancel: (id: string, reason?: string) =>
    api.post<Visit>(`/visits/${id}/cancel`, { reason }).then((r) => r.data),
  complete: (id: string, payload: { feedback?: string; rating?: number }) =>
    api.post<Visit>(`/visits/${id}/complete`, payload).then((r) => r.data),
}

/* --------------------------- Transactions --------------------------- */
export const transactionApi = {
  sales: (params: Record<string, unknown> = {}) =>
    api.get<Page<Sale>>('/sales', { params: toParams(params) }).then((r) => r.data),
  createSale: (payload: Record<string, unknown>) =>
    api.post<Sale>('/sales', payload).then((r) => r.data),
  updateSale: (id: string, payload: Record<string, unknown>) =>
    api.patch<Sale>(`/sales/${id}`, payload).then((r) => r.data),
  rentals: (params: Record<string, unknown> = {}) =>
    api.get<Page<Rental>>('/rentals', { params: toParams(params) }).then((r) => r.data),
  createRental: (payload: Record<string, unknown>) =>
    api.post<Rental>('/rentals', payload).then((r) => r.data),
  updateRental: (id: string, payload: Record<string, unknown>) =>
    api.patch<Rental>(`/rentals/${id}`, payload).then((r) => r.data),
  contracts: (params: Record<string, unknown> = {}) =>
    api.get<Page<Contract>>('/contracts', { params: toParams(params) }).then((r) => r.data),
  createContract: (payload: Record<string, unknown>) =>
    api.post<Contract>('/contracts', payload).then((r) => r.data),
  contract: (id: string) => api.get<Contract>(`/contracts/${id}`).then((r) => r.data),
  signContract: (id: string, signature: string) =>
    api.post<Contract>(`/contracts/${id}/sign`, { signature }).then((r) => r.data),
  downloadContract: async (id: string, reference: string) => {
    const response = await api.get(`/contracts/${id}/download`, { responseType: 'blob' })
    const url = URL.createObjectURL(response.data as Blob)
    const link = window.document.createElement('a')
    link.href = url
    link.download = `${reference}.html`
    window.document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  },
}

/* ----------------------------- Documents ---------------------------- */
export const documentApi = {
  list: (params: Record<string, unknown> = {}) =>
    api.get<Page<DocumentFile>>('/documents', { params: toParams(params) }).then((r) => r.data),
  upload: (payload: { file: File; entity_type: string; entity_id: string; category: string }) => {
    const form = new FormData()
    form.append('file', payload.file)
    form.append('entity_type', payload.entity_type)
    form.append('entity_id', payload.entity_id)
    form.append('category', payload.category)
    return api.post<DocumentFile>('/documents', form).then((r) => r.data)
  },
  verify: (id: string, approve: boolean, reason?: string) =>
    api.post<DocumentFile>(`/documents/${id}/verify`, { approve, reason }).then((r) => r.data),
  remove: (id: string) => api.delete(`/documents/${id}`).then((r) => r.data),
  downloadUrl: (id: string) => `${api.defaults.baseURL}/documents/${id}/download`,
  // Le endpoint est protégé par JWT : un lien direct (<a href>) échoue avec
  // "Jeton d'accès manquant" car le navigateur n'envoie pas le header
  // Authorization lors d'une navigation classique. On passe donc par Axios
  // (qui l'ajoute automatiquement) puis on déclenche le téléchargement
  // nous-mêmes à partir du blob reçu.
  download: async (id: string, filename: string) => {
    const response = await api.get(`/documents/${id}/download`, { responseType: 'blob' })
    const url = URL.createObjectURL(response.data as Blob)
    const link = window.document.createElement('a')
    link.href = url
    link.download = filename
    window.document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  },
}

/* ---------------------------- Messagerie ---------------------------- */
export const messagingApi = {
  conversations: (params: Record<string, unknown> = {}) =>
    api.get<Page<Conversation>>('/conversations', { params: toParams(params) }).then((r) => r.data),
  conversation: (id: string) => api.get<Conversation>(`/conversations/${id}`).then((r) => r.data),
  create: (payload: {
    type: string; participant_ids: string[]; subject?: string
    property_id?: string; initial_message?: string
  }) => api.post<Conversation>('/conversations', payload).then((r) => r.data),
  messages: (id: string, params: Record<string, unknown> = {}) =>
    api.get<Page<Message>>(`/conversations/${id}/messages`, { params: toParams(params) }).then((r) => r.data),
  send: (id: string, payload: {
    type?: string; content?: string; attachment_url?: string; attachment_name?: string
    attachment_mime?: string; attachment_size?: number
  }) => api.post<Message>(`/conversations/${id}/messages`, payload).then((r) => r.data),
  markRead: (id: string) => api.post(`/conversations/${id}/read`).then((r) => r.data),
  archive: (id: string) => api.post(`/conversations/${id}/archive`).then((r) => r.data),
  // Dépose une pièce jointe et renvoie sa clé de stockage (pas une URL
  // publique : le fichier reste protégé, seuls les participants y accèdent).
  uploadAttachment: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post<{ key: string; name: string; mime: string; size: number }>(
        `/conversations/${id}/attachments`, form,
      )
      .then((r) => r.data)
  },
  downloadAttachment: async (conversationId: string, key: string, filename: string, mime: string) => {
    const response = await api.get(`/conversations/${conversationId}/attachments/download`, {
      params: { key, filename, mime },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data as Blob)
    const link = window.document.createElement('a')
    link.href = url
    link.download = filename
    window.document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  },
}

/* --------------------------- Notifications -------------------------- */
export const notificationApi = {
  list: (params: Record<string, unknown> = {}) =>
    api.get<Page<AppNotification>>('/notifications', { params: toParams(params) }).then((r) => r.data),
  unreadCount: () => api.get<{ unread: number }>('/notifications/unread-count').then((r) => r.data),
  markRead: (payload: { ids?: string[]; all?: boolean }) =>
    api.post('/notifications/read', payload).then((r) => r.data),
}

/* -------------------------------- IA -------------------------------- */
export const aiApi = {
  describe: (payload: Record<string, unknown>) =>
    api.post<DescriptionResult>('/ai/description', payload).then((r) => r.data),
  estimate: (payload: Record<string, unknown>) =>
    api.post<EstimationResult>('/ai/estimate', payload).then((r) => r.data),
  assistant: (payload: { query: string; include_results?: boolean; limit?: number }) =>
    api.post<AssistantResult>('/ai/assistant', payload).then((r) => r.data),
  analyzeListing: (payload: { property_id?: string; title?: string; description?: string }) =>
    api.post<ListingAnalysis>('/ai/analyze-listing', payload).then((r) => r.data),
}

/* ---------------------------- Administration ------------------------ */
export const adminApi = {
  stats: () => api.get<PlatformStats>('/admin/stats').then((r) => r.data),
  auditLogs: (params: Record<string, unknown> = {}) =>
    api.get<Page<AuditLog>>('/admin/audit-logs', { params: toParams(params) }).then((r) => r.data),
  users: (params: Record<string, unknown> = {}) =>
    api.get<Page<User>>('/users', { params: toParams(params) }).then((r) => r.data),
  createUser: (payload: { email: string; full_name: string; phone?: string; role: string; agency_id?: string }) =>
    api.post<User>('/users', payload).then((r) => r.data),
  updateUser: (id: string, payload: Record<string, unknown>) =>
    api.patch<User>(`/users/${id}`, payload).then((r) => r.data),
  deactivateUser: (id: string) => api.post(`/users/${id}/deactivate`).then((r) => r.data),
  deleteUser: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),
}