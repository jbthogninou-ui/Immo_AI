import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, ShieldAlert } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { authApi } from '@/api/endpoints'
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

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const token = params.get('token')

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Values>({ resolver: zodResolver(schema) })

  async function onSubmit(values: Values) {
    if (!token) return
    try {
      await authApi.resetPassword({ token, new_password: values.password })
      toast.success('Mot de passe modifié', 'Connectez-vous avec votre nouveau mot de passe.')
      navigate('/connexion')
    } catch (error) {
      toast.error('Réinitialisation impossible', errorMessage(error))
    }
  }

  if (!token) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-laterite-500/15 text-laterite-500">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-content">
          Lien invalide ou expiré
        </h1>
        <p className="mt-3 text-content-muted text-pretty">
          Ce lien de réinitialisation n'est plus valable. Demandez-en un nouveau depuis la page de
          connexion.
        </p>
        <Link to="/mot-de-passe-oublie">
          <Button className="mt-7">Demander un nouveau lien</Button>
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <span className="eyebrow mb-3">Nouveau mot de passe</span>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-content">
        Choisissez un nouveau mot de passe
      </h1>
      <p className="mt-2 text-content-muted">
        Toutes vos sessions ouvertes seront fermées après le changement.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        <Input
          label="Nouveau mot de passe"
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
          Enregistrer le nouveau mot de passe
        </Button>
      </form>
    </motion.div>
  )
}
