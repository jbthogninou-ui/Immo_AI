# Architecture technique — ImmoFlow AI API

## 1. Vue d'ensemble

ImmoFlow AI est une API REST + WebSocket bâtie sur une architecture en couches inspirée
de la *clean architecture*, adaptée au contexte d'une API FastAPI asynchrone.

```
┌──────────────────────────────────────────────────────────────┐
│  Clients : web, mobile, intégrations                          │
└───────────────┬──────────────────────────┬───────────────────┘
                │ HTTPS                    │ WSS
┌───────────────▼──────────────────────────▼───────────────────┐
│  Reverse proxy (Nginx / Traefik) — TLS, upgrade WebSocket     │
└───────────────┬───────────────────────────────────────────────┘
┌───────────────▼───────────────────────────────────────────────┐
│  Uvicorn (N workers) — ImmoFlow AI API                        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Middlewares : request-id · timing · sécurité · quotas    │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ Routers API v1        │  WebSocket /ws                   │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ Dépendances : session · JWT · SecurityContext · Scope    │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ Services (règles métier, états, notifications, audit)    │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ Repositories (SQL + périmètre RBAC)                      │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ Modèles SQLAlchemy 2                                     │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────┬───────────────────────┬────────────────────┬───────────┘
       │                       │                    │
┌──────▼──────┐        ┌───────▼────────┐   ┌───────▼────────┐
│ PostgreSQL  │        │ Redis          │   │ Stockage       │
│ (asyncpg)   │        │ Pub/Sub·quotas │   │ local ou S3    │
└─────────────┘        └───────┬────────┘   └────────────────┘
                               │
                       ┌───────▼────────┐
                       │ Celery workers │ (optionnel)
                       └────────────────┘
```

## 2. Responsabilité de chaque couche

| Couche | Fait | Ne fait jamais |
|---|---|---|
| **Router** | Valide l'entrée/sortie, choisit le code HTTP, décide du `commit()` | Du SQL, des règles métier |
| **Dépendance** | Résout la session, l'utilisateur, le périmètre, applique les gardes RBAC | Des écritures |
| **Service** | Applique les règles métier, orchestre plusieurs repositories, notifie, audite | Du SQL brut, du HTTP |
| **Repository** | Construit et exécute les requêtes, applique le périmètre en SQL | Des décisions métier |
| **Modèle** | Décrit le schéma et les relations | De la logique applicative |

Cette séparation rend chaque règle testable isolément et garantit qu'une nouvelle route
ne peut pas contourner l'isolation multi-tenant : elle passerait forcément par un repository.

## 3. Gestion des transactions

Une requête HTTP correspond à une transaction :

1. `get_db()` ouvre une session (`AsyncSessionLocal`) pour la durée de la requête.
2. Les services enchaînent des `flush()` — les objets reçoivent leur identifiant et les
   contraintes sont vérifiées, sans validation définitive.
3. Le router appelle `session.commit()` une seule fois, en fin de traitement.
4. Toute exception déclenche un `rollback()` dans la dépendance.

Conséquence : une invitation d'agent qui échoue à l'étape de génération du jeton ne laisse
jamais un `User` orphelin en base.

Pour le WebSocket et Celery — hors cycle HTTP — `session_scope()` fournit un contexte
transactionnel équivalent avec commit automatique.

## 4. Isolation multi-tenant

Trois barrières successives :

**a. Dépendance** — `require_roles(...)` sur le router écarte les rôles non concernés.

**b. Service** — `ctx.require_same_agency(entity.agency_id)` sur les accès unitaires,
plus les règles spécifiques (un agent n'accède qu'à son portefeuille).

**c. Repository** — `scoped_query(ctx)` traduit le périmètre en clauses SQL :

```python
def scoped_query(self, ctx, *, agent_id=None, owner_id=None, public=False):
    stmt = select(Property).options(selectinload(Property.images))
    if public:
        return stmt.where(Property.is_published.is_(True), ...)
    if ctx.is_super_admin:
        return stmt
    if ctx.is_agency:
        return stmt.where(Property.agency_id == ctx.agency_id)
    if ctx.is_agent:
        return stmt.where(Property.agency_id == ctx.agency_id,
                          Property.agent_id == agent_id)
    if ctx.is_owner:
        return stmt.where(Property.owner_id == owner_id)
    ...
```

Un développeur qui ajoute un endpoint en oubliant la vérification métier obtient tout de
même une liste filtrée : la fuite de données inter-agences est structurellement empêchée.

## 5. Le `SecurityContext`

Construit à chaque requête à partir du JWT puis enrichi par un accès base :

```python
@dataclass(slots=True)
class SecurityContext:
    user_id: UUID
    role: UserRole
    email: str
    agency_id: UUID | None      # tenant
    owner_id: UUID | None       # fiche propriétaire liée
    client_id: UUID | None      # fiche client liée
    permissions: set[str]       # dérivées du rôle
```

Le `Scope` y ajoute `agent_id` (résolu depuis la table `agents`), afin que les
repositories filtrent sur l'identifiant métier et non sur l'identifiant utilisateur.

## 6. Temps réel

```
Client A ──ws──> Worker 1 ──┐
                            ├── Redis Pub/Sub (canal immoflow:events)
Client B ──ws──> Worker 3 ──┘
```

- `ConnectionManager` tient le registre des sockets **du worker courant**.
- `pubsub.publish(user_ids, payload)` publie l'événement sur Redis.
- `PubSubBridge`, lancée au démarrage, écoute le canal et relaie vers les sockets locales.
- Si Redis est indisponible, la diffusion retombe en local (mono-worker) et un
  avertissement est journalisé — le service ne s'interrompt pas.

Cette conception permet de multiplier les workers Uvicorn sans que deux utilisateurs
connectés à des processus différents cessent de se voir.

## 7. Machines à états

**Bien immobilier**

```
DRAFT ──► AVAILABLE ──► RESERVED ──► SOLD ──► ARCHIVED
            ▲   │           │
            │   └─────────► RENTED ──► AVAILABLE
            └─────────────────┘
```

Les transitions autorisées sont déclarées dans `ALLOWED_TRANSITIONS` ; toute autre
combinaison lève `BusinessRuleError` (HTTP 409).

- **Visite** : `REQUESTED → CONFIRMED | RESCHEDULED | REJECTED → COMPLETED | CANCELLED`
- **Vente** : `DRAFT → IN_PROGRESS → COMPLETED | CANCELLED` (une vente finalisée est figée)
- **Location** : `DRAFT → ACTIVE → TERMINATED | CANCELLED`
- **Propriétaire** : `INVITED → PENDING_VERIFICATION → ACTIVE | REJECTED | SUSPENDED`
- **Agence** : `PENDING_VALIDATION → ACTIVE ⇄ SUSPENDED | REJECTED`

Les transactions pilotent le statut du bien : finaliser une vente bascule le bien en
`SOLD` et le dépublie ; résilier une location le remet en `AVAILABLE`.

## 8. Module IA — conception à double niveau

Chaque fonction IA suit le même schéma :

```
Requête
  ├─► Si un fournisseur LLM est configuré : appel + parsing JSON strict
  │     └─ échec réseau, quota, JSON invalide ──┐
  └─► Repli déterministe local  ◄───────────────┘
```

Le repli n'est pas un message d'erreur mais une implémentation complète :

- **Description** : gabarits français avec accord grammatical et élision.
- **Estimation** : médiane du prix au m² des biens comparables de la base (même quartier,
  surface ±40 %) ; à défaut, barème régional. Ajustements pour équipements et ancienneté,
  rendement locatif pour les locations, indice de confiance fonction du nombre de comparables.
- **Assistant** : extraction par expressions régulières (chambres, ville, budget en
  « millions », type de bien, équipements) branchée sur le moteur de recherche existant.
- **Analyse d'annonce** : contrôle de complétude sur le modèle `Property` + heuristiques
  de qualité rédactionnelle, score sur 100.

Bénéfice : aucune dépendance externe bloquante, coût maîtrisé, et les résultats de
l'estimation s'appuient sur les **données réelles de l'agence** plutôt que sur les
approximations d'un modèle de langage.

## 9. Observabilité

- Journaux JSON en production (`python-json-logger`), lisibles en développement.
- `X-Request-ID` propagé de bout en bout et repris dans les réponses d'erreur.
- `X-Process-Time-ms` sur chaque réponse.
- `AuditLog` : acteur, action, ressource, IP, user-agent, `request_id`, charge utile.
- Sondes `/health` (complète), `/health/live` (vivacité), `/health/ready` (disponibilité).

## 10. Choix techniques notables

| Décision | Motivation |
|---|---|
| Horodatage côté Python (`default=_utcnow`) plutôt que `func.now()` seul | Évite l'expiration d'attribut après `UPDATE` et donc une E/S paresseuse pendant la sérialisation asynchrone ; `server_default` reste en place pour les insertions hors ORM |
| `NullPool` en environnement de test | Aucune connexion partagée entre boucles d'évènements |
| Jetons opaques hachés en SHA-256 pour invitations et réinitialisations | Une fuite de la base ne permet pas de rejouer un lien |
| Rotation systématique des refresh tokens | Le vol d'un jeton devient détectable et révoque la session |
| `selectinload` sur les médias des biens | Évite le problème N+1 sans jointure coûteuse |
| Filtre géographique par *bounding box* | Recherche de proximité utile sans imposer PostGIS en V1 |
| Rate limiting *fail-open* | Une panne Redis dégrade la protection, jamais la disponibilité |

## 11. Points d'extension

| Besoin | Où intervenir |
|---|---|
| Nouveau fournisseur LLM | `services/ai_provider.py` — implémenter le protocole `LLMProvider` |
| Stockage S3 | `services/storage.py` — implémenter le protocole `StorageBackend` |
| Nouveau rôle / permission | `core/permissions.py` + `scoped_query` des repositories concernés |
| Nouveau module métier | modèle → schéma → repository → service → router → migration |
| Recherche géographique fine | Activer PostGIS et remplacer le filtre par *bounding box* |
| Paiement, abonnement (V2) | Nouveau module isolé ; aucune dépendance à ajouter au cœur |
