import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Building2, Eye, EyeOff, FileCheck, Lock, Mail, Phone, User } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { authApi } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const MAX_DOC_SIZE = 25 * 1024 * 1024 // 25 Mo, aligné sur la limite backend

const schema = z
  .object({
    role: z.enum(['CLIENT', 'AGENCY']),
    full_name: z.string().min(3, 'Indiquez votre nom complet.'),
    email: z.string().email('Adresse email invalide.'),
    phone: z.string().optional(),
    agency_name: z.string().optional(),
    agency_document: z.instanceof(FileList).optional(),
    // Une agence ne définit pas de mot de passe à l'inscription : il sera
    // choisi plus tard, via le lien reçu par email une fois le dossier validé.
    password: z.string().optional(),
    confirm: z.string().optional(),
  })
  .refine((values) => values.role !== 'AGENCY' || (values.agency_name?.length ?? 0) >= 2, {
    message: "Indiquez le nom de l'agence.",
    path: ['agency_name'],
  })
  .refine((values) => values.role !== 'AGENCY' || (values.agency_document?.length ?? 0) === 1, {
    message: "Déposez un justificatif (RCCM, IFU ou registre du commerce) pour créer une agence.",
    path: ['agency_document'],
  })
  .refine(
    (values) => (values.agency_document?.[0]?.size ?? 0) <= MAX_DOC_SIZE,
    { message: 'Le fichier ne doit pas dépasser 25 Mo.', path: ['agency_document'] },
  )
  .refine(
    (values) =>
      values.role === 'AGENCY' ||
      (!!values.password &&
        values.password.length >= 8 &&
        /[A-Z]/.test(values.password) &&
        /[a-z]/.test(values.password) &&
        /\d/.test(values.password)),
    {
      message:
        'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre.',
      path: ['password'],
    },
  )
  .refine((values) => values.role === 'AGENCY' || values.password === values.confirm, {
    message: 'Les deux mots de passe ne correspondent pas.',
    path: ['confirm'],
  })

type Values = z.infer<typeof schema>

const ROLES = [
  { value: 'CLIENT' as const, title: 'Je cherche un bien', description: 'Rechercher, mettre en favoris, demander des visites' },
  { value: 'AGENCY' as const, title: 'Je dirige une agence', description: 'Gérer une équipe, un portefeuille et des transactions' },
]

export function RegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  

  const initialRole = params.get('role') === 'AGENCY' ? 'AGENCY' : 'CLIENT'

  const {
    register, handleSubmit, watch, setValue, formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { role: initialRole, full_name: '', email: '', password: '', confirm: '' },
  })

  const role = watch('role')

  async function onSubmit(values: Values) {
    try {
      const user = await authApi.register({
        email: values.email,
        password: values.role === 'AGENCY' ? undefined : values.password,
        full_name: values.full_name,
        phone: values.phone || undefined,
        role: values.role,
        agency_name: values.role === 'AGENCY' ? values.agency_name : undefined,
      })

      // Une agence sans justificatif ne peut de toute façon jamais être validée
      // côté backend : on dépose le document tout de suite, dans le même parcours,
      // plutôt que de laisser l'utilisateur revenir plus tard (et souvent jamais).
      // Le compte n'a pas de mot de passe à ce stade : le dépôt se fait via le
      // jeton temporaire renvoyé par l'inscription, pas via une session connectée.
      if (values.role === 'AGENCY') {
        const file = values.agency_document?.[0]
        if (!file) throw new Error('Justificatif manquant.')
        if (!user.agency_upload_token) throw new Error('Jeton de dépôt manquant.')

        await authApi.uploadAgencyRegistrationDocument({
          file,
          token: user.agency_upload_token,
        })

        navigate('/inscription/confirmation', { state: { email: values.email } })
        return
      }

      toast.success('Compte créé', 'Vous pouvez vous connecter dès maintenant.')
      navigate('/connexion')
    } catch (error) {
      toast.error("L'inscription a échoué", errorMessage(error))
    }
  }

  

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="eyebrow mb-3">Inscription</span>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-content">
        Créez votre compte
      </h1>
      <p className="mt-2 text-content-muted">
        Déjà inscrit ?{' '}
        <Link to="/connexion" className="font-semibold text-lagoon-600 transition-colors hover:text-lagoon-700 dark:text-brass-300">
          Se connecter
        </Link>
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        {/* Choix du profil : détermine tout le parcours qui suit */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          {ROLES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setValue('role', option.value)}
              className={cn(
                'rounded-xl border p-4 text-left transition-all duration-200',
                role === option.value
                  ? 'border-lagoon-600 bg-lagoon-50 shadow-card dark:bg-lagoon-800/40'
                  : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg',
                role === option.value ? 'bg-lagoon-600 text-brass-300' : 'bg-surface-2 text-content-muted',
              )}>
                {option.value === 'AGENCY' ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </span>
              <span className="mt-3 block text-sm font-semibold text-content">{option.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-content-muted">
                {option.description}
              </span>
            </button>
          ))}
        </div>

        <Input
          label="Nom complet"
          placeholder="Prénom et nom"
          icon={<User className="h-4 w-4" />}
          error={errors.full_name?.message}
          {...register('full_name')}
        />

        {role === 'AGENCY' && (
          <>
            <Input
              label="Nom de l'agence"
              placeholder="Atlantique Immobilier"
              icon={<Building2 className="h-4 w-4" />}
              error={errors.agency_name?.message}
              hint="Ce nom apparaîtra sur toutes vos annonces."
              {...register('agency_name')}
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-content">
                Justificatif de l'agence
              </label>
              <div className={cn(
                'flex items-center gap-3 rounded-xl border border-dashed p-3.5 transition-colors',
                errors.agency_document ? 'border-red-500/60' : 'border-line',
              )}>
                <FileCheck className="h-5 w-5 shrink-0 text-content-subtle" />
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="w-full text-sm text-content-muted file:mr-3 file:rounded-lg file:border-0 file:bg-lagoon-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brass-300"
                  {...register('agency_document')}
                />
              </div>
              {errors.agency_document?.message && (
                <p className="mt-1.5 text-xs text-red-500">{errors.agency_document.message}</p>
              )}
              <p className="mt-1.5 text-xs leading-relaxed text-content-subtle">
                RCCM, IFU ou registre du commerce — PDF ou photo lisible, 25 Mo max.
                Obligatoire : aucune agence n'est validée sans ce document.
              </p>
            </div>
          </>
        )}

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
          label="Téléphone (facultatif)"
          type="tel"
          placeholder="+229 97 00 00 00"
          icon={<Phone className="h-4 w-4" />}
          error={errors.phone?.message}
          {...register('phone')}
        />

        {role !== 'AGENCY' && (
          <>
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
          </>
        )}

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Créer mon compte
        </Button>

        {role === 'AGENCY' && (
          <p className="rounded-xl border border-brass-500/30 bg-brass-500/10 p-3.5 text-xs leading-relaxed text-content-muted text-pretty">
            Les comptes agence sont vérifiés avant activation — pas de mot de passe à cette étape.
            Une fois votre dossier validé, vous recevrez un email pour finaliser votre inscription
            et définir votre mot de passe.
          </p>
        )}
      </form>
    </motion.div>
  )
}