# Installation

## Prérequis

| Outil | Version minimale | Vérifier |
|---|---|---|
| Node.js | 18 (20 ou 22 recommandé) | `node -v` |
| npm | 9 | `npm -v` |

Un navigateur récent est nécessaire (Chrome, Firefox, Edge ou Safari à jour).

---

## Installation

```bash
unzip immoflow-ai-frontend.zip
cd immoflow-ai-frontend
npm install
```

L'installation prend une trentaine de secondes et récupère environ 215 paquets.

Le fichier `.env` est déjà présent dans l'archive. Si vous partez d'un dépôt Git,
créez-le à partir du modèle :

```bash
cp .env.example .env
```

---

## Lancement

```bash
npm run dev
```

```
VITE v6.4.3  ready in 408 ms
➜  Local:   http://localhost:5173/
```

---

## Brancher le backend

Le frontend attend l'API sur `http://localhost:8000`.

```bash
cd ../immoflow-ai-api
cp backend/.env.example backend/.env    # renseignez SECRET_KEY
docker compose up -d
curl http://localhost:8000/health       # doit répondre "healthy"
```

Vite relaie `/api/*` vers cette adresse. Pour cibler un autre hôte :

```env
VITE_PROXY_TARGET=http://192.168.1.20:8000
```

Redémarrez `npm run dev` après toute modification de `.env` : les variables sont lues
au démarrage du serveur, pas à chaud.

---

## Build de production

```bash
npm run build      # génère dist/
npm run preview    # sert dist/ sur http://localhost:4173
```

Le dossier `dist/` est un site statique : déposez-le sur Netlify, Vercel, S3, Nginx ou
tout hébergeur de fichiers.

### Configuration Nginx

L'application utilise le routage par historique : toutes les routes doivent renvoyer
`index.html`, sinon un rafraîchissement sur `/agence/biens` produit une erreur 404.

```nginx
server {
    listen 80;
    root /var/www/immoflow;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

En production, `VITE_API_URL` doit pointer vers l'URL publique de l'API si celle-ci
n'est pas servie derrière le même domaine.

---

## Dépannage

**« L'API est injoignable » sur chaque écran**
Le backend n'est pas démarré, ou n'écoute pas sur le port attendu. Vérifiez avec
`curl http://localhost:8000/health`. Pour travailler sans backend, passez
`VITE_DEMO_MODE=true` dans `.env` et redémarrez.

**Le port 5173 est déjà utilisé**
```bash
npm run dev -- --port 5174
```

**Les polices ne s'affichent pas**
Fraunces, Manrope et JetBrains Mono sont chargées depuis Google Fonts. Sans connexion
Internet, le navigateur retombe sur les polices système : la mise en page reste
correcte, seul le caractère typographique change.

**Les photos des biens de démonstration ne s'affichent pas**
Elles proviennent d'Unsplash et nécessitent une connexion. Un dégradé de marque prend
le relais, la mise en page ne casse pas.

**Écran blanc après `npm run build`**
Vérifiez que le serveur renvoie bien `index.html` sur toutes les routes (voir la
configuration Nginx ci-dessus).

**Erreurs TypeScript après modification**
```bash
npm run typecheck
```
Le projet est livré avec zéro erreur : toute erreur provient d'une modification locale.
