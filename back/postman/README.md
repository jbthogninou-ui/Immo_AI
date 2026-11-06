# Collection Postman — ImmoFlow AI API

Deux fichiers à importer dans Postman :

| Fichier | Rôle |
|---|---|
| `ImmoFlow-AI-API.postman_collection.json` | 114 requêtes couvrant les 85 endpoints, réparties en 16 dossiers |
| `ImmoFlow-Local.postman_environment.json` | Environnement local (`base_url = http://localhost:8000`) |

## Import

**Postman → Import → Files** → sélectionnez les deux fichiers, puis choisissez
l'environnement **ImmoFlow - Local** en haut à droite.

## Fonctionnement automatique des jetons

L'authentification est déclarée **au niveau de la collection** : chaque requête envoie
`Authorization: Bearer {{access_token}}`. Un script de pré-requête retire cet en-tête
pour les routes publiques (`/auth/login`, `/auth/register`, `/public/…`, `/health`).

Des scripts de test alimentent les variables au fil des appels :

| Requête | Variables renseignées |
|---|---|
| `Authentification → Connexion` | `access_token`, `refresh_token` |
| `Authentification → Renouvellement` | `access_token`, `refresh_token` |
| `Authentification → Profil` | `agency_id`, `agent_id`, `owner_id`, `client_id`, `user_id` |
| `Agents → Créer et inviter` | `agent_id`, `invitation_token` |
| `Propriétaires → Créer et inviter` | `owner_id`, `owner_invitation_token` |
| `CRM Clients → Créer` | `client_id` |
| `Biens → Créer` | `property_id` |
| `Visites → Demander` | `visit_id` |
| `Transactions → Créer une vente / location / contrat` | `sale_id`, `rental_id`, `contract_id` |
| `Messagerie → Créer une conversation` | `conversation_id` |
| `Documents → Téléverser` | `document_id` |

Vous n'avez donc jamais à copier-coller un identifiant à la main.

## Parcours de démonstration recommandé

Exécutez les requêtes dans cet ordre pour dérouler le cycle métier complet :

1. **Authentification → Connexion** (`admin@immoflow.ai` / `ChangeMe123!`)
2. **Authentification → Inscription** (rôle `AGENCY`)
3. **Authentification → Connexion** avec le compte agence, puis **Profil**
4. **Agences → Valider ou rejeter** (en tant que Super Admin) — l'agence passe `ACTIVE`
5. **Agents → Créer et inviter**, puis **Authentification → Activation d'un compte invité**
6. **Propriétaires → Créer et inviter**, puis **Accepter une invitation**
7. **Documents → Téléverser** (`entity_type=OWNER`, `category=IDENTITY_CIP`)
8. **Propriétaires → Vérifier le dossier** — le propriétaire passe `ACTIVE`
9. **Biens → Créer**, puis **Publier**
10. **Catalogue public → Rechercher** (sans authentification)
11. **CRM Clients → Créer**
12. **Visites → Demander**, puis **Clôturer**
13. **Transactions → Créer une vente**, puis passer le statut à `COMPLETED`
14. **Messagerie → Créer une conversation**, puis **Envoyer un message**
15. **IA → Description / Estimation / Assistant / Analyse d'annonce**

## WebSocket

Postman gère le WebSocket via **New → WebSocket Request** :

```
ws://localhost:8000/ws?token=<collez la valeur de access_token>
```

Message d'exemple à envoyer :

```json
{ "event": "message.send",
  "conversation_id": "<id>",
  "data": { "type": "TEXT", "content": "Bonjour depuis Postman" } }
```

## Paramètres de requête

Les paramètres optionnels (filtres, pagination) sont présents mais **désactivés** par
défaut dans chaque requête : cochez uniquement ceux dont vous avez besoin.
