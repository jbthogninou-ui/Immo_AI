import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui'

interface LocationState {
  email?: string
}

/**
 * Écran d'attente affiché juste après l'inscription d'une agence, une fois
 * son dossier (infos + justificatif) transmis. Route dédiée (et non un état
 * local dans RegisterPage) pour avoir une URL propre, rechargeable et
 * partageable.
 */
export function RegistrationPendingPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const email = (location.state as LocationState | null)?.email

  // Accès direct à l'URL sans être passé par le formulaire d'inscription :
  // on n'a pas d'email à afficher, mais le message reste valable.
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="text-center"
    >
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lagoon-600 text-brass-300">
        <MailCheck className="h-6 w-6" />
      </span>
      <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-content">
        Merci, veuillez patienter
      </h1>
      <p className="mt-3 text-content-muted text-pretty">
        Votre dossier (agence + justificatif) a été transmis pour la confirmation de votre
        compte.{' '}
        {email ? (
          <>
            Une fois votre dossier validé, vous recevrez un email à{' '}
            <span className="font-semibold text-content">{email}</span> avec un lien pour
            finaliser votre inscription et définir votre mot de passe.
          </>
        ) : (
          "Une fois votre dossier validé, vous recevrez un email avec un lien pour finaliser votre inscription et définir votre mot de passe."
        )}
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <Button variant="outline" onClick={() => navigate('/connexion')}>
          Retour à la connexion
        </Button>
      </div>
      <p className="mt-6 text-sm text-content-muted">
        Un souci avec votre dossier ?{' '}
        <Link to="/inscription" className="font-semibold text-lagoon-600 dark:text-brass-300">
          Recommencer l'inscription
        </Link>
      </p>
    </motion.div>
  )
}