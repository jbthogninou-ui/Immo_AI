/* Formatage — tout est calibré pour le franc CFA et le français. */

const CURRENCY_LABEL: Record<string, string> = { XOF: 'FCFA', EUR: '€', USD: '$' }

// Intl.NumberFormat('fr-FR') sépare les milliers avec une espace fine
// insécable (U+202F). Ce caractère est invisible dans certaines polices /
// certains copier-coller, ce qui donne l'impression que deux montants sont
// collés l'un à l'autre. On le remplace par une espace normale.
function withPlainSpaces(text: string) {
  return text.replace(/[\u202F\u00A0]/g, ' ')
}

/** 145000000 XOF → « 145 000 000 FCFA » */
export function formatPrice(value: number | string | null | undefined, currency = 'XOF') {
  if (value === null || value === undefined || value === '') return '—'
  const amount = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(amount)) return '—'
  return `${withPlainSpaces(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount))} ${
    CURRENCY_LABEL[currency] ?? currency
  }`
}

/** 145000000 → « 145 M » — pour les cartes et graphiques où la place manque. */
export function formatCompactPrice(value: number | null | undefined, currency = 'XOF') {
  if (value === null || value === undefined) return '—'
  const label = CURRENCY_LABEL[currency] ?? currency
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace('.0', '')} Md ${label}`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')} M ${label}`
  if (value >= 1_000) return `${Math.round(value / 1_000)} k ${label}`
  return `${withPlainSpaces(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value))} ${label}`
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return withPlainSpaces(new Intl.NumberFormat('fr-FR').format(value))
}

export function formatArea(value: number | null | undefined) {
  return value ? `${new Intl.NumberFormat('fr-FR').format(value)} m²` : '—'
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(value))
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

export function formatTime(value: string | Date | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  )
}

/** « il y a 3 heures » — pour les fils de messages et notifications. */
export function formatRelative(value: string | Date | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  const diff = (date.getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' })
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000], ['month', 2592000], ['week', 604800],
    ['day', 86400], ['hour', 3600], ['minute', 60],
  ]
  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit)
  }
  return "à l'instant"
}

export function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return '—'
  const units = ['o', 'Ko', 'Mo', 'Go']
  let size = bytes
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function truncate(text: string | null | undefined, max = 120) {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}
