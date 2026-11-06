import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, Mail, Users } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { errorMessage, DEMO_MODE } from '@/api/client'
import { toast } from '@/store/toastStore'
import { homeRouteFor } from '@/utils/permissions'
import { DEMO_ACCOUNTS } from '@/mocks/data'

const schema = z.object({
  email: z.string().min(1, 'Renseignez votre adresse email.').email('Adresse email invalide.'),
  password: z.string().min(1, 'Renseignez votre mot de passe.'),
})

type Values = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register, handleSubmit, setValue, formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })

  async function onSubmit(values: Values) {
    try {
      const user = await login(values.email, values.password)
      toast.success(`Bienvenue, ${user.full_name.split(' ')[0]}`)
      navigate(params.get('next') ?? homeRouteFor(user.role), { replace: true })
    } catch (error) {
      toast.error('Connexion refusée', errorMessage(error))
    }
  }

  /** Remplit le formulaire avec un compte de démonstration. */
  function useDemoAccount(email: string) {
    setValue('email', email)
    setValue('password', 'demo')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="eyebrow mb-3">Connexion</span>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-content">
        Reprenez où vous en étiez
      </h1>
      <p className="mt-2 text-content-muted">
        Pas encore de compte ?{' '}
        <Link to="/inscription" className="font-semibold text-lagoon-600 transition-colors hover:text-lagoon-700 dark:text-brass-300">
          Créer un compte
        </Link>
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        <Input
          label="Adresse email"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.bj"
          icon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Mot de passe"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          icon={<Lock className="h-4 w-4" />}
          error={errors.password?.message}
          suffix={
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className="pointer-events-auto text-content-subtle transition-colors hover:text-content"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          {...register('password')}
        />

        <div className="flex justify-end">
          <Link
            to="/mot-de-passe-oublie"
            className="text-sm font-medium text-content-muted transition-colors hover:text-lagoon-600 dark:hover:text-brass-300"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Se connecter
        </Button>
      </form>

      {/* Comptes de démonstration — visibles uniquement en mode démo */}
      {DEMO_MODE && (
        <div className="mt-8 rounded-2xl border border-line bg-surface-2 p-4">
          <p className="flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">
            <Users className="h-3.5 w-3.5" />
            Comptes de démonstration
          </p>
          <div className="mt-3 space-y-1.5">
            {Object.entries(DEMO_ACCOUNTS).map(([email, account]) => (
              <button
                key={email}
                type="button"
                onClick={() => useDemoAccount(email)}
                className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-surface px-3 py-2.5 text-left transition-colors hover:border-brass-500"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lagoon-600 font-mono text-2xs font-bold text-brass-300">
                  {account.label.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-content">{account.label}</span>
                  <span className="block truncate text-xs text-content-subtle">{account.description}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-2xs text-content-subtle">
            Cliquez sur un profil puis sur « Se connecter ». N'importe quel mot de passe est accepté.
          </p>
        </div>
      )}
    </motion.div>
  )
}
