import { Link, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Quote } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

const HIGHLIGHTS = [
  'Un dossier partagé entre l’agence, l’agent, le propriétaire et le client',
  'Estimation de prix appuyée sur les biens réellement vendus dans le quartier',
  'Chaque action tracée : qui a publié, qui a validé, à quelle heure',
]

/**
 * Gabarit des écrans d'authentification.
 * Colonne gauche : formulaire. Colonne droite : preuve de valeur, visible
 * uniquement à partir de 1024 px pour ne pas encombrer le mobile.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Formulaire */}
      <div className="flex w-full flex-col px-5 py-6 sm:px-10 lg:w-[52%] xl:w-[46%]">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>

        <p className="text-center font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">
          © {new Date().getFullYear()} ImmoFlow AI ·{' '}
          <Link to="/" className="transition-colors hover:text-content">Retour au site</Link>
        </p>
      </div>

      {/* Panneau latéral */}
      <aside className="relative hidden overflow-hidden bg-lagoon-800 lg:flex lg:w-[48%] xl:w-[54%]">
        <div className="absolute inset-0 blueprint opacity-[0.06]" />
        <div className="absolute inset-0 bg-grain opacity-[0.05]" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=60)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-lagoon-800 via-lagoon-800/85 to-lagoon-900/95" />

        <div className="relative flex flex-col justify-between p-12 xl:p-16">
          <div>
            <span className="inline-flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.18em] text-brass-400">
              <span className="h-px w-8 bg-brass-500/60" />
              Bénin · Afrique de l’Ouest
            </span>
            <h2 className="mt-6 max-w-md font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white text-balance xl:text-5xl">
              Le dossier immobilier, enfin au même endroit.
            </h2>
          </div>

          <ul className="my-10 space-y-4">
            {HIGHLIGHTS.map((highlight, index) => (
              <motion.li
                key={highlight}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + index * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex gap-3.5 text-sm leading-relaxed text-white/75"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brass-500" />
                <span className="text-pretty">{highlight}</span>
              </motion.li>
            ))}
          </ul>

          <figure className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <Quote className="h-5 w-5 text-brass-500" />
            <blockquote className="mt-3 text-sm leading-relaxed text-white/80 text-pretty">
              Avant, chaque agent gardait ses dossiers dans son téléphone. Aujourd’hui je vois
              l’état réel du portefeuille en ouvrant mon tableau de bord.
            </blockquote>
            <figcaption className="mt-4 text-xs text-white/50">
              <span className="font-semibold text-white/75">Rodrigue Houngbédji</span> — Directeur,
              Atlantique Immobilier
            </figcaption>
          </figure>
        </div>
      </aside>
    </div>
  )
}
