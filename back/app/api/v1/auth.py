"""Endpoints d'authentification."""
from __future__ import annotations

from fastapi import APIRouter, File, UploadFile, status

from app.api.deps import ClientIP, Ctx, CurrentUser, DbSession, ScopeDep, UserAgent
from app.schemas.auth import (
    AcceptInvitationRequest, ChangePasswordRequest, ForgotPasswordRequest, LoginRequest,
    LogoutRequest, RefreshRequest, RegisterRequest, RegisterResponse, ResetPasswordRequest,
    SessionInfo, TokenPair,
)
from app.schemas.common import MessageResponse
from app.schemas.user import UserProfile, UserRead, UserUpdate
from app.services.auth import AuthService
from app.services.user import UserService

router = APIRouter(prefix="/auth", tags=["Authentification"])


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED,
             summary="Inscription (client, propriétaire ou agence)")
async def register(data: RegisterRequest, session: DbSession, ip: ClientIP):
    service = AuthService(session)
    user, upload_token = await service.register(data, ip=ip)
    await session.commit()
    response = RegisterResponse.model_validate(user)
    response.agency_upload_token = upload_token
    return response


@router.post("/login", response_model=TokenPair, summary="Connexion")
async def login(data: LoginRequest, session: DbSession, ip: ClientIP, ua: UserAgent):
    service = AuthService(session)
    _, tokens = await service.login(data, user_agent=ua, ip=ip)
    await session.commit()
    return tokens


@router.post("/refresh", response_model=TokenPair, summary="Renouvellement du jeton d'accès")
async def refresh(data: RefreshRequest, session: DbSession, ip: ClientIP, ua: UserAgent):
    tokens = await AuthService(session).refresh(data.refresh_token, user_agent=ua, ip=ip)
    await session.commit()
    return tokens


@router.post("/logout", response_model=MessageResponse, summary="Déconnexion")
async def logout(data: LogoutRequest, user: CurrentUser, session: DbSession):
    revoked = await AuthService(session).logout(
        user_id=user.id, refresh_token=data.refresh_token, all_devices=data.all_devices
    )
    await session.commit()
    return MessageResponse(message=f"{revoked} session(s) révoquée(s).")


@router.post("/forgot-password", response_model=MessageResponse,
             summary="Demande de réinitialisation de mot de passe")
async def forgot_password(data: ForgotPasswordRequest, session: DbSession):
    url = await AuthService(session).forgot_password(data.email)
    await session.commit()
    message = "Si un compte existe pour cette adresse, un email a été envoyé."
    if url:
        message += f" [dev] {url}"
    return MessageResponse(message=message)


@router.post("/reset-password", response_model=MessageResponse,
             summary="Réinitialisation du mot de passe")
async def reset_password(data: ResetPasswordRequest, session: DbSession):
    await AuthService(session).reset_password(data.token, data.new_password)
    await session.commit()
    return MessageResponse(message="Mot de passe réinitialisé.")


@router.post("/change-password", response_model=MessageResponse,
             summary="Changement de mot de passe")
async def change_password(data: ChangePasswordRequest, user: CurrentUser, session: DbSession):
    await AuthService(session).change_password(user, data)
    await session.commit()
    return MessageResponse(message="Mot de passe mis à jour ; les sessions ont été révoquées.")


@router.post("/accept-invitation", response_model=UserRead,
             summary="Activation d'un compte invité (agent ou propriétaire)")
async def accept_invitation(data: AcceptInvitationRequest, session: DbSession):
    user = await AuthService(session).accept_invitation(data.token, data.password, data.full_name)
    await session.commit()
    return user


@router.get("/me", response_model=UserProfile, summary="Profil de l'utilisateur connecté")
async def me(user: CurrentUser, ctx: Ctx, scope: ScopeDep):
    return UserProfile(
        **UserRead.model_validate(user).model_dump(),
        owner_id=ctx.owner_id,
        client_id=ctx.client_id,
        agent_id=scope.agent_id,
        permissions=sorted(ctx.permissions),
    )


@router.patch("/me", response_model=UserRead, summary="Mise à jour du profil")
async def update_me(data: UserUpdate, user: CurrentUser, session: DbSession):
    updated = await UserService(session).update_profile(user, data)
    await session.commit()
    return updated


@router.post("/me/avatar", response_model=UserRead, summary="Téléversement de l'avatar")
async def upload_avatar(user: CurrentUser, session: DbSession, file: UploadFile = File(...)):
    content = await file.read()
    updated = await UserService(session).set_avatar(
        user, content=content, filename=file.filename or "avatar.png", mime=file.content_type
    )
    await session.commit()
    return updated


@router.get("/sessions", response_model=list[SessionInfo], summary="Sessions actives")
async def sessions(user: CurrentUser, session: DbSession):
    from app.repositories.user import RefreshTokenRepository

    return await RefreshTokenRepository(session).list_sessions(user.id)