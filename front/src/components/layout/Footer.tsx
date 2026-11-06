import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone } from 'lucide-react'
import { Logo } from './Logo'

const COLUMNS = [
  {
    title: 'Explorer',
    links: [
      { label: 'Catalogue des biens', to: '/biens' },
      { label: 'Biens à vendre', to: '/biens?listing_type=SALE' },
      { label: 'Biens à louer', to: '/biens?listing_type=RENT' },
    ],
  },
  {
    title: 'Professionnels',
    links: [
      { label: 'Inscrire mon agence', to: '/inscription?role=AGENCY' },
      { label: 'Espace agence', to: '/connexion' },
      { label: 'Confier un bien', to: '/inscription-proprietaire' },
    ],
  },
  {
    title: 'Ressources',
    links: [
      { label: 'Comment ça marche', to: '/#services' },
      { label: 'Témoignages', to: '/#temoignages' },
      { label: 'Nous contacter', to: '/#contact' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-line bg-lagoon-800 text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo invert />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60 text-pretty">
              Agences, agents, propriétaires et clients travaillent sur le même dossier immobilier,
              du premier contact jusqu'à la signature.
            </p>
            <div className="mt-6 space-y-2.5 text-sm text-white/60">
              <p className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 text-brass-500" />
                Haie Vive, Cotonou — Bénin
              </p>
              <p className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-brass-500" />
                +229 54 24 57 17
              </p>
              <p className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-brass-500" />
                contact@immoflow.ai
              </p>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="font-mono text-2xs uppercase tracking-[0.18em] text-brass-400">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="link-underline text-sm text-white/60 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-2xs uppercase tracking-[0.14em] text-white/35">
            © {new Date().getFullYear()} ImmoFlow AI — Tous droits réservés
          </p>
          <div className="flex gap-5 text-xs text-white/45">
            <Link to="/#" className="transition-colors hover:text-white">Mentions légales</Link>
            <Link to="/#" className="transition-colors hover:text-white">Confidentialité</Link>
            <Link to="/#" className="transition-colors hover:text-white">CGU</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}