import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight, Building2, Calculator, FileCheck2, MessagesSquare, Quote, ShieldCheck, Sparkles,
  UserSquare2,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { SearchBar, type SearchValues } from '@/components/property/SearchBar'
import { PropertyCard, PropertyCardSkeleton } from '@/components/property/PropertyCard'
import { usePublicProperties } from '@/hooks/useQueries'
import { testimonials } from '@/mocks/data'
import { cn } from '@/utils/cn'

/* ---------------------------------------------------------------
   Compteur animé — les chiffres se posent, ils ne défilent pas.
   --------------------------------------------------------------- */
function Counter({ to, suffix = '', duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const [value, setValue] = useState(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) { setValue(to); return }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      // Sortie cubique : rapide puis stabilisation
      setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [to, duration, reduced])

  return (
    <span className="font-display tabular-nums">
      {new Intl.NumberFormat('fr-FR').format(value)}{suffix}
    </span>
  )
}

const STATS = [
  { value: 1240, suffix: '', label: 'Biens référencés' },
  { value: 21, suffix: '', label: 'Agences partenaires' },
  { value: 96, suffix: ' %', label: 'Dossiers complets sous 48 h' },
  { value: 8, suffix: ' villes', label: 'Couverture nationale' },
]

const CAPABILITIES = [
  {
    icon: Calculator,
    title: 'Estimation appuyée sur le terrain',
    body:
      "Le prix conseillé se calcule sur les biens comparables réellement enregistrés dans le quartier, pas sur une moyenne nationale. La fourchette et le nombre de comparables sont affichés : vous savez sur quoi repose le chiffre.",
    detail: 'Médiane par m² · fourchette de confiance · comparables listés',
  },
  {
    icon: MessagesSquare,
    title: 'Recherche en langage courant',
    body:
      "Un client écrit « maison 4 chambres proche du centre, 60 millions maximum ». La plateforme traduit la phrase en critères, interroge le catalogue et renvoie les biens correspondants avec l'agent à contacter.",
    detail: 'Ville · type · chambres · budget · surface · équipements',
  },
  {
    icon: FileCheck2,
    title: 'Annonces prêtes à publier',
    body:
      "À partir des caractéristiques saisies, une description structurée et un titre sont proposés en français. Un contrôle qualité signale les champs manquants avant la mise en ligne.",
    detail: 'Description · titre · points forts · score de complétude',
  },
  {
    icon: ShieldCheck,
    title: 'Cloisonnement strict des données',
    body:
      "Chaque agence ne voit que son portefeuille, chaque agent que ses dossiers, chaque propriétaire que ses biens. La séparation est appliquée à la source des données, pas seulement dans l'affichage.",
    detail: 'Filtrage en base · contrôle par rôle · journal d’audit',
  },
]

const JOURNEY = [
  { role: 'Agence', text: "Crée son compte, fait valider son inscription, invite ses agents." },
  { role: 'Agent', text: "Enregistre les propriétaires, saisit les biens, publie les annonces." },
  { role: 'Propriétaire', text: "Complète son dossier, suit les visites et l'avancement de la vente." },
  { role: 'Client', text: "Cherche, met en favoris, demande une visite, échange avec l'agent." },
]

export function LandingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data, isLoading } = usePublicProperties({ size: 6, sort: '-created_at' })
  const featured = data?.items ?? []

  // Défilement vers la section ciblée par l'ancre (ex: /#services), que l'on
  // arrive depuis une autre page ou qu'on clique un lien du footer alors
  // qu'on est déjà sur l'accueil.
  useEffect(() => {
    if (!location.hash) return
    const target = document.querySelector(location.hash)
    if (target) {
      requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }, [location.hash])


  function handleSearch(values: SearchValues) {
    const params = new URLSearchParams()
    Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value) })
    navigate(`/biens?${params.toString()}`)
  }

  return (
    <>
      {/* =====================================================
          Hero — la photo est le sujet, la recherche est l'action
          ===================================================== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=70"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-lagoon-900/95 via-lagoon-800/88 to-lagoon-700/78" />
          <div className="absolute inset-0 blueprint opacity-[0.05]" />
          <div className="absolute inset-0 bg-grain opacity-[0.06]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-20 sm:px-6 sm:pt-28 lg:px-8 lg:pb-20 lg:pt-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-brass-500/30 bg-brass-500/10 px-3.5 py-1.5 font-mono text-2xs uppercase tracking-[0.16em] text-brass-300 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Cotonou · Abomey-Calavi · Porto-Novo · Parakou
            </span>

            <h1 className="mt-6 font-display text-[clamp(2.75rem,7vw,5rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-white text-balance">
              Le dossier immobilier,
              <span className="block text-gradient-brass">enfin au même endroit.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75 text-pretty">
              Agences, agents, propriétaires et clients travaillent sur le même bien, du premier
              contact jusqu'à la signature. Chaque prix est justifié, chaque document est tracé.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 max-w-4xl"
          >
            <SearchBar
              onSearch={handleSearch}
              onAskAssistant={(query) => navigate(`/biens?q=${encodeURIComponent(query)}&smart=1`)}
            />
          </motion.div>

          {/* Chiffres : ligne de données, en monospace pour les libellés */}
          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-14 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-white/10 pt-8 sm:grid-cols-4"
          >
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dd className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  <Counter to={stat.value} suffix={stat.suffix} />
                </dd>
                <dt className="mt-1.5 font-mono text-2xs uppercase leading-relaxed tracking-[0.14em] text-white/45">
                  {stat.label}
                </dt>
              </div>
            ))}
          </motion.dl>
        </div>
      </section>

      {/* =====================================================
          Biens en vitrine
          ===================================================== */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow mb-3">Dernières publications</span>
            <h2 className="max-w-lg font-display text-3xl font-semibold tracking-tight text-content text-balance sm:text-4xl">
              Des biens vérifiés, avec l'agent responsable en face
            </h2>
          </div>
          <Button variant="outline" onClick={() => navigate('/biens')} iconRight={<ArrowRight className="h-4 w-4" />}>
            Tout le catalogue
          </Button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => <PropertyCardSkeleton key={index} />)
            : featured.map((property, index) => (
                <PropertyCard key={property.id} property={property} index={index} />
              ))}
        </div>
      </section>

      {/* =====================================================
          Capacités
          ===================================================== */}
      <section id="services" className="border-y border-line bg-surface-2/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="eyebrow mb-3">Ce que fait la plateforme</span>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-content text-balance sm:text-4xl">
              Quatre capacités concrètes, pas des promesses
            </h2>
            <p className="mt-4 text-base leading-relaxed text-content-muted text-pretty">
              Chaque fonction produit un résultat vérifiable et affiche ce sur quoi elle s'appuie.
              Vous pouvez contredire un chiffre : il est toujours accompagné de sa méthode.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {CAPABILITIES.map((capability, index) => {
              const Icon = capability.icon
              return (
                <motion.article
                  key={capability.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="cadastre group rounded-2xl border border-line bg-surface p-7 shadow-card transition-all duration-400 hover:-translate-y-1 hover:shadow-lift"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lagoon-600 text-brass-300 transition-transform duration-400 group-hover:scale-105">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-semibold tracking-tight text-content">
                    {capability.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-content-muted text-pretty">
                    {capability.body}
                  </p>
                  <p className="mt-4 border-t border-line pt-3.5 font-mono text-2xs uppercase tracking-[0.12em] text-content-subtle">
                    {capability.detail}
                  </p>
                </motion.article>
              )
            })}
          </div>
        </div>
      </section>

      {/* =====================================================
          Parcours — ici la numérotation est légitime : c'est
          bien une séquence, chaque étape déverrouille la suivante.
          ===================================================== */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <span className="eyebrow mb-3">Comment ça s'enchaîne</span>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-content text-balance sm:text-4xl">
              Un ordre strict, parce que chaque étape en autorise une autre
            </h2>
            <p className="mt-4 text-base leading-relaxed text-content-muted text-pretty">
              Une agence non validée ne peut pas inviter d'agents. Un bien sans propriétaire vérifié
              ne peut pas être publié. La séquence n'est pas décorative : elle est appliquée.
            </p>

            <div className="mt-8 space-y-5">
              <div className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lagoon-600/10 text-lagoon-600 dark:text-brass-300">
                    <Building2 className="h-4.5 w-4.5" />
                  </span>
                  <h3 className="font-display text-lg font-semibold tracking-tight text-content">
                    Vous dirigez une agence
                  </h3>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-content-muted text-pretty">
                  Créez votre compte, déposez votre RCCM/IFU, invitez vos agents dès validation.
                  Chaque bien publié reste rattaché à un propriétaire vérifié.
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  onClick={() => navigate('/inscription?role=AGENCY')}
                  iconRight={<ArrowRight className="h-4 w-4" />}
                >
                  Inscrire mon agence
                </Button>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brass-500/15 text-brass-600 dark:text-brass-300">
                    <UserSquare2 className="h-4.5 w-4.5" />
                  </span>
                  <h3 className="font-display text-lg font-semibold tracking-tight text-content">
                    Vous possédez un bien à louer ou à vendre
                  </h3>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-content-muted text-pretty">
                  Choisissez une agence sur la plateforme, transmettez vos informations et votre
                  pièce d'identité : elle vérifie votre dossier et vous affecte un agent dédié.
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/inscription-proprietaire')}
                  iconRight={<ArrowRight className="h-4 w-4" />}
                >
                  Confier mes biens
                </Button>
              </div>
            </div>
          </div>

          <ol className="relative space-y-1">
            {/* Ligne de liaison verticale */}
            <span className="absolute left-[27px] top-4 bottom-4 w-px bg-line" aria-hidden="true" />
            {JOURNEY.map((step, index) => (
              <motion.li
                key={step.role}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex gap-5 rounded-2xl p-4 transition-colors hover:bg-surface-2"
              >
                <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface font-mono text-sm font-bold text-brass-600 dark:text-brass-300">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="pt-1.5">
                  <h3 className="font-display text-lg font-semibold tracking-tight text-content">
                    {step.role}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-content-muted text-pretty">{step.text}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* =====================================================
          Témoignages
          ===================================================== */}
      <section id="temoignages" className="border-y border-line bg-surface-2/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <span className="eyebrow mb-3">Ils l'utilisent tous les jours</span>
          <h2 className="max-w-xl font-display text-3xl font-semibold tracking-tight text-content text-balance sm:text-4xl">
            Ce que ça change, dit par ceux qui s'en servent
          </h2>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <motion.figure
                key={testimonial.author}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'flex flex-col rounded-2xl border border-line p-7 shadow-card',
                  index === 1 ? 'bg-lagoon-800 text-white' : 'bg-surface',
                )}
              >
                <Quote className={cn('h-6 w-6', index === 1 ? 'text-brass-400' : 'text-brass-500')} />
                <blockquote
                  className={cn(
                    'mt-4 flex-1 text-[15px] leading-relaxed text-pretty',
                    index === 1 ? 'text-white/85' : 'text-content-muted',
                  )}
                >
                  {testimonial.quote}
                </blockquote>
                <figcaption className="mt-6 border-t pt-4 text-sm"
                  style={{ borderColor: index === 1 ? 'rgba(255,255,255,0.12)' : undefined }}
                >
                  <span className={cn('block font-semibold', index === 1 ? 'text-white' : 'text-content')}>
                    {testimonial.author}
                  </span>
                  <span className={cn('mt-0.5 block font-mono text-2xs uppercase tracking-[0.12em]', index === 1 ? 'text-brass-300' : 'text-content-subtle')}>
                    {testimonial.role} · {testimonial.city}
                  </span>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          Appel à l'action
          ===================================================== */}
      <section id="contact" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-brand-gradient px-7 py-14 sm:px-14 sm:py-20">
          <div className="absolute inset-0 blueprint opacity-[0.06]" />
          <div className="absolute inset-0 bg-grain opacity-[0.05]" />
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brass-500/15 blur-3xl" />

          <div className="relative max-w-2xl">
            <span className="font-mono text-2xs uppercase tracking-[0.18em] text-brass-300">
              Prêt à démarrer
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-white text-balance sm:text-5xl">
              Mettez tout votre portefeuille au même endroit
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-white/70 text-pretty">
              Agence : créez votre compte, invitez votre équipe et publiez vos premiers biens.
              Propriétaire : confiez votre bien à l'agence de votre choix en quelques minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="brass" onClick={() => navigate('/inscription?role=AGENCY')} iconRight={<ArrowRight className="h-4 w-4" />}>
                Inscrire mon agence
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/25 text-white hover:border-brass-400 hover:text-brass-300"
                onClick={() => navigate('/inscription-proprietaire')}
              >
                Confier mes biens
              </Button>
              <Link to="/biens">
                <Button size="lg" variant="outline" className="border-white/25 text-white hover:border-brass-400 hover:text-brass-300">
                  Parcourir les biens
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}