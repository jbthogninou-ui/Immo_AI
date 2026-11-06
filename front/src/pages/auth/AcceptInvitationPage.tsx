import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Check, Eye, EyeOff, Lock, ShieldAlert } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { authApi, ownerApi } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { toast } from '@/store/toastStore'

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
      .regex(/[A-Z]/, 'Ajoutez au moins une majuscule.')
      .regex(/[a-z]/, 'Ajoutez au moins une minuscule.')
      .regex(/\d/, 'Ajoutez au moins un chiffre.'),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'Les deux mots de passe ne correspondent pas.',
    path: ['confirm'],
  })

type Values = z.infer<typeof schema>

/**
 * Activation d'un compte créé par invitation (workflow 1).
 *
 * Sert aux agents comme aux propriétaires : le paramètre `type` de l'URL
 * détermine l'endpoint appelé. Par défaut, on suppose un agent — c'est le lien
 * que le backend génère depuis `/agents`.
 */
export function AcceptInvitationPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)

  const { pathname } = useLocation()
  const token = params.get('token')
  // Le backend envoie les propriétaires sur /owner/onboarding et les agents sur
  // /accept-invitation. On accepte les deux formes, plus le paramètre ?type=.
  const kind =
    params.get('type') === 'owner' || pathname.includes('owner') || pathname.includes('proprietaire')
      ? 'owner'
      : params.get('type') === 'agency'
        ? 'agency'
        : 'agent'

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Values>({ resolver: zodResolver(schema) })

  async function onSubmit(values: Values) {
    if (!token) return
    try {
      if (kind === 'owner') {
        await ownerApi.acceptInvitation({ token, password: values.password })
        toast.success(
          'Compte activé',
          "Connectez-vous, puis déposez votre pièce d'identité pour finaliser votre dossier.",
        )
      } else if (kind === 'agency') {
        await authApi.acceptInvitation({ token, password: values.password })
        toast.success('Compte activé', 'Votre agence est prête. Vous pouvez vous connecter.')
      } else {
        await authApi.acceptInvitation({ token, password: values.password })
        toast.success('Compte activé', 'Vous pouvez maintenant vous connecter.')
      }
      navigate('/connexion')
    } catch (error) {
      toast.error("L'activation a échoué", errorMessage(error))
    }
  }

  if (!token) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-laterite-500/15 text-laterite-500">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-content">
          Lien d'invitation incomplet
        </h1>
        <p className="mt-3 text-content-muted text-pretty">
          Ce lien ne contient pas de jeton d'activation. Ouvrez-le directement depuis l'email
          reçu, sans le recopier à la main.
        </p>
        <Link to="/connexion">
          <Button variant="outline" className="mt-7">Retour à la connexion</Button>
        </Link>
      </motion.div>
    )
  }

  const isOwner = kind === 'owner'
  const isAgency = kind === 'agency'

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <span className="eyebrow mb-3">
        {isOwner ? 'Invitation propriétaire' : isAgency ? 'Validation d\u2019agence' : 'Invitation agent'}
      </span>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-content">
        {isAgency ? 'Finalisez votre inscription' : 'Activez votre compte'}
      </h1>
      <p className="mt-2 text-content-muted text-pretty">
        {isOwner
          ? "Votre agence a créé votre fiche. Choisissez un mot de passe pour accéder à votre espace."
          : isAgency
            ? "Votre agence a été validée. Choisissez un mot de passe pour accéder à votre espace."
            : "Votre agence vous a invité à rejoindre son équipe. Choisissez un mot de passe pour commencer."}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        <Input
          label="Mot de passe"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          icon={<Lock className="h-4 w-4" />}
          error={errors.password?.message}
          hint="8 caractères minimum, avec majuscule, minuscule et chiffre."
          suffix={
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Masquer' : 'Afficher'}
              className="pointer-events-auto text-content-subtle transition-colors hover:text-content"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          {...register('password')}
        />
        <Input
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          icon={<Lock className="h-4 w-4" />}
          error={errors.confirm?.message}
          {...register('confirm')}
        />

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          {isAgency ? 'Finaliser mon inscription' : 'Activer mon compte'}
        </Button>
      </form>

      {isOwner && (
        <div className="mt-7 rounded-2xl border border-line bg-surface-2 p-5">
          <p className="font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">
            Étape suivante
          </p>
          <p className="mt-2.5 flex gap-3 text-sm text-content-muted text-pretty">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-lagoon-500" />
            Déposez votre pièce d'identité depuis l'espace Documents. Sans elle, l'agence ne
            peut pas valider votre dossier ni rattacher vos biens.
          </p>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-content-muted">
        Lien expiré ?{' '}
        <Link to="/connexion" className="font-semibold text-lagoon-600 dark:text-brass-300">
          Demandez-en un nouveau à votre agence
        </Link>
      </p>
    </motion.div>
  )
}