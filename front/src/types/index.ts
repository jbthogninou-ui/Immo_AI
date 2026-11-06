/* ============================================================
   Types du domaine — miroir des schémas Pydantic du backend.
   ============================================================ */

export type UserRole = 'SUPER_ADMIN' | 'AGENCY' | 'AGENT' | 'OWNER' | 'CLIENT'
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
export type AgencyStatus = 'PENDING_VALIDATION' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED'
export type AgentStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED'
export type OwnerStatus = 'INVITED' | 'PENDING_VERIFICATION' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED'
export type PropertyStatus = 'DRAFT' | 'AVAILABLE' | 'RESERVED' | 'RENTED' | 'SOLD' | 'ARCHIVED'
export type ListingType = 'SALE' | 'RENT' | 'BOTH'
export type VisitStatus =
  | 'REQUESTED' | 'CONFIRMED' | 'REJECTED' | 'RESCHEDULED'
  | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
export type SaleStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type RentalStatus = 'DRAFT' | 'ACTIVE' | 'TERMINATED' | 'CANCELLED'
export type ContractStatus = 'DRAFT' | 'PENDING_SIGNATURE' | 'SIGNED' | 'TERMINATED'
export type ContractKind = 'SALE_DEED' | 'LEASE' | 'MANDATE'
export type DocumentCategory =
  | 'IDENTITY_CIP' | 'IDENTITY_SELFIE' | 'CONTRACT' | 'MANDATE' | 'PROPERTY_TITLE'
  | 'AGENCY_LEGAL' | 'OTHER'
export type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'
export type EntityType = 'USER' | 'AGENCY' | 'OWNER' | 'CLIENT' | 'PROPERTY' | 'CONTRACT'
export type ConversationType = 'CLIENT_AGENT' | 'OWNER_AGENT' | 'AGENT_AGENCY' | 'SUPPORT'
export type MessageType = 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'SYSTEM'
export type NotificationType =
  | 'INVITATION' | 'ACCOUNT_VALIDATION' | 'NEW_MESSAGE'
  | 'VISIT' | 'TRANSACTION' | 'DOCUMENT' | 'SYSTEM'

/* ---------------------------- Enveloppes ---------------------------- */
export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown; request_id?: string }
}

/* ------------------------------ Comptes ----------------------------- */
export interface User {
  id: string
  email: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  role: UserRole
  status: UserStatus
  is_active: boolean
  is_email_verified: boolean
  agency_id: string | null
  locale: string
  last_login_at: string | null
  created_at: string
}
export interface RegisterResult extends User {
  // Présent uniquement pour une inscription d'agence : jeton temporaire
  // permettant de déposer le justificatif juste après la création du
  // compte (celui-ci n'a pas encore de mot de passe à ce stade).
  agency_upload_token?: string | null
}
export interface UserProfile extends User {
  owner_id: string | null
  client_id: string | null
  agent_id: string | null
  permissions: string[]
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  expires_at: string
  expires_in: number
}

/* ------------------------------ Agences ----------------------------- */
export interface Agency {
  id: string
  name: string
  slug: string
  email: string
  phone: string | null
  description: string | null
  address: string | null
  city: string | null
  country: string
  logo_url: string | null
  website: string | null
  registration_number: string | null
  tax_id: string | null
  status: AgencyStatus
  rejection_reason: string | null
  validated_at: string | null
  owner_user_id: string | null
  created_at: string
}

export interface AgencyStats {
  agents: number
  owners: number
  clients: number
  properties: number
  published_properties: number
  visits_pending: number
  sales_completed: number
  rentals_active: number
}

export interface Agent {
  id: string
  user_id: string
  agency_id: string
  job_title: string | null
  license_number: string | null
  bio: string | null
  status: AgentStatus
  can_manage_owners: boolean
  can_publish_properties: boolean
  invited_at: string | null
  activated_at: string | null
  created_at: string
  user?: User | null
}

/* --------------------------- Propriétaires -------------------------- */
export interface Owner {
  id: string
  agency_id: string
  agent_id: string | null
  user_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string | null
  city: string | null
  national_id_number: string | null
  notes: string | null
  status: OwnerStatus
  rejection_reason: string | null
  invited_at: string | null
  verified_at: string | null
  created_at: string
}

/* ------------------------------ Clients ----------------------------- */
export interface Client {
  id: string
  agency_id: string
  user_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  city: string | null
  source: string | null
  notes: string | null
  budget_min: number | null
  budget_max: number | null
  preferences: Record<string, unknown>
  is_active: boolean
  created_at: string
}

export interface ClientRequest {
  id: string
  agency_id: string
  client_id: string
  agent_id: string | null
  property_id: string | null
  subject: string
  message: string | null
  status: string
  created_at: string
}

export interface SearchHistoryEntry {
  id: string
  client_id: string
  query: string
  filters: Record<string, unknown>
  results_count: number
  created_at: string
}

export interface Favorite {
  id: string
  client_id: string
  property_id: string
  created_at: string
}

/* ------------------------------- Biens ------------------------------ */
export interface PropertyImage {
  id: string
  property_id: string
  url: string
  thumbnail_url: string | null
  caption: string | null
  media_type: string
  is_cover: boolean
  position: number
}

export interface PropertyType {
  id: string
  name: string
  slug: string
  description: string | null
  is_active: boolean
}

export interface Property {
  id: string
  reference: string
  agency_id: string
  agent_id: string | null
  agent_user_id: string | null
  agency_contact_user_id: string | null
  owner_id: string | null
  property_type_id: string | null
  title: string
  description: string | null
  listing_type: ListingType
  status: PropertyStatus
  address: string | null
  district: string | null
  city: string | null
  country: string
  latitude: number | null
  longitude: number | null
  price: number
  currency: string
  charges: number | null
  deposit: number | null
  area: number | null
  land_area: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  floor: number | null
  year_built: number | null
  amenities: string[]
  is_published: boolean
  published_at: string | null
  views_count: number
  created_at: string
  updated_at: string
  images: PropertyImage[]
}

export interface PropertyFilters {
  q?: string
  city?: string
  district?: string
  listing_type?: ListingType
  status?: PropertyStatus
  property_type_id?: string
  owner_id?: string
  agent_id?: string
  min_price?: number
  max_price?: number
  min_area?: number
  max_area?: number
  bedrooms?: number
  rooms?: number
  is_published?: boolean
  sort?: string
  page?: number
  size?: number
}

/* ------------------------------ Visites ----------------------------- */
export interface Visit {
  id: string
  agency_id: string
  property_id: string
  client_id: string
  agent_id: string | null
  scheduled_at: string
  duration_minutes: number
  status: VisitStatus
  client_message: string | null
  agent_notes: string | null
  rejection_reason: string | null
  feedback: string | null
  rating: number | null
  confirmed_at: string | null
  completed_at: string | null
  created_at: string
}

/* --------------------------- Transactions --------------------------- */
export interface Sale {
  id: string
  reference: string
  agency_id: string
  property_id: string
  client_id: string
  agent_id: string | null
  owner_id: string | null
  amount: number
  currency: string
  commission_rate: number | null
  commission_amount: number | null
  status: SaleStatus
  notes: string | null
  signed_at: string | null
  completed_at: string | null
  created_at: string
}

export interface Rental {
  id: string
  reference: string
  agency_id: string
  property_id: string
  client_id: string
  agent_id: string | null
  owner_id: string | null
  monthly_rent: number
  charges: number | null
  deposit_amount: number | null
  currency: string
  start_date: string
  end_date: string | null
  duration_months: number | null
  status: RentalStatus
  notes: string | null
  created_at: string
}

export interface Contract {
  id: string
  reference: string
  agency_id: string
  kind: ContractKind
  status: ContractStatus
  sale_id: string | null
  rental_id: string | null
  property_id: string | null
  client_id: string | null
  agent_id: string | null
  document_id: string | null
  title: string
  content: string | null
  start_date: string | null
  end_date: string | null
  signed_at: string | null
  agent_signature: string | null
  agent_signed_at: string | null
  client_signature: string | null
  client_signed_at: string | null
  created_at: string
}

/* ----------------------------- Documents ---------------------------- */
export interface DocumentFile {
  id: string
  agency_id: string | null
  entity_type: EntityType
  entity_id: string
  category: DocumentCategory
  status: DocumentStatus
  filename: string
  url: string
  mime_type: string
  size_bytes: number
  uploaded_by_id: string | null
  verified_at: string | null
  rejection_reason: string | null
  created_at: string
}

/* ---------------------------- Messagerie ---------------------------- */
export interface Participant {
  id: string
  user_id: string
  last_read_at: string | null
  is_muted: boolean
  full_name: string | null
  email: string | null
  role: string | null
}

export interface Conversation {
  id: string
  agency_id: string
  type: ConversationType
  subject: string | null
  property_id: string | null
  created_by_id: string | null
  is_archived: boolean
  last_message_at: string | null
  created_at: string
  participants: Participant[]
  unread_count: number
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  type: MessageType
  content: string | null
  attachment_url: string | null
  attachment_name: string | null
  attachment_mime: string | null
  attachment_size: number | null
  document_id: string | null
  extra_data: Record<string, unknown>
  edited_at: string | null
  created_at: string
}

/* --------------------------- Notifications -------------------------- */
export interface AppNotification {
  id: string
  user_id: string
  agency_id: string | null
  type: NotificationType
  title: string
  body: string | null
  action_url: string | null
  payload: Record<string, unknown>
  is_read: boolean
  read_at: string | null
  created_at: string
}

/* ------------------------------ Audit ------------------------------- */
export interface AuditLog {
  id: string
  user_id: string | null
  agency_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  status: string
  ip_address: string | null
  request_id: string | null
  payload: Record<string, unknown>
  created_at: string
}

export interface PlatformStats {
  users: number
  agencies: number
  agencies_pending: number
  agencies_active: number
  properties: number
}

/* -------------------------------- IA -------------------------------- */
export interface DescriptionResult {
  description: string
  title_suggestion: string | null
  highlights: string[]
  provider: string
  model: string | null
}

export interface EstimationResult {
  suggested_price: number
  price_range_min: number
  price_range_max: number
  currency: string
  confidence: number
  explanation: string
  comparables_count: number
  method: string
  provider: string
}

export interface SearchCriteria {
  listing_type: ListingType | null
  property_type: string | null
  city: string | null
  district: string | null
  bedrooms: number | null
  rooms: number | null
  min_price: number | null
  max_price: number | null
  min_area: number | null
  amenities: string[]
}

export interface AssistantResult {
  answer: string
  criteria: SearchCriteria
  results: Array<Record<string, any>>
  results_count: number
  provider: string
}

export interface ListingAnalysis {
  score: number
  missing_fields: string[]
  quality_issues: string[]
  suggestions: string[]
  provider: string
}