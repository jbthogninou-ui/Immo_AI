import {
  BarChart3, Bell, Building2, CalendarCheck, ClipboardList, FileSignature, FileText, Handshake,
  Heart, History, Home, KeyRound, LayoutDashboard, MessageSquare, Search, Settings,
  ScrollText, Sparkles, Users, UserSquare2,
} from 'lucide-react'
import type { UserRole } from '@/types'

export interface NavItem {
  label: string
  to: string
  icon: typeof Home
  /** Regroupement affiché en surtitre dans la barre latérale. */
  section?: string
  end?: boolean
}

/**
 * Navigation par rôle.
 *
 * Les libellés sont écrits du point de vue de la personne : un agent voit
 * « Mes biens », une agence voit « Biens » — c'est la même page, mais le
 * périmètre des données diffère et le vocabulaire doit le refléter.
 */
export const NAVIGATION: Record<UserRole, NavItem[]> = {
  SUPER_ADMIN: [
    { label: 'Tableau de bord', to: '/admin', icon: LayoutDashboard, end: true, section: 'Pilotage' },
    { label: 'Statistiques', to: '/admin/statistiques', icon: BarChart3, section: 'Pilotage' },
    { label: 'Agences', to: '/admin/agences', icon: Building2, section: 'Plateforme' },
    { label: 'Utilisateurs', to: '/admin/utilisateurs', icon: Users, section: 'Plateforme' },
    { label: 'Journal d’audit', to: '/admin/audit', icon: ScrollText, section: 'Conformité' },
    { label: 'Paramètres', to: '/admin/parametres', icon: Settings, section: 'Conformité' },
  ],

  AGENCY: [
    { label: 'Tableau de bord', to: '/agence', icon: LayoutDashboard, end: true, section: 'Pilotage' },
    { label: 'Biens', to: '/agence/biens', icon: Home, section: 'Portefeuille' },
    { label: 'Propriétaires', to: '/agence/proprietaires', icon: UserSquare2, section: 'Portefeuille' },
    { label: 'Agents', to: '/agence/agents', icon: Users, section: 'Équipe' },
    { label: 'Clients', to: '/agence/clients', icon: Handshake, section: 'Commercial' },
    { label: 'Visites', to: '/agence/visites', icon: CalendarCheck, section: 'Commercial' },
    { label: 'Transactions', to: '/agence/transactions', icon: KeyRound, section: 'Commercial' },
    { label: 'Contrats', to: '/agence/contrats', icon: FileSignature, section: 'Commercial' },
    { label: 'Documents', to: '/agence/documents', icon: FileText, section: 'Dossiers' },
    { label: 'Messagerie', to: '/agence/messages', icon: MessageSquare, section: 'Dossiers' },
    { label: 'Assistant IA', to: '/agence/assistant', icon: Sparkles, section: 'Dossiers' },
    { label: 'Paramètres', to: '/agence/parametres', icon: Settings, section: 'Dossiers' },
  ],

  AGENT: [
    { label: 'Tableau de bord', to: '/agent', icon: LayoutDashboard, end: true, section: 'Pilotage' },
    { label: 'Mes biens', to: '/agent/biens', icon: Home, section: 'Portefeuille' },
    { label: 'Mes propriétaires', to: '/agent/proprietaires', icon: UserSquare2, section: 'Portefeuille' },
    { label: 'Mes clients', to: '/agent/clients', icon: Handshake, section: 'Commercial' },
    { label: 'Visites', to: '/agent/visites', icon: CalendarCheck, section: 'Commercial' },
    { label: 'Ventes', to: '/agent/ventes', icon: KeyRound, section: 'Commercial' },
    { label: 'Locations', to: '/agent/locations', icon: ClipboardList, section: 'Commercial' },
    { label: 'Contrats', to: '/agent/contrats', icon: FileSignature, section: 'Commercial' },
    { label: 'Messages', to: '/agent/messages', icon: MessageSquare, section: 'Échanges' },
    { label: 'Assistant IA', to: '/agent/assistant', icon: Sparkles, section: 'Échanges' },
  ],

  OWNER: [
    { label: 'Tableau de bord', to: '/proprietaire', icon: LayoutDashboard, end: true, section: 'Suivi' },
    { label: 'Mes biens', to: '/proprietaire/biens', icon: Home, section: 'Suivi' },
    { label: 'Visites', to: '/proprietaire/visites', icon: CalendarCheck, section: 'Suivi' },
    { label: 'Transactions', to: '/proprietaire/transactions', icon: KeyRound, section: 'Suivi' },
    { label: 'Documents', to: '/proprietaire/documents', icon: FileText, section: 'Dossier' },
    { label: 'Messages', to: '/proprietaire/messages', icon: MessageSquare, section: 'Dossier' },
    { label: 'Notifications', to: '/proprietaire/notifications', icon: Bell, section: 'Dossier' },
  ],

  CLIENT: [
    { label: 'Tableau de bord', to: '/espace-client', icon: LayoutDashboard, end: true, section: 'Ma recherche' },
    { label: 'Rechercher', to: '/espace-client/recherche', icon: Search, section: 'Ma recherche' },
    { label: 'Favoris', to: '/espace-client/favoris', icon: Heart, section: 'Ma recherche' },
    { label: 'Historique', to: '/espace-client/historique', icon: History, section: 'Ma recherche' },
    { label: 'Mes demandes', to: '/espace-client/demandes', icon: ClipboardList, section: 'Mon dossier' },
    { label: 'Mes visites', to: '/espace-client/visites', icon: CalendarCheck, section: 'Mon dossier' },
    { label: 'Mes contrats', to: '/espace-client/contrats', icon: FileSignature, section: 'Mon dossier' },
    { label: 'Messages', to: '/espace-client/messages', icon: MessageSquare, section: 'Mon dossier' },
    { label: 'Assistant IA', to: '/espace-client/assistant', icon: Sparkles, section: 'Mon dossier' },
  ],
}

/** Titre affiché dans l'en-tête du tableau de bord selon le rôle. */
export const WORKSPACE_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN: 'Administration plateforme',
  AGENCY: 'Espace agence',
  AGENT: 'Espace agent',
  OWNER: 'Espace propriétaire',
  CLIENT: 'Espace client',
}
