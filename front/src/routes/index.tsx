import { Navigate, Route, Routes } from 'react-router-dom'

import { PublicLayout } from '@/layouts/PublicLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { ProtectedRoute, GuestRoute } from './ProtectedRoute'

import { LandingPage } from '@/pages/public/LandingPage'
import { CatalogPage } from '@/pages/public/CatalogPage'
import { PropertyDetailPage } from '@/pages/public/PropertyDetailPage'

import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { OwnerRegisterPage } from '@/pages/auth/OwnerRegisterPage'
import { AcceptInvitationPage } from '@/pages/auth/AcceptInvitationPage'

import { OverviewPage } from '@/pages/dashboard/OverviewPage'
import { PropertiesPage } from '@/pages/dashboard/PropertiesPage'
import { AgenciesPage } from '@/pages/dashboard/AgenciesPage'
import { UsersPage } from '@/pages/dashboard/UsersPage'
import { StatisticsPage } from '@/pages/dashboard/StatisticsPage'
import { AuditLogsPage } from '@/pages/dashboard/AuditLogsPage'
import { AgentsPage } from '@/pages/dashboard/AgentsPage'
import { OwnersPage } from '@/pages/dashboard/OwnersPage'
import { ClientsPage } from '@/pages/dashboard/ClientsPage'
import { VisitsPage } from '@/pages/dashboard/VisitsPage'
import { TransactionsPage } from '@/pages/dashboard/TransactionsPage'
import { ContractsPage } from '@/pages/dashboard/ContractsPage'
import { DocumentsPage } from '@/pages/dashboard/DocumentsPage'
import { MessagesPage } from '@/pages/dashboard/MessagesPage'
import { AssistantPage } from '@/pages/dashboard/AssistantPage'
import { NotificationsPage } from '@/pages/dashboard/NotificationsPage'
import { FavoritesPage } from '@/pages/dashboard/FavoritesPage'
import { HistoryPage } from '@/pages/dashboard/HistoryPage'
import { RequestsPage } from '@/pages/dashboard/RequestsPage'
import { SettingsPage } from '@/pages/dashboard/SettingsPage'

import { NotFoundPage } from '@/pages/NotFoundPage'
import type { UserRole } from '@/types'
import { RegistrationPendingPage } from '@/pages/auth/RegistrationPendingPage'
/** Gabarit protégé, avec restriction de rôles. */
function Workspace({ roles }: { roles: UserRole[] }) {
  return (
    <ProtectedRoute roles={roles}>
      <DashboardLayout />
    </ProtectedRoute>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      {/* ------------------------- Site public ------------------------- */}
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="biens" element={<CatalogPage />} />
        <Route path="biens/:id" element={<PropertyDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* ---------------------- Authentification ----------------------- */}
      <Route element={<GuestRoute><AuthLayout /></GuestRoute>}>
        <Route path="connexion" element={<LoginPage />} />
        <Route path="inscription" element={<RegisterPage />} />
        <Route path="mot-de-passe-oublie" element={<ForgotPasswordPage />} />
        <Route path="reinitialiser-mot-de-passe" element={<ResetPasswordPage />} />
        <Route path="inscription-proprietaire" element={<OwnerRegisterPage />} />
        <Route path="activer-mon-compte" element={<AcceptInvitationPage />} />

        {/* Alias : chemins réellement présents dans les emails envoyés par
            l'API. Les renommer côté backend casserait les liens déjà partis. */}
        <Route path="accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="owner/onboarding" element={<AcceptInvitationPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* ---------------------- Profil (tous rôles) -------------------- */}
      <Route
        path="profil"
        element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}
      >
        <Route index element={<SettingsPage />} />
      </Route>

      <Route
        path="notifications"
        element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}
      >
        <Route index element={<NotificationsPage />} />
      </Route>

      {/* -------------------------- Super Admin ------------------------ */}
      <Route path="admin" element={<Workspace roles={['SUPER_ADMIN']} />}>
        <Route index element={<OverviewPage />} />
        <Route path="statistiques" element={<StatisticsPage />} />
        <Route path="agences" element={<AgenciesPage />} />
        <Route path="utilisateurs" element={<UsersPage />} />
        <Route path="audit" element={<AuditLogsPage />} />
        <Route path="parametres" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>

      {/* ---------------------------- Agence --------------------------- */}
      <Route path="agence" element={<Workspace roles={['AGENCY']} />}>
        <Route index element={<OverviewPage />} />
        <Route path="biens" element={<PropertiesPage />} />
        <Route path="proprietaires" element={<OwnersPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="visites" element={<VisitsPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="contrats" element={<ContractsPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="demandes" element={<RequestsPage />} />
        <Route path="parametres" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/agence" replace />} />
      </Route>

      {/* ----------------------------- Agent --------------------------- */}
      <Route path="agent" element={<Workspace roles={['AGENT']} />}>
        <Route index element={<OverviewPage />} />
        <Route path="biens" element={<PropertiesPage />} />
        <Route path="proprietaires" element={<OwnersPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="visites" element={<VisitsPage />} />
        <Route path="ventes" element={<TransactionsPage />} />
        <Route path="locations" element={<TransactionsPage />} />
        <Route path="contrats" element={<ContractsPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="parametres" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/agent" replace />} />
      </Route>

      {/* -------------------------- Propriétaire ----------------------- */}
      <Route path="proprietaire" element={<Workspace roles={['OWNER']} />}>
        <Route index element={<OverviewPage />} />
        <Route path="biens" element={<PropertiesPage />} />
        <Route path="visites" element={<VisitsPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="parametres" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/proprietaire" replace />} />
      </Route>

      {/* ----------------------------- Client -------------------------- */}
      <Route path="espace-client" element={<Workspace roles={['CLIENT']} />}>
        <Route index element={<OverviewPage />} />
        <Route path="recherche" element={<PropertiesPage />} />
        <Route path="favoris" element={<FavoritesPage />} />
        <Route path="historique" element={<HistoryPage />} />
        <Route path="demandes" element={<RequestsPage />} />
        <Route path="visites" element={<VisitsPage />} />
        <Route path="contrats" element={<ContractsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="parametres" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/espace-client" replace />} />
      </Route>
      <Route path="inscription" element={<RegisterPage />} />
      <Route path="inscription/confirmation" element={<RegistrationPendingPage />} />
    </Routes>
  )
}
