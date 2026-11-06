"""Endpoints transactions : ventes, locations, contrats."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status
from fastapi.responses import Response

from app.api.deps import AgencyStaff, Ctx, DbSession, ScopeDep
from app.models.enums import RentalStatus, SaleStatus
from app.schemas.common import Page
from app.schemas.transaction import (
    ContractCreate, ContractRead, ContractSign, ContractUpdate, RentalCreate, RentalRead,
    RentalUpdate, SaleCreate, SaleRead, SaleUpdate,
)
from app.services.transaction import TransactionService
from app.utils.pagination import PaginationDep

router = APIRouter(tags=["Transactions"])


# --------------------------------- Ventes ---------------------------------- #
@router.get("/sales", response_model=Page[SaleRead], summary="Lister les ventes")
async def list_sales(
    ctx: Ctx, scope: ScopeDep, session: DbSession, pagination: PaginationDep,
    sale_status: SaleStatus | None = Query(default=None, alias="status"),
    property_id: uuid.UUID | None = Query(default=None),
):
    items, total = await TransactionService(session).sales.search(
        ctx, status=sale_status, property_id=property_id, agent_id=scope.agent_id,
        client_id=scope.client_id, owner_id=scope.owner_id,
        limit=pagination.limit, offset=pagination.offset,
    )
    return Page.create(
        [SaleRead.model_validate(i) for i in items], total, pagination.page, pagination.size
    )


@router.post("/sales", response_model=SaleRead, status_code=status.HTTP_201_CREATED,
             summary="Créer une vente", dependencies=[AgencyStaff])
async def create_sale(data: SaleCreate, ctx: Ctx, scope: ScopeDep, session: DbSession):
    sale = await TransactionService(session).create_sale(data, ctx, agent_id=scope.agent_id)
    await session.commit()
    return sale


@router.get("/sales/{sale_id}", response_model=SaleRead, summary="Détail d'une vente")
async def get_sale(sale_id: uuid.UUID, ctx: Ctx, scope: ScopeDep, session: DbSession):
    return await TransactionService(session)._get_sale(sale_id, ctx, agent_id=scope.agent_id)


@router.patch("/sales/{sale_id}", response_model=SaleRead, summary="Modifier une vente",
              dependencies=[AgencyStaff])
async def update_sale(
    sale_id: uuid.UUID, data: SaleUpdate, ctx: Ctx, scope: ScopeDep, session: DbSession
):
    sale = await TransactionService(session).update_sale(sale_id, data, ctx, agent_id=scope.agent_id)
    await session.commit()
    return sale


# -------------------------------- Locations -------------------------------- #
@router.get("/rentals", response_model=Page[RentalRead], summary="Lister les locations")
async def list_rentals(
    ctx: Ctx, scope: ScopeDep, session: DbSession, pagination: PaginationDep,
    rental_status: RentalStatus | None = Query(default=None, alias="status"),
    property_id: uuid.UUID | None = Query(default=None),
):
    items, total = await TransactionService(session).rentals.search(
        ctx, status=rental_status, property_id=property_id, agent_id=scope.agent_id,
        client_id=scope.client_id, owner_id=scope.owner_id,
        limit=pagination.limit, offset=pagination.offset,
    )
    return Page.create(
        [RentalRead.model_validate(i) for i in items], total, pagination.page, pagination.size
    )


@router.post("/rentals", response_model=RentalRead, status_code=status.HTTP_201_CREATED,
             summary="Créer une location", dependencies=[AgencyStaff])
async def create_rental(data: RentalCreate, ctx: Ctx, scope: ScopeDep, session: DbSession):
    rental = await TransactionService(session).create_rental(data, ctx, agent_id=scope.agent_id)
    await session.commit()
    return rental


@router.get("/rentals/{rental_id}", response_model=RentalRead, summary="Détail d'une location")
async def get_rental(rental_id: uuid.UUID, ctx: Ctx, scope: ScopeDep, session: DbSession):
    return await TransactionService(session)._get_rental(rental_id, ctx, agent_id=scope.agent_id)


@router.patch("/rentals/{rental_id}", response_model=RentalRead, summary="Modifier une location",
              dependencies=[AgencyStaff])
async def update_rental(
    rental_id: uuid.UUID, data: RentalUpdate, ctx: Ctx, scope: ScopeDep, session: DbSession
):
    rental = await TransactionService(session).update_rental(
        rental_id, data, ctx, agent_id=scope.agent_id
    )
    await session.commit()
    return rental


# -------------------------------- Contrats --------------------------------- #
@router.get("/contracts", response_model=Page[ContractRead], summary="Lister les contrats")
async def list_contracts(
    ctx: Ctx, scope: ScopeDep, session: DbSession, pagination: PaginationDep,
    sale_id: uuid.UUID | None = Query(default=None),
    rental_id: uuid.UUID | None = Query(default=None),
):
    if ctx.is_client:
        agency_id, client_id = None, ctx.client_id
    else:
        agency_id, client_id = (None if ctx.is_super_admin else ctx.agency_id), None
    items, total = await TransactionService(session).contracts.search(
        agency_id=agency_id, sale_id=sale_id, rental_id=rental_id, client_id=client_id,
        limit=pagination.limit, offset=pagination.offset,
    )
    return Page.create(
        [ContractRead.model_validate(i) for i in items], total, pagination.page, pagination.size
    )


@router.post("/contracts", response_model=ContractRead, status_code=status.HTTP_201_CREATED,
             summary="Générer un contrat", dependencies=[AgencyStaff])
async def create_contract(data: ContractCreate, ctx: Ctx, scope: ScopeDep, session: DbSession):
    contract = await TransactionService(session).create_contract(data, ctx, agent_id=scope.agent_id)
    await session.commit()
    return contract


@router.get("/contracts/{contract_id}", response_model=ContractRead, summary="Détail d'un contrat")
async def get_contract(contract_id: uuid.UUID, ctx: Ctx, session: DbSession):
    return await TransactionService(session).get_contract(contract_id, ctx)


@router.post("/contracts/{contract_id}/sign", response_model=ContractRead,
             summary="Signer un contrat (agence/agent ou client)")
async def sign_contract(
    contract_id: uuid.UUID, data: ContractSign, ctx: Ctx, scope: ScopeDep, session: DbSession,
):
    contract = await TransactionService(session).sign_contract(
        contract_id, data, ctx, agent_id=scope.agent_id,
    )
    await session.commit()
    return contract


@router.get("/contracts/{contract_id}/download", response_class=Response,
            summary="Télécharger le contrat (avec signatures)")
async def download_contract(contract_id: uuid.UUID, ctx: Ctx, session: DbSession):
    service = TransactionService(session)
    contract = await service.get_contract(contract_id, ctx)
    html = service.render_contract_html(contract)
    filename = f"{contract.reference}.html"
    return Response(
        content=html, media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.patch("/contracts/{contract_id}", response_model=ContractRead, summary="Modifier un contrat",
              dependencies=[AgencyStaff])
async def update_contract(
    contract_id: uuid.UUID, data: ContractUpdate, ctx: Ctx, session: DbSession
):
    contract = await TransactionService(session).update_contract(contract_id, data, ctx)
    await session.commit()
    return contract
