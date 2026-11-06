import { Link } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'
import { Button } from '@/components/ui'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-lagoon-600 text-brass-300">
        <Compass className="h-7 w-7" />
      </span>
      <p className="mt-6 font-mono text-2xs uppercase tracking-[0.18em] text-content-subtle">
        Erreur 404
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-content">
        Cette page n'existe pas
      </h1>
      <p className="mt-3 text-content-muted text-pretty">
        Le lien est peut-être obsolète, ou le bien que vous cherchiez a été retiré du catalogue.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link to="/">
          <Button icon={<ArrowLeft className="h-4 w-4" />}>Retour à l'accueil</Button>
        </Link>
        <Link to="/biens">
          <Button variant="outline">Parcourir le catalogue</Button>
        </Link>
      </div>
    </div>
  )
}
