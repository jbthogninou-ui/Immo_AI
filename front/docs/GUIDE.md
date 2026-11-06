# Guide d'utilisation

Ce guide suit le produit dans l'ordre où on le découvre : le site public, puis chacun
des cinq espaces connectés.

---

## 1. Site public

### Accueil (`/`)

Le bandeau d'ouverture propose deux façons de chercher, sélectionnables par un
interrupteur :

- **Par critères** — mot-clé, ville, type d'opération, budget maximum ;
- **Recherche intelligente** — une phrase libre, par exemple « maison 4 chambres proche
  centre budget 60 millions ». La phrase est traduite en critères, puis appliquée au
  catalogue.

Plus bas : les dernières publications, les quatre capacités de la plateforme, le
parcours des quatre rôles et les témoignages.

### Catalogue (`/biens`)

Filtres à gauche sur grand écran, dans un tiroir sur mobile : opération, type de bien,
ville, quartier, budget, nombre de chambres, surface, équipements. Le tri se fait par
date, prix, surface ou nombre de consultations.

Quand la recherche intelligente est utilisée, la réponse de l'assistant s'affiche
au-dessus des résultats et les filtres sont pré-remplis — vous pouvez les ajuster
ensuite à la main.

### Fiche d'un bien (`/biens/{id}`)

Galerie en mosaïque, ouvrable en plein écran (flèches et touche `Échap` au clavier),
prix avec le prix au m² calculé, caractéristiques, description, équipements, repère de
localisation et biens similaires dans la même ville.

Deux actions : **demander une visite** et **contacter l'agent**. Les deux exigent d'être
connecté ; un visiteur non connecté est redirigé vers la connexion, puis ramené sur la
fiche.

---

## 2. Créer un compte

### Client ou agence — `/inscription`

- **Je cherche un bien** → compte client, actif immédiatement ;
- **Je dirige une agence** → compte agence, en attente de validation par la plateforme.

### Propriétaire — `/inscription-proprietaire`

Le propriétaire suit un parcours distinct, en deux étapes, parce qu'un bien se
confie toujours à une agence précise :

1. **Choisir l'agence** parmi celles qui sont actives sur la plateforme ;
2. **Créer son compte** — il peut se connecter immédiatement.

Son dossier est alors en attente de vérification : il dépose sa pièce d'identité
depuis l'espace Documents, puis l'agence valide. Sans pièce d'identité, la
validation est refusée par l'API — ce n'est pas un contrôle d'affichage.

### Agent ou propriétaire invité — lien reçu par email

Quand l'agence prend l'initiative, elle crée la fiche et un lien d'activation
part par email (`/accept-invitation` pour un agent, `/owner/onboarding` pour un
propriétaire). Il suffit de choisir un mot de passe.

Le lien est valable 48 heures. **Régénérer un lien invalide tous les
précédents** : si vous en avez généré un nouveau, l'ancien affichera « invitation
expirée », ce qui est le comportement voulu.

Le rôle **agent** ne s'obtient jamais par inscription libre.

---

## 3. Espace Super Admin (`/admin`)

**Tableau de bord** — agences actives, demandes en attente, utilisateurs, biens, courbes
de croissance et répartition par ville.

**Agences** — le cœur du rôle. Chaque nouvelle inscription arrive en « À valider ».
Ouvrez le dossier pour vérifier le RCCM et l'identifiant fiscal, puis validez ou
rejetez. Un rejet demande un motif, transmis au dirigeant.

Une agence validée devient opérationnelle : son dirigeant peut se connecter et inviter
son équipe. Une agence suspendue bloque immédiatement la connexion de tous ses agents.

**Utilisateurs** — tous les comptes, tous rôles confondus, avec leur dernière connexion.

**Journal d'audit** — chaque action sensible, son auteur, son résultat, l'adresse IP et
l'identifiant de requête. Filtrable par type de ressource. Ces enregistrements ne sont
ni modifiables ni supprimables.

---

## 4. Espace Agence (`/agence`)

**Agents** — « Inviter un agent » crée le compte et envoie un lien d'activation valable
48 heures. Le lien est aussi affiché à l'écran, avec un bouton de copie : si votre
serveur SMTP n'est pas configuré, vous pouvez le transmettre autrement.

Tant que l'agent n'a pas activé son compte, le menu de sa ligne propose :

- **Corriger l'invitation** — nom, adresse email, téléphone, fonction. Indispensable
  en cas de faute de frappe dans l'adresse, qui rendrait le lien inutilisable ;
- **Générer un nouveau lien** — affiché et copiable, il remplace les précédents.

**Retirer de l'équipe** distingue deux cas, précisés dans la confirmation :
un agent jamais activé est supprimé entièrement et son adresse redevient
disponible ; un agent qui a été actif perd tout accès, mais son compte est
conservé désactivé pour que les biens et transactions qu'il a traités gardent
leur auteur. Vous pourrez le réintégrer plus tard avec la même adresse.

Deux droits se règlent à l'invitation et se modifient ensuite :

| Droit | Effet |
|---|---|
| Gérer les propriétaires | Inviter des propriétaires et suivre leurs dossiers |
| Publier des biens | Mettre une annonce en ligne sur le catalogue public |

**Propriétaires** — invitez un propriétaire, il complète son dossier et dépose sa pièce
d'identité. Vous validez ensuite.

> La validation est **refusée par l'API** tant qu'aucune pièce d'identité n'a été
> déposée. Ce n'est pas un contrôle d'affichage : la conformité documentaire est
> garantie côté serveur.

**Biens** — deux vues : tableau pour piloter, galerie pour vérifier le rendu public.
Un bien créé démarre en brouillon. Sa publication exige un titre, un prix, une ville,
une description d'au moins 40 caractères et au moins une photo. À défaut, l'interface
affiche précisément ce qui manque.

**Clients** — fiches avec budget, origine du contact et notes. Un client créé par un
agent lui est automatiquement rattaché.

**Visites** — les demandes arrivent en « Demandée ». Vous confirmez, proposez un autre
créneau ou refusez. Après la visite, clôturez avec une note d'intérêt de 1 à 5 et un
compte rendu.

**Transactions** — ventes et locations. Le statut de la transaction pilote celui du
bien : une vente créée réserve le bien, une vente finalisée le passe en vendu et le
retire du catalogue. Un bail activé passe le bien en loué.

**Documents** — pièces d'identité, titres de propriété, mandats, contrats. Chaque pièce
est validée ou rejetée avec motif. Le téléchargement passe par l'API, qui contrôle les
droits et journalise l'accès.

**Messagerie** — conversations avec clients, propriétaires et collègues, toujours
cloisonnées à votre agence.

**Assistant IA** — voir la section 8.

---

## 5. Espace Agent (`/agent`)

Mêmes écrans que l'agence, mais restreints à ce qui vous est attribué : vos biens, vos
propriétaires, vos clients, vos visites, vos transactions.

Cette restriction est appliquée par le serveur, pas par l'affichage : une adresse
saisie à la main ne donne pas accès au portefeuille d'un collègue.

Les ventes et les locations sont séparées en deux entrées de menu, mais ouvrent la même
page sur l'onglet correspondant.

---

## 6. Espace Propriétaire (`/proprietaire`)

Consultation seule, ce qui est voulu : l'agence gère, vous suivez.

- **Mes biens** — état, statut, prix et consultations de chaque bien confié ;
- **Visites** — les rendez-vous programmés sur vos biens ;
- **Transactions** — les ventes et locations vous concernant ;
- **Documents** — vos pièces et leur statut de vérification ;
- **Messages** — échanges avec votre agent référent.

---

## 7. Espace Client (`/espace-client`)

- **Rechercher** — le catalogue, avec vos critères ;
- **Favoris** — les biens mis de côté, retirables d'un clic ;
- **Historique** — vos recherches passées, relançables ;
- **Mes demandes** — vos demandes de renseignements et leur statut ;
- **Mes visites** — vos rendez-vous, demandés ou confirmés ;
- **Messages** — échanges avec les agents.

---

## 8. Assistant immobilier

Le bouton flottant est présent sur tous les écrans connectés. Raccourci :
`Ctrl` + `K` (`Cmd` + `K` sur Mac).

### Rechercher

Décrivez le bien en une phrase. L'assistant extrait la ville, le quartier, le type, le
nombre de chambres, le budget et les équipements, puis propose les biens correspondants
**dans votre périmètre** : un client ne voit que le catalogue publié.

### Estimer

Donnez le type, la surface et le quartier. Le prix conseillé est calculé à partir de la
**médiane du prix au m² des biens comparables réellement enregistrés**. Si moins de
trois comparables existent, un barème régional prend le relais.

Le résultat affiche systématiquement le nombre de comparables, la méthode employée et
un indice de confiance. Un prix sans sa méthode ne se défend pas devant un propriétaire.

### Interroger le marché

L'assistant distingue une recherche d'une question de marché. « Quel est le prix
moyen à Cotonou ? » ne renvoie pas une liste de biens mais une médiane, une
fourchette et un prix au m², calculés sur les annonces de votre périmètre.

Les ventes et les locations sont calculées séparément : une médiane qui mêlerait
un loyer mensuel et un prix d'acquisition n'aurait aucun sens.

### Rédiger

À partir des caractéristiques, l'assistant propose un titre et une description en
français, modifiables avant publication.

### Atelier IA

La page dédiée (`/agence/assistant`, `/agent/assistant`) ajoute le **contrôle qualité**
d'une annonce publiée : score sur 100, champs manquants, points de vigilance
rédactionnels et recommandations.

---

## 9. Préférences

`/profil` regroupe le profil, la fiche de l'agence, le changement de mot de passe et le
choix du thème clair ou sombre. Le changement de mot de passe ferme toutes vos autres
sessions.

---

## 10. En cas de problème

**« L'API est injoignable »** — le backend n'est pas démarré. Lancez-le, ou passez en
mode démonstration (`VITE_DEMO_MODE=true`).

**« Session expirée »** — le renouvellement automatique du jeton a échoué. Reconnectez-vous.

**« Publication impossible »** — le message liste exactement les éléments manquants.

**Une action est absente d'un menu** — votre rôle ne l'autorise pas. Un agent sans le
droit de publication ne voit pas l'action « Publier ».
