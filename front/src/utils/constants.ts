import type {
  AgencyStatus, AgentStatus, DocumentStatus, ListingType, OwnerStatus,
  PropertyStatus, RentalStatus, SaleStatus, UserRole, VisitStatus,
} from '@/types'

/** Ton visuel partagé par les badges de toute l'application. */
export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brass'

export const ROLE_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  AGENCY: 'Agence',
  AGENT: 'Agent',
  OWNER: 'Propriétaire',
  CLIENT: 'Client',
}

export const PROPERTY_STATUS: Record<PropertyStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Brouillon', tone: 'neutral' },
  AVAILABLE: { label: 'Disponible', tone: 'success' },
  RESERVED: { label: 'Réservé', tone: 'warning' },
  RENTED: { label: 'Loué', tone: 'info' },
  SOLD: { label: 'Vendu', tone: 'brass' },
  ARCHIVED: { label: 'Archivé', tone: 'neutral' },
}

export const LISTING_TYPE: Record<ListingType, { label: string; short: string }> = {
  SALE: { label: 'À vendre', short: 'Vente' },
  RENT: { label: 'À louer', short: 'Location' },
  BOTH: { label: 'Vente ou location', short: 'Mixte' },
}

export const VISIT_STATUS: Record<VisitStatus, { label: string; tone: Tone }> = {
  REQUESTED: { label: 'Demandée', tone: 'warning' },
  CONFIRMED: { label: 'Confirmée', tone: 'success' },
  RESCHEDULED: { label: 'Reprogrammée', tone: 'info' },
  REJECTED: { label: 'Refusée', tone: 'danger' },
  COMPLETED: { label: 'Effectuée', tone: 'brass' },
  CANCELLED: { label: 'Annulée', tone: 'neutral' },
  NO_SHOW: { label: 'Absent', tone: 'danger' },
}

export const AGENCY_STATUS: Record<AgencyStatus, { label: string; tone: Tone }> = {
  PENDING_VALIDATION: { label: 'À valider', tone: 'warning' },
  ACTIVE: { label: 'Active', tone: 'success' },
  SUSPENDED: { label: 'Suspendue', tone: 'danger' },
  REJECTED: { label: 'Rejetée', tone: 'danger' },
}

export const AGENT_STATUS: Record<AgentStatus, { label: string; tone: Tone }> = {
  INVITED: { label: 'Invité', tone: 'warning' },
  ACTIVE: { label: 'Actif', tone: 'success' },
  SUSPENDED: { label: 'Suspendu', tone: 'danger' },
}

export const OWNER_STATUS: Record<OwnerStatus, { label: string; tone: Tone }> = {
  INVITED: { label: 'Invité', tone: 'neutral' },
  PENDING_VERIFICATION: { label: 'À vérifier', tone: 'warning' },
  ACTIVE: { label: 'Vérifié', tone: 'success' },
  REJECTED: { label: 'Rejeté', tone: 'danger' },
  SUSPENDED: { label: 'Suspendu', tone: 'danger' },
}

export const SALE_STATUS: Record<SaleStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Brouillon', tone: 'neutral' },
  IN_PROGRESS: { label: 'En cours', tone: 'info' },
  COMPLETED: { label: 'Finalisée', tone: 'success' },
  CANCELLED: { label: 'Annulée', tone: 'danger' },
}

export const RENTAL_STATUS: Record<RentalStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Brouillon', tone: 'neutral' },
  ACTIVE: { label: 'En cours', tone: 'success' },
  TERMINATED: { label: 'Terminée', tone: 'neutral' },
  CANCELLED: { label: 'Annulée', tone: 'danger' },
}

export const DOCUMENT_STATUS: Record<DocumentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'En attente', tone: 'warning' },
  VERIFIED: { label: 'Validé', tone: 'success' },
  REJECTED: { label: 'Rejeté', tone: 'danger' },
}

export const DOCUMENT_CATEGORY_LABEL: Record<string, string> = {
  IDENTITY_CIP: "Pièce d'identité (CIP)",
  CONTRACT: 'Contrat',
  MANDATE: 'Mandat',
  PROPERTY_TITLE: 'Titre de propriété',
  AGENCY_LEGAL: 'Document légal',
  OTHER: 'Autre',
}

/** Villes couvertes — sert aux filtres et à l'assistant. */
export const CITIES = [
  'Cotonou', 'Abomey-Calavi', 'Porto-Novo', 'Parakou',
  'Bohicon', 'Ouidah', 'Sèmè-Podji', 'Natitingou',
]

export const DISTRICTS: Record<string, string[]> = {
  Cotonou: ['Fidjrossè', 'Haie Vive', 'Cadjèhoun', 'Akpakpa', 'Gbégamey', 'Zogbo', 'Ganhi'],
  'Abomey-Calavi': ['Godomey', 'Calavi Centre', 'Zogbadjè', 'Tokan'],
  'Porto-Novo': ['Djègan Daho', 'Ouando', 'Tokpota'],
}

export const AMENITIES = [
  'piscine', 'garage', 'jardin', 'climatisation', 'meublé',
  'sécurité', 'forage', 'groupe électrogène', 'ascenseur', 'terrasse',
  'vue mer', 'cuisine équipée', 'parking', 'internet fibre',
]

export const SORT_OPTIONS = [
  { value: '-created_at', label: 'Plus récents' },
  { value: 'price', label: 'Prix croissant' },
  { value: '-price', label: 'Prix décroissant' },
  { value: '-area', label: 'Plus grande surface' },
  { value: '-views_count', label: 'Plus consultés' },
]
