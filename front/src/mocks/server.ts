/* ============================================================
   Serveur simulé.

   En mode démonstration, l'adaptateur Axios est remplacé : les
   requêtes ne sortent jamais du navigateur et sont servies par ce
   routeur. Les composants, hooks et écrans restent strictement
   identiques — seule la source des données change.
   ============================================================ */
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios'
import { api } from '@/api/client'
import * as db from '@/mocks/data'
import type { Page, Property, UserProfile, Visit } from '@/types'

const LATENCY = [140, 380] as const
const wait = () =>
  new Promise((resolve) =>
    setTimeout(resolve, LATENCY[0] + Math.random() * (LATENCY[1] - LATENCY[0])),
  )

/* --------------------------- État en mémoire ------------------------ */
const state = {
  properties: [...db.properties],
  visits: [...db.visits],
  owners: [...db.owners],
  clients: [...db.clients],
  agents: [...db.agents],
  agencies: [...db.agencies],
  sales: [...db.sales],
  rentals: [...db.rentals],
  documents: [...db.documents],
  notifications: [...db.notifications],
  conversations: [...db.conversations],
  messages: JSON.parse(JSON.stringify(db.messages)) as typeof db.messages,
  favorites: ['prop-0001', 'prop-0003', 'prop-0006'],
  searchHistory: [
    { id: 'sh1', client_id: 'cli-0001', query: 'Villa 4 chambres Cotonou budget 150 millions', filters: {}, results_count: 3, created_at: new Date(Date.now() - 3600_000).toISOString() },
    { id: 'sh2', client_id: 'cli-0001', query: 'Appartement meublé Haie Vive', filters: {}, results_count: 2, created_at: new Date(Date.now() - 86_400_000).toISOString() },
    { id: 'sh3', client_id: 'cli-0001', query: 'Terrain titré Godomey', filters: {}, results_count: 1, created_at: new Date(Date.now() - 4 * 86_400_000).toISOString() },
  ],
  requests: [
    { id: 'req1', agency_id: db.AGENCY_ID, client_id: 'cli-0001', agent_id: 'agt-0001', property_id: 'prop-0001', subject: 'Demande de dossier complet', message: 'Merci de m’envoyer le titre foncier et le diagnostic.', status: 'OPEN', created_at: new Date(Date.now() - 2 * 86_400_000).toISOString() },
    { id: 'req2', agency_id: db.AGENCY_ID, client_id: 'cli-0001', agent_id: 'agt-0001', property_id: null, subject: 'Recherche villa 4 chambres', message: 'Budget 90 millions maximum, quartier calme.', status: 'OPEN', created_at: new Date(Date.now() - 9 * 86_400_000).toISOString() },
  ],
  currentEmail: 'agent@immoflow.ai',
}

function currentProfile(): UserProfile {
  return db.DEMO_ACCOUNTS[state.currentEmail]?.profile ?? db.DEMO_ACCOUNTS['agent@immoflow.ai'].profile
}

/* ------------------------------ Aides ------------------------------- */
function paginate<T>(items: T[], params: Record<string, any>): Page<T> {
  const page = Number(params.page ?? 1)
  const size = Number(params.size ?? 20)
  const start = (page - 1) * size
  return {
    items: items.slice(start, start + size),
    total: items.length,
    page,
    size,
    pages: Math.max(1, Math.ceil(items.length / size)),
  }
}

const ok = (config: AxiosRequestConfig, data: unknown, status = 200): AxiosResponse => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: config as any,
})

function fail(status: number, code: string, message: string) {
  const error: any = new Error(message)
  error.isAxiosError = true
  error.response = { status, data: { error: { code, message } } }
  return error
}

/** Applique le périmètre du rôle courant, comme le fait le backend. */
function scopedProperties(): Property[] {
  const me = currentProfile()
  if (me.role === 'SUPER_ADMIN' || me.role === 'AGENCY') return state.properties
  if (me.role === 'AGENT') return state.properties.filter((p) => p.agent_id === me.agent_id)
  if (me.role === 'OWNER') return state.properties.filter((p) => p.owner_id === me.owner_id)
  return state.properties.filter((p) => p.is_published)
}

function filterProperties(list: Property[], q: Record<string, any>): Property[] {
  let items = [...list]
  if (q.q) {
    const needle = String(q.q).toLowerCase()
    items = items.filter(
      (p) =>
        p.title.toLowerCase().includes(needle) ||
        (p.description ?? '').toLowerCase().includes(needle) ||
        p.reference.toLowerCase().includes(needle) ||
        (p.district ?? '').toLowerCase().includes(needle),
    )
  }
  if (q.city) items = items.filter((p) => p.city?.toLowerCase() === String(q.city).toLowerCase())
  if (q.district) items = items.filter((p) => p.district?.toLowerCase() === String(q.district).toLowerCase())
  if (q.listing_type) items = items.filter((p) => p.listing_type === q.listing_type)
  if (q.status) items = items.filter((p) => p.status === q.status)
  if (q.property_type_id) items = items.filter((p) => p.property_type_id === q.property_type_id)
  if (q.owner_id) items = items.filter((p) => p.owner_id === q.owner_id)
  if (q.agent_id) items = items.filter((p) => p.agent_id === q.agent_id)
  if (q.min_price) items = items.filter((p) => p.price >= Number(q.min_price))
  if (q.max_price) items = items.filter((p) => p.price <= Number(q.max_price))
  if (q.min_area) items = items.filter((p) => (p.area ?? 0) >= Number(q.min_area))
  if (q.max_area) items = items.filter((p) => (p.area ?? 0) <= Number(q.max_area))
  if (q.bedrooms) items = items.filter((p) => (p.bedrooms ?? 0) >= Number(q.bedrooms))
  if (q.rooms) items = items.filter((p) => (p.rooms ?? 0) >= Number(q.rooms))
  if (q.is_published !== undefined) items = items.filter((p) => p.is_published === (q.is_published === true || q.is_published === 'true'))

  const sort = String(q.sort ?? '-created_at')
  const desc = sort.startsWith('-')
  const key = sort.replace('-', '') as keyof Property
  items.sort((a, b) => {
    const va = a[key] as any
    const vb = b[key] as any
    if (va === vb) return 0
    return (va > vb ? 1 : -1) * (desc ? -1 : 1)
  })
  return items
}

/* --------------------------- Assistant IA --------------------------- */
const NUMBER_WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
}

function parseQuery(query: string) {
  const text = query.toLowerCase()
  const criteria: Record<string, any> = {
    listing_type: null, property_type: null, city: null, district: null,
    bedrooms: null, rooms: null, min_price: null, max_price: null, min_area: null, amenities: [],
  }

  if (/louer|location|loyer/.test(text)) criteria.listing_type = 'RENT'
  else if (/acheter|achat|vente|vendre/.test(text)) criteria.listing_type = 'SALE'

  for (const kind of ['villa', 'maison', 'appartement', 'studio', 'terrain', 'bureau', 'boutique', 'duplex', 'immeuble']) {
    if (text.includes(kind)) { criteria.property_type = kind; break }
  }
  for (const city of ['cotonou', 'abomey-calavi', 'calavi', 'porto-novo', 'parakou', 'bohicon', 'ouidah']) {
    if (text.includes(city)) { criteria.city = city === 'calavi' ? 'Abomey-Calavi' : city.replace(/(^|-)(\w)/g, (m) => m.toUpperCase()); break }
  }
  for (const district of ['fidjrossè', 'fidjrosse', 'haie vive', 'cadjèhoun', 'cadjehoun', 'akpakpa', 'godomey', 'ganhi', 'zogbo', 'gbégamey']) {
    if (text.includes(district)) { criteria.district = district.replace(/(^|\s)(\w)/g, (m) => m.toUpperCase()); break }
  }

  const roomMatch = text.match(/(\d+)\s*(chambre|pièce|piece)/)
  if (roomMatch) {
    const value = Number(roomMatch[1])
    if (roomMatch[2].startsWith('chambre')) criteria.bedrooms = value
    else criteria.rooms = value
  } else {
    const wordMatch = text.match(new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join('|')})\\s+chambres?`))
    if (wordMatch) criteria.bedrooms = NUMBER_WORDS[wordMatch[1]]
  }

  const budget = text.match(/(\d+(?:[.,]\d+)?)\s*(milliards?|millions?|million|m\b|k\b|mille)/)
  if (budget) {
    const amount = Number(budget[1].replace(',', '.'))
    const unit = budget[2]
    const factor = unit.startsWith('milliard') ? 1e9 : unit.startsWith('m') ? 1e6 : 1e3
    criteria.max_price = Math.round(amount * factor)
  }

  const area = text.match(/(\d+)\s*m2|(\d+)\s*m²/)
  if (area) criteria.min_area = Number(area[1] ?? area[2])

  criteria.amenities = ['piscine', 'garage', 'jardin', 'meublé', 'climatisation'].filter((a) => text.includes(a))
  return criteria
}

function assistantAnswer(query: string) {
  const criteria = parseQuery(query)
  const matches = filterProperties(scopedProperties(), {
    city: criteria.city, district: criteria.district, listing_type: criteria.listing_type,
    bedrooms: criteria.bedrooms, max_price: criteria.max_price, min_area: criteria.min_area,
  }).slice(0, 8)

  const bits: string[] = []
  if (criteria.property_type) bits.push(criteria.property_type)
  if (criteria.bedrooms) bits.push(`${criteria.bedrooms} chambres`)
  if (criteria.city) bits.push(`à ${criteria.city}`)
  if (criteria.max_price) bits.push(`sous ${new Intl.NumberFormat('fr-FR').format(criteria.max_price)} FCFA`)
  const summary = bits.length ? bits.join(' ') : 'votre recherche'

  const answer = matches.length
    ? `J'ai trouvé ${matches.length} bien${matches.length > 1 ? 's' : ''} correspondant à ${summary}. Le plus pertinent : ${matches[0].title} — ${new Intl.NumberFormat('fr-FR').format(matches[0].price)} FCFA à ${matches[0].district}. Souhaitez-vous programmer une visite ?`
    : `Aucun bien ne correspond à ${summary} pour le moment. Élargissez le budget ou la zone, ou demandez à être alerté dès qu'un bien correspondant est publié.`

  return {
    answer,
    criteria,
    results: matches.map((p) => ({
      id: p.id, reference: p.reference, title: p.title, price: p.price,
      currency: p.currency, city: p.city, district: p.district,
      area: p.area, bedrooms: p.bedrooms, status: p.status,
    })),
    results_count: matches.length,
    provider: 'local',
  }
}

function generateDescription(body: Record<string, any>) {
  const source = body.property_id ? state.properties.find((p) => p.id === body.property_id) : null
  const kind = (body.property_type ?? 'bien').toLowerCase()
  const city = body.city ?? source?.city ?? 'Cotonou'
  const district = body.district ?? source?.district ?? ''
  const area = body.area ?? source?.area
  const bedrooms = body.bedrooms ?? source?.bedrooms
  const rooms = body.rooms ?? source?.rooms
  const amenities: string[] = body.amenities?.length ? body.amenities : (source?.amenities ?? [])
  const operation = (body.listing_type ?? source?.listing_type) === 'RENT' ? 'à louer' : 'à vendre'
  const article = /^[aeiouyéèh]/.test(kind) ? 'cet' : 'ce'
  const place = [district, city].filter(Boolean).join(', ')

  const parts = [`Découvrez ${article} ${kind} ${operation} à ${place}.`]
  const specs: string[] = []
  if (area) specs.push(`une surface de ${area} m²`)
  if (bedrooms) specs.push(`${bedrooms} chambre${bedrooms > 1 ? 's' : ''}`)
  if (rooms) specs.push(`${rooms} pièce${rooms > 1 ? 's' : ''}`)
  if (specs.length) parts.push(`Il offre ${specs.join(', ')}.`)
  if (amenities.length) parts.push(`Prestations incluses : ${amenities.join(', ')}.`)
  parts.push("Contactez l'agence pour organiser une visite et obtenir le dossier complet.")

  return {
    description: parts.join(' '),
    title_suggestion: `${kind.charAt(0).toUpperCase()}${kind.slice(1)}${bedrooms ? ` ${bedrooms} chambres` : ''}${area ? ` — ${area} m²` : ''}${place ? ` à ${place}` : ''}`,
    highlights: amenities.slice(0, 5).map((a) => a.charAt(0).toUpperCase() + a.slice(1)),
    provider: 'local',
    model: null,
  }
}

const BASELINE: Record<string, number> = {
  cotonou: 450_000, 'abomey-calavi': 250_000, godomey: 250_000, 'porto-novo': 220_000,
  parakou: 150_000, bohicon: 130_000, fidjrossè: 520_000, 'haie vive': 560_000,
  cadjèhoun: 540_000, akpakpa: 380_000, _default: 200_000,
}
const AMENITY_BONUS: Record<string, number> = {
  piscine: 0.12, garage: 0.05, jardin: 0.04, climatisation: 0.03, meublé: 0.08,
  ascenseur: 0.04, sécurité: 0.05, 'vue mer': 0.15, forage: 0.03,
}

function estimatePrice(body: Record<string, any>) {
  const source = body.property_id ? state.properties.find((p) => p.id === body.property_id) : null
  const area = body.area ?? source?.area ?? 100
  const city = (body.city ?? source?.city ?? '').toLowerCase()
  const district = (body.district ?? source?.district ?? '').toLowerCase()
  const amenities: string[] = body.amenities?.length ? body.amenities : (source?.amenities ?? [])
  const listing = body.listing_type ?? source?.listing_type ?? 'SALE'

  const comparables = state.properties.filter(
    (p) => p.area && p.listing_type !== 'RENT' &&
      (district ? p.district?.toLowerCase() === district : p.city?.toLowerCase() === city) &&
      p.area >= area * 0.6 && p.area <= area * 1.4,
  )

  let perSqm: number
  let method: string
  if (comparables.length >= 3) {
    const values = comparables.map((p) => p.price / (p.area as number)).sort((a, b) => a - b)
    perSqm = values[Math.floor(values.length / 2)]
    method = `médiane de ${comparables.length} biens comparables`
  } else {
    perSqm = BASELINE[district] ?? BASELINE[city] ?? BASELINE._default
    method = 'barème régional'
  }

  let bonus = amenities.reduce((total, a) => total + (AMENITY_BONUS[a.toLowerCase()] ?? 0), 0)
  bonus = Math.min(bonus, 0.35)
  let estimate = perSqm * area * (1 + bonus)
  if (listing === 'RENT') {
    estimate *= 0.006
    method += ' (rendement locatif appliqué)'
  }

  const confidence = comparables.length >= 5 ? 0.75 : comparables.length >= 3 ? 0.6 : 0.4
  const spread = confidence >= 0.6 ? 0.12 : 0.22

  return {
    suggested_price: Math.round(estimate),
    price_range_min: Math.round(estimate * (1 - spread)),
    price_range_max: Math.round(estimate * (1 + spread)),
    currency: 'XOF',
    confidence,
    explanation: `Estimation basée sur ${method}, soit environ ${new Intl.NumberFormat('fr-FR').format(Math.round(perSqm))} FCFA/m² pour ${area} m². Ajustement des équipements : ${bonus > 0 ? '+' : ''}${Math.round(bonus * 100)} %. Fourchette de confiance ±${Math.round(spread * 100)} %.`,
    comparables_count: comparables.length,
    method,
    provider: 'local',
  }
}

function analyzeListing(body: Record<string, any>) {
  const source = body.property_id ? state.properties.find((p) => p.id === body.property_id) : null
  const description: string = body.description ?? source?.description ?? ''
  const title: string = body.title ?? source?.title ?? ''

  const missing: string[] = []
  if (source) {
    const checks: Record<string, boolean> = {
      photos: source.images.length > 0,
      surface: !!source.area,
      chambres: source.bedrooms !== null,
      adresse: !!source.address,
      quartier: !!source.district,
      géolocalisation: source.latitude !== null && source.longitude !== null,
      'propriétaire rattaché': !!source.owner_id,
      équipements: source.amenities.length > 0,
    }
    Object.entries(checks).forEach(([label, present]) => { if (!present) missing.push(label) })
  }

  const issues: string[] = []
  const suggestions: string[] = []
  const words = description.trim().split(/\s+/).filter(Boolean).length
  if (words === 0) { issues.push('Description absente.'); suggestions.push('Rédigez une description de 120 à 200 mots.') }
  else if (words < 60) { issues.push(`Description trop courte (${words} mots).`); suggestions.push("Détaillez l'environnement, les commodités et l'état du bien.") }
  if (/\b\+?\d[\d\s.-]{7,}\b/.test(description)) {
    issues.push('Un numéro de téléphone figure dans la description.')
    suggestions.push("Retirez les coordonnées directes : la mise en relation passe par l'agence.")
  }
  if (title && title.length < 15) issues.push('Titre trop court pour le référencement.')

  let score = 100 - missing.length * 6 - issues.length * 8
  score = Math.max(0, Math.min(100, score))
  if (missing.length) suggestions.push(`Complétez les champs manquants : ${missing.join(', ')}.`)
  if (!suggestions.length) suggestions.push('Annonce complète : pensez à actualiser les photos régulièrement.')

  return { score, missing_fields: missing, quality_issues: issues, suggestions, provider: 'local' }
}

/* ------------------------------ Routeur ----------------------------- */
type Handler = (ctx: {
  config: AxiosRequestConfig
  params: Record<string, any>
  body: any
  match: RegExpMatchArray
}) => unknown

const routes: Array<[string, RegExp, Handler]> = [
  /* ---------------------------- Auth ------------------------------ */
  ['POST', /\/auth\/login$/, ({ body }) => {
    const account = db.DEMO_ACCOUNTS[String(body.email ?? '').toLowerCase()]
    if (!account) throw fail(401, 'authentication_error', 'Identifiants invalides. Utilisez un des comptes de démonstration.')
    state.currentEmail = account.profile.email
    return {
      access_token: `demo.${account.profile.id}.${Date.now()}`,
      refresh_token: `demo-refresh.${account.profile.id}`,
      token_type: 'bearer',
      expires_at: new Date(Date.now() + 1800_000).toISOString(),
      expires_in: 1800,
    }
  }],
  ['POST', /\/auth\/refresh$/, () => ({
    access_token: `demo.${currentProfile().id}.${Date.now()}`,
    refresh_token: `demo-refresh.${currentProfile().id}`,
    token_type: 'bearer',
    expires_at: new Date(Date.now() + 1800_000).toISOString(),
    expires_in: 1800,
  })],
  ['POST', /\/auth\/register$/, ({ body }) => ({
    ...currentProfile(),
    id: `usr-${Date.now()}`,
    email: body.email,
    full_name: body.full_name,
    role: body.role ?? 'CLIENT',
    status: body.role === 'CLIENT' ? 'ACTIVE' : 'PENDING',
  })],
  ['POST', /\/auth\/logout$/, () => ({ message: 'Session fermée.', success: true })],
  ['POST', /\/auth\/forgot-password$/, () => ({ message: 'Si un compte existe pour cette adresse, un email a été envoyé.', success: true })],
  ['POST', /\/auth\/reset-password$/, () => ({ message: 'Mot de passe réinitialisé.', success: true })],
  ['POST', /\/auth\/change-password$/, () => ({ message: 'Mot de passe mis à jour.', success: true })],
  ['GET', /\/auth\/me$/, () => currentProfile()],
  ['PATCH', /\/auth\/me$/, ({ body }) => ({ ...currentProfile(), ...body })],
  ['GET', /\/auth\/sessions$/, () => [
    { id: 's1', user_agent: navigator.userAgent, ip_address: '41.79.24.10', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(), revoked_at: null },
  ]],

  ['GET', /\/public\/agencies$/, ({ params }) => {
    let items = state.agencies.filter((a) => a.status === 'ACTIVE')
    if (params.q) {
      const needle = String(params.q).toLowerCase()
      items = items.filter((a) => `${a.name} ${a.city ?? ''}`.toLowerCase().includes(needle))
    }
    return paginate(
      items.map((a) => ({
        id: a.id, name: a.name, slug: a.slug, city: a.city,
        description: a.description, logo_url: a.logo_url,
      })),
      params,
    )
  }],
  ['POST', /\/owners\/register$/, ({ body }) => ({
    id: `own-${Date.now()}`, agency_id: body.agency_id, agent_id: null, user_id: null,
    first_name: body.first_name, last_name: body.last_name, email: body.email,
    phone: body.phone, address: body.address ?? null, city: body.city ?? null,
    national_id_number: null, notes: null, status: 'PENDING_VERIFICATION',
    rejection_reason: null, invited_at: null, verified_at: null,
    created_at: new Date().toISOString(),
  })],
  ['POST', /\/owners\/accept-invitation$/, () => ({
    ...state.owners[0], status: 'PENDING_VERIFICATION',
  })],

  /* --------------------------- Agences ---------------------------- */
  ['GET', /\/agencies\/me$/, () => state.agencies[0]],
  ['GET', /\/agencies\/([\w-]+)\/stats$/, () => ({
    agents: state.agents.length,
    owners: state.owners.length,
    clients: state.clients.length,
    properties: state.properties.length,
    published_properties: state.properties.filter((p) => p.is_published).length,
    visits_pending: state.visits.filter((v) => v.status === 'REQUESTED').length,
    sales_completed: state.sales.filter((s) => s.status === 'COMPLETED').length,
    rentals_active: state.rentals.filter((r) => r.status === 'ACTIVE').length,
  })],
  ['POST', /\/agencies\/([\w-]+)\/validate$/, ({ match, body }) => {
    const agency = state.agencies.find((a) => a.id === match[1])!
    agency.status = body.approve ? 'ACTIVE' : 'REJECTED'
    agency.validated_at = body.approve ? new Date().toISOString() : null
    return agency
  }],
  ['POST', /\/agencies\/([\w-]+)\/suspend$/, ({ match }) => {
    const agency = state.agencies.find((a) => a.id === match[1])!
    agency.status = 'SUSPENDED'
    return agency
  }],
  ['POST', /\/agencies\/([\w-]+)\/activate$/, ({ match }) => {
    const agency = state.agencies.find((a) => a.id === match[1])!
    agency.status = 'ACTIVE'
    return agency
  }],
  ['GET', /\/agencies\/([\w-]+)$/, ({ match }) => state.agencies.find((a) => a.id === match[1])],
  ['PATCH', /\/agencies\/([\w-]+)$/, ({ match, body }) => {
    const agency = state.agencies.find((a) => a.id === match[1])!
    Object.assign(agency, body)
    return agency
  }],
  ['GET', /\/agencies$/, ({ params }) => {
    let items = state.agencies
    if (params.status) items = items.filter((a) => a.status === params.status)
    if (params.q) items = items.filter((a) => a.name.toLowerCase().includes(String(params.q).toLowerCase()))
    return paginate(items, params)
  }],

  /* ---------------------------- Agents ---------------------------- */
  ['POST', /\/agents$/, ({ body }) => {
    const id = `agt-${Date.now()}`
    const agent = {
      id, user_id: `usr-${Date.now()}`, agency_id: db.AGENCY_ID,
      job_title: body.job_title ?? null, license_number: body.license_number ?? null, bio: null,
      status: 'INVITED' as const, can_manage_owners: body.can_manage_owners ?? true,
      can_publish_properties: body.can_publish_properties ?? true,
      invited_at: new Date().toISOString(), activated_at: null, created_at: new Date().toISOString(),
      user: { id: `usr-${Date.now()}`, email: body.email, full_name: body.full_name, phone: body.phone ?? null, avatar_url: null, role: 'AGENT' as const, status: 'PENDING' as const, is_active: true, is_email_verified: false, agency_id: db.AGENCY_ID, locale: 'fr', last_login_at: null, created_at: new Date().toISOString() },
    }
    state.agents.unshift(agent)
    return { agent, invitation_url: `${window.location.origin}/activer-mon-compte?token=demo-${id}`, message: 'Invitation envoyée.' }
  }],
  ['POST', /\/agents\/([\w-]+)\/resend-invitation$/, ({ match }) => ({
    message: "Nouveau lien d'activation généré. Le lien précédent n'est plus valable.",
    invitation_url: `${window.location.origin}/accept-invitation?token=demo-${match[1]}-${Date.now()}`,
    expires_in_hours: 48,
  })],
  ['PATCH', /\/agents\/([\w-]+)\/invitation$/, ({ match, body }) => {
    const agent = state.agents.find((a) => a.id === match[1])!
    if (agent.user) {
      if (body.email) agent.user.email = body.email
      if (body.full_name) agent.user.full_name = body.full_name
      if (body.phone !== undefined) agent.user.phone = body.phone
    }
    if (body.job_title !== undefined) agent.job_title = body.job_title
    if (body.can_manage_owners !== undefined) agent.can_manage_owners = body.can_manage_owners
    if (body.can_publish_properties !== undefined) agent.can_publish_properties = body.can_publish_properties
    return agent
  }],
  ['POST', /\/agents\/([\w-]+)\/suspend$/, ({ match }) => {
    const agent = state.agents.find((a) => a.id === match[1])!
    agent.status = 'SUSPENDED'
    return agent
  }],
  ['POST', /\/agents\/([\w-]+)\/activate$/, ({ match }) => {
    const agent = state.agents.find((a) => a.id === match[1])!
    agent.status = 'ACTIVE'
    return agent
  }],
  ['DELETE', /\/agents\/([\w-]+)$/, ({ match }) => {
    // Comme le backend : un agent jamais activé disparaît complètement,
    // un agent qui a été actif voit son compte désactivé.
    const agent = state.agents.find((a) => a.id === match[1])
    state.agents = state.agents.filter((a) => a.id !== match[1])
    const permanent = agent?.status === 'INVITED'
    return {
      message: permanent
        ? "Agent supprimé et adresse email libérée."
        : "Agent retiré de l'équipe, son compte est désactivé.",
      success: true,
    }
  }],
  ['PATCH', /\/agents\/([\w-]+)$/, ({ match, body }) => {
    const agent = state.agents.find((a) => a.id === match[1])!
    Object.assign(agent, body)
    return agent
  }],
  ['GET', /\/agents\/([\w-]+)$/, ({ match }) => state.agents.find((a) => a.id === match[1])],
  ['GET', /\/agents$/, ({ params }) => {
    let items = state.agents
    if (params.status) items = items.filter((a) => a.status === params.status)
    if (params.q) {
      const needle = String(params.q).toLowerCase()
      items = items.filter((a) => a.user?.full_name.toLowerCase().includes(needle) || a.user?.email.toLowerCase().includes(needle))
    }
    return paginate(items, params)
  }],

  /* ------------------------ Propriétaires ------------------------- */
  ['POST', /\/owners\/([\w-]+)\/verify$/, ({ match, body }) => {
    const owner = state.owners.find((o) => o.id === match[1])!
    owner.status = body.approve ? 'ACTIVE' : 'REJECTED'
    owner.verified_at = body.approve ? new Date().toISOString() : null
    owner.rejection_reason = body.approve ? null : (body.reason ?? 'Documents non conformes.')
    return owner
  }],
  ['POST', /\/owners\/([\w-]+)\/suspend$/, ({ match }) => {
    const owner = state.owners.find((o) => o.id === match[1])!
    owner.status = 'SUSPENDED'
    return owner
  }],
  ['POST', /\/owners$/, ({ body }) => {
    const owner = {
      id: `own-${Date.now()}`, agency_id: db.AGENCY_ID, agent_id: currentProfile().agent_id,
      user_id: null, first_name: body.first_name, last_name: body.last_name, email: body.email,
      phone: body.phone, address: body.address ?? null, city: body.city ?? null,
      national_id_number: null, notes: body.notes ?? null, status: 'INVITED' as const,
      rejection_reason: null, invited_at: new Date().toISOString(), verified_at: null,
      created_at: new Date().toISOString(),
    }
    state.owners.unshift(owner)
    return { owner, invitation_url: `${window.location.origin}/activer-mon-compte?type=owner&token=demo-${owner.id}`, message: 'Invitation envoyée au propriétaire.' }
  }],
  ['PATCH', /\/owners\/([\w-]+)$/, ({ match, body }) => {
    const owner = state.owners.find((o) => o.id === match[1])!
    Object.assign(owner, body)
    return owner
  }],
  ['GET', /\/owners\/([\w-]+)$/, ({ match }) => state.owners.find((o) => o.id === match[1])],
  ['GET', /\/owners$/, ({ params }) => {
    const me = currentProfile()
    let items = state.owners
    if (me.role === 'AGENT') items = items.filter((o) => o.agent_id === me.agent_id)
    if (me.role === 'OWNER') items = items.filter((o) => o.id === me.owner_id)
    if (me.role === 'CLIENT') items = []
    if (params.status) items = items.filter((o) => o.status === params.status)
    if (params.q) {
      const needle = String(params.q).toLowerCase()
      items = items.filter((o) => `${o.first_name} ${o.last_name} ${o.email}`.toLowerCase().includes(needle))
    }
    return paginate(items, params)
  }],

  /* ---------------------------- Clients --------------------------- */
  ['GET', /\/clients\/requests\/all$/, ({ params }) => paginate(state.requests, params)],
  ['GET', /\/clients\/([\w-]+)\/favorites$/, ({ params }) =>
    paginate(state.favorites.map((propertyId, index) => ({
      id: `fav-${index}`, client_id: 'cli-0001', property_id: propertyId,
      created_at: new Date(Date.now() - index * 86_400_000).toISOString(),
    })), params)],
  ['POST', /\/clients\/([\w-]+)\/favorites\/([\w-]+)$/, ({ match }) => {
    if (!state.favorites.includes(match[2])) state.favorites.push(match[2])
    return { id: `fav-${Date.now()}`, client_id: match[1], property_id: match[2], created_at: new Date().toISOString() }
  }],
  ['DELETE', /\/clients\/([\w-]+)\/favorites\/([\w-]+)$/, ({ match }) => {
    state.favorites = state.favorites.filter((id) => id !== match[2])
    return { message: 'Favori retiré.', success: true }
  }],
  ['GET', /\/clients\/([\w-]+)\/search-history$/, ({ params }) => paginate(state.searchHistory, params)],
  ['POST', /\/clients\/([\w-]+)\/requests$/, ({ match, body }) => {
    const request = {
      id: `req-${Date.now()}`, agency_id: db.AGENCY_ID, client_id: match[1],
      agent_id: 'agt-0001', property_id: body.property_id ?? null,
      subject: body.subject, message: body.message ?? null, status: 'OPEN',
      created_at: new Date().toISOString(),
    }
    state.requests.unshift(request)
    return request
  }],
  ['POST', /\/clients$/, ({ body }) => {
    const client = {
      id: `cli-${Date.now()}`, agency_id: db.AGENCY_ID, user_id: null,
      first_name: body.first_name, last_name: body.last_name, email: body.email,
      phone: body.phone ?? null, city: body.city ?? null, source: body.source ?? null,
      notes: body.notes ?? null, budget_min: body.budget_min ?? null,
      budget_max: body.budget_max ?? null, preferences: body.preferences ?? {},
      is_active: true, created_at: new Date().toISOString(),
    }
    state.clients.unshift(client)
    return client
  }],
  ['PATCH', /\/clients\/([\w-]+)$/, ({ match, body }) => {
    const client = state.clients.find((c) => c.id === match[1])!
    Object.assign(client, body)
    return client
  }],
  ['DELETE', /\/clients\/([\w-]+)$/, ({ match }) => {
    state.clients = state.clients.filter((c) => c.id !== match[1])
    return { message: 'Client supprimé.', success: true }
  }],
  ['GET', /\/clients\/([\w-]+)$/, ({ match }) => state.clients.find((c) => c.id === match[1])],
  ['GET', /\/clients$/, ({ params }) => {
    let items = state.clients
    const me = currentProfile()
    if (me.role === 'CLIENT') items = items.filter((c) => c.id === me.client_id)
    if (params.q) {
      const needle = String(params.q).toLowerCase()
      items = items.filter((c) => `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(needle))
    }
    if (params.is_active !== undefined) items = items.filter((c) => c.is_active === (params.is_active === true || params.is_active === 'true'))
    return paginate(items, params)
  }],

  /* ----------------------------- Biens ---------------------------- */
  ['GET', /\/properties\/types$/, () => db.propertyTypes],
  ['GET', /\/public\/properties\/([\w-]+)$/, ({ match }) => {
    const property = state.properties.find((p) => p.id === match[1] && p.is_published)
    if (!property) throw fail(404, 'not_found', 'Bien introuvable.')
    return property
  }],
  ['GET', /\/public\/properties$/, ({ params }) =>
    paginate(filterProperties(state.properties.filter((p) => p.is_published && ['AVAILABLE', 'RESERVED'].includes(p.status)), params), params)],
  ['POST', /\/properties\/([\w-]+)\/publish$/, ({ match, config }) => {
    const property = state.properties.find((p) => p.id === match[1])!
    const publish = (config.params?.publish ?? true) !== false
    if (publish && !property.images.length) {
      throw fail(409, 'business_rule_violation', 'Publication impossible : au moins une photo est requise.')
    }
    property.is_published = publish
    if (publish && property.status === 'DRAFT') property.status = 'AVAILABLE'
    property.published_at = publish ? new Date().toISOString() : null
    return property
  }],
  ['POST', /\/properties\/([\w-]+)\/status$/, ({ match, body }) => {
    const property = state.properties.find((p) => p.id === match[1])!
    property.status = body.status
    if (['SOLD', 'RENTED', 'ARCHIVED'].includes(body.status)) property.is_published = false
    return property
  }],
  ['POST', /\/properties$/, ({ body }) => {
    const id = `prop-${Date.now()}`
    const property: Property = {
      id, reference: `BIEN-ATL-${String(state.properties.length + 1).padStart(5, '0')}`,
      agency_id: db.AGENCY_ID, agent_id: currentProfile().agent_id ?? 'agt-0001',
      owner_id: body.owner_id ?? null, property_type_id: body.property_type_id ?? null,
      title: body.title, description: body.description ?? null,
      listing_type: body.listing_type ?? 'SALE', status: 'DRAFT',
      address: body.address ?? null, district: body.district ?? null, city: body.city ?? null,
      country: 'Bénin', latitude: body.latitude ?? null, longitude: body.longitude ?? null,
      price: Number(body.price), currency: 'XOF', charges: body.charges ?? null,
      deposit: body.deposit ?? null, area: body.area ?? null, land_area: body.land_area ?? null,
      rooms: body.rooms ?? null, bedrooms: body.bedrooms ?? null, bathrooms: body.bathrooms ?? null,
      floor: null, year_built: body.year_built ?? null, amenities: body.amenities ?? [],
      is_published: false, published_at: null, views_count: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      images: (body.images ?? []).map((image: any, index: number) => ({
        id: `img-${id}-${index}`, property_id: id, url: image.url,
        thumbnail_url: image.url, caption: image.caption ?? null,
        media_type: 'IMAGE', is_cover: index === 0, position: index,
      })),
    }
    state.properties.unshift(property)
    return property
  }],
  ['PATCH', /\/properties\/([\w-]+)$/, ({ match, body }) => {
    const property = state.properties.find((p) => p.id === match[1])!
    Object.assign(property, body, { updated_at: new Date().toISOString() })
    return property
  }],
  ['DELETE', /\/properties\/([\w-]+)$/, ({ match }) => {
    state.properties = state.properties.filter((p) => p.id !== match[1])
    return { message: 'Bien supprimé.', success: true }
  }],
  ['GET', /\/properties\/([\w-]+)$/, ({ match }) => {
    const property = state.properties.find((p) => p.id === match[1])
    if (!property) throw fail(404, 'not_found', 'Bien introuvable.')
    return property
  }],
  ['GET', /\/properties$/, ({ params }) => paginate(filterProperties(scopedProperties(), params), params)],

  /* ---------------------------- Visites --------------------------- */
  ['POST', /\/visits\/([\w-]+)\/decision$/, ({ match, body }) => {
    const visit = state.visits.find((v) => v.id === match[1])!
    if (body.approve) {
      visit.status = body.scheduled_at ? 'RESCHEDULED' : 'CONFIRMED'
      if (body.scheduled_at) visit.scheduled_at = body.scheduled_at
      visit.confirmed_at = new Date().toISOString()
    } else {
      visit.status = 'REJECTED'
      visit.rejection_reason = body.reason ?? 'Créneau indisponible.'
    }
    return visit
  }],
  ['POST', /\/visits\/([\w-]+)\/complete$/, ({ match, body }) => {
    const visit = state.visits.find((v) => v.id === match[1])!
    visit.status = 'COMPLETED'
    visit.completed_at = new Date().toISOString()
    visit.feedback = body.feedback ?? null
    visit.rating = body.rating ?? null
    return visit
  }],
  ['POST', /\/visits\/([\w-]+)\/cancel$/, ({ match, body }) => {
    const visit = state.visits.find((v) => v.id === match[1])!
    visit.status = 'CANCELLED'
    visit.rejection_reason = body?.reason ?? null
    return visit
  }],
  ['POST', /\/visits$/, ({ body }) => {
    const me = currentProfile()
    const visit = {
      id: `vis-${Date.now()}`, agency_id: db.AGENCY_ID, property_id: body.property_id,
      client_id: body.client_id ?? me.client_id ?? 'cli-0001',
      agent_id: state.properties.find((p) => p.id === body.property_id)?.agent_id ?? 'agt-0001',
      scheduled_at: body.scheduled_at, duration_minutes: body.duration_minutes ?? 45,
      status: (me.role === 'CLIENT' ? 'REQUESTED' : 'CONFIRMED') as Visit['status'],
      client_message: body.client_message ?? null, agent_notes: null, rejection_reason: null,
      feedback: null, rating: null,
      confirmed_at: me.role === 'CLIENT' ? null : new Date().toISOString(),
      completed_at: null, created_at: new Date().toISOString(),
    }
    state.visits.unshift(visit)
    return visit
  }],
  ['PATCH', /\/visits\/([\w-]+)$/, ({ match, body }) => {
    const visit = state.visits.find((v) => v.id === match[1])!
    Object.assign(visit, body)
    return visit
  }],
  ['GET', /\/visits\/([\w-]+)$/, ({ match }) => state.visits.find((v) => v.id === match[1])],
  ['GET', /\/visits$/, ({ params }) => {
    const me = currentProfile()
    let items = [...state.visits]
    if (me.role === 'AGENT') items = items.filter((v) => v.agent_id === me.agent_id)
    if (me.role === 'CLIENT') items = items.filter((v) => v.client_id === me.client_id)
    if (me.role === 'OWNER') {
      const owned = state.properties.filter((p) => p.owner_id === me.owner_id).map((p) => p.id)
      items = items.filter((v) => owned.includes(v.property_id))
    }
    if (params.status) items = items.filter((v) => v.status === params.status)
    if (params.property_id) items = items.filter((v) => v.property_id === params.property_id)
    items.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
    return paginate(items, params)
  }],

  /* ------------------------- Transactions ------------------------- */
  ['POST', /\/sales$/, ({ body }) => {
    const sale = {
      id: `sal-${Date.now()}`, reference: `VTE-ATL-${String(state.sales.length + 1).padStart(5, '0')}`,
      agency_id: db.AGENCY_ID, property_id: body.property_id, client_id: body.client_id,
      agent_id: currentProfile().agent_id ?? 'agt-0001',
      owner_id: state.properties.find((p) => p.id === body.property_id)?.owner_id ?? null,
      amount: Number(body.amount), currency: 'XOF',
      commission_rate: body.commission_rate ?? null,
      commission_amount: body.commission_rate ? Math.round((Number(body.amount) * Number(body.commission_rate)) / 100) : null,
      status: 'IN_PROGRESS' as const, notes: body.notes ?? null,
      signed_at: null, completed_at: null, created_at: new Date().toISOString(),
    }
    state.sales.unshift(sale)
    const property = state.properties.find((p) => p.id === body.property_id)
    if (property) property.status = 'RESERVED'
    return sale
  }],
  ['PATCH', /\/sales\/([\w-]+)$/, ({ match, body }) => {
    const sale = state.sales.find((s) => s.id === match[1])!
    Object.assign(sale, body)
    if (body.status === 'COMPLETED') {
      sale.completed_at = new Date().toISOString()
      const property = state.properties.find((p) => p.id === sale.property_id)
      if (property) { property.status = 'SOLD'; property.is_published = false }
    }
    return sale
  }],
  ['GET', /\/sales\/([\w-]+)$/, ({ match }) => state.sales.find((s) => s.id === match[1])],
  ['GET', /\/sales$/, ({ params }) => {
    const me = currentProfile()
    let items = [...state.sales]
    if (me.role === 'AGENT') items = items.filter((s) => s.agent_id === me.agent_id)
    if (me.role === 'OWNER') items = items.filter((s) => s.owner_id === me.owner_id)
    if (me.role === 'CLIENT') items = items.filter((s) => s.client_id === me.client_id)
    if (params.status) items = items.filter((s) => s.status === params.status)
    return paginate(items, params)
  }],
  ['POST', /\/rentals$/, ({ body }) => {
    const rental = {
      id: `ren-${Date.now()}`, reference: `LOC-ATL-${String(state.rentals.length + 1).padStart(5, '0')}`,
      agency_id: db.AGENCY_ID, property_id: body.property_id, client_id: body.client_id,
      agent_id: currentProfile().agent_id ?? 'agt-0001',
      owner_id: state.properties.find((p) => p.id === body.property_id)?.owner_id ?? null,
      monthly_rent: Number(body.monthly_rent), charges: body.charges ?? null,
      deposit_amount: body.deposit_amount ?? null, currency: 'XOF',
      start_date: body.start_date, end_date: body.end_date ?? null,
      duration_months: body.duration_months ?? null, status: 'DRAFT' as const,
      notes: body.notes ?? null, created_at: new Date().toISOString(),
    }
    state.rentals.unshift(rental)
    return rental
  }],
  ['PATCH', /\/rentals\/([\w-]+)$/, ({ match, body }) => {
    const rental = state.rentals.find((r) => r.id === match[1])!
    Object.assign(rental, body)
    const property = state.properties.find((p) => p.id === rental.property_id)
    if (body.status === 'ACTIVE' && property) { property.status = 'RENTED'; property.is_published = false }
    if (body.status === 'TERMINATED' && property) property.status = 'AVAILABLE'
    return rental
  }],
  ['GET', /\/rentals\/([\w-]+)$/, ({ match }) => state.rentals.find((r) => r.id === match[1])],
  ['GET', /\/rentals$/, ({ params }) => {
    const me = currentProfile()
    let items = [...state.rentals]
    if (me.role === 'AGENT') items = items.filter((r) => r.agent_id === me.agent_id)
    if (me.role === 'OWNER') items = items.filter((r) => r.owner_id === me.owner_id)
    if (me.role === 'CLIENT') items = items.filter((r) => r.client_id === me.client_id)
    if (params.status) items = items.filter((r) => r.status === params.status)
    return paginate(items, params)
  }],
  ['GET', /\/contracts$/, ({ params }) => paginate([], params)],

  /* --------------------------- Documents -------------------------- */
  ['POST', /\/documents\/([\w-]+)\/verify$/, ({ match, body }) => {
    const document = state.documents.find((d) => d.id === match[1])!
    document.status = body.approve ? 'VERIFIED' : 'REJECTED'
    document.verified_at = body.approve ? new Date().toISOString() : null
    document.rejection_reason = body.approve ? null : (body.reason ?? 'Document non conforme.')
    return document
  }],
  ['DELETE', /\/documents\/([\w-]+)$/, ({ match }) => {
    state.documents = state.documents.filter((d) => d.id !== match[1])
    return { message: 'Document supprimé.', success: true }
  }],
  ['POST', /\/documents$/, ({ body }) => {
    const file = body instanceof FormData ? (body.get('file') as File | null) : null
    const document = {
      id: `doc-${Date.now()}`, agency_id: db.AGENCY_ID,
      entity_type: (body instanceof FormData ? body.get('entity_type') : 'OTHER') as any,
      entity_id: (body instanceof FormData ? body.get('entity_id') : '') as string,
      category: (body instanceof FormData ? body.get('category') : 'OTHER') as any,
      status: 'PENDING' as const, filename: file?.name ?? 'document.pdf', url: '#',
      mime_type: file?.type ?? 'application/pdf', size_bytes: file?.size ?? 120_000,
      uploaded_by_id: currentProfile().id, verified_at: null, rejection_reason: null,
      created_at: new Date().toISOString(),
    }
    state.documents.unshift(document)
    return document
  }],
  ['GET', /\/documents\/([\w-]+)$/, ({ match }) => state.documents.find((d) => d.id === match[1])],
  ['GET', /\/documents$/, ({ params }) => {
    let items = state.documents
    if (params.category) items = items.filter((d) => d.category === params.category)
    if (params.status) items = items.filter((d) => d.status === params.status)
    if (params.entity_type) items = items.filter((d) => d.entity_type === params.entity_type)
    if (params.entity_id) items = items.filter((d) => d.entity_id === params.entity_id)
    return paginate(items, params)
  }],

  /* -------------------------- Messagerie -------------------------- */
  ['GET', /\/conversations\/([\w-]+)\/messages$/, ({ match, params }) => {
    const list = [...(state.messages[match[1]] ?? [])].reverse()
    return paginate(list, { ...params, size: params.size ?? 50 })
  }],
  ['POST', /\/conversations\/([\w-]+)\/messages$/, ({ match, body }) => {
    const message = {
      id: `msg-${Date.now()}`, conversation_id: match[1], sender_id: currentProfile().id,
      type: body.type ?? 'TEXT', content: body.content ?? null,
      attachment_url: body.attachment_url ?? null, attachment_name: body.attachment_name ?? null,
      attachment_mime: body.attachment_mime ?? null, attachment_size: body.attachment_size ?? null,
      document_id: body.document_id ?? null, extra_data: {}, edited_at: null,
      created_at: new Date().toISOString(),
    }
    state.messages[match[1]] = [...(state.messages[match[1]] ?? []), message]
    const conversation = state.conversations.find((c) => c.id === match[1])
    if (conversation) conversation.last_message_at = message.created_at
    return message
  }],
  ['POST', /\/conversations\/([\w-]+)\/read$/, ({ match }) => {
    const conversation = state.conversations.find((c) => c.id === match[1])
    if (conversation) conversation.unread_count = 0
    return { last_read_at: new Date().toISOString() }
  }],
  ['POST', /\/conversations\/([\w-]+)\/archive$/, ({ match }) => {
    const conversation = state.conversations.find((c) => c.id === match[1])!
    conversation.is_archived = true
    return { message: 'Conversation archivée.', success: true }
  }],
  ['POST', /\/conversations$/, ({ body }) => {
    const conversation = {
      id: `cnv-${Date.now()}`, agency_id: db.AGENCY_ID, type: body.type,
      subject: body.subject ?? null, property_id: body.property_id ?? null,
      created_by_id: currentProfile().id, is_archived: false,
      last_message_at: new Date().toISOString(), created_at: new Date().toISOString(),
      participants: [], unread_count: 0,
    }
    state.conversations.unshift(conversation)
    state.messages[conversation.id] = []
    return conversation
  }],
  ['GET', /\/conversations\/([\w-]+)$/, ({ match }) => state.conversations.find((c) => c.id === match[1])],
  ['GET', /\/conversations$/, ({ params }) => paginate(state.conversations.filter((c) => !c.is_archived), params)],

  /* ------------------------- Notifications ------------------------ */
  ['GET', /\/notifications\/unread-count$/, () => ({
    unread: state.notifications.filter((n) => !n.is_read).length,
  })],
  ['POST', /\/notifications\/read$/, ({ body }) => {
    let count = 0
    state.notifications.forEach((notification) => {
      if (notification.is_read) return
      if (body.all || body.ids?.includes(notification.id)) {
        notification.is_read = true
        notification.read_at = new Date().toISOString()
        count += 1
      }
    })
    return { message: `${count} notification(s) marquée(s) comme lue(s).`, success: true }
  }],
  ['GET', /\/notifications$/, ({ params }) => {
    let items = state.notifications
    if (params.is_read !== undefined) items = items.filter((n) => n.is_read === (params.is_read === true || params.is_read === 'true'))
    if (params.type) items = items.filter((n) => n.type === params.type)
    return paginate(items, params)
  }],

  /* ------------------------------ IA ------------------------------ */
  ['POST', /\/ai\/description$/, ({ body }) => generateDescription(body)],
  ['POST', /\/ai\/estimate$/, ({ body }) => estimatePrice(body)],
  ['POST', /\/ai\/assistant$/, ({ body }) => assistantAnswer(String(body.query ?? ''))],
  ['POST', /\/ai\/analyze-listing$/, ({ body }) => analyzeListing(body)],

  /* -------------------------- Administration ---------------------- */
  ['GET', /\/admin\/stats$/, () => ({
    users: 392,
    agencies: state.agencies.length,
    agencies_pending: state.agencies.filter((a) => a.status === 'PENDING_VALIDATION').length,
    agencies_active: state.agencies.filter((a) => a.status === 'ACTIVE').length,
    properties: state.properties.length,
  })],
  ['GET', /\/admin\/audit-logs$/, ({ params }) => {
    let items = db.auditLogs
    if (params.action) items = items.filter((log) => log.action === params.action)
    if (params.resource_type) items = items.filter((log) => log.resource_type === params.resource_type)
    return paginate(items, params)
  }],
  ['GET', /\/users$/, ({ params }) => {
    const users = [
      ...Object.values(db.DEMO_ACCOUNTS).map((account) => account.profile),
      ...state.agents.map((agent) => agent.user).filter(Boolean),
    ] as any[]
    let items = users
    if (params.q) {
      const needle = String(params.q).toLowerCase()
      items = items.filter((u) => `${u.full_name} ${u.email}`.toLowerCase().includes(needle))
    }
    return paginate(items, params)
  }],
  ['GET', /\/health$/, () => ({ status: 'healthy', database: 'demo', redis: 'demo', version: '1.0.0' })],
]

/* --------------------- Installation de l'adaptateur ------------------ */
export function installMockServer() {
  const adapter: AxiosAdapter = async (config) => {
    await wait()

    const method = (config.method ?? 'get').toUpperCase()
    const url = (config.url ?? '').split('?')[0]
    const params = (config.params ?? {}) as Record<string, any>

    let body: any = config.data
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { /* FormData ou corps vide */ }
    }

    for (const [routeMethod, pattern, handler] of routes) {
      if (routeMethod !== method) continue
      const match = url.match(pattern)
      if (!match) continue
      const data = handler({ config, params, body, match })
      if (data === undefined) throw fail(404, 'not_found', 'Ressource introuvable.')
      return ok(config, data)
    }

    throw fail(404, 'not_found', `Route non simulée : ${method} ${url}`)
  }

  api.defaults.adapter = adapter
  // eslint-disable-next-line no-console
  console.info(
    '%c ImmoFlow AI %c Mode démonstration actif — aucune requête réseau, données simulées.',
    'background:#0E4D45;color:#E3C58A;padding:2px 6px;border-radius:3px;font-weight:600',
    'color:#157A6E',
  )
}
