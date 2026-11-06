import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { ArrowLeft, MailCheck, Mail } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { authApi } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { toast } from '@/store/toastStore'

const schema = z.object({ email: z.string().email('Adresse email invalide.') })
type Values = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } =
    useForm<Values>({ resolver: zodResolver(schema) })

  async function onSubmit(values: Values) {
    try {
      await authApi.forgotPassword(values.email)
      setSent(true)
    } catch (error) {
      toast.error("L'envoi a échoué", errorMessage(error))
    }
  }

  if (sent) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lagoon-600 text-brass-300">
          <MailCheck className="h-6 w-6" />
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-content">
          Vérifiez votre boîte mail
        </h1>
        <p className="mt-3 text-content-muted text-pretty">
          Si un compte existe pour <span className="font-semibold text-content">{getValues('email')}</span>,
          un lien de réinitialisation vient d'être envoyé. Il reste valable une heure.
        </p>
        <Link to="/connexion">
          <Button variant="outline" className="mt-7" icon={<ArrowLeft className="h-4 w-4" />}>
            Retour à la connexion
          </Button>
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <span className="eyebrow mb-3">Mot de passe oublié</span>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-content">
        Réinitialiser votre accès
      </h1>
      <p className="mt-2 text-content-muted text-pretty">
        Indiquez l'adresse associée à votre compte. Vous recevrez un lien pour choisir un nouveau
        mot de passe.
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
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Envoyer le lien
        </Button>
        <Link
          to="/connexion"
          className="flex items-center justify-center gap-2 text-sm font-medium text-content-muted transition-colors hover:text-content"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la connexion
        </Link>
      </form>
    </motion.div>
  )
}
