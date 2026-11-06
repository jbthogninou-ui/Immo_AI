#!/usr/bin/env python3
"""
Peuplement de la base ImmoFlow AI avec un jeu de données de démonstration.

Génère des données cohérentes entre elles : chaque bien appartient à un
propriétaire vérifié de la même agence, chaque visite porte sur un bien réel,
chaque vente fait basculer le statut du bien, et les compteurs affichés dans
les tableaux de bord correspondent au contenu réel des tables.

Prérequis
---------
    createdb immoflow
    alembic upgrade head
    python -m app.database.init_db     # crée le Super Admin et les types de biens

Utilisation
-----------
    # Volumes par défaut (10 utilisateurs applicatifs, 30 biens)
    PYTHONPATH=. python scripts/seed_data.py

    # Volumes personnalisés
    PYTHONPATH=. python scripts/seed_data.py --properties 120 --clients 60

    # Repartir de zéro (supprime uniquement les données générées)
    PYTHONPATH=. python scripts/seed_data.py --reset

Tous les comptes créés utilisent le même mot de passe, affiché en fin
d'exécution (« Demo2026! » par défaut).
"""

from __future__ import annotations

import argparse
import asyncio
import random
import sys
import unicodedata
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.database.session import AsyncSessionLocal
from app.models import (
    Agency,
    AgencyStatus,
    Agent,
    AgentStatus,
    AuditLog,
    Client,
    ClientAgent,
    ClientFavorite,
    ClientRequest,
    ClientSearchHistory,
    Contract,
    ContractKind,
    ContractStatus,
    Conversation,
    ConversationParticipant,
    ConversationType,
    Document,
    DocumentCategory,
    DocumentStatus,
    ListingType,
    Message,
    MessageType,
    Notification,
    NotificationType,
    Owner,
    OwnerEntityType,
    OwnerStatus,
    Property,
    PropertyImage,
    PropertyStatus,
    PropertyType,
    Rental,
    RentalStatus,
    Sale,
    SaleStatus,
    User,
    UserRole,
    UserStatus,
    Visit,
    VisitStatus,
)

# --------------------------------------------------------------------------
# Graine fixe : deux exécutions produisent le même jeu de données, ce qui rend
# les captures d'écran et les démonstrations reproductibles.
# --------------------------------------------------------------------------
SEED = 20260803
rng = random.Random(SEED)

DEFAULT_PASSWORD = "Demo2026!"
MARKER = "seed"  # Permet de retrouver et supprimer les données générées.


def now() -> datetime:
    return datetime.now(timezone.utc)


def days_ago(n: float) -> datetime:
    return now() - timedelta(days=n)


def slugify(value: str) -> str:
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return "-".join(part for part in text.lower().replace("'", " ").split() if part)


# --------------------------------------------------------------------------
# Référentiels béninois — noms, villes, quartiers
# --------------------------------------------------------------------------
FIRST_NAMES_M = [
    "Koffi", "Marc", "Rodrigue", "Serge", "Ibrahim", "Paul", "Didier", "Éric",
    "Bernard", "Aurélien", "Hervé", "Cyrille", "Gaston", "羅"[0:0] + "Placide",
    "Sylvain", "Rufin", "Anselme", "Blaise", "Damien", "Fabrice",
]
FIRST_NAMES_F = [
    "Awa", "Fatima", "Chantal", "Grâce", "Sylvie", "Nadia", "Bernadette",
    "Clarisse", "Estelle", "Rachelle", "Yvette", "Léonie", "Prisca", "Adjoa",
    "Mireille", "Solange", "Carine", "Delphine", "Reine", "Viviane",
]
LAST_NAMES = [
    "Dossou", "Houngbédji", "Mensah", "Adjovi", "Sossou", "Agbo", "Zinsou",
    "Ahouandjinou", "Kpodo", "Amoussou", "Lokossou", "Hounkpatin", "Tossou",
    "Aïvodji", "Djossou", "Gbaguidi", "Sagbo", "Aholou", "Quenum", "Bello",
    "Traoré", "Adjahoun", "Dagba", "Kakpo", "Sinsin", "Toffa",
]

CITY_DISTRICTS: dict[str, list[str]] = {
    "Cotonou": [
        "Fidjrossè", "Haie Vive", "Cadjèhoun", "Akpakpa", "Gbégamey",
        "Zogbo", "Ganhi", "Vedoko", "Sainte-Rita",
    ],
    "Abomey-Calavi": ["Godomey", "Calavi Centre", "Zogbadjè", "Tokan", "Hêvié"],
    "Porto-Novo": ["Djègan Daho", "Ouando", "Tokpota", "Houinmè"],
    "Parakou": ["Zongo", "Banikanni", "Titirou", "Guéma"],
    "Bohicon": ["Agbodjèlou", "Sodohomè", "Avogbanna"],
    "Ouidah": ["Centre", "Pahou", "Djègbadji"],
}

# Prix de référence au m² (XOF), par quartier puis par ville.
PRICE_PER_SQM = {
    "Haie Vive": 560_000, "Cadjèhoun": 540_000, "Fidjrossè": 520_000,
    "Ganhi": 470_000, "Sainte-Rita": 400_000, "Akpakpa": 380_000,
    "Gbégamey": 360_000, "Zogbo": 340_000, "Vedoko": 320_000,
    "Cotonou": 450_000, "Abomey-Calavi": 250_000, "Porto-Novo": 220_000,
    "Parakou": 150_000, "Bohicon": 130_000, "Ouidah": 190_000,
}

CITY_COORDS = {
    "Cotonou": (6.3654, 2.4183), "Abomey-Calavi": (6.4489, 2.3556),
    "Porto-Novo": (6.4969, 2.6289), "Parakou": (9.3372, 2.6303),
    "Bohicon": (7.1782, 2.0667), "Ouidah": (6.3628, 2.0852),
}

AMENITIES = [
    "piscine", "garage", "jardin", "climatisation", "meublé", "sécurité",
    "forage", "groupe électrogène", "ascenseur", "terrasse", "vue mer",
    "cuisine équipée", "parking", "internet fibre",
]

# Photos Unsplash — identifiants stables, servies en ligne.
PHOTO_IDS = [
    "photo-1600596542815-ffad4c1539a9", "photo-1600585154340-be6161a56a0c",
    "photo-1600607687939-ce8a6c25118c", "photo-1512917774080-9991f1c4c750",
    "photo-1613490493576-7fde63acd811", "photo-1600566753086-00f18fb6b3ea",
    "photo-1600047509807-ba8f99d2cdde", "photo-1580587771525-78b9dba3b914",
    "photo-1600566753190-17f0baa2a6c3", "photo-1502672260266-1c1ef2d93688",
    "photo-1600210492486-724fe5c67fb0", "photo-1493809842364-78817add7ffb",
    "photo-1568605114967-8130f3a36994", "photo-1570129477492-45c003edd2be",
    "photo-1576941089067-2de3c901e126", "photo-1583608205776-bfd35f0d9f83",
]


def photo(index: int, width: int = 1200) -> str:
    pid = PHOTO_IDS[index % len(PHOTO_IDS)]
    return f"https://images.unsplash.com/{pid}?auto=format&fit=crop&w={width}&q=70"


AGENCY_SEEDS = [
    ("Atlantique Immobilier", "Cotonou", "Résidentiel haut de gamme sur le littoral."),
    ("Littoral Habitat", "Cotonou", "Gestion locative et syndic de copropriété."),
    ("Ouémé Résidences", "Porto-Novo", "Promotion immobilière dans l'Ouémé."),
    ("Zou Patrimoine", "Bohicon", "Terrains et lotissements dans le Zou."),
    ("Nord Immo Services", "Parakou", "Location meublée pour expatriés."),
    ("Calavi Foncier", "Abomey-Calavi", "Parcelles titrées et viabilisées."),
]

PROPERTY_KINDS = [
    # (slug du type, libellé, surface min, surface max, chambres min, max)
    ("villa", "Villa", 150, 450, 3, 6),
    ("appartement", "Appartement", 55, 140, 1, 4),
    ("studio", "Studio", 25, 45, 1, 1),
    ("duplex", "Duplex", 180, 420, 4, 6),
    ("terrain", "Terrain", 300, 1200, 0, 0),
    ("bureau", "Bureau", 60, 300, 0, 0),
    ("boutique", "Boutique", 25, 120, 0, 0),
    ("immeuble", "Immeuble", 400, 900, 8, 16),
]

DESCRIPTION_OPENINGS = [
    "Bien récent implanté dans un secteur calme et facilement accessible.",
    "Construction soignée, livrée avec des finitions de qualité.",
    "Emplacement recherché, à quelques minutes des principaux axes.",
    "Ensemble lumineux et bien orienté, entretenu avec régularité.",
    "Adresse discrète dans un quartier résidentiel bien desservi.",
]
DESCRIPTION_CLOSINGS = [
    "Le dossier complet est disponible sur demande auprès de l'agence.",
    "Une visite permet d'apprécier le volume réel des pièces.",
    "Les diagnostics et le titre foncier sont à jour.",
    "Disponibilité immédiate, sous réserve de la constitution du dossier.",
    "Contactez l'agent référent pour organiser une visite.",
]


# --------------------------------------------------------------------------
# Statistiques d'exécution
# --------------------------------------------------------------------------
class Counter:
    def __init__(self) -> None:
        self.data: dict[str, int] = {}

    def add(self, label: str, n: int = 1) -> None:
        self.data[label] = self.data.get(label, 0) + n

    def report(self) -> str:
        width = max(len(k) for k in self.data) if self.data else 10
        lines = [f"  {k.ljust(width)}  {v:>5}" for k, v in self.data.items()]
        return "\n".join(lines)


stats = Counter()


# --------------------------------------------------------------------------
# Nettoyage
# --------------------------------------------------------------------------
async def reset(session: AsyncSession) -> None:
    """Supprime les données générées, en respectant l'ordre des dépendances."""
    print("Suppression des données existantes…")

    # Les agences générées portent un marqueur dans leurs réglages.
    result = await session.execute(
        select(Agency.id).where(Agency.settings["seed"].astext == "true")
    )
    agency_ids = [row[0] for row in result.all()]

    if not agency_ids:
        print("  Aucune donnée générée à supprimer.")
        return

    # Sous-requêtes de périmètre : on ne touche qu'aux lignes rattachées aux
    # agences générées, jamais aux données saisies manuellement.
    conv_ids = select(Conversation.id).where(Conversation.agency_id.in_(agency_ids))
    client_ids = select(Client.id).where(Client.agency_id.in_(agency_ids))

    await session.execute(delete(Message).where(Message.conversation_id.in_(conv_ids)))
    await session.execute(
        delete(ConversationParticipant).where(ConversationParticipant.conversation_id.in_(conv_ids))
    )
    prop_ids = select(Property.id).where(Property.agency_id.in_(agency_ids))
    await session.execute(delete(PropertyImage).where(PropertyImage.property_id.in_(prop_ids)))
    await session.execute(delete(ClientFavorite).where(ClientFavorite.client_id.in_(client_ids)))
    await session.execute(
        delete(ClientSearchHistory).where(ClientSearchHistory.client_id.in_(client_ids))
    )

    # L'ordre suit les clés étrangères, du plus dépendant au plus porteur.
    for model, column in [
        (Conversation, Conversation.agency_id),
        (Notification, Notification.agency_id),
        (AuditLog, AuditLog.agency_id),
        (Contract, Contract.agency_id),
        (Sale, Sale.agency_id),
        (Rental, Rental.agency_id),
        (Visit, Visit.agency_id),
        (Document, Document.agency_id),
        (ClientRequest, ClientRequest.agency_id),
        (ClientAgent, ClientAgent.agency_id),
        (Client, Client.agency_id),
        (Property, Property.agency_id),
        (Owner, Owner.agency_id),
        (Agent, Agent.agency_id),
    ]:
        await session.execute(delete(model).where(column.in_(agency_ids)))

    await session.execute(delete(User).where(User.agency_id.in_(agency_ids)))
    await session.execute(delete(Agency).where(Agency.id.in_(agency_ids)))
    await session.commit()
    print(f"  {len(agency_ids)} agence(s) générée(s) supprimée(s).")


# --------------------------------------------------------------------------
# Génération
# --------------------------------------------------------------------------
async def build(session: AsyncSession, args: argparse.Namespace) -> dict:
    password = hash_password(args.password)

    # Types de biens : créés par init_db, on les récupère (et on complète au besoin).
    result = await session.execute(select(PropertyType))
    types_by_slug = {t.slug: t for t in result.scalars().all()}
    for slug, label, *_ in PROPERTY_KINDS:
        if slug not in types_by_slug:
            pt = PropertyType(name=label, slug=slug, is_active=True)
            session.add(pt)
            types_by_slug[slug] = pt
    await session.flush()

    # Un compte de démonstration par rôle, sur la première agence.
    demo_accounts: dict[str, str] = {}

    agencies: list[Agency] = []
    agents_by_agency: dict[str, list[Agent]] = {}
    owners_by_agency: dict[str, list[Owner]] = {}
    clients_by_agency: dict[str, list[Client]] = {}
    users_by_agency: dict[str, list[User]] = {}
    properties: list[Property] = []

    # ---------------------------------------------------------------- Agences
    for index in range(args.agencies):
        name, city, description = AGENCY_SEEDS[index % len(AGENCY_SEEDS)]
        if index >= len(AGENCY_SEEDS):
            name = f"{name} {index // len(AGENCY_SEEDS) + 1}"

        # La première agence est active ; les suivantes couvrent tous les statuts
        # pour que l'écran de validation du Super Admin ait matière à montrer.
        if index == 0:
            status = AgencyStatus.ACTIVE
        elif index < args.agencies - 2:
            status = AgencyStatus.ACTIVE
        elif index == args.agencies - 2:
            status = AgencyStatus.PENDING_VALIDATION
        else:
            status = AgencyStatus.SUSPENDED

        slug = slugify(name)
        agency = Agency(
            name=name,
            slug=slug,
            email=f"contact@{slug.replace('-', '')}.bj",
            phone=f"+229 21 {rng.randint(10, 99)} {rng.randint(10, 99)} {rng.randint(10, 99)}",
            description=description,
            address=f"Carré {rng.randint(100, 2000)}, {rng.choice(CITY_DISTRICTS[city])}",
            city=city,
            country="Bénin",
            registration_number=f"RCCM/BJ/COT/{2014 + index}/B/{rng.randint(100, 9999)}",
            tax_id=f"IFU-{rng.randint(10**11, 10**12 - 1)}",
            status=status,
            validated_at=days_ago(240 - index * 20) if status == AgencyStatus.ACTIVE else None,
            settings={"seed": "true"},  # marqueur pour --reset
        )
        session.add(agency)
        await session.flush()
        agencies.append(agency)
        stats.add("agences")

        # Dirigeant de l'agence
        director_first = rng.choice(FIRST_NAMES_M + FIRST_NAMES_F)
        director_last = rng.choice(LAST_NAMES)
        email = "agence@immoflow.ai" if index == 0 else f"direction@{slug.replace('-', '')}.bj"
        director = User(
            email=email,
            hashed_password=password,
            full_name=f"{director_first} {director_last}",
            phone=f"+229 97 {rng.randint(10, 99)} {rng.randint(10, 99)} {rng.randint(10, 99)}",
            role=UserRole.AGENCY,
            status=UserStatus.ACTIVE if status == AgencyStatus.ACTIVE else UserStatus.PENDING,
            is_active=True,
            is_email_verified=True,
            agency_id=agency.id,
        )
        session.add(director)
        await session.flush()
        agency.owner_user_id = director.id
        users_by_agency[str(agency.id)] = [director]
        stats.add("utilisateurs")
        if index == 0:
            demo_accounts["Agence"] = email

        # ------------------------------------------------------------ Agents
        agency_agents: list[Agent] = []
        agent_count = args.agents if index == 0 else max(1, args.agents // 2)
        for a in range(agent_count):
            first = rng.choice(FIRST_NAMES_M + FIRST_NAMES_F)
            last = rng.choice(LAST_NAMES)
            agent_email = (
                "agent@immoflow.ai" if (index == 0 and a == 0)
                else f"{slugify(first)}.{slugify(last)}{a}@{slug.replace('-', '')}.bj"
            )
            # Le dernier agent de chaque agence reste au stade « invité ».
            invited = a == agent_count - 1 and agent_count > 1
            agent_user = User(
                email=agent_email,
                hashed_password=None if invited else password,
                full_name=f"{first} {last}",
                phone=f"+229 96 {rng.randint(10, 99)} {rng.randint(10, 99)} {rng.randint(10, 99)}",
                role=UserRole.AGENT,
                status=UserStatus.PENDING if invited else UserStatus.ACTIVE,
                is_active=True,
                is_email_verified=not invited,
                agency_id=agency.id,
                last_login_at=None if invited else days_ago(rng.uniform(0, 12)),
            )
            session.add(agent_user)
            await session.flush()

            agent = Agent(
                user_id=agent_user.id,
                agency_id=agency.id,
                job_title=rng.choice(
                    ["Négociateur", "Négociateur senior", "Conseillère location",
                     "Chargé de clientèle", "Assistante commerciale"]
                ),
                license_number=None if invited else f"LIC-{2018 + a}-{rng.randint(1000, 9999)}",
                status=AgentStatus.INVITED if invited else AgentStatus.ACTIVE,
                can_manage_owners=not invited,
                can_publish_properties=not invited,
                invited_at=days_ago(200 - a * 10),
                activated_at=None if invited else days_ago(199 - a * 10),
            )
            session.add(agent)
            await session.flush()
            agency_agents.append(agent)
            users_by_agency[str(agency.id)].append(agent_user)
            stats.add("agents")
            stats.add("utilisateurs")
            if index == 0 and a == 0:
                demo_accounts["Agent"] = agent_email

        agents_by_agency[str(agency.id)] = agency_agents
        active_agents = [a for a in agency_agents if a.status == AgentStatus.ACTIVE] or agency_agents

        # ----------------------------------------------------- Propriétaires
        agency_owners: list[Owner] = []
        owner_count = args.owners if index == 0 else max(2, args.owners // 2)
        for o in range(owner_count):
            first = rng.choice(FIRST_NAMES_M + FIRST_NAMES_F)
            last = rng.choice(LAST_NAMES)
            owner_email = (
                "proprietaire@immoflow.ai" if (index == 0 and o == 0)
                else f"{slugify(first)}.{slugify(last)}{o}@mail.bj"
            )

            # Répartition réaliste : la majorité vérifiée, quelques dossiers ouverts.
            roll = rng.random()
            if o == 0 or roll < 0.7:
                owner_status = OwnerStatus.ACTIVE
            elif roll < 0.85:
                owner_status = OwnerStatus.PENDING_VERIFICATION
            else:
                owner_status = OwnerStatus.INVITED

            owner_user = None
            if owner_status != OwnerStatus.INVITED:
                owner_user = User(
                    email=owner_email,
                    hashed_password=password,
                    full_name=f"{first} {last}",
                    phone=f"+229 95 {rng.randint(10, 99)} {rng.randint(10, 99)} {rng.randint(10, 99)}",
                    role=UserRole.OWNER,
                    status=UserStatus.ACTIVE,
                    is_active=True,
                    is_email_verified=True,
                    agency_id=agency.id,
                    last_login_at=days_ago(rng.uniform(0, 40)),
                )
                session.add(owner_user)
                await session.flush()
                users_by_agency[str(agency.id)].append(owner_user)
                stats.add("utilisateurs")

            owner = Owner(
                agency_id=agency.id,
                agent_id=rng.choice(active_agents).id,
                user_id=owner_user.id if owner_user else None,
                first_name=first,
                last_name=last,
                email=owner_email,
                phone=f"+229 95 {rng.randint(10, 99)} {rng.randint(10, 99)} {rng.randint(10, 99)}",
                address=f"{rng.choice(CITY_DISTRICTS[city])}",
                city=city,
                national_id_number=(
                    f"CIP-{rng.randint(10**9, 10**10 - 1)}"
                    if owner_status == OwnerStatus.ACTIVE else None
                ),
                status=owner_status,
                invited_at=days_ago(180 - o * 3),
                verified_at=days_ago(175 - o * 3) if owner_status == OwnerStatus.ACTIVE else None,
            )
            session.add(owner)
            await session.flush()
            agency_owners.append(owner)
            stats.add("propriétaires")
            if index == 0 and o == 0:
                demo_accounts["Propriétaire"] = owner_email

            # Pièce d'identité pour les dossiers traités
            if owner_status in (OwnerStatus.ACTIVE, OwnerStatus.PENDING_VERIFICATION):
                verified = owner_status == OwnerStatus.ACTIVE
                session.add(
                    Document(
                        agency_id=agency.id,
                        entity_type=OwnerEntityType.OWNER,
                        entity_id=owner.id,
                        category=DocumentCategory.IDENTITY_CIP,
                        status=DocumentStatus.VERIFIED if verified else DocumentStatus.PENDING,
                        filename=f"CIP-{slugify(first)}-{slugify(last)}.pdf",
                        storage_key=f"{MARKER}/cip/{owner.id}.pdf",
                        url=f"/api/v1/documents/{owner.id}/download",
                        mime_type="application/pdf",
                        size_bytes=rng.randint(180_000, 2_400_000),
                        uploaded_by_id=owner_user.id if owner_user else director.id,
                        verified_at=days_ago(174 - o * 3) if verified else None,
                    )
                )
                stats.add("documents")

        owners_by_agency[str(agency.id)] = agency_owners

        # ----------------------------------------------------------- Clients
        agency_clients: list[Client] = []
        client_count = args.clients if index == 0 else max(2, args.clients // 3)
        for c in range(client_count):
            first = rng.choice(FIRST_NAMES_M + FIRST_NAMES_F)
            last = rng.choice(LAST_NAMES)
            client_email = (
                "client@immoflow.ai" if (index == 0 and c == 0)
                else f"{slugify(first)}.{slugify(last)}{c}@mail.bj"
            )

            client_user = None
            if c < max(1, client_count // 3):  # un tiers dispose d'un compte
                client_user = User(
                    email=client_email,
                    hashed_password=password,
                    full_name=f"{first} {last}",
                    phone=f"+229 94 {rng.randint(10, 99)} {rng.randint(10, 99)} {rng.randint(10, 99)}",
                    role=UserRole.CLIENT,
                    status=UserStatus.ACTIVE,
                    is_active=True,
                    is_email_verified=True,
                    agency_id=agency.id,
                    last_login_at=days_ago(rng.uniform(0, 20)),
                )
                session.add(client_user)
                await session.flush()
                users_by_agency[str(agency.id)].append(client_user)
                stats.add("utilisateurs")

            budget_max = rng.choice([25, 40, 60, 90, 120, 180, 250]) * 1_000_000
            client = Client(
                agency_id=agency.id,
                user_id=client_user.id if client_user else None,
                first_name=first,
                last_name=last,
                email=client_email,
                phone=f"+229 94 {rng.randint(10, 99)} {rng.randint(10, 99)} {rng.randint(10, 99)}",
                city=rng.choice(list(CITY_DISTRICTS)),
                source=rng.choice(
                    ["Site web", "Recommandation", "Salon immobilier", "Facebook",
                     "Appel entrant", "Panneau"]
                ),
                budget_min=Decimal(str(int(budget_max * 0.5))),
                budget_max=Decimal(str(budget_max)),
                preferences={
                    "quartiers": rng.sample(CITY_DISTRICTS[city], k=min(2, len(CITY_DISTRICTS[city]))),
                    "chambres": rng.randint(2, 5),
                },
                is_active=rng.random() > 0.15,
            )
            session.add(client)
            await session.flush()
            agency_clients.append(client)
            stats.add("clients")
            if index == 0 and c == 0:
                demo_accounts["Client"] = client_email

            # Rattachement à un agent — la règle métier du CRM
            primary = rng.choice(active_agents)
            session.add(
                ClientAgent(
                    client_id=client.id,
                    agent_id=primary.id,
                    agency_id=agency.id,
                    is_primary=True,
                    assigned_at=days_ago(rng.uniform(1, 120)),
                )
            )

            # Historique de recherche
            for _ in range(rng.randint(0, 4)):
                district = rng.choice(CITY_DISTRICTS[city])
                kind = rng.choice(["villa", "appartement", "terrain", "studio"])
                rooms = rng.randint(2, 5)
                session.add(
                    ClientSearchHistory(
                        client_id=client.id,
                        query=f"{kind} {rooms} chambres {district} budget {budget_max // 1_000_000} millions",
                        filters={"city": city, "district": district, "max_price": budget_max},
                        results_count=rng.randint(0, 12),
                        created_at=days_ago(rng.uniform(0, 60)),
                    )
                )
                stats.add("recherches enregistrées")

        clients_by_agency[str(agency.id)] = agency_clients

    await session.flush()
    print(f"  Agences, équipes et contacts créés.")

    # ------------------------------------------------------------------ Biens
    reference_counters: dict[str, int] = {}
    active_agencies = [a for a in agencies if a.status == AgencyStatus.ACTIVE]

    for index in range(args.properties):
        agency = active_agencies[index % len(active_agencies)]
        key = str(agency.id)
        agency_agents_list = [
            a for a in agents_by_agency[key] if a.status == AgentStatus.ACTIVE
        ] or agents_by_agency[key]
        eligible_owners = [
            o for o in owners_by_agency[key]
            if o.status in (OwnerStatus.ACTIVE, OwnerStatus.PENDING_VERIFICATION)
        ]
        if not eligible_owners:
            continue

        slug, label, area_min, area_max, bed_min, bed_max = rng.choice(PROPERTY_KINDS)
        city = agency.city or "Cotonou"
        district = rng.choice(CITY_DISTRICTS[city])
        area = round(rng.uniform(area_min, area_max))
        bedrooms = rng.randint(bed_min, bed_max) if bed_max else None
        rooms = (bedrooms + rng.randint(1, 3)) if bedrooms else rng.randint(1, 4)
        bathrooms = max(1, (bedrooms or 1) - rng.randint(0, 1)) if bed_max else 1

        listing = ListingType.RENT if rng.random() < 0.38 else ListingType.SALE
        amenities = rng.sample(AMENITIES, k=rng.randint(2, 6))
        if slug == "terrain":
            amenities = rng.sample(["forage", "sécurité", "parking"], k=rng.randint(0, 2))
            bedrooms = bathrooms = None
            rooms = None

        base = PRICE_PER_SQM.get(district) or PRICE_PER_SQM.get(city, 200_000)
        bonus = 1 + min(0.35, 0.045 * len(amenities))
        if listing == ListingType.SALE:
            price = round(base * area * bonus, -5)
        else:
            price = round(base * area * bonus * 0.006, -4)
        price = max(price, 50_000 if listing == ListingType.RENT else 5_000_000)

        # Répartition des statuts. Les biens vendus et loués sont attribués
        # ensuite, par quotas explicites, pour que le volume de transactions
        # soit maîtrisé plutôt que laissé au hasard.
        roll = rng.random()
        if roll < 0.78:
            status = PropertyStatus.AVAILABLE
        elif roll < 0.90:
            status = PropertyStatus.DRAFT
        else:
            status = PropertyStatus.ARCHIVED

        published = status in (PropertyStatus.AVAILABLE, PropertyStatus.RESERVED)

        counter = reference_counters.get(key, 0) + 1
        reference_counters[key] = counter
        prefix = "".join(w[0] for w in agency.name.split()[:3]).upper()[:3] or "IMO"
        reference = f"BIEN-{prefix}-{counter:05d}"

        lat, lng = CITY_COORDS[city]
        description = (
            f"{rng.choice(DESCRIPTION_OPENINGS)} "
            f"{label} de {area} m² situé à {district}, {city}"
            + (f", comprenant {rooms} pièces dont {bedrooms} chambres" if bedrooms else "")
            + (f" et {bathrooms} salle(s) d'eau" if bathrooms else "")
            + ". "
            + (f"Prestations : {', '.join(amenities)}. " if amenities else "")
            + rng.choice(DESCRIPTION_CLOSINGS)
        )

        prop = Property(
            reference=reference,
            agency_id=agency.id,
            agent_id=rng.choice(agency_agents_list).id,
            owner_id=rng.choice(eligible_owners).id,
            property_type_id=types_by_slug[slug].id,
            title=(
                f"{label} {bedrooms} chambres à {district}" if bedrooms
                else f"{label} {area} m² à {district}"
            ),
            description=description,
            listing_type=listing,
            status=status,
            address=f"Carré {rng.randint(100, 2400)}, {district}",
            district=district,
            city=city,
            country="Bénin",
            latitude=round(lat + rng.uniform(-0.04, 0.04), 6),
            longitude=round(lng + rng.uniform(-0.04, 0.04), 6),
            price=Decimal(str(price)),
            currency="XOF",
            charges=Decimal(str(round(price * 0.08, -3))) if listing == ListingType.RENT else None,
            deposit=Decimal(str(price * 2)) if listing == ListingType.RENT else None,
            area=float(area),
            land_area=float(area if slug == "terrain" else round(area * rng.uniform(1.3, 2.2))),
            rooms=rooms,
            bedrooms=bedrooms,
            bathrooms=bathrooms,
            year_built=rng.randint(2008, 2025) if slug != "terrain" else None,
            amenities=amenities,
            is_published=published,
            published_at=days_ago(rng.uniform(1, 200)) if published else None,
            views_count=rng.randint(0, 480) if published else rng.randint(0, 15),
            created_at=days_ago(rng.uniform(5, 300)),
        )
        session.add(prop)
        await session.flush()
        properties.append(prop)
        stats.add("biens")

        # Photos — un terrain en a moins, une villa davantage.
        photo_count = 2 if slug == "terrain" else rng.randint(3, 6)
        captions = ["Façade", "Séjour", "Chambre", "Cuisine", "Extérieur", "Salle d'eau"]
        for p in range(photo_count):
            session.add(
                PropertyImage(
                    property_id=prop.id,
                    url=photo(index + p * 3),
                    thumbnail_url=photo(index + p * 3, 600),
                    caption=captions[p % len(captions)],
                    media_type="IMAGE",
                    is_cover=p == 0,
                    position=p,
                )
            )
            stats.add("photos")

        # Titre de propriété pour une partie des biens
        if rng.random() < 0.4:
            session.add(
                Document(
                    agency_id=agency.id,
                    entity_type=OwnerEntityType.PROPERTY,
                    entity_id=prop.id,
                    category=DocumentCategory.PROPERTY_TITLE,
                    status=DocumentStatus.VERIFIED,
                    filename=f"titre-foncier-{counter:05d}.pdf",
                    storage_key=f"{MARKER}/titles/{prop.id}.pdf",
                    url=f"/api/v1/documents/{prop.id}/download",
                    mime_type="application/pdf",
                    size_bytes=rng.randint(400_000, 3_200_000),
                    uploaded_by_id=rng.choice(agency_agents_list).user_id,
                    verified_at=days_ago(rng.uniform(10, 120)),
                )
            )
            stats.add("documents")

    await session.flush()
    print(f"  {len(properties)} bien(s) créé(s) avec leurs photos.")

    # ---------------------------------------------------------------- Favoris
    for agency in active_agencies:
        key = str(agency.id)
        agency_props = [p for p in properties if str(p.agency_id) == key and p.is_published]
        if not agency_props:
            continue
        for client in clients_by_agency[key]:
            for prop in rng.sample(agency_props, k=min(len(agency_props), rng.randint(0, 5))):
                session.add(
                    ClientFavorite(
                        client_id=client.id,
                        property_id=prop.id,
                        created_at=days_ago(rng.uniform(0, 60)),
                    )
                )
                stats.add("favoris")

    # ---------------------------------------------------------------- Visites
    visitable = [p for p in properties if p.status in (
        PropertyStatus.AVAILABLE, PropertyStatus.RESERVED,
        PropertyStatus.SOLD, PropertyStatus.RENTED,
    )]
    for _ in range(args.visits):
        prop = rng.choice(visitable)
        key = str(prop.agency_id)
        clients = clients_by_agency.get(key) or []
        if not clients:
            continue
        client = rng.choice(clients)

        future = rng.random() < 0.42
        when = (now() + timedelta(days=rng.uniform(0.5, 25))) if future else days_ago(rng.uniform(1, 90))

        if future:
            status = rng.choice([VisitStatus.REQUESTED, VisitStatus.CONFIRMED,
                                 VisitStatus.CONFIRMED, VisitStatus.RESCHEDULED])
        else:
            status = rng.choice([VisitStatus.COMPLETED, VisitStatus.COMPLETED,
                                 VisitStatus.CANCELLED, VisitStatus.NO_SHOW,
                                 VisitStatus.REJECTED])

        completed = status == VisitStatus.COMPLETED
        session.add(
            Visit(
                agency_id=prop.agency_id,
                property_id=prop.id,
                client_id=client.id,
                agent_id=prop.agent_id,
                scheduled_at=when,
                duration_minutes=rng.choice([30, 45, 45, 60, 90]),
                status=status,
                client_message=rng.choice([
                    None, "Disponible en matinée de préférence.",
                    "Je viendrai accompagné.", "Merci de confirmer l'adresse exacte.",
                    "Puis-je décaler d'une heure ?",
                ]),
                agent_notes="Client très intéressé, offre attendue." if completed and rng.random() < 0.5 else None,
                feedback="Bien conforme aux attentes." if completed and rng.random() < 0.6 else None,
                rating=rng.randint(3, 5) if completed else None,
                confirmed_at=days_ago(rng.uniform(1, 30)) if status != VisitStatus.REQUESTED else None,
                completed_at=when if completed else None,
                cancelled_at=when if status == VisitStatus.CANCELLED else None,
                created_at=when - timedelta(days=rng.uniform(1, 10)),
            )
        )
        stats.add("visites")

    # ----------------------------------------------------------- Transactions
    #
    # On sélectionne d'abord les biens concernés, puis on aligne leur statut
    # sur celui de la transaction — exactement ce que fait l'API quand une
    # vente est finalisée ou un bail activé.
    sale_counters: dict[str, int] = {}
    rent_counters: dict[str, int] = {}

    def prefix_for(agency_id) -> str:
        name = next(a.name for a in agencies if a.id == agency_id)
        return "".join(w[0] for w in name.split()[:3]).upper()[:3] or "IMO"

    def clients_of(agency_id) -> list[Client]:
        return clients_by_agency.get(str(agency_id)) or []

    available = [p for p in properties if p.status == PropertyStatus.AVAILABLE]
    for_sale = [p for p in available if p.listing_type == ListingType.SALE and clients_of(p.agency_id)]
    for_rent = [p for p in available if p.listing_type == ListingType.RENT and clients_of(p.agency_id)]
    rng.shuffle(for_sale)
    rng.shuffle(for_rent)

    # ---- Ventes -----------------------------------------------------------
    sale_target = min(args.sales, len(for_sale))
    for i, prop in enumerate(for_sale[:sale_target]):
        key = str(prop.agency_id)
        counter = sale_counters.get(key, 0) + 1
        sale_counters[key] = counter

        # Deux tiers finalisées, un tiers encore en cours.
        finalised = i < int(sale_target * 0.65)
        amount = float(prop.price) * rng.uniform(0.94, 1.0)
        rate = rng.choice([3.5, 4.0, 4.5, 5.0, 5.0])
        signed = days_ago(rng.uniform(5, 200))

        if finalised:
            prop.status = PropertyStatus.SOLD
            prop.is_published = False
        else:
            prop.status = PropertyStatus.RESERVED

        session.add(
            Sale(
                reference=f"VTE-{prefix_for(prop.agency_id)}-{counter:05d}",
                agency_id=prop.agency_id,
                property_id=prop.id,
                client_id=rng.choice(clients_of(prop.agency_id)).id,
                agent_id=prop.agent_id,
                owner_id=prop.owner_id,
                amount=Decimal(str(round(amount, -4))),
                currency="XOF",
                commission_rate=Decimal(str(rate)),
                commission_amount=Decimal(str(round(amount * rate / 100, 2))),
                status=SaleStatus.COMPLETED if finalised else SaleStatus.IN_PROGRESS,
                notes=rng.choice([None, "Financement bancaire validé.",
                                  "Compromis signé, acte en préparation.", "Paiement comptant."]),
                signed_at=signed if finalised else None,
                completed_at=signed + timedelta(days=rng.randint(3, 30)) if finalised else None,
                created_at=signed - timedelta(days=rng.randint(10, 60)),
            )
        )
        stats.add("ventes")

    # ---- Locations --------------------------------------------------------
    rent_target = min(args.rentals, len(for_rent))
    for i, prop in enumerate(for_rent[:rent_target]):
        key = str(prop.agency_id)
        counter = rent_counters.get(key, 0) + 1
        rent_counters[key] = counter

        months = rng.choice([12, 12, 24, 36])
        start_date = days_ago(rng.uniform(10, 500))
        ended = i >= int(rent_target * 0.75)  # un quart de baux terminés

        if not ended:
            prop.status = PropertyStatus.RENTED
            prop.is_published = False

        session.add(
            Rental(
                reference=f"LOC-{prefix_for(prop.agency_id)}-{counter:05d}",
                agency_id=prop.agency_id,
                property_id=prop.id,
                client_id=rng.choice(clients_of(prop.agency_id)).id,
                agent_id=prop.agent_id,
                owner_id=prop.owner_id,
                monthly_rent=prop.price,
                charges=prop.charges,
                deposit_amount=prop.deposit,
                currency="XOF",
                start_date=start_date.date(),
                end_date=(start_date + timedelta(days=30 * months)).date(),
                duration_months=months,
                status=RentalStatus.TERMINATED if ended else RentalStatus.ACTIVE,
                terminated_at=days_ago(rng.uniform(1, 60)) if ended else None,
                created_at=start_date - timedelta(days=rng.randint(2, 20)),
            )
        )
        stats.add("locations")

    await session.flush()

    # ------------------------------------------------------------- Messagerie
    for agency in active_agencies:
        key = str(agency.id)
        agency_agents_list = [a for a in agents_by_agency[key] if a.status == AgentStatus.ACTIVE]
        agency_props = [p for p in properties if str(p.agency_id) == key]
        agency_users = users_by_agency[key]
        client_users = [u for u in agency_users if u.role == UserRole.CLIENT]
        owner_users = [u for u in agency_users if u.role == UserRole.OWNER]
        if not agency_agents_list:
            continue

        for c in range(args.conversations):
            agent = rng.choice(agency_agents_list)
            agent_user_id = agent.user_id

            # Les deux premières conversations vont aux comptes de démonstration :
            # sans cela, un tirage malheureux laisserait leur messagerie vide.
            if c == 0 and owner_users:
                other = owner_users[0]
                ctype = ConversationType.OWNER_AGENT
            elif c == 1 and client_users:
                other = client_users[0]
                ctype = ConversationType.CLIENT_AGENT
            elif c % 3 == 0 and owner_users:
                other = rng.choice(owner_users)
                ctype = ConversationType.OWNER_AGENT
            elif client_users:
                other = rng.choice(client_users)
                ctype = ConversationType.CLIENT_AGENT
            else:
                continue

            prop = rng.choice(agency_props) if agency_props else None
            started = days_ago(rng.uniform(1, 45))
            conversation = Conversation(
                agency_id=agency.id,
                type=ctype,
                subject=f"{prop.title[:60]} — {prop.reference}" if prop else "Échange",
                property_id=prop.id if prop else None,
                created_by_id=agent_user_id,
                last_message_at=started,
                created_at=started,
            )
            session.add(conversation)
            await session.flush()
            stats.add("conversations")

            for user_id in (agent_user_id, other.id):
                session.add(
                    ConversationParticipant(
                        conversation_id=conversation.id,
                        user_id=user_id,
                        last_read_at=started,
                    )
                )

            exchange = [
                (agent_user_id, "Bonjour, je reviens vers vous concernant ce bien."),
                (other.id, "Bonjour, merci. Est-il toujours disponible ?"),
                (agent_user_id, "Oui. Souhaitez-vous que je programme une visite ?"),
                (other.id, "Volontiers, plutôt en fin de semaine."),
                (agent_user_id, "C'est noté, je vous confirme le créneau aujourd'hui."),
            ]
            last_at = started
            for m, (sender, content) in enumerate(exchange[: rng.randint(2, 5)]):
                last_at = started + timedelta(hours=m * rng.uniform(1, 8))
                session.add(
                    Message(
                        conversation_id=conversation.id,
                        sender_id=sender,
                        type=MessageType.TEXT,
                        content=content,
                        created_at=last_at,
                    )
                )
                stats.add("messages")
            conversation.last_message_at = last_at

        # Échanges internes dirigeant ↔ agents : sans eux, la messagerie de
        # l'agence resterait vide, le dirigeant n'étant participant d'aucune
        # conversation client.
        director_user = next(u for u in agency_users if u.role == UserRole.AGENCY)
        for agent in agency_agents_list[:3]:
            started = days_ago(rng.uniform(1, 20))
            conversation = Conversation(
                agency_id=agency.id,
                type=ConversationType.AGENT_AGENCY,
                subject=rng.choice([
                    "Point hebdomadaire sur le portefeuille",
                    "Objectifs du trimestre",
                    "Dossiers en attente de validation",
                    "Répartition des visites de la semaine",
                ]),
                created_by_id=director_user.id,
                last_message_at=started,
                created_at=started,
            )
            session.add(conversation)
            await session.flush()
            stats.add("conversations")

            for user_id in (director_user.id, agent.user_id):
                session.add(
                    ConversationParticipant(
                        conversation_id=conversation.id,
                        user_id=user_id,
                        last_read_at=started,
                    )
                )

            internal = [
                (director_user.id, "Merci de mettre à jour vos dossiers avant jeudi soir."),
                (agent.user_id, "C'est noté, je termine les fiches en cours aujourd'hui."),
                (director_user.id, "Parfait. Pensez aussi aux photos des biens en brouillon."),
            ]
            last_at = started
            for m, (sender, content) in enumerate(internal[: rng.randint(1, 3)]):
                last_at = started + timedelta(hours=m * rng.uniform(2, 10))
                session.add(
                    Message(
                        conversation_id=conversation.id,
                        sender_id=sender,
                        type=MessageType.TEXT,
                        content=content,
                        created_at=last_at,
                    )
                )
                stats.add("messages")
            conversation.last_message_at = last_at

    # ---------------------------------------------------------- Notifications
    NOTIFS = [
        (NotificationType.VISIT, "Demande de visite", "Un client souhaite visiter un de vos biens.", "/visites"),
        (NotificationType.NEW_MESSAGE, "Nouveau message", "Vous avez reçu un message.", "/messages"),
        (NotificationType.TRANSACTION, "Vente finalisée", "Une vente vient d'être clôturée.", "/transactions"),
        (NotificationType.DOCUMENT, "Document à vérifier", "Une pièce attend votre validation.", "/documents"),
        (NotificationType.ACCOUNT_VALIDATION, "Dossier validé", "Un propriétaire a été vérifié.", "/proprietaires"),
    ]
    for agency in active_agencies:
        for user in users_by_agency[str(agency.id)]:
            for _ in range(rng.randint(2, 6)):
                ntype, title, body, url = rng.choice(NOTIFS)
                created = days_ago(rng.uniform(0, 30))
                read = rng.random() < 0.55
                session.add(
                    Notification(
                        user_id=user.id,
                        agency_id=agency.id,
                        type=ntype,
                        title=title,
                        body=body,
                        action_url=url,
                        is_read=read,
                        read_at=created + timedelta(hours=2) if read else None,
                        created_at=created,
                    )
                )
                stats.add("notifications")

    # ----------------------------------------------------------- Journal d'audit
    ACTIONS = [
        ("property.create", "property"), ("property.publish", "property"),
        ("property.change_status", "property"), ("owner.invite", "owner"),
        ("owner.verify", "owner"), ("agent.invite", "agent"),
        ("client.create", "client"), ("client.assign", "client"),
        ("visit.request", "visit"), ("visit.decide", "visit"),
        ("sale.create", "sale"), ("document.upload", "document"),
        ("document.verify", "document"), ("auth.login", "user"),
    ]
    for agency in active_agencies:
        users = users_by_agency[str(agency.id)]
        for _ in range(args.audit_logs):
            action, resource = rng.choice(ACTIONS)
            session.add(
                AuditLog(
                    user_id=rng.choice(users).id,
                    agency_id=agency.id,
                    action=action,
                    resource_type=resource,
                    resource_id=str(rng.randint(10**5, 10**6)),
                    status="SUCCESS" if rng.random() > 0.06 else "FAILURE",
                    ip_address=f"41.79.{rng.randint(1, 254)}.{rng.randint(1, 254)}",
                    request_id=f"{rng.getrandbits(64):016x}",
                    payload={},
                    created_at=days_ago(rng.uniform(0, 45)),
                )
            )
            stats.add("entrées d'audit")

    # -------------------------------------------------------------- Contrats
    result = await session.execute(select(Sale).where(Sale.status == SaleStatus.COMPLETED))
    for sale in result.scalars().all():
        session.add(
            Contract(
                reference=f"CTR-{rng.getrandbits(24):06x}".upper(),
                agency_id=sale.agency_id,
                kind=ContractKind.SALE_DEED,
                status=ContractStatus.SIGNED,
                sale_id=sale.id,
                property_id=sale.property_id,
                title="Acte de vente",
                start_date=sale.signed_at.date() if sale.signed_at else date.today(),
                signed_at=sale.signed_at,
            )
        )
        stats.add("contrats")

    result = await session.execute(select(Rental).where(Rental.status == RentalStatus.ACTIVE))
    for rental in result.scalars().all():
        session.add(
            Contract(
                reference=f"CTR-{rng.getrandbits(24):06x}".upper(),
                agency_id=rental.agency_id,
                kind=ContractKind.LEASE,
                status=ContractStatus.SIGNED,
                rental_id=rental.id,
                property_id=rental.property_id,
                title="Bail d'habitation",
                start_date=rental.start_date,
                end_date=rental.end_date,
                signed_at=days_ago(rng.uniform(10, 400)),
            )
        )
        stats.add("contrats")

    await session.commit()
    return demo_accounts


# --------------------------------------------------------------------------
# Vérification
# --------------------------------------------------------------------------
async def verify(session: AsyncSession) -> None:
    """Contrôle la cohérence des données produites."""
    print("\nContrôles de cohérence")

    checks: list[tuple[str, bool, str]] = []

    orphans = await session.scalar(
        select(func.count()).select_from(Property).where(Property.owner_id.is_(None))
    )
    checks.append(("Aucun bien sans propriétaire", orphans == 0, f"{orphans} orphelin(s)"))

    mismatched = await session.scalar(
        select(func.count())
        .select_from(Property)
        .join(Owner, Property.owner_id == Owner.id)
        .where(Property.agency_id != Owner.agency_id)
    )
    checks.append((
        "Bien et propriétaire dans la même agence",
        mismatched == 0,
        f"{mismatched} incohérence(s)",
    ))

    bad_visits = await session.scalar(
        select(func.count())
        .select_from(Visit)
        .join(Property, Visit.property_id == Property.id)
        .where(Visit.agency_id != Property.agency_id)
    )
    checks.append(("Visites rattachées à la bonne agence", bad_visits == 0, f"{bad_visits} écart(s)"))

    published_draft = await session.scalar(
        select(func.count())
        .select_from(Property)
        .where(Property.is_published.is_(True), Property.status == PropertyStatus.DRAFT)
    )
    checks.append(("Aucun brouillon publié", published_draft == 0, f"{published_draft} cas"))

    no_cover = await session.scalar(
        select(func.count())
        .select_from(Property)
        .where(
            Property.is_published.is_(True),
            ~Property.id.in_(select(PropertyImage.property_id).where(PropertyImage.is_cover.is_(True))),
        )
    )
    checks.append(("Chaque bien publié a une photo de couverture", no_cover == 0, f"{no_cover} sans photo"))

    sold_published = await session.scalar(
        select(func.count())
        .select_from(Property)
        .where(Property.status == PropertyStatus.SOLD, Property.is_published.is_(True))
    )
    checks.append(("Aucun bien vendu encore publié", sold_published == 0, f"{sold_published} cas"))

    unverified_owner_props = await session.scalar(
        select(func.count())
        .select_from(Property)
        .join(Owner, Property.owner_id == Owner.id)
        .where(Owner.status == OwnerStatus.INVITED)
    )
    checks.append((
        "Aucun bien rattaché à un propriétaire non activé",
        unverified_owner_props == 0,
        f"{unverified_owner_props} cas",
    ))

    failed = 0
    for label, ok, detail in checks:
        if ok:
            print(f"  OK    {label}")
        else:
            failed += 1
            print(f"  ÉCHEC {label} — {detail}")

    if failed:
        print(f"\n{failed} contrôle(s) en échec.")
        sys.exit(1)


async def summary(session: AsyncSession) -> None:
    print("\nContenu de la base")
    rows = [
        ("Agences", Agency), ("Utilisateurs", User), ("Agents", Agent),
        ("Propriétaires", Owner), ("Clients", Client), ("Biens", Property),
        ("Photos", PropertyImage), ("Visites", Visit), ("Ventes", Sale),
        ("Locations", Rental), ("Contrats", Contract), ("Documents", Document),
        ("Conversations", Conversation), ("Messages", Message),
        ("Notifications", Notification), ("Entrées d'audit", AuditLog),
        ("Favoris", ClientFavorite), ("Recherches", ClientSearchHistory),
    ]
    width = max(len(label) for label, _ in rows)
    for label, model in rows:
        count = await session.scalar(select(func.count()).select_from(model))
        print(f"  {label.ljust(width)}  {count:>6}")

    published = await session.scalar(
        select(func.count()).select_from(Property).where(Property.is_published.is_(True))
    )
    print(f"\n  dont {published} bien(s) visibles sur le catalogue public")


# --------------------------------------------------------------------------
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Peuple la base ImmoFlow AI avec un jeu de démonstration cohérent.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--agencies", type=int, default=4, help="Nombre d'agences")
    parser.add_argument("--agents", type=int, default=4, help="Agents dans l'agence principale")
    parser.add_argument("--owners", type=int, default=8, help="Propriétaires dans l'agence principale")
    parser.add_argument("--clients", type=int, default=12, help="Clients dans l'agence principale")
    parser.add_argument("--properties", type=int, default=30, help="Nombre total de biens")
    parser.add_argument("--visits", type=int, default=45, help="Nombre total de visites")
    parser.add_argument("--sales", type=int, default=None,
                        help="Nombre de ventes (défaut : 20 %% des biens)")
    parser.add_argument("--rentals", type=int, default=None,
                        help="Nombre de locations (défaut : 15 %% des biens)")
    parser.add_argument("--conversations", type=int, default=4, help="Conversations par agence")
    parser.add_argument("--audit-logs", type=int, default=40, help="Entrées d'audit par agence")
    parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Mot de passe des comptes créés")
    parser.add_argument("--reset", action="store_true", help="Supprimer les données générées avant de recréer")
    parser.add_argument("--reset-only", action="store_true", help="Supprimer sans recréer")
    args = parser.parse_args()

    # Les transactions consomment des biens du catalogue : sans plafond
    # proportionnel, une valeur fixe viderait la vitrine publique.
    if args.sales is None:
        args.sales = max(1, round(args.properties * 0.20))
    if args.rentals is None:
        args.rentals = max(1, round(args.properties * 0.15))
    return args


async def main() -> None:
    args = parse_args()

    print("=" * 62)
    print("  ImmoFlow AI — peuplement de la base de démonstration")
    print("=" * 62)

    async with AsyncSessionLocal() as session:
        if args.reset or args.reset_only:
            await reset(session)
            if args.reset_only:
                print("\nTerminé.")
                return

        print("\nGénération…")
        demo_accounts = await build(session, args)

        await verify(session)
        await summary(session)

        print("\nComptes de démonstration")
        print(f"  Mot de passe commun : {args.password}")
        width = max(len(k) for k in demo_accounts) if demo_accounts else 12
        print(f"  {'Super Admin'.ljust(width)}  admin@immoflow.ai  (mot de passe défini par init_db)")
        for role, email in demo_accounts.items():
            print(f"  {role.ljust(width)}  {email}")

        print("\nDétail de la génération")
        print(stats.report())
        print("\nTerminé.")


if __name__ == "__main__":
    asyncio.run(main())
