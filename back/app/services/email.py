"""Service d'envoi d'emails (SMTP, non bloquant)."""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from anyio import to_thread

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """En développement (SMTP_ENABLED=false), les emails sont journalisés."""

    async def send(
        self, *, to: str, subject: str, body: str, html: str | None = None
    ) -> bool:
        if not settings.SMTP_ENABLED:
            logger.info("[EMAIL SIMULÉ] à=%s | sujet=%s\n%s", to, subject, body)
            return True
        try:
            await to_thread.run_sync(self._send_sync, to, subject, body, html)
            return True
        except Exception:  # pragma: no cover - dépend de l'infra SMTP
            logger.exception("Échec d'envoi d'email à %s", to)
            return False

    def _send_sync(self, to: str, subject: str, body: str, html: str | None) -> None:
        message = EmailMessage()
        message["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>"
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)
        if html:
            message.add_alternative(html, subtype="html")

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
            server.send_message(message)

    # --------------------------- Modèles d'emails --------------------------- #
    async def send_agent_invitation(self, *, to: str, full_name: str, agency: str, url: str) -> bool:
        return await self.send(
            to=to,
            subject=f"Invitation à rejoindre {agency} sur ImmoFlow AI",
            body=(
                f"Bonjour {full_name},\n\n"
                f"Vous avez été invité(e) à rejoindre l'agence {agency} en tant qu'agent.\n"
                f"Activez votre compte : {url}\n\n"
                f"Ce lien expire dans {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes.\n"
            ),
        )

    async def send_owner_invitation(self, *, to: str, full_name: str, agency: str, url: str) -> bool:
        return await self.send(
            to=to,
            subject=f"{agency} vous invite à gérer vos biens sur ImmoFlow AI",
            body=(
                f"Bonjour {full_name},\n\n"
                f"L'agence {agency} vous a enregistré(e) comme propriétaire.\n"
                f"Complétez votre profil et déposez votre pièce d'identité : {url}\n"
            ),
        )

    async def send_account_created(self, *, to: str, full_name: str, role_label: str, url: str) -> bool:
        """Compte créé directement par un administrateur de la plateforme."""
        return await self.send(
            to=to,
            subject="Votre compte ImmoFlow AI a été créé",
            body=(
                f"Bonjour {full_name},\n\n"
                f"Un compte {role_label} vient d'être créé pour vous sur ImmoFlow AI.\n"
                f"Activez-le en définissant votre mot de passe : {url}\n\n"
                f"Ce lien expire dans {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes.\n"
            ),
        )

    async def send_password_reset(self, *, to: str, url: str) -> bool:
        return await self.send(
            to=to,
            subject="Réinitialisation de votre mot de passe ImmoFlow AI",
            body=(
                "Vous avez demandé la réinitialisation de votre mot de passe.\n"
                f"Lien : {url}\n\n"
                "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n"
            ),
        )

    async def send_agency_validated(
        self, *, to: str, full_name: str, agency: str, url: str
    ) -> bool:
        return await self.send(
            to=to,
            subject=f"Votre agence {agency} a été validée — finalisez votre inscription",
            body=(
                f"Bonjour {full_name},\n\n"
                f"Bonne nouvelle : le dossier de votre agence {agency} a été validé "
                "par notre équipe.\n"
                f"Pour finaliser votre inscription et définir votre mot de passe, "
                f"cliquez sur le lien suivant : {url}\n\n"
                f"Ce lien expire dans {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes.\n"
            ),
        )

    async def send_agency_rejected(
        self, *, to: str, full_name: str, agency: str, reason: str, retry_url: str
    ) -> bool:
        return await self.send(
            to=to,
            subject=f"Votre demande d'inscription pour {agency} n'a pas été retenue",
            body=(
                f"Bonjour {full_name},\n\n"
                f"Après examen, votre dossier pour l'agence {agency} n'a pas pu être "
                "validé.\n\n"
                f"Motif indiqué par notre équipe : {reason}\n\n"
                "Vous pouvez corriger votre dossier et soumettre une nouvelle demande "
                f"à tout moment : {retry_url}\n\n"
                "Ce compte n'ayant pas de mot de passe, aucune connexion n'est possible "
                "tant qu'une nouvelle demande n'est pas validée.\n"
            ),
        )

    async def send_account_validated(self, *, to: str, full_name: str) -> bool:
        return await self.send(
            to=to,
            subject="Votre compte ImmoFlow AI est activé",
            body=f"Bonjour {full_name},\n\nVotre compte a été validé. Bienvenue !\n",
        )


email_service = EmailService()