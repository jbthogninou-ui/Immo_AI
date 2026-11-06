import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Building2, Camera, Check, Eye, EyeOff, IdCard, Lock, Mail, MapPin,
  Phone, RefreshCw, Search, ShieldCheck, User,
} from 'lucide-react'
import { Button, Input, Spinner } from '@/components/ui'
import { api } from '@/api/client'
import { errorMessage } from '@/api/client'
import { tokenStorage } from '@/api/client'
import { authApi, documentApi, ownerApi } from '@/api/endpoints'
import { toast } from '@/store/toastStore'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/utils/cn'
import type { Page } from '@/types'

const MAX_DOC_SIZE = 15 * 1024 * 1024 // 15 Mo

interface PublicAgency {
  id: string
  name: string
  slug: string
  city: string | null
  description: string | null
  logo_url: string | null
}

const schema = z
  .object({
    first_name: z.string().min(2, 'Indiquez votre prénom.'),
    last_name: z.string().min(2, 'Indiquez votre nom.'),
    email: z.string().email('Adresse email invalide.'),
    phone: z.string().min(6, 'Indiquez un numéro de téléphone.'),
    city: z.string().optional(),
    address: z.string().optional(),
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
 * Inscription autonome d'un propriétaire (workflow 2).
 *
 * Le propriétaire choisit d'abord l'agence à qui il confie son bien : sans elle,
 * le compte n'aurait aucun rattachement et l'API refuserait l'inscription.
 */
export function OwnerRegisterPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'agency' | 'account' | 'verification'>('agency')
  const [agency, setAgency] = useState<PublicAgency | null>(null)
  const [search, setSearch] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const debounced = useDebounce(search)

  // Nécessaires à l'étape 3 : le compte existe déjà, on garde ses identifiants
  // en mémoire le temps de la session de vérification (jamais persistés).
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null)
  const [ownerId, setOwnerId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['public-agencies', debounced],
    queryFn: () =>
      api
        .get<Page<PublicAgency>>('/public/agencies', {
          params: { q: debounced || undefined, size: 20 },
        })
        .then((response) => response.data),
  })

  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  async function onSubmit(values: Values) {
    if (!agency) return
    try {
      const owner = await ownerApi.selfRegister({
        agency_id: agency.id,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        city: values.city || undefined,
        address: values.address || undefined,
      })
      setOwnerId(owner.id)
      setCredentials({ email: values.email, password: values.password })
      setStep('verification')
    } catch (error) {
      toast.error("L'inscription a échoué", errorMessage(error))
    }
  }

  async function finishVerification() {
    navigate('/connexion')
  }

  /* ---------------------------- Étape 1 : agence --------------------------- */
  if (step === 'agency') {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <span className="eyebrow mb-3">Propriétaire · étape 1 sur 2</span>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-content">
          À quelle agence confiez-vous votre bien ?
        </h1>
        <p className="mt-2 text-content-muted text-pretty">
          C'est elle qui vérifiera votre dossier, publiera vos annonces et vous
          transmettra les demandes de visite.
        </p>

        <div className="mt-7">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher par nom ou par ville"
            icon={<Search className="h-4 w-4" />}
          />
        </div>

        <div className="mt-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (data?.items ?? []).length === 0 ? (
            <p className="rounded-xl border border-line bg-surface-2 p-4 text-sm text-content-muted text-pretty">
              Aucune agence ne correspond. Essayez un autre nom, ou demandez à votre agence
              de vous envoyer une invitation directe.
            </p>
          ) : (
            data!.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setAgency(item); setStep('account') }}
                className={cn(
                  'flex w-full items-center gap-3.5 rounded-xl border p-4 text-left transition-all duration-200',
                  agency?.id === item.id
                    ? 'border-lagoon-600 bg-lagoon-50 dark:bg-lagoon-800/40'
                    : 'border-line bg-surface hover:border-line-strong hover:shadow-card',
                )}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lagoon-600 font-mono text-xs font-bold text-brass-300">
                  {item.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-content">{item.name}</span>
                  {item.city && (
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-content-subtle">
                      <MapPin className="h-3 w-3 text-brass-500" />
                      {item.city}
                    </span>
                  )}
                  {item.description && (
                    <span className="mt-1 block line-clamp-1 text-xs text-content-muted">
                      {item.description}
                    </span>
                  )}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-content-subtle" />
              </button>
            ))
          )}
        </div>

        <p className="mt-7 rounded-xl border border-brass-500/30 bg-brass-500/10 p-4 text-xs leading-relaxed text-content-muted text-pretty">
          <strong className="text-content">Votre agence vous a déjà envoyé un lien ?</strong>{' '}
          Ouvrez-le directement : votre fiche existe déjà, vous n'avez qu'à choisir un mot de
          passe.
        </p>

        <Link
          to="/inscription"
          className="mt-5 flex items-center justify-center gap-2 text-sm font-medium text-content-muted transition-colors hover:text-content"
        >
          <ArrowLeft className="h-4 w-4" />
          Je ne suis pas propriétaire
        </Link>
      </motion.div>
    )
  }

  /* ---------------------------- Étape 2 : compte --------------------------- */
  if (step === 'verification' && ownerId && credentials) {
    return (
      <OwnerIdentityVerificationStep
        agencyName={agency?.name ?? 'Votre agence'}
        ownerId={ownerId}
        credentials={credentials}
        onDone={finishVerification}
      />
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <span className="eyebrow mb-3">Propriétaire · étape 2 sur 2</span>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-content">
        Créez votre compte
      </h1>

      <button
        type="button"
        onClick={() => setStep('agency')}
        className="mt-4 flex w-full items-center gap-3 rounded-xl border border-lagoon-600 bg-lagoon-50 p-3.5 text-left transition-colors hover:bg-lagoon-100 dark:bg-lagoon-800/40 dark:hover:bg-lagoon-800/60"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-lagoon-600 text-brass-300">
          <Building2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">
            Agence choisie
          </span>
          <span className="block truncate text-sm font-semibold text-content">
            {agency?.name}
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-lagoon-600 dark:text-brass-300">
          Changer
        </span>
      </button>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Prénom" icon={<User className="h-4 w-4" />} error={errors.first_name?.message} {...register('first_name')} />
          <Input label="Nom" error={errors.last_name?.message} {...register('last_name')} />
        </div>

        <Input
          label="Adresse email"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.bj"
          icon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Téléphone"
            type="tel"
            placeholder="+229 97 00 00 00"
            icon={<Phone className="h-4 w-4" />}
            error={errors.phone?.message}
            {...register('phone')}
          />
          <Input label="Ville" placeholder="Cotonou" error={errors.city?.message} {...register('city')} />
        </div>

        <Input label="Adresse (facultatif)" placeholder="Carré 1024, Fidjrossè" {...register('address')} />

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
          Créer mon compte propriétaire
        </Button>
      </form>

      {/* Ce qui se passe ensuite : le propriétaire doit savoir qu'une étape reste */}
      <div className="mt-7 rounded-2xl border border-line bg-surface-2 p-5">
        <p className="font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">
          Après l'inscription
        </p>
        <ol className="mt-3 space-y-2.5">
          {[
            "À l'étape suivante, déposez votre pièce d'identité et une photo de votre visage.",
            "L'agence compare visuellement les deux pour confirmer votre identité.",
            'Votre dossier est ensuite vérifié, généralement sous 48 heures.',
            'Vos biens peuvent alors être enregistrés et publiés.',
          ].map((line, index) => (
            <li key={line} className="flex gap-3 text-sm text-content-muted">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lagoon-600 font-mono text-[10px] font-bold text-brass-300">
                {index + 1}
              </span>
              <span className="text-pretty">{line}</span>
            </li>
          ))}
        </ol>
      </div>
    </motion.div>
  )
}

/* ---------------------------- Étape 3 : vérification --------------------------- */
function OwnerIdentityVerificationStep({
  agencyName, ownerId, credentials, onDone,
}: {
  agencyName: string
  ownerId: string
  credentials: { email: string; password: string }
  onDone: () => void
}) {
  const [idFile, setIdFile] = useState<File | null>(null)
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 480, height: 480 },
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraOn(true)
    } catch {
      toast.error(
        'Caméra inaccessible',
        "Autorisez l'accès à la caméra dans votre navigateur, ou revenez plus tard depuis un appareil équipé.",
      )
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  function capture() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      setSelfieBlob(blob)
      setSelfiePreview(URL.createObjectURL(blob))
      stopCamera()
    }, 'image/jpeg', 0.92)
  }

  function retake() {
    if (selfiePreview) URL.revokeObjectURL(selfiePreview)
    setSelfieBlob(null)
    setSelfiePreview(null)
    startCamera()
  }

  async function submit() {
    if (!idFile || !selfieBlob) {
      toast.error('Dossier incomplet', "Ajoutez votre pièce d'identité et une photo de votre visage.")
      return
    }
    setSubmitting(true)
    try {
      // Session temporaire, le temps des deux envois : le compte reste en
      // attente de vérification côté métier tant que l'agence n'a pas validé.
      const tokens = await authApi.login(credentials)
      tokenStorage.set(tokens.access_token, tokens.refresh_token)
      try {
        await documentApi.upload({
          file: idFile, entity_type: 'OWNER', entity_id: ownerId, category: 'IDENTITY_CIP',
        })
        const selfieFile = new File([selfieBlob], 'selfie-verification.jpg', { type: 'image/jpeg' })
        await documentApi.upload({
          file: selfieFile, entity_type: 'OWNER', entity_id: ownerId, category: 'IDENTITY_SELFIE',
        })
      } finally {
        await authApi.logout({ refresh_token: tokenStorage.refresh })
        tokenStorage.clear()
      }
      toast.success('Dossier transmis', `${agencyName} va comparer votre pièce d'identité et votre photo.`)
      onDone()
    } catch (error) {
      toast.error("L'envoi a échoué", errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <span className="eyebrow mb-3 flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" /> Propriétaire · étape 3 sur 3
      </span>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-content">
        Vérifiez votre identité
      </h1>
      <p className="mt-2 text-content-muted text-pretty">
        {agencyName} compare votre pièce d'identité et votre photo pour confirmer que le compte
        vous appartient bien avant de publier vos biens.
      </p>

      <div className="mt-7 space-y-6">
        {/* Pièce d'identité */}
        <div>
          <span className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-content">
            <IdCard className="h-4 w-4" /> Pièce d'identité (CIP, CNI ou passeport)
          </span>
          <label className={cn(
            'flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 transition-colors',
            idFile ? 'border-lagoon-600 bg-lagoon-50 dark:bg-lagoon-800/40' : 'border-line hover:border-line-strong',
          )}>
            {idFile ? (
              <Check className="h-5 w-5 shrink-0 text-lagoon-600" />
            ) : (
              <IdCard className="h-5 w-5 shrink-0 text-content-subtle" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm text-content-muted">
              {idFile ? idFile.name : 'PDF, JPG ou PNG — 15 Mo max'}
            </span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                if (file.size > MAX_DOC_SIZE) {
                  toast.error('Fichier trop lourd', 'Le fichier ne doit pas dépasser 15 Mo.')
                  return
                }
                setIdFile(file)
              }}
            />
          </label>
        </div>

        {/* Selfie */}
        <div>
          <span className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-content">
            <Camera className="h-4 w-4" /> Photo de votre visage
          </span>

          <div className="flex aspect-square w-full max-w-[280px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface-2">
            {selfiePreview ? (
              <img src={selfiePreview} alt="Selfie de vérification" className="h-full w-full object-cover" />
            ) : cameraOn ? (
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-8 w-8 text-content-subtle" />
            )}
          </div>

          <div className="mt-3 flex gap-2.5">
            {!cameraOn && !selfiePreview && (
              <Button type="button" variant="secondary" icon={<Camera className="h-4 w-4" />} onClick={startCamera}>
                Activer la caméra
              </Button>
            )}
            {cameraOn && (
              <Button type="button" onClick={capture}>Prendre la photo</Button>
            )}
            {selfiePreview && (
              <Button type="button" variant="ghost" icon={<RefreshCw className="h-4 w-4" />} onClick={retake}>
                Reprendre
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-content-subtle text-pretty">
            Visage bien visible, sans lunettes de soleil ni couvre-chef, dans un endroit lumineux.
          </p>
        </div>

        <Button size="lg" fullWidth loading={submitting} onClick={submit}>
          Envoyer mon dossier
        </Button>
      </div>
    </motion.div>
  )
}

/** Petit encart de confirmation réutilisable. */
export function OwnerRegisterSuccess({ agencyName }: { agencyName: string }) {
  return (
    <div className="text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lagoon-600 text-brass-300">
        <Check className="h-6 w-6" />
      </span>
      <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-content">
        Compte créé
      </h1>
      <p className="mt-3 text-content-muted text-pretty">
        {agencyName} va vérifier votre dossier.
      </p>
    </div>
  )
}