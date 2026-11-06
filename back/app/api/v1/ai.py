"""Endpoints du module IA immobilière."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import Ctx, DbSession, ScopeDep
from app.schemas.ai import (
    AssistantRequest, AssistantResponse, DescriptionRequest, DescriptionResponse,
    EstimationRequest, EstimationResponse, ListingAnalysisRequest, ListingAnalysisResponse,
)
from app.services.ai import AIService

router = APIRouter(prefix="/ai", tags=["IA immobilière"])


@router.post("/description", response_model=DescriptionResponse,
             summary="Générer une description d'annonce")
async def generate_description(data: DescriptionRequest, ctx: Ctx, session: DbSession):
    ctx.require("ai:use")
    return await AIService(session).generate_description(data, ctx)


@router.post("/estimate", response_model=EstimationResponse, summary="Estimer le prix d'un bien")
async def estimate_price(data: EstimationRequest, ctx: Ctx, session: DbSession):
    ctx.require("ai:use")
    return await AIService(session).estimate_price(data, ctx)


@router.post("/assistant", response_model=AssistantResponse,
             summary="Assistant immobilier (recherche en langage naturel)")
async def assistant(data: AssistantRequest, ctx: Ctx, scope: ScopeDep, session: DbSession):
    ctx.require("ai:use")
    result = await AIService(session).assistant(
        data, ctx, agent_id=scope.agent_id, owner_id=scope.owner_id
    )
    if ctx.is_client and scope.client_id:
        from app.services.client import ClientService

        await ClientService(session).record_search(
            scope.client_id, data.query, result.criteria.model_dump(mode="json"),
            result.results_count,
        )
        await session.commit()
    return result


@router.post("/analyze-listing", response_model=ListingAnalysisResponse,
             summary="Analyser la qualité d'une annonce")
async def analyze_listing(data: ListingAnalysisRequest, ctx: Ctx, session: DbSession):
    ctx.require("ai:use")
    return await AIService(session).analyze_listing(data, ctx)
