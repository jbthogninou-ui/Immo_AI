import { useState } from 'react'
import { Building2, Lock, Monitor, Moon, Sun, User } from 'lucide-react'
import {
  Avatar, Badge, Button, Card, CardHeader, Input, Switch, Tab, TabList, Tabs, Textarea,
} from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { useAgencyMutations, useMyAgency } from '@/hooks/useQueries'
import { useUIStore } from '@/store/uiStore'
import { authApi } from '@/api/endpoints'
import { errorMessage } from '@/api/client'
import { toast } from '@/store/toastStore'
import { ROLE_LABEL } from '@/utils/constants'
import { cn } from '@/utils/cn'

/** Profil, agence, sécurité et préférences d'affichage. */
export function SettingsPage() {
  const { user, refreshProfile, isAgency, isAgent, isSuperAdmin } = useAuth()
  const { theme, setTheme } = useUIStore()
  const [tab, setTab] = useState('profil')

  const showAgency = isAgency || isAgent
  const { data: agency } = useMyAgency(showAgency)
  const { update: updateAgency } = useAgencyMutations()

  const [profile, setProfile] = useState({
    full_name: user?.full_name ?? '',
    phone: user?.phone ?? '',
  })
  const [savingProfile, setSavingProfile] = useState(false)

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [savingPassword, setSavingPassword] = useState(false)

  const [agencyForm, setAgencyForm] = useState<Record<string, any>>({})
  const agencyValue = (field: string) => agencyForm[field] ?? (agency as any)?.[field] ?? ''

  async function saveProfile() {
    setSavingProfile(true)
    try {
      await authApi.updateProfile({ full_name: profile.full_name, phone: profile.phone || null })
      await refreshProfile()
      toast.success('Profil mis à jour')
    } catch (error) {
      toast.error('Mise à jour impossible', errorMessage(error))
    } finally {
      setSavingProfile(false)
    }
  }

  async function changePassword() {
    if (passwords.next !== passwords.confirm) {
      toast.error('Mots de passe différents', 'La confirmation ne correspond pas.')
      return
    }
    if (passwords.next.length < 8) {
      toast.error('Mot de passe trop court', '8 caractères minimum, avec majuscule, minuscule et chiffre.')
      return
    }
    setSavingPassword(true)
    try {
      await authApi.changePassword({
        current_password: passwords.current,
        new_password: passwords.next,
      })
      setPasswords({ current: '', next: '', confirm: '' })
      toast.success('Mot de passe modifié', 'Vos autres sessions ont été fermées.')
    } catch (error) {
      toast.error('Changement refusé', errorMessage(error))
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Compte"
        title="Paramètres"
        description="Votre profil, la fiche de votre agence, votre mot de passe et vos préférences d'affichage."
      />

      <Tabs value={tab} onChange={setTab}>
        <TabList className="mb-5">
          <Tab value="profil">Profil</Tab>
          {showAgency && <Tab value="agence">Agence</Tab>}
          <Tab value="securite">Sécurité</Tab>
          <Tab value="affichage">Affichage</Tab>
        </TabList>

        {tab === 'profil' && (
          <Card className="max-w-2xl">
            <CardHeader eyebrow="Identité" title="Mon profil" />
            <div className="space-y-5 p-5">
              <div className="flex items-center gap-4">
                <Avatar name={user?.full_name} src={user?.avatar_url} size="xl" />
                <div>
                  <p className="font-display text-lg font-semibold tracking-tight text-content">
                    {user?.full_name}
                  </p>
                  <p className="text-sm text-content-muted">{user?.email}</p>
                  <Badge tone="brass" size="sm" className="mt-1.5">
                    {user ? ROLE_LABEL[user.role] : ''}
                  </Badge>
                </div>
              </div>

              <Input
                label="Nom complet"
                value={profile.full_name}
                onChange={(event) => setProfile({ ...profile, full_name: event.target.value })}
                icon={<User className="h-4 w-4" />}
              />
              <Input
                label="Téléphone"
                value={profile.phone}
                onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                placeholder="+229 97 00 00 00"
              />
              <Input
                label="Adresse email"
                value={user?.email ?? ''}
                disabled
                hint="L'adresse email sert d'identifiant de connexion et ne peut pas être modifiée ici."
              />

              <Button loading={savingProfile} onClick={saveProfile}>
                Enregistrer les modifications
              </Button>
            </div>
          </Card>
        )}

        {tab === 'agence' && showAgency && (
          <Card className="max-w-2xl">
            <CardHeader
              eyebrow="Organisation"
              title="Fiche de l'agence"
              subtitle={isAgent ? 'Consultation seule — seul le dirigeant peut modifier ces informations.' : undefined}
            />
            <div className="space-y-5 p-5">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lagoon-600 font-mono text-lg font-bold text-brass-300">
                  {agency?.name.slice(0, 2).toUpperCase() ?? '—'}
                </span>
                <div>
                  <p className="font-display text-lg font-semibold tracking-tight text-content">
                    {agency?.name ?? '—'}
                  </p>
                  <p className="font-mono text-2xs text-content-subtle">{agency?.slug}</p>
                </div>
              </div>

              <Input label="Nom de l'agence" value={agencyValue('name')} disabled={isAgent} onChange={(event) => setAgencyForm({ ...agencyForm, name: event.target.value })} icon={<Building2 className="h-4 w-4" />} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Email de contact" value={agencyValue('email')} disabled={isAgent} onChange={(event) => setAgencyForm({ ...agencyForm, email: event.target.value })} />
                <Input label="Téléphone" value={agencyValue('phone')} disabled={isAgent} onChange={(event) => setAgencyForm({ ...agencyForm, phone: event.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Adresse" value={agencyValue('address')} disabled={isAgent} onChange={(event) => setAgencyForm({ ...agencyForm, address: event.target.value })} />
                <Input label="Ville" value={agencyValue('city')} disabled={isAgent} onChange={(event) => setAgencyForm({ ...agencyForm, city: event.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Numéro RCCM" value={agencyValue('registration_number')} disabled={isAgent} onChange={(event) => setAgencyForm({ ...agencyForm, registration_number: event.target.value })} />
                <Input label="Identifiant fiscal" value={agencyValue('tax_id')} disabled={isAgent} onChange={(event) => setAgencyForm({ ...agencyForm, tax_id: event.target.value })} />
              </div>
              <Textarea label="Description" rows={4} value={agencyValue('description')} disabled={isAgent} onChange={(event) => setAgencyForm({ ...agencyForm, description: event.target.value })} hint="Ce texte apparaît sur les fiches de vos biens." />

              {!isAgent && (
                <Button
                  loading={updateAgency.isPending}
                  onClick={() => {
                    if (!agency) return
                    updateAgency.mutate({ id: agency.id, payload: agencyForm })
                  }}
                >
                  Enregistrer la fiche
                </Button>
              )}
            </div>
          </Card>
        )}

        {tab === 'securite' && (
          <Card className="max-w-2xl">
            <CardHeader eyebrow="Accès" title="Mot de passe" subtitle="Le changement ferme toutes vos autres sessions." />
            <div className="space-y-5 p-5">
              <Input
                label="Mot de passe actuel"
                type="password"
                autoComplete="current-password"
                value={passwords.current}
                onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
                icon={<Lock className="h-4 w-4" />}
              />
              <Input
                label="Nouveau mot de passe"
                type="password"
                autoComplete="new-password"
                value={passwords.next}
                onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
                icon={<Lock className="h-4 w-4" />}
                hint="8 caractères minimum, avec majuscule, minuscule et chiffre."
              />
              <Input
                label="Confirmer le nouveau mot de passe"
                type="password"
                autoComplete="new-password"
                value={passwords.confirm}
                onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                icon={<Lock className="h-4 w-4" />}
              />
              <Button loading={savingPassword} onClick={changePassword}>
                Modifier le mot de passe
              </Button>
            </div>
          </Card>
        )}

        {tab === 'affichage' && (
          <Card className="max-w-2xl">
            <CardHeader eyebrow="Préférences" title="Affichage" />
            <div className="space-y-5 p-5">
              <div>
                <span className="mb-2.5 block text-sm font-semibold text-content">Thème</span>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {[
                    { value: 'light' as const, label: 'Clair', icon: Sun, description: 'Fond sable, contraste élevé' },
                    { value: 'dark' as const, label: 'Sombre', icon: Moon, description: 'Fond lagune profonde, confort du soir' },
                  ].map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.value}
                        onClick={() => setTheme(option.value)}
                        className={cn(
                          'rounded-xl border p-4 text-left transition-all duration-200',
                          theme === option.value
                            ? 'border-lagoon-600 bg-lagoon-50 shadow-card dark:bg-lagoon-800/40'
                            : 'border-line bg-surface hover:border-line-strong',
                        )}
                      >
                        <span className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-lg',
                          theme === option.value ? 'bg-lagoon-600 text-brass-300' : 'bg-surface-2 text-content-muted',
                        )}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="mt-3 block text-sm font-semibold text-content">{option.label}</span>
                        <span className="mt-0.5 block text-xs text-content-muted">{option.description}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-2 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-content">
                  <Monitor className="h-4 w-4 text-brass-500" />
                  Assistant immobilier
                </p>
                <p className="mt-1 text-xs text-content-muted text-pretty">
                  Le raccourci <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-2xs">Ctrl</kbd>{' '}
                  + <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-2xs">K</kbd> ouvre
                  l'assistant depuis n'importe quel écran.
                </p>
              </div>
            </div>
          </Card>
        )}
      </Tabs>
    </div>
  )
}
