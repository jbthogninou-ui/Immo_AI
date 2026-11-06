/* ============================================================
   Jeu de données de démonstration.

   Utilisé uniquement lorsque VITE_DEMO_MODE=true : l'interface
   est alors entièrement navigable sans backend, ce qui permet de
   la présenter depuis n'importe quel poste.
   ============================================================ */
import type {
  Agency, Agent, AppNotification, AuditLog, Client, Conversation, DocumentFile,
  Message, Owner, Property, PropertyType, Rental, Sale, User, UserProfile, Visit,
} from '@/types'

const now = Date.now()
const day = 86_400_000
const iso = (offsetDays: number) => new Date(now + offsetDays * day).toISOString()

export const AGENCY_ID = 'ag-0001'

/* ------------------------------- Photos ----------------------------- */
/* Photothèque Unsplash — chargée en ligne, avec dégradé de repli. */
const PHOTOS = [
  'photo-1600596542815-ffad4c1539a9',
  'photo-1600585154340-be6161a56a0c',
  'photo-1600607687939-ce8a6c25118c',
  'photo-1512917774080-9991f1c4c750',
  'photo-1613490493576-7fde63acd811',
  'photo-1600566753086-00f18fb6b3ea',
  'photo-1600047509807-ba8f99d2cdde',
  'photo-1580587771525-78b9dba3b914',
  'photo-1600566753190-17f0baa2a6c3',
  'photo-1502672260266-1c1ef2d93688',
  'photo-1600210492486-724fe5c67fb0',
  'photo-1493809842364-78817add7ffb',
]
export const photo = (index: number, width = 1200) =>
  `https://images.unsplash.com/${PHOTOS[index % PHOTOS.length]}?auto=format&fit=crop&w=${width}&q=70`

/* ------------------------------ Comptes ----------------------------- */
export const DEMO_PASSWORD = 'demo'

interface DemoAccount {
  profile: UserProfile
  label: string
  description: string
}

function makeProfile(over: Partial<UserProfile> & Pick<UserProfile, 'id' | 'email' | 'full_name' | 'role'>): UserProfile {
  return {
    phone: '+229 97 00 00 00',
    avatar_url: null,
    status: 'ACTIVE',
    is_active: true,
    is_email_verified: true,
    agency_id: AGENCY_ID,
    locale: 'fr',
    last_login_at: iso(0),
    created_at: iso(-240),
    owner_id: null,
    client_id: null,
    agent_id: null,
    permissions: [],
    ...over,
  }
}

const PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  AGENCY: [
    'agency:read', 'agency:update', 'agent:create', 'agent:read', 'agent:update', 'agent:delete',
    'owner:create', 'owner:read', 'owner:update', 'owner:verify', 'client:create', 'client:read',
    'client:update', 'client:delete', 'property:create', 'property:read', 'property:update',
    'property:delete', 'property:publish', 'visit:read', 'visit:update', 'transaction:create',
    'transaction:read', 'transaction:update', 'document:create', 'document:read', 'document:verify',
    'document:delete', 'conversation:create', 'conversation:read', 'message:create',
    'notification:read', 'ai:use', 'audit:read',
  ],
  AGENT: [
    'agency:read', 'owner:create', 'owner:read', 'owner:update', 'client:create', 'client:read',
    'client:update', 'property:create', 'property:read', 'property:update', 'property:publish',
    'visit:read', 'visit:update', 'transaction:create', 'transaction:read', 'transaction:update',
    'document:create', 'document:read', 'conversation:create', 'conversation:read',
    'message:create', 'notification:read', 'ai:use',
  ],
  OWNER: [
    'owner:read', 'owner:update', 'property:read', 'visit:read', 'transaction:read',
    'document:create', 'document:read', 'conversation:create', 'conversation:read',
    'message:create', 'notification:read',
  ],
  CLIENT: [
    'property:read', 'visit:create', 'visit:read', 'transaction:read', 'client:read',
    'client:update', 'document:read', 'conversation:create', 'conversation:read',
    'message:create', 'notification:read', 'ai:use',
  ],
}

export const DEMO_ACCOUNTS: Record<string, DemoAccount> = {
  'admin@immoflow.ai': {
    label: 'Super Admin',
    description: 'Supervise toutes les agences de la plateforme',
    profile: makeProfile({
      id: 'usr-admin', email: 'admin@immoflow.ai', full_name: 'Sarah Adjovi',
      role: 'SUPER_ADMIN', agency_id: null, permissions: PERMISSIONS.SUPER_ADMIN,
    }),
  },
  'agence@immoflow.ai': {
    label: 'Agence',
    description: 'Dirige Atlantique Immobilier et son équipe',
    profile: makeProfile({
      id: 'usr-agency', email: 'agence@immoflow.ai', full_name: 'Rodrigue Houngbédji',
      role: 'AGENCY', permissions: PERMISSIONS.AGENCY,
    }),
  },
  'agent@immoflow.ai': {
    label: 'Agent',
    description: 'Gère son portefeuille de biens et de clients',
    profile: makeProfile({
      id: 'usr-agent', email: 'agent@immoflow.ai', full_name: 'Koffi Mensah',
      role: 'AGENT', agent_id: 'agt-0001', permissions: PERMISSIONS.AGENT,
    }),
  },
  'proprietaire@immoflow.ai': {
    label: 'Propriétaire',
    description: 'Suit ses biens confiés à l’agence',
    profile: makeProfile({
      id: 'usr-owner', email: 'proprietaire@immoflow.ai', full_name: 'Marc Dossou',
      role: 'OWNER', owner_id: 'own-0001', permissions: PERMISSIONS.OWNER,
    }),
  },
  'client@immoflow.ai': {
    label: 'Client',
    description: 'Recherche un bien et planifie ses visites',
    profile: makeProfile({
      id: 'usr-client', email: 'client@immoflow.ai', full_name: 'Awa Sossou',
      role: 'CLIENT', client_id: 'cli-0001', permissions: PERMISSIONS.CLIENT,
    }),
  },
}

/* ------------------------------ Agences ----------------------------- */
export const agencies: Agency[] = [
  {
    id: AGENCY_ID, name: 'Atlantique Immobilier', slug: 'atlantique-immobilier',
    email: 'contact@atlantique.bj', phone: '+229 21 30 40 50',
    description: "Spécialiste du résidentiel haut de gamme sur le littoral béninois depuis 2014.",
    address: 'Carré 1024, Haie Vive', city: 'Cotonou', country: 'Bénin',
    logo_url: null, website: 'https://atlantique-immo.bj',
    registration_number: 'RCCM/BJ/COT/2014/B/1204', tax_id: 'IFU-3201401204',
    status: 'ACTIVE', rejection_reason: null, validated_at: iso(-230),
    owner_user_id: 'usr-agency', created_at: iso(-240),
  },
  {
    id: 'ag-0002', name: 'Littoral Habitat', slug: 'littoral-habitat',
    email: 'hello@littoral-habitat.bj', phone: '+229 21 55 12 12',
    description: 'Gestion locative et syndic de copropriété.',
    address: 'Rue 428, Cadjèhoun', city: 'Cotonou', country: 'Bénin',
    logo_url: null, website: null, registration_number: 'RCCM/BJ/COT/2019/B/0781',
    tax_id: null, status: 'ACTIVE', rejection_reason: null, validated_at: iso(-120),
    owner_user_id: null, created_at: iso(-130),
  },
  {
    id: 'ag-0003', name: 'Ouémé Résidences', slug: 'oueme-residences',
    email: 'contact@oueme-residences.bj', phone: '+229 20 21 33 44',
    description: 'Promotion immobilière à Porto-Novo et alentours.',
    address: 'Avenue Jean Bayol', city: 'Porto-Novo', country: 'Bénin',
    logo_url: null, website: null, registration_number: null, tax_id: null,
    status: 'PENDING_VALIDATION', rejection_reason: null, validated_at: null,
    owner_user_id: null, created_at: iso(-6),
  },
  {
    id: 'ag-0004', name: 'Zou Patrimoine', slug: 'zou-patrimoine',
    email: 'direction@zou-patrimoine.bj', phone: '+229 22 51 09 09',
    description: 'Terrains et lotissements dans le Zou.',
    address: 'Quartier Agbodjèlou', city: 'Bohicon', country: 'Bénin',
    logo_url: null, website: null, registration_number: null, tax_id: null,
    status: 'PENDING_VALIDATION', rejection_reason: null, validated_at: null,
    owner_user_id: null, created_at: iso(-2),
  },
  {
    id: 'ag-0005', name: 'Nord Immo Services', slug: 'nord-immo-services',
    email: 'contact@nordimmo.bj', phone: '+229 23 61 22 88',
    description: 'Location meublée pour expatriés à Parakou.',
    address: 'Zongo', city: 'Parakou', country: 'Bénin',
    logo_url: null, website: null, registration_number: 'RCCM/BJ/PAR/2021/B/0233',
    tax_id: null, status: 'SUSPENDED', rejection_reason: 'Documents légaux expirés',
    validated_at: iso(-90), owner_user_id: null, created_at: iso(-95),
  },
]

/* ------------------------------- Agents ----------------------------- */
const agentUsers: User[] = [
  { id: 'usr-agent', email: 'agent@immoflow.ai', full_name: 'Koffi Mensah', phone: '+229 97 11 22 33', avatar_url: null, role: 'AGENT', status: 'ACTIVE', is_active: true, is_email_verified: true, agency_id: AGENCY_ID, locale: 'fr', last_login_at: iso(0), created_at: iso(-200) },
  { id: 'usr-agent2', email: 'fatima.bello@atlantique.bj', full_name: 'Fatima Bello', phone: '+229 96 44 55 66', avatar_url: null, role: 'AGENT', status: 'ACTIVE', is_active: true, is_email_verified: true, agency_id: AGENCY_ID, locale: 'fr', last_login_at: iso(-1), created_at: iso(-160) },
  { id: 'usr-agent3', email: 'serge.ahouandjinou@atlantique.bj', full_name: 'Serge Ahouandjinou', phone: '+229 95 77 88 99', avatar_url: null, role: 'AGENT', status: 'ACTIVE', is_active: true, is_email_verified: true, agency_id: AGENCY_ID, locale: 'fr', last_login_at: iso(-3), created_at: iso(-90) },
  { id: 'usr-agent4', email: 'nadia.kpodo@atlantique.bj', full_name: 'Nadia Kpodo', phone: '+229 94 12 34 56', avatar_url: null, role: 'AGENT', status: 'PENDING', is_active: true, is_email_verified: false, agency_id: AGENCY_ID, locale: 'fr', last_login_at: null, created_at: iso(-4) },
]

export const agents: Agent[] = [
  { id: 'agt-0001', user_id: 'usr-agent', agency_id: AGENCY_ID, job_title: 'Négociateur senior', license_number: 'LIC-2019-0142', bio: 'Spécialiste du résidentiel à Fidjrossè et Cadjèhoun.', status: 'ACTIVE', can_manage_owners: true, can_publish_properties: true, invited_at: iso(-200), activated_at: iso(-199), created_at: iso(-200), user: agentUsers[0] },
  { id: 'agt-0002', user_id: 'usr-agent2', agency_id: AGENCY_ID, job_title: 'Conseillère location', license_number: 'LIC-2020-0311', bio: null, status: 'ACTIVE', can_manage_owners: true, can_publish_properties: true, invited_at: iso(-160), activated_at: iso(-159), created_at: iso(-160), user: agentUsers[1] },
  { id: 'agt-0003', user_id: 'usr-agent3', agency_id: AGENCY_ID, job_title: 'Négociateur', license_number: null, bio: null, status: 'ACTIVE', can_manage_owners: false, can_publish_properties: true, invited_at: iso(-90), activated_at: iso(-88), created_at: iso(-90), user: agentUsers[2] },
  { id: 'agt-0004', user_id: 'usr-agent4', agency_id: AGENCY_ID, job_title: 'Assistante commerciale', license_number: null, bio: null, status: 'INVITED', can_manage_owners: false, can_publish_properties: false, invited_at: iso(-4), activated_at: null, created_at: iso(-4), user: agentUsers[3] },
]

/* --------------------------- Propriétaires -------------------------- */
export const owners: Owner[] = [
  { id: 'own-0001', agency_id: AGENCY_ID, agent_id: 'agt-0001', user_id: 'usr-owner', first_name: 'Marc', last_name: 'Dossou', email: 'proprietaire@immoflow.ai', phone: '+229 97 33 44 55', address: 'Rue 12.34, Fidjrossè', city: 'Cotonou', national_id_number: 'CIP-0123456789', notes: 'Détient trois biens sur le littoral.', status: 'ACTIVE', rejection_reason: null, invited_at: iso(-180), verified_at: iso(-175), created_at: iso(-180) },
  { id: 'own-0002', agency_id: AGENCY_ID, agent_id: 'agt-0002', user_id: null, first_name: 'Bernadette', last_name: 'Agbo', email: 'b.agbo@mail.bj', phone: '+229 96 12 13 14', address: 'Godomey', city: 'Abomey-Calavi', national_id_number: 'CIP-0987654321', notes: null, status: 'PENDING_VERIFICATION', rejection_reason: null, invited_at: iso(-12), verified_at: null, created_at: iso(-12) },
  { id: 'own-0003', agency_id: AGENCY_ID, agent_id: 'agt-0001', user_id: null, first_name: 'Ibrahim', last_name: 'Traoré', email: 'i.traore@mail.bj', phone: '+229 95 21 22 23', address: null, city: 'Cotonou', national_id_number: null, notes: 'Investisseur, recherche du rendement locatif.', status: 'ACTIVE', rejection_reason: null, invited_at: iso(-60), verified_at: iso(-55), created_at: iso(-60) },
  { id: 'own-0004', agency_id: AGENCY_ID, agent_id: 'agt-0003', user_id: null, first_name: 'Chantal', last_name: 'Zinsou', email: 'c.zinsou@mail.bj', phone: '+229 94 55 66 77', address: null, city: 'Porto-Novo', national_id_number: null, notes: null, status: 'INVITED', rejection_reason: null, invited_at: iso(-3), verified_at: null, created_at: iso(-3) },
  { id: 'own-0005', agency_id: AGENCY_ID, agent_id: 'agt-0002', user_id: null, first_name: 'Paul', last_name: 'Adjahoun', email: 'p.adjahoun@mail.bj', phone: '+229 97 88 99 00', address: 'Akpakpa', city: 'Cotonou', national_id_number: 'CIP-5544332211', notes: null, status: 'ACTIVE', rejection_reason: null, invited_at: iso(-140), verified_at: iso(-138), created_at: iso(-140) },
]

/* ------------------------------ Clients ----------------------------- */
export const clients: Client[] = [
  { id: 'cli-0001', agency_id: AGENCY_ID, user_id: 'usr-client', first_name: 'Awa', last_name: 'Sossou', email: 'client@immoflow.ai', phone: '+229 97 45 45 45', city: 'Cotonou', source: 'Site web', notes: 'Financement bancaire validé, recherche active.', budget_min: 40_000_000, budget_max: 90_000_000, preferences: { quartiers: ['Fidjrossè', 'Haie Vive'], chambres: 4 }, is_active: true, created_at: iso(-45) },
  { id: 'cli-0002', agency_id: AGENCY_ID, user_id: null, first_name: 'Éric', last_name: 'Adjovi', email: 'e.adjovi@mail.bj', phone: '+229 96 78 78 78', city: 'Abomey-Calavi', source: 'Recommandation', notes: null, budget_min: 15_000_000, budget_max: 35_000_000, preferences: {}, is_active: true, created_at: iso(-30) },
  { id: 'cli-0003', agency_id: AGENCY_ID, user_id: null, first_name: 'Grâce', last_name: 'Hounkpatin', email: 'g.hounkpatin@mail.bj', phone: '+229 95 33 22 11', city: 'Cotonou', source: 'Salon immobilier', notes: 'Cherche une location meublée.', budget_min: null, budget_max: 600_000, preferences: {}, is_active: true, created_at: iso(-18) },
  { id: 'cli-0004', agency_id: AGENCY_ID, user_id: null, first_name: 'Didier', last_name: 'Lokossou', email: 'd.lokossou@mail.bj', phone: '+229 94 10 20 30', city: 'Porto-Novo', source: 'Site web', notes: null, budget_min: 50_000_000, budget_max: 120_000_000, preferences: {}, is_active: true, created_at: iso(-9) },
  { id: 'cli-0005', agency_id: AGENCY_ID, user_id: null, first_name: 'Sylvie', last_name: 'Amoussou', email: 's.amoussou@mail.bj', phone: '+229 97 01 02 03', city: 'Cotonou', source: 'Facebook', notes: null, budget_min: null, budget_max: 25_000_000, preferences: {}, is_active: false, created_at: iso(-70) },
]

/* ------------------------- Types et biens --------------------------- */
export const propertyTypes: PropertyType[] = [
  { id: 'pt-1', name: 'Villa', slug: 'villa', description: 'Maison individuelle avec cour ou jardin', is_active: true },
  { id: 'pt-2', name: 'Appartement', slug: 'appartement', description: 'Logement en immeuble collectif', is_active: true },
  { id: 'pt-3', name: 'Studio', slug: 'studio', description: "Logement d'une pièce principale", is_active: true },
  { id: 'pt-4', name: 'Duplex', slug: 'duplex', description: 'Logement sur deux niveaux', is_active: true },
  { id: 'pt-5', name: 'Terrain', slug: 'terrain', description: 'Parcelle nue, lotie ou non', is_active: true },
  { id: 'pt-6', name: 'Bureau', slug: 'bureau', description: 'Local à usage professionnel', is_active: true },
  { id: 'pt-7', name: 'Boutique', slug: 'boutique', description: 'Local commercial', is_active: true },
  { id: 'pt-8', name: 'Immeuble', slug: 'immeuble', description: 'Bâtiment complet à revenus', is_active: true },
]

interface Seed {
  title: string
  type: string
  listing: 'SALE' | 'RENT'
  status: Property['status']
  price: number
  area: number
  rooms: number
  bedrooms: number
  bathrooms: number
  city: string
  district: string
  amenities: string[]
  agent: string
  owner: string
  lat: number
  lng: number
  description: string
}

const SEEDS: Seed[] = [
  { title: 'Villa contemporaine 4 chambres avec piscine', type: 'pt-1', listing: 'SALE', status: 'AVAILABLE', price: 145_000_000, area: 320, rooms: 7, bedrooms: 4, bathrooms: 3, city: 'Cotonou', district: 'Fidjrossè', amenities: ['piscine', 'garage', 'jardin', 'climatisation', 'sécurité'], agent: 'agt-0001', owner: 'own-0001', lat: 6.3554, lng: 2.3812, description: "Villa de plain-pied livrée en 2022, implantée sur une parcelle de 600 m² à cinq minutes de la plage. Séjour traversant ouvert sur la terrasse et le bassin, cuisine américaine équipée, quatre chambres dont une suite parentale. Cour arborée, garage double et local technique. Quartier calme et sécurisé, écoles internationales à proximité." },
  { title: 'Appartement 3 pièces standing à Haie Vive', type: 'pt-2', listing: 'RENT', status: 'AVAILABLE', price: 450_000, area: 95, rooms: 3, bedrooms: 2, bathrooms: 1, city: 'Cotonou', district: 'Haie Vive', amenities: ['climatisation', 'parking', 'internet fibre', 'sécurité'], agent: 'agt-0002', owner: 'own-0003', lat: 6.3612, lng: 2.4021, description: "Appartement lumineux au deuxième étage d'une résidence de six logements. Séjour spacieux prolongé par un balcon, cuisine équipée, deux chambres avec placards intégrés. Gardiennage jour et nuit, place de parking privative, fibre installée. Idéal pour un couple ou une petite famille." },
  { title: 'Duplex neuf 5 chambres vue lagune', type: 'pt-4', listing: 'SALE', status: 'RESERVED', price: 210_000_000, area: 410, rooms: 9, bedrooms: 5, bathrooms: 4, city: 'Cotonou', district: 'Cadjèhoun', amenities: ['piscine', 'ascenseur', 'garage', 'groupe électrogène', 'vue mer'], agent: 'agt-0001', owner: 'own-0005', lat: 6.3498, lng: 2.3901, description: "Duplex d'exception livré en 2024, orienté plein sud avec vue dégagée sur la lagune. Double séjour de 70 m², cuisine professionnelle, cinq chambres toutes en suite. Ascenseur privatif, groupe électrogène automatique, piscine à débordement et pool house. Prestations haut de gamme du sol au plafond." },
  { title: 'Terrain loti 500 m² titré à Godomey', type: 'pt-5', listing: 'SALE', status: 'AVAILABLE', price: 28_000_000, area: 500, rooms: 0, bedrooms: 0, bathrooms: 0, city: 'Abomey-Calavi', district: 'Godomey', amenities: ['forage'], agent: 'agt-0003', owner: 'own-0002', lat: 6.3789, lng: 2.3345, description: "Parcelle de 500 m² entièrement titrée, bornée et clôturée, dans un lotissement viabilisé de Godomey. Accès direct par voie bitumée, électricité et forage déjà présents en limite. Aucun litige, dossier complet disponible immédiatement." },
  { title: 'Studio meublé tout confort à Akpakpa', type: 'pt-3', listing: 'RENT', status: 'RENTED', price: 180_000, area: 38, rooms: 1, bedrooms: 1, bathrooms: 1, city: 'Cotonou', district: 'Akpakpa', amenities: ['meublé', 'climatisation', 'internet fibre'], agent: 'agt-0002', owner: 'own-0005', lat: 6.3651, lng: 2.4423, description: "Studio entièrement meublé et équipé, refait à neuf en 2025. Coin nuit séparé par une claustra, kitchenette complète, salle d'eau moderne. Climatisation, fibre optique et compteur individuel. Location courte ou longue durée, charges comprises." },
  { title: 'Maison familiale 4 chambres avec jardin', type: 'pt-1', listing: 'SALE', status: 'AVAILABLE', price: 78_000_000, area: 210, rooms: 6, bedrooms: 4, bathrooms: 2, city: 'Abomey-Calavi', district: 'Calavi Centre', amenities: ['jardin', 'garage', 'forage'], agent: 'agt-0003', owner: 'own-0003', lat: 6.4489, lng: 2.3556, description: "Maison de plain-pied sur parcelle de 400 m², idéale pour une famille. Grand séjour, quatre chambres, deux salles d'eau, cuisine indépendante avec cellier. Jardin planté de manguiers, forage et château d'eau, garage couvert. Proche du marché et des transports." },
  { title: 'Plateau de bureaux 180 m² à Ganhi', type: 'pt-6', listing: 'RENT', status: 'AVAILABLE', price: 950_000, area: 180, rooms: 6, bedrooms: 0, bathrooms: 2, city: 'Cotonou', district: 'Ganhi', amenities: ['climatisation', 'ascenseur', 'parking', 'internet fibre', 'sécurité'], agent: 'agt-0001', owner: 'own-0001', lat: 6.3572, lng: 2.4285, description: "Plateau de bureaux au quatrième étage d'un immeuble de standing du quartier d'affaires. Espace modulable, six bureaux cloisonnés ou open space, salle de réunion, deux sanitaires. Climatisation centralisée, ascenseur, quatre places de parking, fibre dédiée. Accès contrôlé 24 h/24." },
  { title: 'Villa de charme 3 chambres à Ouidah', type: 'pt-1', listing: 'SALE', status: 'SOLD', price: 62_000_000, area: 175, rooms: 5, bedrooms: 3, bathrooms: 2, city: 'Ouidah', district: 'Centre', amenities: ['jardin', 'terrasse', 'forage'], agent: 'agt-0002', owner: 'own-0004', lat: 6.3628, lng: 2.0852, description: "Villa de caractère à dix minutes de la route des pêches, alliant matériaux traditionnels et confort actuel. Trois chambres, vaste terrasse couverte, jardin de 300 m². Toiture refaite en 2023, forage autonome. Un bien rare dans un secteur très recherché." },
  { title: 'Appartement 2 pièces neuf à Gbégamey', type: 'pt-2', listing: 'RENT', status: 'AVAILABLE', price: 250_000, area: 62, rooms: 2, bedrooms: 1, bathrooms: 1, city: 'Cotonou', district: 'Gbégamey', amenities: ['climatisation', 'parking'], agent: 'agt-0003', owner: 'own-0002', lat: 6.3701, lng: 2.4045, description: "Appartement neuf jamais habité, au premier étage d'une petite copropriété. Séjour ouvert sur cuisine équipée, une chambre avec dressing, salle d'eau carrelée. Place de parking incluse, compteur individuel, charges réduites." },
  { title: 'Immeuble de rapport 6 logements', type: 'pt-8', listing: 'SALE', status: 'AVAILABLE', price: 320_000_000, area: 640, rooms: 18, bedrooms: 12, bathrooms: 6, city: 'Cotonou', district: 'Zogbo', amenities: ['parking', 'sécurité', 'forage'], agent: 'agt-0001', owner: 'own-0005', lat: 6.3745, lng: 2.4112, description: "Immeuble R+2 de six appartements F3, entièrement loué avec un rendement brut de 9 %. Construction 2018, structure saine, parties communes entretenues. Cour intérieure avec parking, forage, loge de gardien. Baux et quittances disponibles pour audit." },
  { title: 'Boutique 45 m² sur artère passante', type: 'pt-7', listing: 'RENT', status: 'AVAILABLE', price: 320_000, area: 45, rooms: 2, bedrooms: 0, bathrooms: 1, city: 'Porto-Novo', district: 'Ouando', amenities: ['climatisation', 'sécurité'], agent: 'agt-0002', owner: 'own-0004', lat: 6.4969, lng: 2.6289, description: "Local commercial en rez-de-chaussée sur l'axe le plus fréquenté du quartier. Vitrine de six mètres, réserve à l'arrière, sanitaire privatif. Rideau métallique, climatisation installée. Fort passage piéton toute la journée." },
  { title: 'Villa 6 chambres avec dépendance', type: 'pt-1', listing: 'SALE', status: 'DRAFT', price: 185_000_000, area: 380, rooms: 10, bedrooms: 6, bathrooms: 4, city: 'Cotonou', district: 'Fidjrossè', amenities: ['piscine', 'garage', 'jardin', 'groupe électrogène', 'sécurité'], agent: 'agt-0001', owner: 'own-0001', lat: 6.3521, lng: 2.3765, description: "Grande villa familiale sur parcelle de 800 m², avec dépendance indépendante de deux pièces. Six chambres, quatre salles d'eau, double séjour et bureau. Piscine, garage trois voitures, groupe électrogène. Bien en cours de préparation, photos complémentaires à venir." },
]

export const properties: Property[] = SEEDS.map((seed, index) => ({
  id: `prop-${String(index + 1).padStart(4, '0')}`,
  reference: `BIEN-ATL-${String(index + 1).padStart(5, '0')}`,
  agency_id: AGENCY_ID,
  agent_id: seed.agent,
  owner_id: seed.owner,
  property_type_id: seed.type,
  title: seed.title,
  description: seed.description,
  listing_type: seed.listing,
  status: seed.status,
  address: `${seed.district}, ${seed.city}`,
  district: seed.district,
  city: seed.city,
  country: 'Bénin',
  latitude: seed.lat,
  longitude: seed.lng,
  price: seed.price,
  currency: 'XOF',
  charges: seed.listing === 'RENT' ? Math.round(seed.price * 0.08) : null,
  deposit: seed.listing === 'RENT' ? seed.price * 2 : null,
  area: seed.area,
  land_area: seed.type === 'pt-5' ? seed.area : Math.round(seed.area * 1.8),
  rooms: seed.rooms,
  bedrooms: seed.bedrooms,
  bathrooms: seed.bathrooms,
  floor: null,
  year_built: 2015 + (index % 10),
  amenities: seed.amenities,
  is_published: seed.status !== 'DRAFT' && seed.status !== 'ARCHIVED',
  published_at: seed.status === 'DRAFT' ? null : iso(-(index * 4 + 3)),
  views_count: 40 + index * 37,
  created_at: iso(-(index * 6 + 10)),
  updated_at: iso(-(index % 5)),
  images: [0, 1, 2, 3].map((offset) => ({
    id: `img-${index}-${offset}`,
    property_id: `prop-${String(index + 1).padStart(4, '0')}`,
    url: photo(index + offset * 3),
    thumbnail_url: photo(index + offset * 3, 600),
    caption: ['Façade', 'Séjour', 'Chambre', 'Extérieur'][offset],
    media_type: 'IMAGE',
    is_cover: offset === 0,
    position: offset,
  })),
}))

/* ------------------------------ Visites ----------------------------- */
export const visits: Visit[] = [
  { id: 'vis-0001', agency_id: AGENCY_ID, property_id: 'prop-0001', client_id: 'cli-0001', agent_id: 'agt-0001', scheduled_at: iso(2), duration_minutes: 60, status: 'CONFIRMED', client_message: 'Disponible en matinée de préférence.', agent_notes: null, rejection_reason: null, feedback: null, rating: null, confirmed_at: iso(-1), completed_at: null, created_at: iso(-2) },
  { id: 'vis-0002', agency_id: AGENCY_ID, property_id: 'prop-0002', client_id: 'cli-0003', agent_id: 'agt-0002', scheduled_at: iso(1), duration_minutes: 45, status: 'REQUESTED', client_message: 'Je peux me libérer en fin de journée.', agent_notes: null, rejection_reason: null, feedback: null, rating: null, confirmed_at: null, completed_at: null, created_at: iso(-0.5) },
  { id: 'vis-0003', agency_id: AGENCY_ID, property_id: 'prop-0006', client_id: 'cli-0002', agent_id: 'agt-0003', scheduled_at: iso(-3), duration_minutes: 45, status: 'COMPLETED', client_message: null, agent_notes: 'Client très intéressé, offre attendue cette semaine.', rejection_reason: null, feedback: 'Bien conforme à mes attentes.', rating: 5, confirmed_at: iso(-5), completed_at: iso(-3), created_at: iso(-7) },
  { id: 'vis-0004', agency_id: AGENCY_ID, property_id: 'prop-0003', client_id: 'cli-0004', agent_id: 'agt-0001', scheduled_at: iso(4), duration_minutes: 90, status: 'CONFIRMED', client_message: 'Je viendrai avec mon architecte.', agent_notes: null, rejection_reason: null, feedback: null, rating: null, confirmed_at: iso(0), completed_at: null, created_at: iso(-1) },
  { id: 'vis-0005', agency_id: AGENCY_ID, property_id: 'prop-0009', client_id: 'cli-0003', agent_id: 'agt-0003', scheduled_at: iso(-8), duration_minutes: 30, status: 'CANCELLED', client_message: null, agent_notes: null, rejection_reason: 'Client indisponible', feedback: null, rating: null, confirmed_at: iso(-10), completed_at: null, created_at: iso(-12) },
  { id: 'vis-0006', agency_id: AGENCY_ID, property_id: 'prop-0007', client_id: 'cli-0004', agent_id: 'agt-0001', scheduled_at: iso(6), duration_minutes: 60, status: 'REQUESTED', client_message: 'Pour installer notre siège social.', agent_notes: null, rejection_reason: null, feedback: null, rating: null, confirmed_at: null, completed_at: null, created_at: iso(-0.2) },
  { id: 'vis-0007', agency_id: AGENCY_ID, property_id: 'prop-0004', client_id: 'cli-0002', agent_id: 'agt-0003', scheduled_at: iso(-15), duration_minutes: 30, status: 'COMPLETED', client_message: null, agent_notes: 'Parcelle validée, dossier en cours.', rejection_reason: null, feedback: null, rating: 4, confirmed_at: iso(-17), completed_at: iso(-15), created_at: iso(-20) },
]

/* --------------------------- Transactions --------------------------- */
export const sales: Sale[] = [
  { id: 'sal-0001', reference: 'VTE-ATL-00001', agency_id: AGENCY_ID, property_id: 'prop-0008', client_id: 'cli-0002', agent_id: 'agt-0002', owner_id: 'own-0004', amount: 61_000_000, currency: 'XOF', commission_rate: 5, commission_amount: 3_050_000, status: 'COMPLETED', notes: 'Financement comptant.', signed_at: iso(-25), completed_at: iso(-22), created_at: iso(-40) },
  { id: 'sal-0002', reference: 'VTE-ATL-00002', agency_id: AGENCY_ID, property_id: 'prop-0003', client_id: 'cli-0004', agent_id: 'agt-0001', owner_id: 'own-0005', amount: 205_000_000, currency: 'XOF', commission_rate: 4.5, commission_amount: 9_225_000, status: 'IN_PROGRESS', notes: "Compromis signé, acte prévu le mois prochain.", signed_at: iso(-6), completed_at: null, created_at: iso(-14) },
  { id: 'sal-0003', reference: 'VTE-ATL-00003', agency_id: AGENCY_ID, property_id: 'prop-0006', client_id: 'cli-0002', agent_id: 'agt-0003', owner_id: 'own-0003', amount: 75_500_000, currency: 'XOF', commission_rate: 5, commission_amount: 3_775_000, status: 'IN_PROGRESS', notes: 'Dossier bancaire en cours.', signed_at: null, completed_at: null, created_at: iso(-4) },
]

export const rentals: Rental[] = [
  { id: 'ren-0001', reference: 'LOC-ATL-00001', agency_id: AGENCY_ID, property_id: 'prop-0005', client_id: 'cli-0003', agent_id: 'agt-0002', owner_id: 'own-0005', monthly_rent: 180_000, charges: 15_000, deposit_amount: 360_000, currency: 'XOF', start_date: iso(-90).slice(0, 10), end_date: iso(275).slice(0, 10), duration_months: 12, status: 'ACTIVE', notes: null, created_at: iso(-95) },
  { id: 'ren-0002', reference: 'LOC-ATL-00002', agency_id: AGENCY_ID, property_id: 'prop-0002', client_id: 'cli-0003', agent_id: 'agt-0002', owner_id: 'own-0003', monthly_rent: 450_000, charges: 36_000, deposit_amount: 900_000, currency: 'XOF', start_date: iso(20).slice(0, 10), end_date: null, duration_months: 24, status: 'DRAFT', notes: 'En attente de la caution.', created_at: iso(-2) },
  { id: 'ren-0003', reference: 'LOC-ATL-00003', agency_id: AGENCY_ID, property_id: 'prop-0009', client_id: 'cli-0005', agent_id: 'agt-0003', owner_id: 'own-0002', monthly_rent: 250_000, charges: 20_000, deposit_amount: 500_000, currency: 'XOF', start_date: iso(-400).slice(0, 10), end_date: iso(-35).slice(0, 10), duration_months: 12, status: 'TERMINATED', notes: null, created_at: iso(-405) },
]

/* ----------------------------- Documents ---------------------------- */
export const documents: DocumentFile[] = [
  { id: 'doc-0001', agency_id: AGENCY_ID, entity_type: 'OWNER', entity_id: 'own-0001', category: 'IDENTITY_CIP', status: 'VERIFIED', filename: 'CIP-Marc-Dossou.pdf', url: '#', mime_type: 'application/pdf', size_bytes: 842_112, uploaded_by_id: 'usr-owner', verified_at: iso(-175), rejection_reason: null, created_at: iso(-178) },
  { id: 'doc-0002', agency_id: AGENCY_ID, entity_type: 'OWNER', entity_id: 'own-0002', category: 'IDENTITY_CIP', status: 'PENDING', filename: 'piece-identite-agbo.jpg', url: '#', mime_type: 'image/jpeg', size_bytes: 1_640_448, uploaded_by_id: 'usr-agency', verified_at: null, rejection_reason: null, created_at: iso(-10) },
  { id: 'doc-0003', agency_id: AGENCY_ID, entity_type: 'PROPERTY', entity_id: 'prop-0001', category: 'PROPERTY_TITLE', status: 'VERIFIED', filename: 'titre-foncier-3412.pdf', url: '#', mime_type: 'application/pdf', size_bytes: 2_310_144, uploaded_by_id: 'usr-agent', verified_at: iso(-30), rejection_reason: null, created_at: iso(-35) },
  { id: 'doc-0004', agency_id: AGENCY_ID, entity_type: 'CONTRACT', entity_id: 'ctr-0001', category: 'CONTRACT', status: 'VERIFIED', filename: 'bail-akpakpa-signe.pdf', url: '#', mime_type: 'application/pdf', size_bytes: 512_000, uploaded_by_id: 'usr-agent', verified_at: iso(-88), rejection_reason: null, created_at: iso(-90) },
  { id: 'doc-0005', agency_id: AGENCY_ID, entity_type: 'PROPERTY', entity_id: 'prop-0003', category: 'MANDATE', status: 'PENDING', filename: 'mandat-exclusif-duplex.pdf', url: '#', mime_type: 'application/pdf', size_bytes: 388_608, uploaded_by_id: 'usr-agent', verified_at: null, rejection_reason: null, created_at: iso(-5) },
  { id: 'doc-0006', agency_id: AGENCY_ID, entity_type: 'AGENCY', entity_id: AGENCY_ID, category: 'AGENCY_LEGAL', status: 'VERIFIED', filename: 'rccm-atlantique.pdf', url: '#', mime_type: 'application/pdf', size_bytes: 962_560, uploaded_by_id: 'usr-agency', verified_at: iso(-230), rejection_reason: null, created_at: iso(-238) },
  { id: 'doc-0007', agency_id: AGENCY_ID, entity_type: 'OWNER', entity_id: 'own-0004', category: 'IDENTITY_CIP', status: 'REJECTED', filename: 'scan-flou.png', url: '#', mime_type: 'image/png', size_bytes: 204_800, uploaded_by_id: 'usr-agent', verified_at: null, rejection_reason: 'Document illisible, merci de renvoyer un scan net.', created_at: iso(-2) },
]

/* ---------------------------- Messagerie ---------------------------- */
export const conversations: Conversation[] = [
  { id: 'cnv-0001', agency_id: AGENCY_ID, type: 'CLIENT_AGENT', subject: 'Villa Fidjrossè — BIEN-ATL-00001', property_id: 'prop-0001', created_by_id: 'usr-agent', is_archived: false, last_message_at: iso(-0.02), created_at: iso(-3), participants: [{ id: 'p1', user_id: 'usr-agent', last_read_at: iso(-0.02), is_muted: false }, { id: 'p2', user_id: 'usr-client', last_read_at: iso(-0.5), is_muted: false }], unread_count: 2 },
  { id: 'cnv-0002', agency_id: AGENCY_ID, type: 'OWNER_AGENT', subject: 'Mandat de vente — duplex Cadjèhoun', property_id: 'prop-0003', created_by_id: 'usr-owner', is_archived: false, last_message_at: iso(-0.3), created_at: iso(-8), participants: [{ id: 'p3', user_id: 'usr-agent', last_read_at: iso(-0.3), is_muted: false }, { id: 'p4', user_id: 'usr-owner', last_read_at: iso(-0.3), is_muted: false }], unread_count: 0 },
  { id: 'cnv-0003', agency_id: AGENCY_ID, type: 'AGENT_AGENCY', subject: 'Objectifs du trimestre', property_id: null, created_by_id: 'usr-agency', is_archived: false, last_message_at: iso(-1.2), created_at: iso(-15), participants: [{ id: 'p5', user_id: 'usr-agent', last_read_at: iso(-1.2), is_muted: false }, { id: 'p6', user_id: 'usr-agency', last_read_at: iso(-1.1), is_muted: false }], unread_count: 1 },
  { id: 'cnv-0004', agency_id: AGENCY_ID, type: 'CLIENT_AGENT', subject: 'Recherche bureau à Ganhi', property_id: 'prop-0007', created_by_id: 'usr-agent', is_archived: false, last_message_at: iso(-2.4), created_at: iso(-6), participants: [{ id: 'p7', user_id: 'usr-agent', last_read_at: iso(-2.4), is_muted: false }, { id: 'p8', user_id: 'usr-client', last_read_at: iso(-2.4), is_muted: false }], unread_count: 0 },
]

export const messages: Record<string, Message[]> = {
  'cnv-0001': [
    { id: 'm1', conversation_id: 'cnv-0001', sender_id: 'usr-agent', type: 'TEXT', content: "Bonjour Awa, la villa de Fidjrossè correspond exactement à vos critères : 4 chambres, piscine, quartier calme.", attachment_url: null, attachment_name: null, attachment_mime: null, attachment_size: null, document_id: null, extra_data: {}, edited_at: null, created_at: iso(-3) },
    { id: 'm2', conversation_id: 'cnv-0001', sender_id: 'usr-client', type: 'TEXT', content: 'Bonjour Koffi, elle me plaît beaucoup. Le prix est-il négociable ?', attachment_url: null, attachment_name: null, attachment_mime: null, attachment_size: null, document_id: null, extra_data: {}, edited_at: null, created_at: iso(-2.8) },
    { id: 'm3', conversation_id: 'cnv-0001', sender_id: 'usr-agent', type: 'TEXT', content: "Le propriétaire reste ouvert à une offre sérieuse. Je vous transmets le dossier complet.", attachment_url: null, attachment_name: null, attachment_mime: null, attachment_size: null, document_id: null, extra_data: {}, edited_at: null, created_at: iso(-2.7) },
    { id: 'm4', conversation_id: 'cnv-0001', sender_id: 'usr-agent', type: 'DOCUMENT', content: null, attachment_url: '#', attachment_name: 'dossier-villa-fidjrosse.pdf', attachment_mime: 'application/pdf', attachment_size: 1_842_000, document_id: 'doc-0003', extra_data: {}, edited_at: null, created_at: iso(-2.69) },
    { id: 'm5', conversation_id: 'cnv-0001', sender_id: 'usr-client', type: 'TEXT', content: 'Parfait, merci. Peut-on visiter samedi matin ?', attachment_url: null, attachment_name: null, attachment_mime: null, attachment_size: null, document_id: null, extra_data: {}, edited_at: null, created_at: iso(-0.6) },
    { id: 'm6', conversation_id: 'cnv-0001', sender_id: 'usr-agent', type: 'TEXT', content: 'Samedi 10 h me convient. Je confirme la visite dans la plateforme.', attachment_url: null, attachment_name: null, attachment_mime: null, attachment_size: null, document_id: null, extra_data: {}, edited_at: null, created_at: iso(-0.02) },
  ],
  'cnv-0002': [
    { id: 'm7', conversation_id: 'cnv-0002', sender_id: 'usr-owner', type: 'TEXT', content: 'Bonjour, où en est la commercialisation du duplex ?', attachment_url: null, attachment_name: null, attachment_mime: null, attachment_size: null, document_id: null, extra_data: {}, edited_at: null, created_at: iso(-8) },
    { id: 'm8', conversation_id: 'cnv-0002', sender_id: 'usr-agent', type: 'TEXT', content: "Nous avons deux visites programmées cette semaine et une offre à 205 millions en cours d'instruction.", attachment_url: null, attachment_name: null, attachment_mime: null, attachment_size: null, document_id: null, extra_data: {}, edited_at: null, created_at: iso(-0.3) },
  ],
  'cnv-0003': [
    { id: 'm9', conversation_id: 'cnv-0003', sender_id: 'usr-agency', type: 'TEXT', content: "Point d'équipe vendredi 9 h. Merci de mettre à jour vos dossiers en cours d'ici jeudi soir.", attachment_url: null, attachment_name: null, attachment_mime: null, attachment_size: null, document_id: null, extra_data: {}, edited_at: null, created_at: iso(-1.2) },
  ],
  'cnv-0004': [
    { id: 'm10', conversation_id: 'cnv-0004', sender_id: 'usr-client', type: 'TEXT', content: 'Le plateau de Ganhi est-il divisible ?', attachment_url: null, attachment_name: null, attachment_mime: null, attachment_size: null, document_id: null, extra_data: {}, edited_at: null, created_at: iso(-2.5) },
    { id: 'm11', conversation_id: 'cnv-0004', sender_id: 'usr-agent', type: 'TEXT', content: 'Oui, il peut être scindé en deux lots de 90 m². Je vous envoie le plan.', attachment_url: null, attachment_name: null, attachment_mime: null, attachment_size: null, document_id: null, extra_data: {}, edited_at: null, created_at: iso(-2.4) },
  ],
}

/* --------------------------- Notifications -------------------------- */
export const notifications: AppNotification[] = [
  { id: 'not-1', user_id: 'usr-agent', agency_id: AGENCY_ID, type: 'NEW_MESSAGE', title: 'Nouveau message', body: 'Awa Sossou : « Peut-on visiter samedi matin ? »', action_url: '/messages', payload: {}, is_read: false, read_at: null, created_at: iso(-0.02) },
  { id: 'not-2', user_id: 'usr-agent', agency_id: AGENCY_ID, type: 'VISIT', title: 'Demande de visite', body: 'Grâce Hounkpatin — Appartement Haie Vive, demain 17 h', action_url: '/visites', payload: {}, is_read: false, read_at: null, created_at: iso(-0.4) },
  { id: 'not-3', user_id: 'usr-agent', agency_id: AGENCY_ID, type: 'DOCUMENT', title: 'Document rejeté', body: "La pièce d'identité de Chantal Zinsou est illisible.", action_url: '/documents', payload: {}, is_read: false, read_at: null, created_at: iso(-2) },
  { id: 'not-4', user_id: 'usr-agent', agency_id: AGENCY_ID, type: 'TRANSACTION', title: 'Vente finalisée', body: 'VTE-ATL-00001 — Villa de charme à Ouidah, 61 000 000 FCFA', action_url: '/transactions', payload: {}, is_read: true, read_at: iso(-20), created_at: iso(-22) },
  { id: 'not-5', user_id: 'usr-agent', agency_id: AGENCY_ID, type: 'ACCOUNT_VALIDATION', title: 'Propriétaire vérifié', body: 'Le dossier de Marc Dossou a été validé.', action_url: '/proprietaires', payload: {}, is_read: true, read_at: iso(-170), created_at: iso(-175) },
]

/* ------------------------------ Audit ------------------------------- */
const AUDIT_ACTIONS = [
  ['property.publish', 'property', 'Koffi Mensah'],
  ['owner.verify', 'owner', 'Rodrigue Houngbédji'],
  ['sale.create', 'sale', 'Fatima Bello'],
  ['agent.invite', 'agent', 'Rodrigue Houngbédji'],
  ['document.upload', 'document', 'Marc Dossou'],
  ['auth.login', 'user', 'Awa Sossou'],
  ['property.create', 'property', 'Serge Ahouandjinou'],
  ['visit.decide', 'visit', 'Koffi Mensah'],
  ['document.verify', 'document', 'Rodrigue Houngbédji'],
  ['property.change_status', 'property', 'Koffi Mensah'],
  ['client.assign', 'client', 'Fatima Bello'],
  ['auth.change_password', 'user', 'Serge Ahouandjinou'],
]

export const auditLogs: AuditLog[] = Array.from({ length: 36 }, (_, index) => {
  const [action, resource, actor] = AUDIT_ACTIONS[index % AUDIT_ACTIONS.length]
  return {
    id: `aud-${index}`,
    user_id: 'usr-agent',
    agency_id: AGENCY_ID,
    action,
    resource_type: resource,
    resource_id: `res-${1000 + index}`,
    status: index % 11 === 0 ? 'FAILURE' : 'SUCCESS',
    ip_address: `41.79.${20 + (index % 40)}.${10 + index}`,
    request_id: `req-${(index * 7717).toString(16)}`,
    payload: { actor },
    created_at: iso(-(index * 0.35)),
  }
})

/* --------------------------- Séries chiffrées ----------------------- */
const MONTHS = ['Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août']

export const revenueSeries = MONTHS.map((month, index) => ({
  month,
  ventes: [42, 51, 38, 64, 72, 58, 81, 94, 76, 103, 118, 97][index],
  locations: [18, 22, 25, 21, 28, 31, 27, 34, 39, 36, 42, 45][index],
}))

export const activitySeries = MONTHS.slice(-8).map((month, index) => ({
  month,
  visites: [12, 18, 15, 24, 29, 22, 34, 41][index],
  publications: [4, 6, 5, 9, 7, 11, 8, 13][index],
  nouveauxClients: [3, 5, 4, 8, 6, 9, 11, 14][index],
}))

export const portfolioBreakdown = [
  { name: 'Villas', value: 34, color: '#0E4D45' },
  { name: 'Appartements', value: 28, color: '#157A6E' },
  { name: 'Terrains', value: 18, color: '#C8963E' },
  { name: 'Commerces', value: 12, color: '#D6AC5F' },
  { name: 'Bureaux', value: 8, color: '#6FB0A3' },
]

export const cityDistribution = [
  { city: 'Cotonou', biens: 58 },
  { city: 'Abomey-Calavi', biens: 31 },
  { city: 'Porto-Novo', biens: 19 },
  { city: 'Ouidah', biens: 12 },
  { city: 'Parakou', biens: 8 },
]

export const platformGrowth = MONTHS.map((month, index) => ({
  month,
  agences: [4, 5, 5, 7, 8, 9, 11, 12, 14, 16, 18, 21][index],
  utilisateurs: [48, 62, 77, 96, 118, 142, 171, 205, 244, 288, 337, 392][index],
}))

/* ----------------------------- Témoignages -------------------------- */
export const testimonials = [
  {
    quote:
      "Avant, chaque agent gardait ses dossiers dans son téléphone. Aujourd'hui je vois l'état réel du portefeuille en ouvrant mon tableau de bord, et les propriétaires ne m'appellent plus pour savoir où en est leur bien.",
    author: 'Rodrigue Houngbédji',
    role: 'Directeur, Atlantique Immobilier',
    city: 'Cotonou',
  },
  {
    quote:
      "L'estimation s'appuie sur les biens réellement vendus dans le quartier, pas sur une moyenne nationale. C'est la première fois qu'un outil me donne un prix que je peux défendre devant un propriétaire.",
    author: 'Fatima Bello',
    role: 'Conseillère location',
    city: 'Cotonou',
  },
  {
    quote:
      "J'ai déposé ma pièce d'identité un lundi, mon dossier était validé le mardi. Je suis les visites de ma villa depuis mon téléphone, sans relancer personne.",
    author: 'Marc Dossou',
    role: 'Propriétaire, trois biens confiés',
    city: 'Fidjrossè',
  },
]
