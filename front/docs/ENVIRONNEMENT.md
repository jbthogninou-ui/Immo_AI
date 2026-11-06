# Variables d'environnement

Toutes les variables sont préfixées `VITE_` : c'est la condition pour que Vite les
expose au navigateur. Elles sont lues **au démarrage** du serveur — après modification
de `.env`, relancez `npm run dev`.

> Ces valeurs se retrouvent dans le bundle envoyé au navigateur. **N'y placez jamais de
> secret** : pas de clé d'API privée, pas de mot de passe, pas de jeton de service.

---

## Référence

### `VITE_API_URL`

Préfixe de tous les appels HTTP.

- Défaut : `/api/v1`
- En développement, laissez cette valeur : le proxy Vite se charge du relais.
- En production sur un domaine distinct : `https://api.votre-domaine.com/api/v1`

### `VITE_PROXY_TARGET`

Adresse du backend visée par le proxy de développement. **Sans effet en production** :
le proxy n'existe que dans le serveur Vite.

- Défaut : `http://localhost:8000`

### `VITE_WS_URL`

Adresse du WebSocket temps réel, utilisée par la messagerie.

- Défaut : `ws://localhost:8000/ws`
- En production derrière HTTPS : `wss://api.votre-domaine.com/ws`

### `VITE_DEMO_MODE`

Bascule entre l'API réelle et le serveur simulé.

| Valeur | Comportement |
|---|---|
| `false` *(défaut)* | Les requêtes partent vers `VITE_API_URL` |
| `true` | L'adaptateur HTTP est remplacé : aucune requête ne sort du navigateur |

En mode démonstration, l'écran de connexion propose cinq comptes correspondant aux cinq
rôles. C'est le mode à utiliser pour présenter l'interface sans infrastructure.

**À laisser sur `false` en production.**

### `VITE_APP_NAME`

Nom affiché dans l'interface.

- Défaut : `ImmoFlow AI`

---

## Fichiers d'exemple

### Développement avec le backend local

```env
VITE_API_URL=/api/v1
VITE_PROXY_TARGET=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
VITE_DEMO_MODE=false
VITE_APP_NAME=ImmoFlow AI
```

### Démonstration hors ligne

```env
VITE_API_URL=/api/v1
VITE_DEMO_MODE=true
VITE_APP_NAME=ImmoFlow AI
```

### Production

```env
VITE_API_URL=https://api.votre-domaine.com/api/v1
VITE_WS_URL=wss://api.votre-domaine.com/ws
VITE_DEMO_MODE=false
VITE_APP_NAME=ImmoFlow AI
```
