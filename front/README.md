# ImmoFlow AI — Frontend

Interface React de la plateforme immobilière multi-agences ImmoFlow AI.

---

## Démarrage en trois commandes

```bash
unzip immoflow-ai-frontend.zip
cd immoflow-ai-frontend
npm install
npm run dev
```

L'application est servie sur **http://localhost:5173**.

> Le fichier `.env` est **fourni dans l'archive**, déjà configuré. Aucune étape de
> configuration n'est nécessaire pour démarrer.

---

## Deux façons de lancer l'interface

### A. Branchée sur le backend (configuration par défaut)

C'est le mode livré. `VITE_DEMO_MODE=false` dans `.env`.

Lancez d'abord l'API :

```bash
cd immoflow-ai-api
docker compose up -d          # API sur http://localhost:8000
```

Puis le frontend :

```bash
npm run dev
```

Vite relaie automatiquement les appels `/api/*` vers `http://localhost:8000`
(voir `vite.config.ts`). Aucune configuration CORS n'est nécessaire en développement.

Connectez-vous avec le compte créé par le backend au premier démarrage :

| Identifiant | Mot de passe |
|---|---|
| `admin@immoflow.ai` | `ChangeMe123!` |

> Sur une base fraîche, le catalogue est vide : c'est normal. Créez une agence depuis
> `/inscription`, validez-la avec le compte Super Admin, puis invitez un agent et
> saisissez vos premiers biens. Le parcours complet est décrit dans
> [`docs/GUIDE.md`](docs/GUIDE.md).

### B. Mode démonstration, sans backend

Pour présenter l'interface depuis n'importe quel poste, sans PostgreSQL ni Docker :

```bash
# dans .env
VITE_DEMO_MODE=true
```

```bash
npm run dev
```

Un adaptateur HTTP simulé sert alors une soixantaine de routes depuis un jeu de données
réaliste : cinq agences, quatre agents, cinq propriétaires, douze biens avec photos,
sept visites, trois ventes, des conversations et un journal d'audit. Le périmètre par
rôle y est reproduit à l'identique.

Cinq comptes sont proposés en un clic sur l'écran de connexion (n'importe quel mot de
passe est accepté) :

| Compte | Rôle | Ce qu'il voit |
|---|---|---|
| `admin@immoflow.ai` | Super Admin | Toutes les agences de la plateforme |
| `agence@immoflow.ai` | Agence | Son équipe, son portefeuille, ses transactions |
| `agent@immoflow.ai` | Agent | Ses biens, ses clients, ses visites |
| `proprietaire@immoflow.ai` | Propriétaire | Les biens qu'il a confiés |
| `client@immoflow.ai` | Client | Le catalogue publié, ses favoris, ses visites |

---

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement avec rechargement à chaud |
| `npm run build` | Compilation TypeScript puis build de production dans `dist/` |
| `npm run preview` | Sert le build de production localement |
| `npm run typecheck` | Vérification des types sans émission |

---

## Stack

| Domaine | Choix |
|---|---|
| Framework | React 18 + TypeScript strict |
| Build | Vite 6 |
| Styles | Tailwind CSS 3 |
| Routage | React Router 6 |
| Données serveur | TanStack Query 5 |
| État client | Zustand 5 |
| Formulaires | React Hook Form + Zod |
| HTTP | Axios |
| Animation | Framer Motion 11 |
| Icônes | Lucide React |
| Graphiques | Recharts |

---

## Ce que contient l'interface

**Pages publiques** — accueil avec recherche et statistiques animées, catalogue filtrable,
fiche de bien avec galerie plein écran, repère cartographique et prise de rendez-vous.

**Authentification** — connexion, inscription (client ou agence), mot de passe oublié,
réinitialisation. Validation des formulaires par Zod, messages d'erreur en français.

**Cinq espaces connectés** — Super Admin, Agence, Agent, Propriétaire, Client. Chacun
avec son tableau de bord, ses modules et son périmètre de données.

**Assistant immobilier** — bouton flottant présent partout (`Ctrl`/`Cmd` + `K`), avec
trois modes : rechercher un bien en langage courant, estimer un prix, rédiger une annonce.
Une page dédiée présente en plus le contrôle qualité des annonces publiées.

**Thème clair et sombre**, responsive de 360 px au grand écran, focus clavier visible,
`prefers-reduced-motion` respecté.

---

## Documentation

| Document | Contenu |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Organisation du code et décisions structurantes |
| [`docs/INSTALLATION.md`](docs/INSTALLATION.md) | Installation détaillée et dépannage |
| [`docs/ENVIRONNEMENT.md`](docs/ENVIRONNEMENT.md) | Toutes les variables d'environnement |
| [`docs/GUIDE.md`](docs/GUIDE.md) | Guide d'utilisation, espace par espace |

---

## Vérifications effectuées avant livraison

- `npm install` puis `npm run build` : **compilation réussie**, 0 erreur TypeScript
- `npm run dev` : serveur démarré, proxy `/api` fonctionnel
- **Appels du frontend rejoués contre l'API réelle** (PostgreSQL 16 + FastAPI) :
  authentification, rotation de jeton, validation d'agence, cycle complet d'une
  invitation (création, correction, régénération, révocation de l'ancien lien,
  activation), les deux parcours d'inscription propriétaire, création et publication
  de bien, CRM, visites, ventes, messagerie, fonctions d'assistance et isolation
  inter-agences.
- **Cloisonnement mesuré** sur un jeu de 30 biens : Super Admin 30, Agence 15,
  Agent 4, Propriétaire 3, Client 20 — le même écran, des chiffres différents.
