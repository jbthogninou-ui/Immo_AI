"""Repositories utilisateurs et jetons."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_, select, update

from app.models.user import PasswordResetToken, RefreshToken, User
from app.repositories.base import BaseRepository


def _lower(column):
    return func.lower(column)


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(_lower(User.email) == email.strip().lower())
        return (await self.session.execute(stmt)).scalars().first()

    async def search(self, *, term: str | None, agency_id: uuid.UUID | None, limit: int, offset: int):
        stmt = select(User)
        if agency_id:
            stmt = stmt.where(User.agency_id == agency_id)
        if term:
            like = f"%{term.lower()}%"
            stmt = stmt.where(
                or_(_lower(User.email).like(like), _lower(User.full_name).like(like))
            )
        stmt = stmt.order_by(User.created_at.desc())
        return await self.paginate(stmt, limit=limit, offset=offset)

    async def touch_last_login(self, user_id: uuid.UUID) -> None:
        await self.session.execute(
            update(User).where(User.id == user_id).values(last_login_at=datetime.now(timezone.utc))
        )


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    model = RefreshToken

    async def get_active(self, token_hash: str) -> RefreshToken | None:
        stmt = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
        return (await self.session.execute(stmt)).scalars().first()

    async def revoke(self, token: RefreshToken) -> None:
        token.revoked_at = datetime.now(timezone.utc)
        await self.session.flush()

    async def revoke_all_for_user(self, user_id: uuid.UUID) -> int:
        result = await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await self.session.flush()
        return result.rowcount or 0

    async def list_sessions(self, user_id: uuid.UUID):
        stmt = (
            select(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .order_by(RefreshToken.created_at.desc())
            .limit(50)
        )
        return (await self.session.execute(stmt)).scalars().all()


class PasswordResetTokenRepository(BaseRepository[PasswordResetToken]):
    model = PasswordResetToken

    async def get_valid(self, token_hash: str) -> PasswordResetToken | None:
        stmt = select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
        return (await self.session.execute(stmt)).scalars().first()

    async def invalidate_for_user(self, user_id: uuid.UUID) -> None:
        await self.session.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.user_id == user_id, PasswordResetToken.used_at.is_(None))
            .values(used_at=datetime.now(timezone.utc))
        )
        await self.session.flush()
