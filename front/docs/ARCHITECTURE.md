# Interface — direction artistique et architecture

Ce chapitre documente le frontend React de la plateforme : l'identité visuelle
retenue, les conventions de code et l'organisation des écrans.

> **Périmètre livré.** Socle technique, librairie de composants, pages publiques,
> écrans d'authentification et les cinq espaces connectés avec l'ensemble de leurs
> modules. Le projet compile sans erreur TypeScript et a été vérifié contre l'API
> réelle.

---

## 1. Direction artistique

### 1.1 Le point de départ

Le cahier des charges écarte explicitement le minimalisme froid façon Linear ou
Notion, ainsi que les interfaces uniquement blanches et grises. Plutôt que de
composer une identité générique de SaaS, l'identité est ancrée dans le contexte
réel du produit : l'immobilier ouest-africain, à Cotonou, en francs CFA.

### 1.2 Palette

| Rôle | Nom | Valeur | Usage |
|---|---|---|---|
| Structure | Vert lagune | `#0E4D45` | Couleur de marque, barre latérale, boutons principaux |
| Structure foncée | Lagune profonde | `#08302B` | Fonds sombres, dégradés, pied de page |
| Accent | Laiton | `#C8963E` | Repères, chiffres, éléments de signature |
| Signal | Latérite | `#C25C3C` | Erreurs et actions destructrices, avec parcimonie |
| Texte | Encre | `#101F1C` | Corps de texte en thème clair |
| Fond | Sable | `#FAF7F2` | Fond de page en thème clair |

Le vert lagune renvoie au littoral béninois ; le laiton au travail du bronze,
tradition métallurgique du pays. La latérite — la terre rouge locale — sert
uniquement de signal d'alerte, jamais de couleur décorative.

Toutes les surfaces passent par des variables CSS (`--surface`, `--line`,
`--content`). Aucun composant ne code une couleur de thème en dur, ce qui rend la
bascule clair/sombre entièrement déclarative.

### 1.3 Typographie

Trois familles, chacune avec un rôle distinct :

| Famille | Rôle | Justification |
|---|---|---|
| **Fraunces** | Titres | Serif à optique variable, apporte le caractère patrimonial attendu sur un produit immobilier haut de gamme |
| **Manrope** | Texte courant | Grotesque humaniste, très lisible aux petites tailles, excellent support du français |
| **JetBrains Mono** | Données | Références de biens, prix au m², dates, identifiants |

Le choix du monospace pour les données n'est pas cosmétique : une référence comme
`BIEN-ATL-00001` **est** un code. Le composer dans la même fonte que la prose
brouille la distinction entre ce qui se lit et ce qui s'identifie.

### 1.4 Élément de signature

Chaque carte de bien porte un encadrement dit « fiche cadastrale » : deux équerres
de laiton en angles opposés, qui s'écartent au survol, et la référence du bien
sur un onglet laiton — comme la languette d'un dossier foncier.

```css
.cadastre::before {
  top: 10px; left: 10px;
  border-width: 1.5px 0 0 1.5px;
  border-color: rgb(200 150 62 / 0.85);
  transition: all 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.cadastre:hover::before { top: 6px; left: 6px; width: 22px; height: 22px; }
```

C'est le seul endroit où le produit prend un risque graphique. Tout le reste —
espacements, hiérarchie, boutons — reste sobre et discipliné.

### 1.5 Mouvement

L'animation sert la compréhension, jamais la démonstration :

- **Entrées échelonnées** sur les grilles de cartes (50 ms de décalage, plafonné à 300 ms) — l'œil suit l'ordre de lecture ;
- **Indicateur de navigation partagé** (`layoutId`) qui glisse d'un onglet à l'autre plutôt que d'apparaître brutalement ;
- **Halo pulsé** sur le bouton de l'assistant et le repère cartographique — signale un élément actif sans clignoter ;
- **Compteurs à sortie cubique** sur la page d'accueil : les chiffres se posent, ils ne défilent pas.

`prefers-reduced-motion` neutralise l'ensemble des animations.

---

## 2. Socle technique

| Domaine | Choix |
|---|---|
| Framework | React 18 + TypeScript en mode strict |
| Build | Vite 6, alias `@` vers `src`, proxy `/api` vers le backend |
| Styles | Tailwind CSS 3, thème étendu par variables CSS |
| Routage | React Router 6 |
| Données serveur | TanStack Query 5 |
| État client | Zustand 5 avec persistance |
| Formulaires | React Hook Form + Zod |
| HTTP | Axios avec intercepteurs |
| Animation | Framer Motion 11 |
| Icônes | Lucide React |
| Graphiques | Recharts |

---

## 3. Organisation du code

```
src/
├── api/          client Axios, intercepteurs, 13 modules d'appels
├── components/
│   ├── ui/       librairie de base (24 composants)
│   ├── property/ carte, galerie, recherche, filtres
│   ├── ai/       assistant flottant, messagerie
│   ├── layout/   barre latérale, en-têtes, pied de page, navigation
│   ├── charts/   courbes, colonnes, anneau, courbe compacte
│   └── shared/   en-tête de page, carte d'indicateur
├── layouts/      gabarits public, authentification, tableau de bord
├── pages/        écrans, regroupés par espace
├── routes/       définition des routes et gardes de rôle
├── hooks/        session, requêtes, utilitaires réactifs
├── store/        session, préférences d'interface, notifications
├── types/        miroir des schémas Pydantic du backend
├── utils/        formatage, constantes métier, permissions
└── mocks/        jeu de données et serveur simulé (mode démonstration)
```

---

## 4. Trois décisions structurantes

### 4.1 File d'attente sur le renouvellement de jeton

Lorsqu'un tableau de bord charge six widgets simultanément et que le jeton
d'accès vient d'expirer, une implémentation naïve déclenche six appels de
renouvellement concurrents — dont cinq échouent, puisque le backend applique une
rotation stricte des jetons de rafraîchissement.

L'intercepteur met donc les requêtes en attente pendant qu'un seul
renouvellement est en cours, puis les rejoue avec le nouveau jeton :

```ts
if (isRefreshing) {
  return new Promise((resolve, reject) => {
    queue.push({
      resolve: (token) => {
        original.headers.Authorization = `Bearer ${token}`
        resolve(api(original))
      },
      reject,
    })
  })
}
```

Sans ce mécanisme, la rotation des jetons du backend déconnecterait l'utilisateur
au premier rafraîchissement de page.

### 4.2 Mode démonstration

Un adaptateur Axios simulé, activé par `VITE_DEMO_MODE=true`, sert environ
soixante-dix routes depuis un jeu de données réaliste : cinq agences, quatre
agents, cinq propriétaires, douze biens, sept visites, trois ventes, des
conversations et un journal d'audit.

Le périmètre par rôle y est reproduit à l'identique : un agent ne voit que ses
biens, un client ne voit que le catalogue publié. Les fonctions d'assistance —
estimation, extraction de critères, rédaction d'annonce — sont réimplémentées
côté navigateur avec la même méthode que le backend.

Aucun composant, hook ou écran ne connaît l'existence de ce mode : seule la
source des données change. L'interface est donc entièrement navigable sans
lancer PostgreSQL, ce qui permet de la présenter depuis n'importe quel poste.

Cinq comptes de démonstration sont proposés en un clic sur l'écran de connexion :

| Compte | Rôle | Périmètre |
|---|---|---|
| `admin@immoflow.ai` | Super Admin | Toutes les agences |
| `agence@immoflow.ai` | Agence | Atlantique Immobilier |
| `agent@immoflow.ai` | Agent | Portefeuille personnel |
| `proprietaire@immoflow.ai` | Propriétaire | Biens confiés |
| `client@immoflow.ai` | Client | Catalogue publié |

### 4.3 Tableaux de bord calculés, jamais illustrés

Un tableau de bord qui affiche les mêmes courbes pour tout le monde ne dit rien.
Toutes les séries de la page d'accueil sont donc **agrégées à partir des données
que l'API retourne à l'appelant** : aucune donnée d'exemple n'est utilisée.

```ts
const activitySeries = useMemo(
  () => monthlySeries(buckets, [
    { key: 'visites', rows: visits },
    { key: 'biens', rows: properties },
    { key: 'transactions', rows: [...sales, ...rentals] },
  ]),
  [buckets, visits, properties, sales, rentals],
)
```

Comme le backend filtre déjà par rôle, chaque personne obtient mécaniquement ses
propres chiffres :

| Rôle | Ce que montre la page d'accueil |
|---|---|
| Super Admin | Inscriptions d'agences, répartition nationale par ville, dossiers à valider |
| Agence | Portefeuille par type, ventes et locations par mois, dossiers en attente |
| Agent | Ses biens, ses visites à confirmer, ses clients, son volume finalisé |
| Propriétaire | Statut de ses biens, audience de ses annonces, revenus locatifs |
| Client | Ses favoris, ses visites, ce que propose le catalogue |

Les blocs sans objet pour un rôle ne sont pas affichés vides : ils sont absents.
Un client n'a pas de section « commissions », un propriétaire pas de « dossiers à
traiter ».

> **Une contrainte à connaître.** L'API plafonne `size` à 100 éléments par page.
> Les requêtes d'agrégation demandent donc 100 lignes au maximum ; au-delà, la
> validation du serveur rejette l'appel et l'écran resterait vide. C'est une
> erreur que nous avons commise puis corrigée : elle ne se voit qu'en testant
> contre l'API réelle, jamais en mode démonstration.

### 4.4 Écrans mutualisés, vocabulaire adapté

Les cinq espaces partagent les mêmes écrans. Un agent voit « Mes biens », une
agence voit « Biens de l'agence » : c'est la même page, mais le périmètre des
données et le vocabulaire diffèrent.

Ce choix évite de dupliquer quarante écrans presque identiques et garantit qu'une
correction s'applique partout. La navigation par rôle est déclarée dans un seul
fichier (`components/layout/navigation.ts`), ce qui rend le périmètre de chaque
espace lisible d'un coup d'œil.

---

## 5. Parcours d'inscription

Trois portes d'entrée distinctes, parce que les trois rôles n'ont pas les mêmes
prérequis :

| Route | Public | Particularité |
|---|---|---|
| `/inscription` | Client ou agence | Le compte agence attend une validation de la plateforme |
| `/inscription-proprietaire` | Propriétaire | Choix préalable de l'agence, via `GET /public/agencies` |
| `/accept-invitation`, `/owner/onboarding` | Agent ou propriétaire invité | Activation par jeton reçu par email |

Les chemins d'activation reprennent **exactement** ceux que le backend inscrit
dans ses emails. Les renommer côté frontend casserait les liens déjà envoyés :
les routes françaises existent en parallèle, comme alias.

La gestion des invitations couvre le cycle complet : correction des coordonnées
tant que le compte n'est pas activé, régénération d'un lien affiché et copiable,
et retrait de l'équipe dont la confirmation précise ce qui est supprimé et ce qui
est conservé.

---

## 6. Qualité de base

Ces exigences sont tenues sans être mises en avant dans l'interface :

- **Responsive** de 360 px à grand écran ; les tableaux masquent les colonnes secondaires sous 768 px plutôt que de défiler horizontalement ;
- **Focus visible** homogène sur tous les éléments interactifs ;
- **Rôles ARIA** et libellés explicites sur les dialogues, tiroirs, interrupteurs et boutons sans texte ;
- **Thème sombre** complet, sans clignotement au chargement grâce à un script inline appliqué avant le premier rendu ;
- **Chargement progressif** : squelettes calés sur les proportions réelles du contenu, jamais de saut de mise en page ;
- **États vides rédigés** : chaque écran vide explique quoi faire, il ne se contente pas d'annoncer l'absence de données.

---

## 7. Écriture de l'interface

Les textes suivent trois règles :

1. **Nommer ce que la personne contrôle**, pas ce que le système fait. « Retirer du catalogue », pas « Dépublier l'entité ».
2. **Un bouton dit ce qui va se passer**, et le message de confirmation reprend le même mot. « Publier » produit « Bien publié ».
3. **Une erreur explique et oriente**. « Publication impossible : au moins une photo est requise » plutôt que « Erreur 409 ».

Les messages d'erreur de l'API sont traduits par une fonction unique
(`errorMessage`) qui extrait le champ manquant lorsque le backend le fournit,
de sorte que l'utilisateur lit une phrase actionnable et non un code technique.
