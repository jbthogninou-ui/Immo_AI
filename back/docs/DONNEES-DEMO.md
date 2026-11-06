# Peuplement de la base

Le script `backend/scripts/seed_data.py` remplit la base avec un jeu de données
cohérent : agences, équipes, propriétaires, clients, biens photographiés, visites,
transactions, documents, conversations, notifications et journal d'audit.

---

## Utilisation

Depuis `backend/`, sur une base déjà migrée :

```bash
createdb immoflow                       # si nécessaire
alembic upgrade head
python -m app.database.init_db          # Super Admin + types de biens

PYTHONPATH=. python scripts/seed_data.py
```

Avec Docker :

```bash
docker compose exec api python scripts/seed_data.py
```

---

## Volumes

Valeurs par défaut, toutes ajustables :

| Option | Défaut | Effet |
|---|---:|---|
| `--agencies` | 4 | Agences créées |
| `--agents` | 4 | Agents dans l'agence principale (moitié pour les autres) |
| `--owners` | 8 | Propriétaires dans l'agence principale |
| `--clients` | 12 | Clients dans l'agence principale |
| `--properties` | 30 | Biens, répartis entre les agences actives |
| `--visits` | 45 | Visites, passées et à venir |
| `--sales` | 20 % des biens | Ventes générées |
| `--rentals` | 15 % des biens | Locations générées |
| `--conversations` | 4 | Conversations par agence |
| `--audit-logs` | 40 | Entrées d'audit par agence |
| `--password` | `Demo2026!` | Mot de passe des comptes créés |

Exemples :

```bash
# Jeu de démonstration standard
PYTHONPATH=. python scripts/seed_data.py

# Base fournie pour des tests de charge
PYTHONPATH=. python scripts/seed_data.py --agencies 6 --properties 200 \
    --clients 40 --owners 25 --agents 6 --visits 300

# Repartir de zéro
PYTHONPATH=. python scripts/seed_data.py --reset --properties 50

# Vider sans recréer
PYTHONPATH=. python scripts/seed_data.py --reset-only
```

Générer 200 biens et l'ensemble de leurs dépendances prend environ 4 secondes.

---

## Comptes créés

Un compte par rôle est garanti sur la première agence, avec le même mot de passe :

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Super Admin | `admin@immoflow.ai` | celui défini par `init_db` (`ChangeMe123!` par défaut) |
| Agence | `agence@immoflow.ai` | `Demo2026!` |
| Agent | `agent@immoflow.ai` | `Demo2026!` |
| Propriétaire | `proprietaire@immoflow.ai` | `Demo2026!` |
| Client | `client@immoflow.ai` | `Demo2026!` |

Les autres comptes générés utilisent le même mot de passe et des adresses dérivées
des noms.

---

## Ce que le script garantit

Le réalisme d'un jeu de données ne tient pas au volume mais à la cohérence. Le script
respecte les mêmes règles que l'API :

- chaque bien appartient à un propriétaire **de la même agence**, jamais d'une autre ;
- aucun bien n'est rattaché à un propriétaire resté au stade « invité » — l'API le
  refuserait ;
- un bien publié possède toujours une photo de couverture ;
- un bien vendu ou loué est retiré du catalogue public ;
- aucun brouillon n'est publié ;
- les visites et les transactions portent sur des biens de leur propre agence ;
- une vente finalisée place le bien en « vendu », un bail actif le place en « loué ».

Sept contrôles sont exécutés en fin de génération et affichés. Si l'un échoue, le
script s'arrête avec un code de sortie non nul — utilisable en intégration continue.

Le script garantit également qu'**aucun écran du produit n'est vide** : chaque compte de
démonstration dispose de biens, de visites, de transactions, de documents, de
conversations et de notifications.

---

## Reproductibilité

La graine aléatoire est fixe (`SEED = 20260803`). Deux exécutions avec les mêmes
options produisent le même jeu de données, ce qui rend les captures d'écran et les
démonstrations stables.

---

## Suppression

`--reset` et `--reset-only` ne suppriment **que** les données générées. Les agences
créées par le script portent un marqueur (`settings.seed = "true"`) et la suppression
est limitée à leur périmètre.

Concrètement :

- le compte Super Admin est préservé ;
- les types de biens créés par `init_db` sont préservés ;
- toute agence, tout bien, tout compte créé manuellement est préservé.

---

## Répartition des statuts

Le jeu de données couvre volontairement tous les cas que le produit doit savoir
afficher, pas seulement le cas nominal :

| Entité | Statuts représentés |
|---|---|
| Agences | actives, une en attente de validation, une suspendue |
| Agents | actifs, un invité par agence (compte non encore activé) |
| Propriétaires | vérifiés (majorité), en attente de vérification, invités |
| Biens | disponibles, réservés, vendus, loués, brouillons, archivés |
| Visites | demandées, confirmées, reprogrammées, effectuées, annulées, refusées, absences |
| Ventes | en cours et finalisées |
| Locations | actives et terminées |
| Documents | validés, en attente, avec pièces d'identité et titres fonciers |

C'est ce qui permet de démontrer l'écran de validation des agences, la vérification des
dossiers propriétaires ou le traitement des demandes de visite : sans données dans ces
états, ces écrans resteraient vides.
