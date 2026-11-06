"""Service IA immobilière : description, estimation, assistant, analyse d'annonce.

Chaque fonction dispose d'un **repli déterministe** (heuristiques + données de
l'agence) afin que l'API reste utilisable sans fournisseur LLM configuré.
"""
from __future__ import annotations

import logging
import re
import statistics
import uuid
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ExternalServiceError, NotFoundError
from app.core.permissions import SecurityContext
from app.models.enums import ListingType
from app.repositories.property import PropertyRepository, PropertyTypeRepository
from app.schemas.ai import (
    AssistantRequest, AssistantResponse, DescriptionRequest, DescriptionResponse,
    EstimationRequest, EstimationResponse, ListingAnalysisRequest,
    ListingAnalysisResponse, ParsedSearchCriteria,
)
from app.schemas.property import PropertyFilters
from app.services.ai_provider import get_provider, parse_json_response

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Tu es un expert immobilier francophone travaillant en Afrique de l'Ouest "
    "(Bénin, Togo, Côte d'Ivoire). Tu rédiges avec précision, sans exagération, "
    "et tu n'inventes jamais de caractéristique non fournie."
)

# Le prompt système varie selon le rôle : un administrateur ne doit jamais se
# voir proposer des biens (il gère la plateforme, pas un portefeuille), un
# agent/agence a besoin d'aide pro (rédaction, estimation, fidélisation,
# promotion), un client/propriétaire cherche ou gère un bien. Dans tous les
# cas, l'assistant reste cantonné à l'immobilier sur la plateforme.
ROLE_SYSTEM_PROMPTS: dict[str, str] = {
    "SUPER_ADMIN": (
        SYSTEM_PROMPT + " Tu t'adresses ici à un administrateur de la plateforme, "
        "jamais à un client : ne lui propose jamais de biens à acheter ou louer. "
        "Aide-le sur des sujets de gestion de plateforme : statistiques d'usage, "
        "méthodes pour augmenter la visibilité des annonces, détection d'anomalies "
        "ou de failles à signaler, qualité des données, modération."
    ),
    "AGENCY": (
        SYSTEM_PROMPT + " Tu t'adresses à une agence immobilière professionnelle. "
        "Aide-la à rédiger des annonces, estimer des prix, fidéliser ses clients "
        "et promouvoir ses biens. Ne lui présente jamais l'app comme si elle "
        "était cliente d'un bien."
    ),
    "AGENT": (
        SYSTEM_PROMPT + " Tu t'adresses à un agent immobilier. Aide-le à rédiger "
        "des annonces, estimer des prix, fidéliser ses clients et promouvoir "
        "ses biens."
    ),
}

# Message de repli, poli, quand la question sort clairement du champ
# immobilier/plateforme (aucune raison de laisser l'assistant y répondre).
OFFTOPIC_REPLY = (
    "Désolé, je ne peux pas vous répondre : je suis votre assistant immobilier "
    "et je réponds uniquement aux questions liées aux biens, aux estimations, "
    "aux visites et à votre activité sur la plateforme."
)

_REAL_ESTATE_KEYWORDS = (
    "bien", "biens", "appartement", "maison", "villa", "terrain", "immeuble",
    "studio", "duplex", "chambre", "piece", "louer", "location", "vente",
    "vendre", "acheter", "achat", "prix", "budget", "estimation", "estimer",
    "annonce", "visite", "visiter", "agence", "agent", "proprietaire",
    "locataire", "quartier", "ville", "cotonou", "calavi", "porto-novo",
    "parakou", "surface", "m2", "m²", "loyer", "caution", "bail", "contrat",
    "commission", "mandat", "titre foncier", "cip", "fcfa", "xof",
    "statistique", "visibilite", "promouvoir", "promotion", "fideliser",
    "client", "signaler", "probleme", "faille", "plateforme", "compte",
    "document", "dossier",
)

# Prix de référence indicatifs au m² (XOF) — ajustables par agence.
BASELINE_PRICE_PER_SQM: dict[str, int] = {
    "cotonou": 450_000,
    "calavi": 250_000,
    "abomey-calavi": 250_000,
    "porto-novo": 220_000,
    "parakou": 150_000,
    "bohicon": 130_000,
    "_default": 200_000,
}
RENT_YIELD_MONTHLY = 0.006  # ≈ 0,6 % du prix de vente par mois

AMENITY_BONUS = {
    "piscine": 0.12, "garage": 0.05, "jardin": 0.04, "climatisation": 0.03,
    "meublé": 0.08, "meuble": 0.08, "ascenseur": 0.04, "sécurité": 0.05,
    "securite": 0.05, "groupe électrogène": 0.03, "forage": 0.03, "vue mer": 0.15,
}

NUMBER_WORDS = {
    "un": 1, "une": 1, "deux": 2, "trois": 3, "quatre": 4, "cinq": 5,
    "six": 6, "sept": 7, "huit": 8, "neuf": 9, "dix": 10,
}


KNOWN_DISTRICTS: dict[str, str] = {
    # quartier (en minuscules, sans accent superflu) -> ville de rattachement
    "fidjrossè": "Cotonou", "fidjrosse": "Cotonou",
    "haie vive": "Cotonou", "cadjèhoun": "Cotonou", "cadjehoun": "Cotonou",
    "akpakpa": "Cotonou", "gbégamey": "Cotonou", "gbegamey": "Cotonou",
    "zogbo": "Cotonou", "ganhi": "Cotonou", "vedoko": "Cotonou",
    "sainte-rita": "Cotonou",
    "godomey": "Abomey-Calavi", "calavi centre": "Abomey-Calavi",
    "zogbadjè": "Abomey-Calavi", "tokan": "Abomey-Calavi", "hêvié": "Abomey-Calavi",
    "djègan daho": "Porto-Novo", "ouando": "Porto-Novo", "tokpota": "Porto-Novo",
    "houinmè": "Porto-Novo",
    "zongo": "Parakou", "banikanni": "Parakou", "titirou": "Parakou",
    "agbodjèlou": "Bohicon", "pahou": "Ouidah",
}


class AIService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.properties = PropertyRepository(session)
        self.property_types = PropertyTypeRepository(session)
        self.provider = get_provider()

    # ------------------------------------------------------------------ #
    # 1. Génération de description
    # ------------------------------------------------------------------ #
    async def generate_description(
        self, data: DescriptionRequest, ctx: SecurityContext
    ) -> DescriptionResponse:
        data = await self._hydrate_from_property(data, ctx)

        # Sans fournisseur externe configuré, la rédaction locale est la voie
        # normale, pas un repli d'erreur.
        if self.provider.name == "local":
            return self._fallback_description(data)

        facts = self._describe_facts(data)

        try:
            raw = await self.provider.complete(
                system=SYSTEM_PROMPT,
                prompt=(
                    f"Rédige une annonce immobilière en {data.language}, ton {data.tone}, "
                    f"{data.max_words} mots maximum.\n"
                    "Réponds uniquement en JSON avec les clés: "
                    '{"title": str, "description": str, "highlights": [str]}\n\n'
                    f"Caractéristiques :\n{facts}"
                ),
                max_tokens=900,
            )
            payload = parse_json_response(raw)
            return DescriptionResponse(
                description=payload.get("description", "").strip(),
                title_suggestion=payload.get("title"),
                highlights=list(payload.get("highlights", []))[:8],
                provider=self.provider.name,
                model=None if self.provider.name == "local" else settings.AI_MODEL,
            )
        except (ExternalServiceError, ValueError, KeyError) as exc:
            logger.info("Repli local pour la génération de description (%s)", exc)
            return self._fallback_description(data)

    async def _hydrate_from_property(
        self, data: DescriptionRequest, ctx: SecurityContext
    ) -> DescriptionRequest:
        """Complète la demande avec les caractéristiques du bien référencé.

        Permet d'appeler /ai/description avec un simple property_id : les
        champs absents de la requête sont repris de la fiche, ceux fournis
        explicitement l'emportent.
        """
        if not data.property_id:
            return data

        prop = await self.properties.get(data.property_id)
        if not prop:
            raise NotFoundError("Bien introuvable.")

        type_label = data.property_type
        if not type_label and prop.property_type_id:
            from sqlalchemy import select

            from app.models.property import PropertyType

            row = await self.session.execute(
                select(PropertyType.name).where(PropertyType.id == prop.property_type_id)
            )
            type_label = row.scalar_one_or_none()

        return data.model_copy(
            update={
                "property_type": type_label or data.property_type,
                "listing_type": prop.listing_type,
                "area": data.area or prop.area,
                "district": data.district or prop.district,
                "city": data.city or prop.city,
                "rooms": data.rooms or prop.rooms,
                "bedrooms": data.bedrooms or prop.bedrooms,
                "bathrooms": data.bathrooms or prop.bathrooms,
                "price": data.price or prop.price,
                "currency": prop.currency or data.currency,
                "amenities": data.amenities or list(prop.amenities or []),
                "land_area": data.land_area or prop.land_area,
                "floor": data.floor if data.floor is not None else prop.floor,
                "year_built": data.year_built or prop.year_built,
                "charges": data.charges or prop.charges,
                "deposit": data.deposit or prop.deposit,
            }
        )

    def _describe_facts(self, data: DescriptionRequest) -> str:
        lines = [
            f"- Type : {data.property_type or 'bien immobilier'}",
            f"- Opération : {'vente' if data.listing_type is ListingType.SALE else 'location'}",
        ]
        if data.area:
            lines.append(f"- Surface : {data.area:g} m²")
        if data.rooms:
            lines.append(f"- Pièces : {data.rooms}")
        if data.bedrooms:
            lines.append(f"- Chambres : {data.bedrooms}")
        if data.bathrooms:
            lines.append(f"- Salles d'eau : {data.bathrooms}")
        location = ", ".join(filter(None, [data.district, data.city]))
        if location:
            lines.append(f"- Localisation : {location}")
        if data.price:
            lines.append(f"- Prix : {data.price:,.0f} {data.currency}".replace(",", " "))
        if data.amenities:
            lines.append(f"- Équipements : {', '.join(data.amenities)}")
        return "\n".join(lines)

    # Éléments de rédaction : la variété vient de la combinaison, pas d'un
    # texte unique. Chaque bien produit ainsi une annonce différente.
    _OPENINGS = [
        "Découvrez {article} {kind} {operation} à {location}.",
        "{Kind} {operation} à {location}, dans un secteur recherché.",
        "Nous vous proposons {article} {kind} {operation}, idéalement situé{e} à {location}.",
        "Rare sur le marché : {article} {kind} {operation} à {location}.",
        "Belle opportunité à {location} : {article} {kind} {operation}.",
    ]

    _AMBIANCE = [
        "L'ensemble bénéficie d'une belle luminosité et d'une distribution fonctionnelle.",
        "Les volumes sont généreux et les espaces de vie parfaitement agencés.",
        "Le bien a été entretenu avec soin et ne nécessite aucun travaux.",
        "La construction soignée et les finitions de qualité se remarquent dès l'entrée.",
        "L'agencement privilégie le confort quotidien et la circulation entre les pièces.",
    ]

    _ENVIRONMENT = [
        "Le quartier est calme, sécurisé et facilement accessible depuis les principaux axes.",
        "Commerces, écoles et transports se trouvent à quelques minutes.",
        "L'environnement immédiat est résidentiel, à l'écart des nuisances.",
        "Le secteur est en plein développement et bien desservi.",
        "L'adresse est appréciée pour sa tranquillité et sa proximité des commodités.",
    ]

    _AUDIENCE = {
        "SALE": [
            "Un bien qui conviendra aussi bien à une résidence principale qu'à un investissement locatif.",
            "Idéal pour une famille recherchant de l'espace sans quitter la ville.",
            "Une acquisition solide, dans un secteur où la demande reste soutenue.",
        ],
        "RENT": [
            "Une location adaptée à un couple ou à une petite famille.",
            "Parfait pour un séjour professionnel de moyenne ou longue durée.",
            "Un logement prêt à vivre, disponible rapidement.",
        ],
    }

    _CLOSINGS = [
        "Contactez l'agence pour organiser une visite et recevoir le dossier complet.",
        "Le dossier technique et le titre foncier sont disponibles sur demande.",
        "Une visite permet d'apprécier pleinement les volumes : contactez votre agent.",
        "Nous restons à votre disposition pour toute précision ou pour convenir d'un rendez-vous.",
    ]

    def _fallback_description(self, data: DescriptionRequest) -> DescriptionResponse:
        """Rédige une annonce complète sans appel à un modèle de langage.

        Le texte est assemblé à partir de la fiche du bien : il varie d'un bien
        à l'autre, tient 120 à 200 mots et suit la structure attendue d'une
        annonce professionnelle — accroche, caractéristiques, prestations,
        environnement, appel à l'action.
        """
        import random

        kind = (data.property_type or "bien").lower()
        location = ", ".join(filter(None, [data.district, data.city])) or "un emplacement recherché"
        is_sale = data.listing_type is ListingType.SALE
        operation = "à vendre" if is_sale else "à louer"
        # Genre grammatical : « ce villa » est fautif. La liste couvre les
        # types de biens du référentiel ; le masculin reste le défaut.
        feminine = {"villa", "maison", "boutique", "parcelle", "résidence", "chambre"}
        is_feminine = kind in feminine
        if is_feminine:
            article = "cette"
        elif kind[:1] in "aeiouyéèh":
            article = "cet"
        else:
            article = "ce"

        # Graine dérivée du bien : deux appels sur le même bien donnent le même
        # texte, deux biens différents donnent des textes différents.
        seed = hash((kind, location, data.area or 0, data.bedrooms or 0, tuple(data.amenities)))
        rnd = random.Random(seed)

        paragraphs: list[str] = []

        # --- Accroche ---------------------------------------------------
        opening = rnd.choice(self._OPENINGS).format(
            article=article, kind=kind, Kind=kind.capitalize(),
            operation=operation, location=location,
            e="e" if is_feminine else "",
        )

        # --- Caractéristiques -------------------------------------------
        specs: list[str] = []
        if data.area:
            specs.append(f"une surface de {data.area:g} m²")
        if data.rooms:
            specs.append(f"{data.rooms} pièce{'s' if data.rooms > 1 else ''}")
        if data.bedrooms:
            specs.append(f"{data.bedrooms} chambre{'s' if data.bedrooms > 1 else ''}")
        if data.bathrooms:
            specs.append(f"{data.bathrooms} salle{'s' if data.bathrooms > 1 else ''} d'eau")

        first = [opening]
        if specs:
            if len(specs) > 1:
                listed = ", ".join(specs[:-1]) + " et " + specs[-1]
            else:
                listed = specs[0]
            first.append(f"Il développe {listed}.")
        first.append(rnd.choice(self._AMBIANCE))

        # Détails déduits de la fiche : ils évitent l'annonce passe-partout.
        if data.year_built:
            age = 2026 - int(data.year_built)
            if age <= 2:
                first.append(f"Construction livrée en {data.year_built}, jamais rénovée depuis.")
            elif age <= 10:
                first.append(f"Bâti en {data.year_built}, l'ensemble est en très bon état général.")
            else:
                first.append(f"Édifié en {data.year_built}, le bien a été entretenu régulièrement.")
        if data.land_area and data.area and float(data.land_area) > float(data.area) * 1.2:
            reste = float(data.land_area) - float(data.area)
            first.append(
                f"La parcelle totalise {float(data.land_area):g} m², laissant environ "
                f"{reste:g} m² d'espace extérieur."
            )
        if data.floor:
            first.append(f"Le logement se situe au {data.floor}e étage.")
        paragraphs.append(" ".join(first))

        # --- Prestations et environnement -------------------------------
        second: list[str] = []
        if data.amenities:
            pretty = [a.strip().lower() for a in data.amenities if a]
            if len(pretty) > 1:
                listed = ", ".join(pretty[:-1]) + " et " + pretty[-1]
            else:
                listed = pretty[0]
            second.append(f"Côté prestations, le bien dispose de {listed}.")
        # Un équipement marquant mérite une phrase, pas une simple énumération.
        highlights = {
            "piscine": "La piscine, orientée pour profiter du soleil de fin de journée, prolonge naturellement l'espace de vie.",
            "vue mer": "La vue sur l'océan reste dégagée depuis les pièces principales.",
            "jardin": "Le jardin planté offre de l'ombre et un espace de jeu à l'abri des regards.",
            "garage": "Le garage fermé accueille deux véhicules et sert de rangement complémentaire.",
            "groupe électrogène": "Un groupe électrogène prend automatiquement le relais en cas de coupure.",
            "forage": "Le forage assure une alimentation en eau indépendante du réseau.",
            "ascenseur": "L'ascenseur dessert tous les niveaux, un confort rare dans le secteur.",
            "sécurité": "Le gardiennage est assuré jour et nuit, avec accès contrôlé.",
            "meublé": "Le bien est livré entièrement meublé et équipé : vous pouvez emménager immédiatement.",
            "internet fibre": "La fibre optique est déjà installée et opérationnelle.",
            "climatisation": "Toutes les pièces principales sont climatisées.",
        }
        for amenity in (data.amenities or [])[:2]:
            phrase = highlights.get(amenity.strip().lower())
            if phrase:
                second.append(phrase)

        second.append(rnd.choice(self._ENVIRONMENT))
        second.append(rnd.choice(self._AUDIENCE["SALE" if is_sale else "RENT"]))
        paragraphs.append(" ".join(second))

        # --- Conditions et appel à l'action -----------------------------
        third: list[str] = []
        if data.price:
            label = "Prix de vente" if is_sale else "Loyer mensuel"
            amount = f"{float(data.price):,.0f}".replace(",", " ")
            third.append(f"{label} : {amount} {data.currency}.")
            if data.area and is_sale:
                per_sqm = f"{float(data.price) / float(data.area):,.0f}".replace(",", " ")
                third.append(f"Soit environ {per_sqm} {data.currency} le mètre carré.")
        if not is_sale:
            if data.charges:
                amount = f"{float(data.charges):,.0f}".replace(",", " ")
                third.append(f"Charges mensuelles : {amount} {data.currency}.")
            if data.deposit:
                amount = f"{float(data.deposit):,.0f}".replace(",", " ")
                third.append(f"Caution demandée à l'entrée : {amount} {data.currency}.")
        third.append(rnd.choice(self._CLOSINGS))
        paragraphs.append(" ".join(third))

        description = "\n\n".join(paragraphs)

        # Respect de la longueur demandée : on coupe à la phrase, jamais au mot.
        limit = getattr(data, "max_words", None)
        if limit and len(description.split()) > limit:
            kept: list[str] = []
            total = 0
            for block in description.split("\n\n"):
                sentences = re.split(r"(?<=[.!?])\s+", block)
                buffer: list[str] = []
                for sentence in sentences:
                    words = len(sentence.split())
                    if total + words > limit and kept:
                        break
                    buffer.append(sentence)
                    total += words
                if buffer:
                    kept.append(" ".join(buffer))
                if total >= limit:
                    break
            description = "\n\n".join(kept)

        # --- Titre ------------------------------------------------------
        title_parts = [(data.property_type or "Bien").capitalize()]
        if data.bedrooms:
            title_parts.append(f"{data.bedrooms} chambres")
        if data.area:
            title_parts.append(f"{data.area:g} m²")
        title = " ".join(title_parts)
        if data.amenities:
            title += f" avec {data.amenities[0].lower()}"
        if location:
            title += f" à {location}"

        return DescriptionResponse(
            description=description,
            title_suggestion=title[:200],
            highlights=[a.capitalize() for a in data.amenities[:5]],
            provider="local",
            model=None,
        )

    # ------------------------------------------------------------------ #
    # 2. Estimation de prix
    # ------------------------------------------------------------------ #
    async def estimate_price(
        self, data: EstimationRequest, ctx: SecurityContext
    ) -> EstimationResponse:
        if data.property_id:
            prop = await self.properties.get(data.property_id)
            if not prop:
                raise NotFoundError("Bien introuvable.")
            data = data.model_copy(
                update={
                    "area": data.area or prop.area,
                    "district": data.district or prop.district,
                    "city": data.city or prop.city,
                    "rooms": data.rooms or prop.rooms,
                    "bedrooms": data.bedrooms or prop.bedrooms,
                    "listing_type": prop.listing_type,
                    "amenities": data.amenities or list(prop.amenities or []),
                    "currency": prop.currency,
                }
            )

        comparables = await self.properties.comparables(
            city=data.city, district=data.district,
            property_type_id=None, area=data.area,
        )
        sale_comps = [
            c for c in comparables
            if c.area and c.price and c.listing_type is not ListingType.RENT
        ]
        price_per_sqm: float | None = None
        method = "barème régional"

        if len(sale_comps) >= 3:
            values = [float(c.price) / float(c.area) for c in sale_comps]
            price_per_sqm = statistics.median(values)
            method = f"médiane de {len(sale_comps)} biens comparables"
        else:
            key = (data.district or data.city or "").strip().lower()
            price_per_sqm = float(
                BASELINE_PRICE_PER_SQM.get(key, BASELINE_PRICE_PER_SQM["_default"])
            )

        area = data.area or 100.0
        base = price_per_sqm * area

        bonus = 0.0
        for amenity in data.amenities:
            bonus += AMENITY_BONUS.get(amenity.strip().lower(), 0.0)
        bonus = min(bonus, 0.35)

        if data.year_built:
            age = max(0, 2026 - data.year_built)
            bonus -= min(0.20, age * 0.005)

        estimate = base * (1 + bonus)
        if data.listing_type is ListingType.RENT:
            estimate *= RENT_YIELD_MONTHLY
            method += " (rendement locatif appliqué)"

        confidence = 0.75 if len(sale_comps) >= 5 else (0.6 if len(sale_comps) >= 3 else 0.4)
        spread = 0.12 if confidence >= 0.6 else 0.22

        explanation = (
            f"Estimation basée sur {method}, soit environ "
            f"{price_per_sqm:,.0f} {data.currency}/m² pour {area:g} m². "
            f"Ajustement des équipements et de l'ancienneté : {bonus * 100:+.0f} %. "
            f"Fourchette de confiance ±{spread * 100:.0f} %."
        ).replace(",", " ")

        if self.provider.name != "local":
            try:
                comment = await self.provider.complete(
                    system=SYSTEM_PROMPT,
                    prompt=(
                        "Rédige en 2 phrases une justification d'estimation immobilière "
                        f"pour un bien de {area:g} m² à "
                        f"{data.district or data.city or 'localisation non précisée'}, "
                        f"estimé à {estimate:,.0f} {data.currency}. "
                        f"Méthode : {method}."
                    ),
                    max_tokens=200,
                )
                explanation = f"{explanation} {comment.strip()}"
            except ExternalServiceError:
                pass

        def money(value: float) -> Decimal:
            return Decimal(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        return EstimationResponse(
            suggested_price=money(estimate),
            price_range_min=money(estimate * (1 - spread)),
            price_range_max=money(estimate * (1 + spread)),
            currency=data.currency,
            confidence=round(confidence, 2),
            explanation=explanation,
            comparables_count=len(sale_comps),
            method=method,
            provider=self.provider.name,
        )

    # ------------------------------------------------------------------ #
    # 3. Assistant immobilier (recherche en langage naturel)
    # ------------------------------------------------------------------ #
    async def assistant(
        self, data: AssistantRequest, ctx: SecurityContext, *, agent_id=None, owner_id=None
    ) -> AssistantResponse:
        # Un administrateur gère la plateforme, pas un portefeuille de biens :
        # on ne lui propose jamais d'annonces, et on l'oriente vers ses propres
        # sujets (statistiques, visibilité, anomalies à signaler).
        if ctx.is_super_admin:
            return await self._assistant_for_admin(data.query)

        small_talk = self._detect_small_talk(data.query)
        if not small_talk and self._is_offtopic(data.query):
            return AssistantResponse(
                answer=OFFTOPIC_REPLY, criteria=ParsedSearchCriteria(),
                results=[], results_count=0, provider=self.provider.name,
            )

        criteria = await self._parse_query(data.query)

        results: list[dict] = []
        count = 0
        # Une moyenne calculée sur cinq biens n'a aucune valeur : on élargit
        # l'échantillon quand la question porte sur le marché.
        is_market = self._is_market_question(data.query)
        sample_limit = 200 if is_market else data.limit
        if data.include_results or is_market:
            property_type_id = await self._resolve_property_type(criteria.property_type)
            filters = PropertyFilters(
                q=None,
                city=criteria.city,
                district=criteria.district,
                listing_type=criteria.listing_type,
                bedrooms=criteria.bedrooms,
                rooms=criteria.rooms,
                min_price=criteria.min_price,
                max_price=criteria.max_price,
                min_area=criteria.min_area,
                property_type_id=property_type_id,
                sort="-created_at",
            )
            public = ctx.is_client
            rows, count = await self.properties.search(
                ctx, filters, agent_id=agent_id, owner_id=owner_id,
                public=public, limit=sample_limit, offset=0,
            )
            results = [
                {
                    "id": str(p.id),
                    "reference": p.reference,
                    "title": p.title,
                    "price": float(p.price),
                    "currency": p.currency,
                    "city": p.city,
                    "district": p.district,
                    "area": p.area,
                    "bedrooms": p.bedrooms,
                    "status": p.status.value,
                    "listing_type": p.listing_type.value,
                }
                for p in rows
            ]

        answer = self._compose_answer(data.query, criteria, results, count)
        if is_market and not data.include_results:
            results = []
        elif is_market:
            results = results[: data.limit]
        if self.provider.name != "local":
            try:
                answer = await self.provider.complete(
                    system=ROLE_SYSTEM_PROMPTS.get(ctx.role.value, SYSTEM_PROMPT),
                    prompt=(
                        "Réponds en français, 4 phrases maximum, comme un conseiller "
                        "immobilier. Ne cite que les biens fournis. Ne réponds jamais "
                        "à une question hors du champ immobilier/plateforme : dans ce "
                        f"cas réponds exactement « {OFFTOPIC_REPLY} ».\n"
                        f"Demande du client : {data.query}\n"
                        f"Critères détectés : {criteria.model_dump_json()}\n"
                        f"Biens disponibles ({count}) : {results[:5]}"
                    ),
                    max_tokens=400,
                )
            except ExternalServiceError:
                pass

        return AssistantResponse(
            answer=answer.strip(),
            criteria=criteria,
            results=results,
            results_count=count,
            provider=self.provider.name,
        )

    def _is_offtopic(self, query: str) -> bool:
        """Heuristique simple : aucune requête vide, mais aucun mot-clé du
        domaine immobilier/plateforme non plus → probablement hors sujet."""
        text = self._normalise(query)
        if len(text.strip()) < 3:
            return False
        return not any(keyword in text for keyword in _REAL_ESTATE_KEYWORDS)

    async def _assistant_for_admin(self, query: str) -> AssistantResponse:
        """Répond à un administrateur sans jamais lui proposer de biens à
        acheter/louer : statistiques de la plateforme, visibilité, anomalies."""
        small_talk = self._detect_small_talk(query)
        if small_talk:
            return AssistantResponse(
                answer=small_talk, criteria=ParsedSearchCriteria(),
                results=[], results_count=0, provider=self.provider.name,
            )

        text = self._normalise(query)
        is_admin_topic = any(
            keyword in text
            for keyword in (
                "statistique", "visibilite", "promouvoir", "promotion", "signaler",
                "faille", "probleme", "bug", "anomalie", "plateforme", "utilisateur",
                "agence", "moderation", "performance", "activite", "rapport",
            )
        )
        if not is_admin_topic:
            answer = OFFTOPIC_REPLY
        else:
            answer = (
                "En tant qu'administrateur, je peux vous aider sur les statistiques "
                "d'usage de la plateforme, des pistes pour améliorer la visibilité des "
                "annonces des agences, ou pour signaler une anomalie technique. "
                "Précisez votre besoin (ex. « comment améliorer la visibilité des "
                "agences peu actives » ou « je soupçonne une faille sur la page X »)."
            )

        if self.provider.name != "local" and is_admin_topic:
            try:
                answer = await self.provider.complete(
                    system=ROLE_SYSTEM_PROMPTS["SUPER_ADMIN"],
                    prompt=(
                        "Réponds en français, 4 phrases maximum, à un administrateur "
                        "de plateforme immobilière (pas un client). Ne propose jamais "
                        f"de biens à acheter/louer.\nQuestion : {query}"
                    ),
                    max_tokens=400,
                )
            except ExternalServiceError:
                pass

        return AssistantResponse(
            answer=answer.strip(), criteria=ParsedSearchCriteria(),
            results=[], results_count=0, provider=self.provider.name,
        )

    async def _parse_query(self, query: str) -> ParsedSearchCriteria:
        if self.provider.name != "local":
            try:
                raw = await self.provider.complete(
                    system=SYSTEM_PROMPT,
                    prompt=(
                        "Extrais les critères de recherche immobilière de la phrase "
                        "suivante. Réponds uniquement en JSON avec les clés "
                        '{"listing_type": "SALE"|"RENT"|null, "property_type": str|null, '
                        '"city": str|null, "district": str|null, "bedrooms": int|null, '
                        '"rooms": int|null, "min_price": number|null, '
                        '"max_price": number|null, "min_area": number|null, '
                        '"amenities": [str]}. Les montants sont en francs CFA.\n\n'
                        f"Phrase : {query}"
                    ),
                    max_tokens=400,
                )
                payload = parse_json_response(raw)
                return ParsedSearchCriteria(**{
                    k: v for k, v in payload.items()
                    if k in ParsedSearchCriteria.model_fields
                })
            except (ExternalServiceError, ValueError, TypeError) as exc:
                logger.info("Repli local pour l'analyse de requête (%s)", exc)
        return self._parse_query_heuristic(query)

    _TYPE_SYNONYMS = {
        "maison": "villa", "logement": "appartement", "appart": "appartement",
        "parcelle": "terrain", "local": "boutique", "magasin": "boutique",
    }

    async def _resolve_property_type(self, label: str | None):
        """Traduit un type exprimé en toutes lettres en identifiant de référentiel.

        Sans cette traduction, le critère « villa » était affiché dans la
        réponse mais jamais appliqué à la recherche.
        """
        if not label:
            return None
        slug = self._TYPE_SYNONYMS.get(label.lower(), label.lower())
        from sqlalchemy import select

        from app.models.property import PropertyType

        row = await self.session.execute(
            select(PropertyType.id).where(PropertyType.slug == slug).limit(1)
        )
        return row.scalar_one_or_none()

    def _parse_query_heuristic(self, query: str) -> ParsedSearchCriteria:
        text = query.lower()
        criteria = ParsedSearchCriteria()

        if any(word in text for word in ("louer", "location", "loyer", "à louer")):
            criteria.listing_type = ListingType.RENT
        elif any(word in text for word in ("acheter", "achat", "vente", "à vendre")):
            criteria.listing_type = ListingType.SALE

        for kind in ("villa", "maison", "appartement", "studio", "terrain", "bureau", "boutique", "duplex"):
            if kind in text:
                criteria.property_type = kind
                break

        for city in ("cotonou", "abomey-calavi", "calavi", "porto-novo", "parakou",
                     "bohicon", "ouidah", "sèmè-podji", "seme-podji", "natitingou"):
            if city in text:
                criteria.city = "Abomey-Calavi" if city == "calavi" else city.title()
                break

        # Quartiers : recherchés avant tout, car un client raisonne par
        # quartier bien plus souvent que par ville.
        for district, city in KNOWN_DISTRICTS.items():
            if district in text:
                criteria.district = district.title()
                criteria.city = criteria.city or city
                break

        rooms_match = re.search(r"(\d+)\s*(chambre|pièce|piece)", text)
        if rooms_match:
            value = int(rooms_match.group(1))
            if "chambre" in rooms_match.group(2):
                criteria.bedrooms = value
            else:
                criteria.rooms = value
        else:
            word_match = re.search(r"\b(" + "|".join(NUMBER_WORDS) + r")\s+chambres?", text)
            if word_match:
                criteria.bedrooms = NUMBER_WORDS[word_match.group(1)]

        criteria.max_price = self._extract_budget(text)

        area_match = re.search(r"(\d+)\s*m2|\bm²", text)
        if area_match and area_match.group(1):
            criteria.min_area = float(area_match.group(1))

        criteria.amenities = [
            amenity for amenity in ("piscine", "garage", "jardin", "meublé", "climatisation")
            if amenity in text
        ]
        return criteria

    def _extract_budget(self, text: str) -> Decimal | None:
        match = re.search(
            r"(\d+(?:[.,]\d+)?)\s*(millions?|million|m\b|milliards?|k\b|mille)", text
        )
        if match:
            amount = float(match.group(1).replace(",", "."))
            unit = match.group(2)
            factor = (
                1_000_000_000 if unit.startswith("milliard")
                else 1_000_000 if unit.startswith("m")
                else 1_000
            )
            return Decimal(int(amount * factor))
        plain = re.search(r"budget\D{0,10}(\d[\d\s]{4,})", text)
        if plain:
            return Decimal(int(plain.group(1).replace(" ", "")))
        return None

    # Motifs conversationnels : l'assistant doit répondre à autre chose qu'une
    # requête de recherche, sinon la première question hors sujet le fait
    # paraître cassé.
    _SMALL_TALK = [
        (("bonjour", "bonsoir", "salut", "hello", "coucou"),
         "Bonjour. Décrivez-moi le bien que vous cherchez — type, quartier, "
         "nombre de chambres, budget — et je vous propose ce qui correspond."),
        (("merci", "super", "parfait", "ok merci"),
         "Avec plaisir. Dites-moi si vous voulez affiner la recherche ou "
         "programmer une visite."),
        (("aide", "help", "que peux-tu", "que sais-tu", "comment ça marche",
          "tu fais quoi", "capacités"),
         "Je peux chercher un bien à partir d'une phrase, estimer un prix à "
         "partir des biens comparables du portefeuille, et rédiger une annonce. "
         "Par exemple : « villa 4 chambres à Fidjrossè, budget 150 millions »."),
        (("au revoir", "bye", "à bientôt"),
         "À bientôt. Votre historique de recherche est conservé dans votre espace."),
    ]

    _MARKET_PATTERNS = (
        "prix moyen", "prix moyens", "prix au m", "prix du m", "combien coute",
        "combien coûte", "combien ça coûte", "quel prix", "quels prix",
        "prix medians", "prix médian", "tendance", "marché", "marche immobilier",
        "combien de biens", "combien y a", "combien avez",
    )

    def _is_market_question(self, query: str) -> bool:
        text = self._normalise(query)
        return any(pattern in text for pattern in self._MARKET_PATTERNS)

    @staticmethod
    def _normalise(text: str) -> str:
        import unicodedata

        stripped = unicodedata.normalize("NFKD", text.lower())
        return "".join(c for c in stripped if not unicodedata.combining(c))

    def _market_answer(
        self, criteria: ParsedSearchCriteria, results: list[dict], count: int, query: str
    ) -> str:
        """Répond à une question sur le marché plutôt que de lister des biens.

        Les chiffres proviennent des biens réellement accessibles à l'appelant :
        un client voit la moyenne du catalogue publié, une agence celle de son
        propre portefeuille. Aucune donnée d'une autre agence n'y entre.
        """
        zone = criteria.district or criteria.city
        place = f"à {zone}" if zone else "dans votre périmètre"

        if not results:
            return (
                f"Je n'ai aucun bien {place} pour établir une moyenne fiable. "
                "Élargissez la zone, ou précisez un type de bien — par exemple "
                "« prix moyen des villas à Cotonou »."
            )

        # On calcule séparément les ventes et les locations : une médiane qui
        # mélange un loyer et un prix d'acquisition ne veut rien dire.
        sales = [r for r in results if r.get("listing_type") != "RENT"]
        rentals = [r for r in results if r.get("listing_type") == "RENT"]
        sample = sales if len(sales) >= len(rentals) else rentals
        kind = "à la vente" if sample is sales else "en location"
        if not sample:
            sample = results
            kind = ""
        count = len(sample)

        prices = sorted(r["price"] for r in sample)
        per_sqm = sorted(
            r["price"] / r["area"] for r in sample if r.get("area")
        )
        currency = sample[0].get("currency", "XOF")

        def fmt(value: float) -> str:
            return f"{value:,.0f}".replace(",", " ")

        median = prices[len(prices) // 2]
        suffix = " par mois" if kind == "en location" else ""
        lines = [
            f"Sur les {count} bien{'s' if count > 1 else ''} {kind} {place} que je peux "
            f"consulter, le prix médian est de {fmt(median)} {currency}{suffix}."
        ]
        if prices[0] != prices[-1]:
            lines.append(f"La fourchette va de {fmt(prices[0])} à {fmt(prices[-1])} {currency}.")
        if per_sqm:
            median_sqm = per_sqm[len(per_sqm) // 2]
            lines.append(f"Soit environ {fmt(median_sqm)} {currency} le mètre carré.")
        lines.append(
            "Ces chiffres portent sur les annonces en cours, pas sur les ventes "
            "conclues. Pour un bien précis, demandez-moi une estimation."
        )
        return " ".join(lines)

    def _detect_small_talk(self, query: str) -> str | None:
        text = query.strip().lower()
        if not text:
            return None
        for triggers, reply in self._SMALL_TALK:
            if any(text == t or text.startswith(t) for t in triggers):
                return reply
        return None

    def _describe_criteria(self, criteria: ParsedSearchCriteria) -> str:
        """Reformule les critères compris, pour que l'utilisateur puisse corriger."""
        bits: list[str] = []
        if criteria.property_type:
            bits.append(criteria.property_type)
        if criteria.bedrooms:
            bits.append(f"au moins {criteria.bedrooms} chambre{'s' if criteria.bedrooms > 1 else ''}")
        elif criteria.rooms:
            bits.append(f"{criteria.rooms} pièce{'s' if criteria.rooms > 1 else ''}")
        if criteria.district:
            bits.append(f"à {criteria.district}")
        elif criteria.city:
            bits.append(f"à {criteria.city}")
        if criteria.min_area:
            bits.append(f"d'au moins {float(criteria.min_area):g} m²")
        if criteria.max_price:
            amount = f"{float(criteria.max_price):,.0f}".replace(",", " ")
            bits.append(f"sous {amount} XOF")
        if criteria.listing_type is ListingType.RENT:
            bits.append("en location")
        elif criteria.listing_type is ListingType.SALE:
            bits.append("à la vente")
        if criteria.amenities:
            bits.append("avec " + ", ".join(criteria.amenities))
        return " ".join(bits)

    def _compose_answer(
        self, query: str, criteria: ParsedSearchCriteria, results: list[dict], count: int
    ) -> str:
        """Compose une réponse conversationnelle, sans modèle de langage.

        Trois cas : une salutation ou une question générale, une recherche
        fructueuse, une recherche sans résultat. Dans les trois, la réponse
        indique ce qui a été compris et propose une suite concrète.
        """
        small_talk = self._detect_small_talk(query)
        if small_talk:
            return small_talk

        if self._is_market_question(query):
            return self._market_answer(criteria, results, count, query)

        summary = self._describe_criteria(criteria)

        # --- Aucun critère exploitable ----------------------------------
        if not summary and not results:
            return (
                "Je n'ai pas identifié de critère précis dans votre demande. "
                "Précisez au moins le type de bien et la zone — par exemple "
                "« appartement 2 chambres à Cadjèhoun » ou « terrain à Godomey "
                "budget 30 millions »."
            )

        # --- Aucun résultat ---------------------------------------------
        if not results:
            subject = summary or "cette recherche"
            joiner = "" if subject.startswith(("à ", "au ", "en ", "avec ")) else "à "
            lines = [f"Aucun bien ne correspond {joiner}{subject} pour le moment."]
            suggestions: list[str] = []
            if criteria.max_price:
                higher = f"{float(criteria.max_price) * 1.3:,.0f}".replace(",", " ")
                suggestions.append(f"porter le budget à {higher} XOF")
            if criteria.district:
                suggestions.append(f"élargir au-delà de {criteria.district}")
            elif criteria.city:
                suggestions.append("étendre la recherche aux villes voisines")
            if criteria.bedrooms and criteria.bedrooms > 2:
                suggestions.append(f"accepter {criteria.bedrooms - 1} chambres")
            if suggestions:
                if len(suggestions) > 1:
                    listed = ", ".join(suggestions[:-1]) + " ou " + suggestions[-1]
                else:
                    listed = suggestions[0]
                lines.append(f"Vous pourriez {listed}.")
            lines.append(
                "Vous pouvez aussi adresser une demande à l'agence : elle vous "
                "alertera dès qu'un bien correspondant sera publié."
            )
            return " ".join(lines)

        # --- Résultats trouvés ------------------------------------------
        top = results[0]
        price = f"{top['price']:,.0f}".replace(",", " ")
        place = top.get("district") or top.get("city") or ""

        # Le résumé commence parfois déjà par une préposition (« à Cotonou ») :
        # on ne préfixe alors pas une seconde fois.
        subject = summary or "votre recherche"
        joiner = "" if subject.startswith(("à ", "au ", "en ", "avec ")) else "à "
        lines = [
            f"{count} bien{'s' if count > 1 else ''} correspond"
            f"{'ent' if count > 1 else ''} {joiner}{subject}."
        ]

        detail = f"Le plus pertinent : {top['title']}, {price} {top['currency']}"
        if place:
            detail += f" à {place}"
        if top.get("area"):
            detail += f", {top['area']:g} m²"
        if top.get("bedrooms"):
            detail += f", {top['bedrooms']} chambres"
        lines.append(detail + ".")

        # Fourchette de prix : uniquement si tous les biens relèvent de la même
        # opération. Mélanger un loyer mensuel et un prix de vente produirait
        # une fourchette absurde (« de 880 000 à 547 600 000 XOF »).
        listings = {r.get("listing_type") for r in results}
        if count > 1 and len(listings) == 1:
            prices = sorted(r["price"] for r in results)
            low = f"{prices[0]:,.0f}".replace(",", " ")
            high = f"{prices[-1]:,.0f}".replace(",", " ")
            if prices[0] != prices[-1]:
                lines.append(f"Les prix proposés vont de {low} à {high} {top['currency']}.")

        if count > len(results):
            lines.append(f"Je n'affiche que les {len(results)} premiers résultats.")

        lines.append(
            "Ouvrez une fiche pour voir les photos et demander une visite, ou "
            "précisez un critère pour affiner."
        )
        return " ".join(lines)

    # ------------------------------------------------------------------ #
    # 4. Analyse d'annonce
    # ------------------------------------------------------------------ #
    async def analyze_listing(
        self, data: ListingAnalysisRequest, ctx: SecurityContext
    ) -> ListingAnalysisResponse:
        title = data.title
        description = data.description
        missing: list[str] = []

        if data.property_id:
            prop = await self.properties.get_with_images(data.property_id)
            if not prop:
                raise NotFoundError("Bien introuvable.")
            if not ctx.is_super_admin and ctx.agency_id and prop.agency_id != ctx.agency_id:
                raise NotFoundError("Bien introuvable.")
            title = title or prop.title
            description = description or prop.description
            checks = {
                "photos": bool(prop.images),
                "surface": bool(prop.area),
                "chambres": prop.bedrooms is not None,
                "pièces": prop.rooms is not None,
                "adresse": bool(prop.address),
                "quartier": bool(prop.district),
                "ville": bool(prop.city),
                "géolocalisation": prop.latitude is not None and prop.longitude is not None,
                "propriétaire rattaché": prop.owner_id is not None,
                "équipements": bool(prop.amenities),
            }
            missing = [label for label, present in checks.items() if not present]

        issues: list[str] = []
        suggestions: list[str] = []
        text = (description or "").strip()
        words = len(text.split())

        if words == 0:
            issues.append("Description absente.")
            suggestions.append("Rédigez une description de 120 à 200 mots.")
        elif words < 60:
            issues.append(f"Description trop courte ({words} mots).")
            suggestions.append("Détaillez l'environnement, les commodités et l'état du bien.")
        elif words > 500:
            issues.append("Description très longue : risque de perte d'attention.")

        if text and text.upper() == text and words > 3:
            issues.append("Texte entièrement en majuscules.")
        if text.count("!") > 3:
            issues.append("Ponctuation excessive (ton trop promotionnel).")
        if re.search(r"\b(\+?\d[\d\s.-]{7,})\b", text):
            issues.append("Un numéro de téléphone figure dans la description.")
            suggestions.append("Retirez les coordonnées directes : la mise en relation passe par l'agence.")
        if title and len(title) < 15:
            issues.append("Titre trop court pour le référencement.")

        score = 100
        score -= len(missing) * 6
        score -= len(issues) * 8
        score = max(0, min(100, score))

        if missing:
            suggestions.append("Complétez les champs manquants : " + ", ".join(missing) + ".")
        if not suggestions:
            suggestions.append("Annonce complète : pensez à actualiser les photos régulièrement.")

        if self.provider.name != "local" and text:
            try:
                raw = await self.provider.complete(
                    system=SYSTEM_PROMPT,
                    prompt=(
                        "Analyse cette annonce immobilière et réponds uniquement en JSON "
                        '{"quality_issues": [str], "suggestions": [str]} (3 éléments max chacun).\n'
                        f"Titre : {title}\nDescription : {text[:2000]}"
                    ),
                    max_tokens=500,
                )
                payload = parse_json_response(raw)
                issues += [str(i) for i in payload.get("quality_issues", [])][:3]
                suggestions += [str(s) for s in payload.get("suggestions", [])][:3]
            except (ExternalServiceError, ValueError):
                pass

        return ListingAnalysisResponse(
            score=score,
            missing_fields=missing,
            quality_issues=issues,
            suggestions=suggestions,
            provider=self.provider.name,
        )
