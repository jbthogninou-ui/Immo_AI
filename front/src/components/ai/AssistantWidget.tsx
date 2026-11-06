import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUp, Calculator, FileText, Loader2, MessageSquareText, Minus, Sparkles, X,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/utils/cn'
import { formatCompactPrice, formatPrice } from '@/utils/format'
import { useAIMutations } from '@/hooks/useQueries'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/store/uiStore'
import type { AssistantResult, EstimationResult } from '@/types'

type Mode = 'search' | 'estimate' | 'describe'

interface Entry {
  id: string
  role: 'user' | 'assistant'
  text: string
  results?: AssistantResult['results']
  estimation?: EstimationResult
  criteria?: AssistantResult['criteria']
}

const MODES: Array<{ key: Mode; label: string; icon: typeof Sparkles; placeholder: string }> = [
  { key: 'search', label: 'Rechercher', icon: MessageSquareText, placeholder: 'Maison 4 chambres proche centre, budget 60 millions' },
  { key: 'estimate', label: 'Estimer', icon: Calculator, placeholder: 'Villa 250 m² à Fidjrossè avec piscine et garage' },
  { key: 'describe', label: 'Rédiger', icon: FileText, placeholder: 'Appartement 95 m², 2 chambres, Haie Vive, climatisation' },
]

const OPENERS: Record<Mode, string> = {
  search: "Décrivez le bien recherché en une phrase. Je cherche dans le catalogue et vous propose les correspondances.",
  estimate: "Donnez-moi le type de bien, sa surface et son quartier. Je calcule un prix à partir des biens comparables déjà enregistrés.",
  describe: "Listez les caractéristiques du bien. Je rédige une annonce prête à publier.",
}

/** Extrait surface, ville et équipements d'une phrase libre. */
function parseForEstimate(text: string) {
  const lower = text.toLowerCase()
  const area = lower.match(/(\d+)\s*m/)
  const bedrooms = lower.match(/(\d+)\s*chambre/)
  const city = ['cotonou', 'abomey-calavi', 'porto-novo', 'parakou', 'bohicon', 'ouidah']
    .find((value) => lower.includes(value))
  const district = ['fidjrossè', 'haie vive', 'cadjèhoun', 'akpakpa', 'godomey', 'ganhi', 'gbégamey']
    .find((value) => lower.includes(value))
  const type = ['villa', 'appartement', 'studio', 'duplex', 'terrain', 'bureau', 'boutique']
    .find((value) => lower.includes(value))
  const amenities = ['piscine', 'garage', 'jardin', 'climatisation', 'meublé', 'sécurité', 'ascenseur']
    .filter((value) => lower.includes(value))

  return {
    area: area ? Number(area[1]) : undefined,
    bedrooms: bedrooms ? Number(bedrooms[1]) : undefined,
    city: city ? city.replace(/(^|-)(\w)/g, (m) => m.toUpperCase()) : undefined,
    district: district ? district.replace(/(^|\s)(\w)/g, (m) => m.toUpperCase()) : undefined,
    property_type: type,
    amenities,
    listing_type: /louer|location|loyer/.test(lower) ? 'RENT' : 'SALE',
  }
}

/**
 * Assistant immobilier flottant.
 *
 * Présent sur tout le produit, il regroupe les trois usages courants :
 * chercher un bien, estimer un prix, rédiger une annonce.
 */
export function AssistantWidget() {
  const { isAuthenticated, isClient } = useAuth()
  const { assistantOpen, setAssistantOpen } = useUIStore()
  const [mode, setMode] = useState<Mode>('search')
  const [input, setInput] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { assistant, estimate, describe } = useAIMutations()

  const busy = assistant.isPending || estimate.isPending || describe.isPending

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [entries, busy])

  useEffect(() => {
    if (assistantOpen) setTimeout(() => inputRef.current?.focus(), 320)
  }, [assistantOpen])

  // Raccourci clavier : Ctrl/Cmd + K
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setAssistantOpen(!assistantOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [assistantOpen, setAssistantOpen])

  const push = (entry: Omit<Entry, 'id'>) =>
    setEntries((current) => [...current, { ...entry, id: Math.random().toString(36).slice(2) }])

  async function submit() {
    const question = input.trim()
    if (!question || busy) return
    setInput('')
    push({ role: 'user', text: question })

    try {
      if (mode === 'search') {
        const result = await assistant.mutateAsync({ query: question, include_results: true, limit: 6 })
        push({ role: 'assistant', text: result.answer, results: result.results, criteria: result.criteria })
      } else if (mode === 'estimate') {
        const result = await estimate.mutateAsync(parseForEstimate(question))
        push({ role: 'assistant', text: result.explanation, estimation: result })
      } else {
        const parsed = parseForEstimate(question)
        const result = await describe.mutateAsync({ ...parsed, tone: 'professionnel', max_words: 170 })
        push({
          role: 'assistant',
          text: `${result.title_suggestion ? `« ${result.title_suggestion} »\n\n` : ''}${result.description}`,
        })
      }
    } catch {
      push({ role: 'assistant', text: "Je n'ai pas pu traiter cette demande. Reformulez ou réessayez dans un instant." })
    }
  }

  // L'assistant n'est proposé qu'aux rôles qui en ont l'usage.
  if (!isAuthenticated) return null

  const activeMode = MODES.find((item) => item.key === mode)!

  return (
    <>
      {/* --------------------------- Déclencheur -------------------------- */}
      <AnimatePresence>
        {!assistantOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            onClick={() => setAssistantOpen(true)}
            aria-label="Ouvrir l'assistant immobilier"
            className="group fixed bottom-5 right-5 z-[60] flex h-14 items-center gap-3 rounded-full bg-lagoon-600 pl-4 pr-5 text-white shadow-lift transition-colors hover:bg-lagoon-700"
          >
            {/* Halo pulsé : signale un service actif sans clignoter */}
            <span className="absolute inset-0 -z-10 rounded-full bg-lagoon-500/40 animate-pulse-ring" />
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brass-500 text-ink">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="hidden text-sm font-semibold sm:block">Assistant</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ----------------------------- Fenêtre ---------------------------- */}
      <AnimatePresence>
        {assistantOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className={cn(
              'fixed z-[60] flex flex-col overflow-hidden border border-line bg-surface shadow-lift',
              'inset-x-0 bottom-0 h-[86vh] rounded-t-3xl',
              'sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,82vh)] sm:w-[420px] sm:rounded-2xl',
            )}
          >
            {/* En-tête */}
            <header className="relative shrink-0 overflow-hidden bg-brand-gradient px-5 py-4">
              <div className="absolute inset-0 bg-grain opacity-[0.07]" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brass-500 text-ink">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-display text-base font-semibold tracking-tight text-white">
                      Assistant immobilier
                    </p>
                    <p className="font-mono text-2xs uppercase tracking-[0.14em] text-brass-200">
                      {activeMode.label}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEntries([])}
                    className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Effacer la conversation"
                    title="Effacer la conversation"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setAssistantOpen(false)}
                    className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Fermer l'assistant"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Sélecteur de mode */}
              <div className="relative mt-4 flex gap-1 rounded-xl bg-ink/25 p-1">
                {MODES.filter((item) => !(isClient && item.key === 'describe')).map((item) => {
                  const Icon = item.icon
                  const active = mode === item.key
                  return (
                    <button
                      key={item.key}
                      onClick={() => setMode(item.key)}
                      className={cn(
                        'relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors',
                        active ? 'text-ink' : 'text-white/70 hover:text-white',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="assistant-mode"
                          className="absolute inset-0 rounded-lg bg-brass-400"
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className="relative flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </header>

            {/* Fil de conversation */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
              {entries.length === 0 && (
                <div className="rounded-2xl border border-line bg-surface-2 p-4">
                  <p className="text-sm leading-relaxed text-content-muted text-pretty">{OPENERS[mode]}</p>
                  <p className="mt-3 font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">
                    Exemple
                  </p>
                  <button
                    onClick={() => setInput(activeMode.placeholder)}
                    className="mt-1.5 text-left text-sm text-lagoon-600 transition-colors hover:text-lagoon-700 dark:text-brass-300"
                  >
                    « {activeMode.placeholder} »
                  </button>
                </div>
              )}

              {entries.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className={cn('flex', entry.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                      entry.role === 'user'
                        ? 'bg-lagoon-600 text-white'
                        : 'border border-line bg-surface-2 text-content',
                    )}
                  >
                    <p className="whitespace-pre-wrap text-pretty">{entry.text}</p>

                    {/* Résultat d'estimation */}
                    {entry.estimation && (
                      <div className="mt-3 rounded-xl border border-brass-500/30 bg-brass-500/10 p-3">
                        <p className="font-mono text-2xs uppercase tracking-[0.14em] text-brass-700 dark:text-brass-300">
                          Prix conseillé
                        </p>
                        <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-content">
                          {formatPrice(entry.estimation.suggested_price, entry.estimation.currency)}
                        </p>
                        <p className="mt-1 font-mono text-xs text-content-muted">
                          {formatCompactPrice(entry.estimation.price_range_min)} — {formatCompactPrice(entry.estimation.price_range_max)}
                        </p>
                        <div className="mt-2.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full bg-brass-500"
                              style={{ width: `${entry.estimation.confidence * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-2xs text-content-subtle">
                            confiance {Math.round(entry.estimation.confidence * 100)} %
                          </span>
                        </div>
                        <p className="mt-2 text-2xs text-content-subtle">
                          {entry.estimation.comparables_count} bien(s) comparable(s) · {entry.estimation.method}
                        </p>
                      </div>
                    )}

                    {/* Biens proposés */}
                    {entry.results && entry.results.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {entry.results.slice(0, 4).map((result: any) => (
                          <Link
                            key={result.id}
                            to={`/biens/${result.id}`}
                            onClick={() => setAssistantOpen(false)}
                            className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5 transition-colors hover:border-brass-500"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-content">{result.title}</p>
                              <p className="font-mono text-2xs text-content-subtle">
                                {result.district ?? result.city} · {result.area ?? '—'} m²
                              </p>
                            </div>
                            <span className="shrink-0 font-mono text-xs font-semibold text-lagoon-600 dark:text-brass-300">
                              {formatCompactPrice(result.price, result.currency)}
                            </span>
                          </Link>
                        ))}
                        {entry.results.length > 4 && (
                          <p className="text-2xs text-content-subtle">
                            et {entry.results.length - 4} autre(s) bien(s)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-brass-500" />
                    <span className="text-sm text-content-muted">
                      {mode === 'estimate' ? 'Analyse des biens comparables…' : 'Recherche en cours…'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Saisie */}
            <div className="shrink-0 border-t border-line bg-surface p-3">
              <div className="flex items-end gap-2 rounded-xl border border-line bg-surface-2 p-2 focus-within:border-lagoon-500">
                <textarea
                  ref={inputRef}
                  value={input}
                  rows={1}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      submit()
                    }
                  }}
                  placeholder={activeMode.placeholder}
                  className="max-h-28 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-content placeholder:text-content-subtle focus:outline-none"
                />
                <Button
                  size="icon"
                  variant="brass"
                  disabled={!input.trim() || busy}
                  onClick={submit}
                  aria-label="Envoyer"
                  className="h-9 w-9 rounded-lg"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 px-1 text-2xs text-content-subtle">
                Les estimations s'appuient sur les biens de votre agence. Vérifiez-les avant de les transmettre.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
