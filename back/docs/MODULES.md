# Documentation des modules métier — ImmoFlow AI API

Ce document décrit, module par module, les règles métier appliquées par l'API, les
statuts, les permissions et les endpoints associés.

Préfixe commun : `/api/v1`

---

## Table des matières

1. [Authentification](#1-authentification)
2. [Agences](#2-agences)
3. [Agents](#3-agents)
4. [Propriétaires](#4-propriétaires)
5. [Biens immobiliers](#5-biens-immobiliers)
6. [CRM Clients](#6-crm-clients)
7. [Visites](#7-visites)
8. [Transactions](#8-transactions)
9. [Documents](#9-documents)
10. [Messagerie temps réel](#10-messagerie-temps-réel)
11. [Notifications](#11-notifications)
12. [IA immobilière](#12-ia-immobilière)
13. [Administration et audit](#13-administration-et-audit)
14. [Matrice des permissions](#14-matrice-des-permissions)

---

## 1. Authentification

### Endpoints

| Méthode | Chemin | Description | Accès |
|---|---|---|---|
| POST | `/auth/register` | Inscription (CLIENT, OWNER ou AGENCY) | Public |
| POST | `/auth/login` | Connexion | Public |
| POST | `/auth/refresh` | Renouvellement du jeton d'accès | Public (jeton requis) |
| POST | `/auth/logout` | Déconnexion (session ou tous appareils) | Authentifié |
| POST | `/auth/forgot-password` | Demande de réinitialisation | Public |
| POST | `/auth/reset-password` | Réinitialisation par jeton | Public |
| POST | `/auth/change-password` | Changement de mot de passe | Authentifié |
| POST | `/auth/accept-invitation` | Activation d'un compte invité | Public (jeton requis) |
| GET | `/auth/me` | Profil enrichi + permissions | Authentifié |
| PATCH | `/auth/me` | Mise à jour du profil | Authentifié |
| POST | `/auth/me/avatar` | Téléversement de l'avatar | Authentifié |
| GET | `/auth/sessions` | Sessions actives | Authentifié |

### Règles métier

- **Rôles auto-attribuables** : `CLIENT`, `OWNER`, `AGENCY` uniquement. Toute tentative
  d'inscription en `SUPER_ADMIN` ou `AGENT` est rejetée en **422** — ces rôles ne
  s'obtiennent que par invitation.
- **Politique de mot de passe** : 8 à 128 caractères, au moins une minuscule, une
  majuscule et un chiffre.
- **Inscription AGENCY** : `agency_name` obligatoire. L'agence est créée en
  `PENDING_VALIDATION` et l'utilisateur en `PENDING` — il peut se connecter mais son
  agence n'est pas opérationnelle avant validation par le Super Admin.
- **Rotation des refresh tokens** : chaque appel à `/auth/refresh` révoque le jeton
  utilisé et en émet un nouveau. Rejouer un jeton déjà consommé révoque **toutes** les
  sessions de l'utilisateur (signal de vol de jeton).
- **Non-énumération des comptes** : `/auth/login` et `/auth/forgot-password` répondent
  de façon identique que le compte existe ou non.
- **Changement de mot de passe** : révoque toutes les sessions actives.
- Les jetons de réinitialisation et d'invitation sont stockés **hachés (SHA-256)**.
  Ils ne sont jamais consultables en base en clair.

### Réponse type

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_at": "2026-07-31T19:05:00Z",
  "expires_in": 1800
}
```

---

## 2. Agences

### Endpoints

| Méthode | Chemin | Description | Accès |
|---|---|---|---|
| GET | `/agencies` | Lister les agences | SUPER_ADMIN |
| POST | `/agencies` | Créer une agence | SUPER_ADMIN |
| GET | `/agencies/me` | Mon agence | AGENCY, AGENT |
| GET | `/agencies/{id}` | Détail | Périmètre |
| PATCH | `/agencies/{id}` | Modifier | AGENCY, SUPER_ADMIN |
| POST | `/agencies/{id}/validate` | Valider ou rejeter | SUPER_ADMIN |
| POST | `/agencies/{id}/suspend` | Suspendre | SUPER_ADMIN |
| POST | `/agencies/{id}/activate` | Réactiver | SUPER_ADMIN |
| GET | `/agencies/{id}/stats` | Tableau de bord | Périmètre |

### Cycle de vie

```
PENDING_VALIDATION ──validate(approve=true)──► ACTIVE ⇄ SUSPENDED
         │
         └──validate(approve=false)──► REJECTED
```

### Règles métier

- Seul le **Super Admin** valide, suspend ou réactive une agence.
- La validation active également le compte du dirigeant (`owner_user_id`) et lui envoie
  une notification + un email.
- Une agence `SUSPENDED` bloque la connexion de ses agents et de son dirigeant.
- Une agence non `ACTIVE` n'accepte pas les inscriptions autonomes de propriétaires.
- Le `slug` est généré automatiquement à partir du nom, avec suffixe numérique en cas
  de collision.
- Les documents légaux sont déposés via `/documents` avec
  `entity_type=AGENCY&category=AGENCY_LEGAL`.

### Statistiques retournées

```json
{
  "agents": 8, "owners": 42, "clients": 137, "properties": 96,
  "published_properties": 71, "visits_pending": 5,
  "sales_completed": 12, "rentals_active": 28
}
```

---

## 3. Agents

### Endpoints

| Méthode | Chemin | Description | Accès |
|---|---|---|---|
| GET | `/agents` | Lister | AGENCY, AGENT, SUPER_ADMIN |
| POST | `/agents` | Créer et inviter | AGENCY, SUPER_ADMIN |
| GET | `/agents/{id}` | Détail | Périmètre agence |
| PATCH | `/agents/{id}` | Modifier | AGENCY |
| POST | `/agents/{id}/resend-invitation` | Renvoyer l'invitation | AGENCY |
| POST | `/agents/{id}/suspend` | Suspendre | AGENCY |
| POST | `/agents/{id}/activate` | Activer | AGENCY |
| DELETE | `/agents/{id}` | Supprimer | AGENCY |

### Workflow d'invitation

```
1. L'agence crée l'agent (email, nom, téléphone, fonction)
   → un User de rôle AGENT est créé SANS mot de passe, statut PENDING
   → un profil Agent est créé, statut INVITED
2. Un jeton d'invitation (48 h) est généré et envoyé par email
3. L'agent appelle POST /auth/accept-invitation { token, password }
   → User.status = ACTIVE, Agent.status = ACTIVE, activated_at renseigné
```

En développement (`ENVIRONMENT != production`), la réponse contient `invitation_url`
pour faciliter les tests. En production, ce champ est `null` — le lien passe uniquement
par email.

### Permissions fines

| Champ | Effet |
|---|---|
| `can_manage_owners` | Autorise la création et le suivi de propriétaires |
| `can_publish_properties` | Autorise la publication au catalogue |

### Périmètre d'un agent

Un agent ne voit que ce qui lui est **attribué** :

| Ressource | Critère de rattachement |
|---|---|
| Biens | `Property.agent_id == agent.id` |
| Clients | Lien actif dans `client_agents` |
| Propriétaires | `Owner.agent_id == agent.id` |
| Visites | `Visit.agent_id == agent.id` |
| Transactions | `Sale.agent_id` / `Rental.agent_id == agent.id` |

---

## 4. Propriétaires

### Endpoints

| Méthode | Chemin | Description | Accès |
|---|---|---|---|
| POST | `/owners/register` | Inscription autonome (workflow 2) | Public |
| POST | `/owners/accept-invitation` | Accepter une invitation (workflow 1) | Public |
| GET | `/owners` | Lister | Périmètre |
| POST | `/owners` | Créer et inviter | AGENCY, AGENT |
| GET | `/owners/{id}` | Détail | Périmètre |
| PATCH | `/owners/{id}` | Modifier | Périmètre |
| POST | `/owners/{id}/complete-profile` | Compléter le profil | Propriétaire, agence |
| POST | `/owners/{id}/verify` | Vérifier le dossier | AGENCY |
| POST | `/owners/{id}/suspend` | Suspendre | AGENCY |

### Workflow 1 — invitation par l'agent

```
Agent crée le propriétaire (nom, prénom, email, téléphone)
   → Owner status = INVITED, un User de rôle OWNER est pré-créé
   → invitation (72 h) envoyée par email
Propriétaire accepte : POST /owners/accept-invitation { token, password }
   → status = PENDING_VERIFICATION
Propriétaire complète son profil + dépose sa CIP
   → POST /owners/{id}/complete-profile
   → POST /documents (entity_type=OWNER, category=IDENTITY_CIP)
Agence vérifie : POST /owners/{id}/verify { approve: true }
   → status = ACTIVE
```

### Workflow 2 — inscription autonome

```
POST /owners/register { agency_id, nom, prénom, email, téléphone, password }
   → l'agence doit être ACTIVE, sinon 409
   → Owner status = PENDING_VERIFICATION
   → notification envoyée au dirigeant de l'agence
Agence vérifie → ACTIVE
```

### Statuts

| Statut | Signification |
|---|---|
| `INVITED` | Créé par l'agence, invitation non acceptée |
| `PENDING_VERIFICATION` | Compte actif, dossier en attente de contrôle |
| `ACTIVE` | Dossier vérifié, peut détenir des biens |
| `REJECTED` | Dossier refusé (motif conservé) |
| `SUSPENDED` | Accès suspendu par l'agence |

### Règle bloquante

`POST /owners/{id}/verify` avec `approve: true` renvoie **409
`business_rule_violation`** si aucun document de catégorie `IDENTITY_CIP` n'a été
déposé pour ce propriétaire. La conformité documentaire est donc garantie par l'API,
pas seulement par la discipline des utilisateurs.

### Unicité

Un couple `(agency_id, email)` est unique : un même propriétaire peut être suivi par
plusieurs agences, mais jamais dupliqué au sein d'une même agence.

---

## 5. Biens immobiliers

### Endpoints

| Méthode | Chemin | Description | Accès |
|---|---|---|---|
| GET | `/properties/types` | Types de biens | Authentifié |
| POST | `/properties/types` | Créer un type | AGENCY, AGENT |
| GET | `/properties` | Rechercher (périmètre RBAC) | Authentifié |
| POST | `/properties` | Créer | AGENCY, AGENT |
| GET | `/properties/{id}` | Détail | Périmètre |
| PATCH | `/properties/{id}` | Modifier | AGENCY, AGENT |
| DELETE | `/properties/{id}` | Supprimer | AGENCY, AGENT |
| POST | `/properties/{id}/status` | Changer le statut | AGENCY, AGENT |
| POST | `/properties/{id}/publish` | Publier / dépublier | AGENCY, AGENT |
| GET | `/properties/{id}/images` | Médias | Périmètre |
| POST | `/properties/{id}/images` | Ajouter par URL | AGENCY, AGENT |
| POST | `/properties/{id}/images/upload` | Téléverser | AGENCY, AGENT |
| DELETE | `/properties/{id}/images/{img}` | Supprimer un média | AGENCY, AGENT |
| GET | `/public/properties` | Catalogue public | **Public** |
| GET | `/public/properties/{id}` | Détail public | **Public** |

### Champs

Titre, description, type d'opération (`SALE` / `RENT` / `BOTH`), type de bien, adresse,
quartier, ville, pays, latitude, longitude, prix, devise, charges, caution, surface,
surface du terrain, pièces, chambres, salles d'eau, étage, année de construction,
équipements (tableau JSONB), photos et vidéos.

Chaque bien reçoit une **référence lisible** générée automatiquement :
`BIEN-<4 car. agence>-<numéro>`, par exemple `BIEN-9F80-00001`.

### Transitions de statut

```
DRAFT ──► AVAILABLE ──► RESERVED ──► SOLD ──► ARCHIVED
            ▲   │           │
            │   └─────────► RENTED ──► AVAILABLE
            └─────────────────┘
```

Une transition non autorisée (par exemple `DRAFT → SOLD`) renvoie **409** :

```json
{ "error": { "code": "business_rule_violation",
             "message": "Transition de statut interdite : DRAFT → SOLD." } }
```

### Conditions de publication

`POST /properties/{id}/publish` vérifie la présence de :

- un titre, un prix, une ville ;
- une description d'au moins 40 caractères ;
- au moins une photo.

En cas de manque, réponse **409** avec le détail :

```json
{ "error": { "code": "business_rule_violation",
             "message": "Publication impossible : éléments manquants.",
             "details": { "missing": ["description (40 caractères minimum)", "au moins une photo"] } } }
```

Publier un bien en `DRAFT` le bascule automatiquement en `AVAILABLE`.
Le passage en `SOLD`, `RENTED` ou `ARCHIVED` le dépublie automatiquement.

### Suppression

Un bien `SOLD` ou `RENTED` **ne peut pas être supprimé** (traçabilité des transactions) :
il doit être archivé.

### Filtres de recherche

`q`, `city`, `district`, `listing_type`, `status`, `property_type_id`, `owner_id`,
`agent_id`, `min_price`, `max_price`, `min_area`, `max_area`, `bedrooms`, `rooms`,
`is_published`, `near_lat` + `near_lng` + `radius_km`, `sort` (`price`, `-price`,
`-created_at`, `area`, `views_count`), `page`, `size`.

Exemple :

```
GET /api/v1/properties?city=Cotonou&min_price=20000000&max_price=80000000
    &bedrooms=3&sort=-created_at&page=1&size=20
```

### Catalogue public

`/public/properties` n'expose que les biens `is_published = true` avec statut
`AVAILABLE` ou `RESERVED`. Aucun jeton requis. Le compteur de vues est incrémenté à
chaque consultation de fiche.

---

## 6. CRM Clients

### Endpoints

| Méthode | Chemin | Description | Accès |
|---|---|---|---|
| GET | `/clients` | Lister | Périmètre |
| POST | `/clients` | Créer | AGENCY, AGENT |
| GET | `/clients/{id}` | Détail | Périmètre |
| PATCH | `/clients/{id}` | Modifier | Périmètre |
| DELETE | `/clients/{id}` | Supprimer | AGENCY |
| POST | `/clients/{id}/assign` | Attribuer à un agent | AGENCY, AGENT |
| DELETE | `/clients/{id}/assign/{agent}` | Retirer l'attribution | AGENCY |
| GET | `/clients/{id}/favorites` | Favoris | Périmètre |
| POST | `/clients/{id}/favorites/{bien}` | Ajouter un favori | Périmètre |
| DELETE | `/clients/{id}/favorites/{bien}` | Retirer un favori | Périmètre |
| GET | `/clients/{id}/search-history` | Historique de recherche | Périmètre |
| POST | `/clients/{id}/requests` | Créer une demande | Périmètre |
| GET | `/clients/requests/all` | Demandes de l'agence | AGENCY, AGENT |

### Règle centrale

> **Un client appartient à un agent après interaction.**

Le rattachement est matérialisé par la table `client_agents` :

- création par un agent → attribution automatique à cet agent, marqué `is_primary` ;
- un client peut être suivi par plusieurs agents, un seul étant principal ;
- le retrait d'attribution ne supprime pas la ligne : il renseigne `unassigned_at`
  (traçabilité).

**Conséquence sur le périmètre** : un agent ne voit que les clients dont il détient une
attribution active. Le dirigeant d'agence voit tous les clients de son agence.

### Données suivies

Coordonnées, ville, source d'acquisition, notes, budget minimum et maximum,
préférences (JSONB libre), favoris, historique de recherche (alimenté automatiquement
par l'assistant IA), demandes.

---

## 7. Visites

### Endpoints

| Méthode | Chemin | Description | Accès |
|---|---|---|---|
| GET | `/visits` | Lister | Périmètre |
| POST | `/visits` | Demander ou programmer | Authentifié |
| GET | `/visits/{id}` | Détail | Périmètre |
| POST | `/visits/{id}/decision` | Valider / refuser / reprogrammer | AGENCY, AGENT |
| PATCH | `/visits/{id}` | Modifier | AGENCY, AGENT |
| POST | `/visits/{id}/cancel` | Annuler | Parties prenantes |
| POST | `/visits/{id}/complete` | Clôturer | AGENCY, AGENT |

### Comportement selon l'auteur

| Auteur | Statut initial | Remarque |
|---|---|---|
| CLIENT | `REQUESTED` | Le bien doit être publié |
| AGENT / AGENCY | `CONFIRMED` | `client_id` obligatoire dans la requête |

### Cycle de vie

```
REQUESTED ──decision(approve)──► CONFIRMED ──complete──► COMPLETED
    │            │                    │
    │            └─(nouvelle date)──► RESCHEDULED
    ├──decision(refuse)──► REJECTED
    └──cancel──► CANCELLED
```

### Règles métier

- La date de visite doit être **dans le futur** (409 sinon).
- Un bien `SOLD` ou `RENTED` n'accepte plus de demande de visite.
- Une visite `COMPLETED` ou `CANCELLED` ne peut plus être modifiée ni reclôturée.
- L'agent est déduit automatiquement : agent du bien, à défaut agent principal du client.
- Toute modification notifie **client, agent et propriétaire** (sauf l'auteur de l'action)
  via notification in-app + WebSocket.
- La clôture accepte un retour (`feedback`) et une note de 1 à 5.

---

## 8. Transactions

### Ventes

| Méthode | Chemin | Description | Accès |
|---|---|---|---|
| GET | `/sales` | Lister | Périmètre |
| POST | `/sales` | Créer | AGENCY, AGENT |
| GET | `/sales/{id}` | Détail | Périmètre |
| PATCH | `/sales/{id}` | Modifier | AGENCY, AGENT |

Associe **client + bien + agent + propriétaire**. Référence `VTE-<agence>-<n°>`.

- La commission est calculée automatiquement : `montant × taux / 100`, arrondie au centime.
- À la création, le bien passe en `RESERVED`.
- `status = COMPLETED` → le bien passe en `SOLD` et est dépublié ; `completed_at` et
  `signed_at` sont horodatés.
- `status = CANCELLED` → le bien redevient `AVAILABLE` s'il était réservé.
- Une vente `COMPLETED` est **figée** : tout changement de statut ultérieur est refusé.

### Locations

| Méthode | Chemin | Description | Accès |
|---|---|---|---|
| GET | `/rentals` | Lister | Périmètre |
| POST | `/rentals` | Créer | AGENCY, AGENT |
| GET | `/rentals/{id}` | Détail | Périmètre |
| PATCH | `/rentals/{id}` | Modifier | AGENCY, AGENT |

Loyer mensuel, charges, caution, devise, date de début, date de fin, durée en mois.
Référence `LOC-<agence>-<n°>`.

- `status = ACTIVE` → le bien passe en `RENTED` et est dépublié.
- `status = TERMINATED` → le bien redevient `AVAILABLE`, `terminated_at` horodaté.
- La date de fin doit être postérieure à la date de début (validation Pydantic).

### Contrats

| Méthode | Chemin | Description | Accès |
|---|---|---|---|
| GET | `/contracts` | Lister | AGENCY, AGENT |
| POST | `/contracts` | Créer | AGENCY, AGENT |
| PATCH | `/contracts/{id}` | Modifier | AGENCY, AGENT |

Types : `SALE_DEED` (acte de vente), `LEASE` (bail), `MANDATE` (mandat).
Statuts : `DRAFT → PENDING_SIGNATURE → SIGNED → TERMINATED`.
Un contrat doit être lié à une vente, une location ou un bien, et peut référencer un
document signé (`document_id`).

---

## 9. Documents

### Endpoints

| Méthode | Chemin | Description | Accès |
|---|---|---|---|
| GET | `/documents` | Lister | Périmètre |
| POST | `/documents` | Téléverser | Authentifié |
| GET | `/documents/{id}` | Métadonnées | Périmètre |
| GET | `/documents/{id}/download` | Télécharger | Périmètre |
| POST | `/documents/{id}/verify` | Valider / rejeter | AGENCY |
| DELETE | `/documents/{id}` | Supprimer | Déposant ou agence |

### Rattachement polymorphe contrôlé

`entity_type` ∈ `USER`, `AGENCY`, `OWNER`, `CLIENT`, `PROPERTY`, `CONTRACT`
`entity_id` = identifiant de l'entité concernée.

L'accès à l'entité est vérifié **avant** l'enregistrement : un propriétaire ne peut
déposer un document que sur sa propre fiche ou ses propres biens.

### Catégories

`IDENTITY_CIP` (pièce d'identité), `CONTRACT`, `MANDATE`, `PROPERTY_TITLE`,
`AGENCY_LEGAL`, `OTHER`.

### Sécurité des fichiers

- Liste blanche MIME : images (JPEG, PNG, WebP, GIF, HEIC), documents (PDF, Word, Excel,
  texte), vidéos (MP4, QuickTime, WebM).
- Taille maximale configurable (`MAX_UPLOAD_SIZE_MB`, 25 Mo par défaut).
- Nom de fichier assaini, clé de stockage préfixée d'un UUID (aucune collision).
- Protection contre la traversée de chemin (`path traversal`).
- Empreinte SHA-256 calculée et stockée.
- **Les fichiers ne sont jamais servis en accès direct** : le téléchargement passe par
  `/documents/{id}/download`, qui applique le contrôle d'accès et journalise l'action.

### Vérification

`POST /documents/{id}/verify` (agence uniquement) fait passer le document en `VERIFIED`
ou `REJECTED` avec motif, et notifie le déposant.

---

## 10. Messagerie temps réel

### Endpoints REST

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/conversations` | Mes conversations (avec compteur de non-lus) |
| POST | `/conversations` | Créer ou retrouver une conversation |
| GET | `/conversations/{id}` | Détail |
| GET | `/conversations/{id}/messages` | Historique paginé |
| POST | `/conversations/{id}/messages` | Envoyer un message |
| POST | `/conversations/{id}/read` | Marquer comme lu |
| POST | `/conversations/{id}/archive` | Archiver |

### WebSocket

```
ws://<host>/ws?token=<access_token>
```

| Sens | Événements |
|---|---|
| Entrants | `message.send`, `message.read`, `typing`, `ping` |
| Sortants | `connected`, `message.new`, `message.read`, `typing`, `notification.new`, `pong`, `error` |

### Types de conversation

`CLIENT_AGENT`, `OWNER_AGENT`, `AGENT_AGENCY`, `SUPPORT`.

### Types de message

`TEXT`, `IMAGE`, `DOCUMENT`, `VIDEO`, `SYSTEM`.
Un message texte exige un contenu non vide ; un message média exige `attachment_url`
ou `document_id` (validation Pydantic).

### Règles métier

- Tous les participants doivent appartenir au **même tenant** — la création d'une
  conversation inter-agences est refusée (403).
- La déduplication est automatique : recréer une conversation entre les mêmes
  participants et du même type retourne la conversation existante.
- Une conversation archivée n'accepte plus de message.
- Chaque message envoyé est **persisté**, **diffusé** aux participants connectés (via
  Redis Pub/Sub, donc sur tous les workers) et génère une **notification** pour les
  destinataires.
- Le compteur de non-lus se calcule à partir de `last_read_at` du participant.
- L'historique se pagine par curseur temporel (`before`) pour un défilement infini stable.

---

## 11. Notifications

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/notifications` | Mes notifications (filtres `is_read`, `type`) |
| GET | `/notifications/unread-count` | Nombre de non lues |
| POST | `/notifications/read` | Marquer comme lues (`ids` ou `all: true`) |

### Types

`INVITATION`, `ACCOUNT_VALIDATION`, `NEW_MESSAGE`, `VISIT`, `TRANSACTION`,
`DOCUMENT`, `SYSTEM`.

### Canaux

1. **In-app** — persistée en base, consultable via l'API ;
2. **WebSocket** — poussée immédiate (`notification.new`) si l'utilisateur est connecté ;
3. **Email** — optionnel, activé au cas par cas (validation de compte, invitation).

Chaque notification porte un `action_url` exploitable par le frontend et une charge
utile `payload` (identifiants de la ressource concernée).

---

## 12. IA immobilière

| Méthode | Chemin | Description |
|---|---|---|
| POST | `/ai/description` | Génération de description d'annonce |
| POST | `/ai/estimate` | Estimation de prix |
| POST | `/ai/assistant` | Recherche en langage naturel + conseil |
| POST | `/ai/analyze-listing` | Analyse de qualité d'annonce |

Permission requise : `ai:use` (SUPER_ADMIN, AGENCY, AGENT, CLIENT).

### 12.1 Génération de description

**Entrée** : `property_id` (les caractéristiques sont alors chargées depuis le bien) ou
saisie manuelle (type, surface, quartier, chambres, équipements, ton, longueur).

**Sortie**

```json
{
  "description": "Découvrez cette villa à vendre à Fidjrossè, Cotonou. Elle offre une surface de 320 m², 4 chambres…",
  "title_suggestion": "Villa 4 chambres — 320 m² à Fidjrossè, Cotonou",
  "highlights": ["Piscine", "Garage", "Jardin"],
  "provider": "local"
}
```

### 12.2 Estimation de prix

**Méthode** :

1. Recherche des **biens comparables** en base : même quartier (à défaut même ville),
   surface comprise entre 60 % et 140 % de la surface cible.
2. Si au moins 3 comparables : **médiane du prix au m²** (méthode privilégiée).
3. Sinon : barème régional au m² (Cotonou, Calavi, Porto-Novo, Parakou, Bohicon…).
4. Ajustements : équipements (piscine +12 %, vue mer +15 %, meublé +8 %…, plafonné à
   +35 %), ancienneté (−0,5 % par an, plafonné à −20 %).
5. Pour une location : application d'un rendement locatif mensuel.
6. Indice de confiance : 0,75 (≥ 5 comparables), 0,60 (≥ 3), 0,40 (barème).
7. Fourchette : ±12 % si confiance élevée, ±22 % sinon.

**Sortie**

```json
{
  "suggested_price": 144000000,
  "price_range_min": 126720000,
  "price_range_max": 161280000,
  "currency": "XOF",
  "confidence": 0.6,
  "explanation": "Estimation basée sur la médiane de 4 biens comparables, soit environ 450 000 XOF/m² pour 320 m². Ajustement des équipements et de l'ancienneté : +21 %. Fourchette de confiance ±12 %.",
  "comparables_count": 4,
  "method": "médiane de 4 biens comparables",
  "provider": "local"
}
```

### 12.3 Assistant immobilier

**Entrée** : `"Maison 4 chambres proche centre budget 60 millions"`

**Critères extraits**

```json
{ "listing_type": null, "property_type": "maison", "city": "Cotonou",
  "bedrooms": 4, "max_price": 60000000, "amenities": [] }
```

L'extraction reconnaît les nombres en chiffres et en lettres, les unités de budget
(« millions », « milliards », « k »), les villes du Bénin, les types de biens et les
équipements. Les critères alimentent directement le moteur de recherche, **dans le
périmètre RBAC de l'appelant** (un client ne voit que le catalogue publié).

Pour un client, chaque requête alimente automatiquement son **historique de recherche**.

### 12.4 Analyse d'annonce

Contrôle de complétude (photos, surface, chambres, pièces, adresse, quartier, ville,
géolocalisation, propriétaire rattaché, équipements) et de qualité rédactionnelle
(longueur, majuscules, ponctuation excessive, numéro de téléphone dans le texte, titre
trop court pour le référencement).

**Sortie** : score sur 100, `missing_fields`, `quality_issues`, `suggestions`.

### Fournisseurs LLM

`AI_PROVIDER` ∈ `none` | `openai` | `groq` | `anthropic`, avec `AI_API_KEY` et `AI_MODEL`.

> **Sans clé configurée, les quatre fonctions restent pleinement opérationnelles** grâce
> aux replis déterministes décrits ci-dessus. Si un appel LLM échoue (réseau, quota, JSON
> invalide), l'API bascule silencieusement sur le repli : aucune fonctionnalité ne devient
> indisponible à cause d'un service tiers.

---

## 13. Administration et audit

| Méthode | Chemin | Description | Accès |
|---|---|---|---|
| GET | `/admin/stats` | Statistiques plateforme | SUPER_ADMIN |
| GET | `/admin/audit-logs` | Journal d'audit | AGENCY, SUPER_ADMIN |
| GET | `/users` | Lister les utilisateurs | AGENCY, SUPER_ADMIN |
| GET | `/users/{id}` | Détail | Périmètre |
| PATCH | `/users/{id}` | Mise à jour administrative | AGENCY, SUPER_ADMIN |
| POST | `/users/{id}/deactivate` | Désactiver un compte | AGENCY, SUPER_ADMIN |

### Journal d'audit

Chaque action sensible enregistre : acteur, agence, action, type et identifiant de
ressource, statut, adresse IP, user-agent, `request_id` et charge utile.

Actions journalisées : `auth.register`, `auth.login`, `auth.change_password`,
`auth.reset_password`, `auth.accept_invitation`, `agency.create`, `agency.validate`,
`agency.suspend`, `agency.activate`, `agent.invite`, `agent.update`, `agent.set_status`,
`agent.delete`, `owner.invite`, `owner.self_register`, `owner.verify`, `owner.suspend`,
`client.create`, `client.assign`, `client.delete`, `property.create`, `property.update`,
`property.change_status`, `property.publish`, `property.delete`, `visit.request`,
`visit.decide`, `sale.create`, `rental.create`, `contract.create`, `document.upload`,
`document.download`, `document.verify`, `document.delete`, `user.admin_update`,
`user.deactivate`.

Le journal est **filtré par agence** : un dirigeant ne consulte que les actions de son
tenant. L'écriture d'audit n'interrompt jamais le flux métier — un échec est journalisé
mais n'annule pas l'opération.

### Restrictions

Un compte ne peut pas se désactiver lui-même. Seul le Super Admin peut modifier le rôle
ou l'agence de rattachement d'un utilisateur, et l'attribution du rôle `SUPER_ADMIN` lui
est réservée.

---

## 14. Matrice des permissions

| Permission | SUPER_ADMIN | AGENCY | AGENT | OWNER | CLIENT |
|---|:--:|:--:|:--:|:--:|:--:|
| `agency:read` | ✅ | ✅ | ✅ | — | — |
| `agency:update` | ✅ | ✅ | — | — | — |
| `agent:create` / `update` / `delete` | ✅ | ✅ | — | — | — |
| `owner:create` | ✅ | ✅ | ✅ | — | — |
| `owner:read` | ✅ | ✅ | ✅ | ✅ | — |
| `owner:verify` | ✅ | ✅ | — | — | — |
| `client:create` / `update` | ✅ | ✅ | ✅ | — | ✅¹ |
| `client:delete` | ✅ | ✅ | — | — | — |
| `property:create` / `update` | ✅ | ✅ | ✅ | — | — |
| `property:read` | ✅ | ✅ | ✅ | ✅ | ✅² |
| `property:publish` | ✅ | ✅ | ✅ | — | — |
| `property:delete` | ✅ | ✅ | — | — | — |
| `visit:create` | ✅ | — | — | — | ✅ |
| `visit:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `visit:update` | ✅ | ✅ | ✅ | — | — |
| `transaction:create` / `update` | ✅ | ✅ | ✅ | — | — |
| `transaction:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `document:create` | ✅ | ✅ | ✅ | ✅ | — |
| `document:verify` / `delete` | ✅ | ✅ | — | — | — |
| `conversation:create` / `message:create` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `notification:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `ai:use` | ✅ | ✅ | ✅ | — | ✅ |
| `audit:read` | ✅ | ✅ | — | — | — |

¹ Uniquement sa propre fiche client.
² Catalogue publié uniquement.

Toutes ces permissions s'appliquent **en plus** du filtrage par périmètre décrit dans
chaque module : disposer de `property:read` ne donne accès qu'aux biens de son propre
périmètre, jamais à ceux d'une autre agence.
