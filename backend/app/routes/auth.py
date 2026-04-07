"""
Magic-link passwordless authentication.

Flow:
  1. POST /auth/request  { email }
     - Creates (or fetches) the User row.
     - Creates a MagicLink with a random token (expires in 15 min).
     - Sends the link via Resend.
     - Returns {"message": "check your email"}.

  2. GET /auth/verify?token=<token>
     - Validates the token (exists, not expired, not used).
     - Marks the token as used.
     - Sets an httpOnly session cookie containing a signed JWT.
     - Returns {"message": "authenticated"} + Set-Cookie header.
"""

import os
import secrets
from datetime import datetime, timedelta, timezone

import boto3
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import MagicLink, User
from app.schemas import AuthRequest, UserOut

router = APIRouter()

SECRET_KEY = os.environ.get("SECRET_KEY", "changeme")
ALGORITHM = "HS256"
SESSION_EXPIRE_DAYS = 30
MAGIC_LINK_EXPIRE_MINUTES = 15
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "noreply@example.com")


def _create_session_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRE_DAYS)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_session_token(token: str) -> str:
    """Return user_id (sub) or raise HTTPException."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_current_user(
    session_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency — resolves the session cookie to a User."""
    if session_token is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = _decode_session_token(session_token)
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.post("/request")
async def request_magic_link(
    body: AuthRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Send a one-time login link to the supplied email address."""
    email = body.email.strip().lower()

    # Upsert user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(email=email)
        db.add(user)
        await db.flush()  # get the generated id

    # Create magic link
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=MAGIC_LINK_EXPIRE_MINUTES)
    magic_link = MagicLink(user_id=user.id, token=token, expires_at=expires_at)
    db.add(magic_link)
    await db.flush()

    # Send email via AWS SES
    aws_region = os.environ.get("AWS_REGION", "us-east-2")
    link_url = f"{FRONTEND_URL}/auth?token={token}"
    ses = boto3.client("ses", region_name=aws_region)
    ses.send_email(
        Source=FROM_EMAIL,
        Destination={"ToAddresses": [email]},
        Message={
            "Subject": {"Data": "Your Hindi App login link"},
            "Body": {
                "Html": {
                    "Data": (
                        f"<p>Click the link below to log in. It expires in "
                        f"{MAGIC_LINK_EXPIRE_MINUTES} minutes.</p>"
                        f'<p><a href="{link_url}">{link_url}</a></p>'
                    )
                }
            },
        },
    )

    return {"message": "check your email"}


@router.get("/verify")
async def verify_magic_link(
    token: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Validate a magic-link token and set a session cookie."""
    now = datetime.now(timezone.utc)

    result = await db.execute(select(MagicLink).where(MagicLink.token == token))
    magic_link = result.scalar_one_or_none()

    if magic_link is None:
        raise HTTPException(status_code=400, detail="Invalid token")
    if magic_link.used_at is not None:
        raise HTTPException(status_code=400, detail="Token already used")
    if magic_link.expires_at < now:
        raise HTTPException(status_code=400, detail="Token expired")

    # Mark as used
    magic_link.used_at = now

    session_token = _create_session_token(str(magic_link.user_id))
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        samesite="lax",
        max_age=SESSION_EXPIRE_DAYS * 24 * 3600,
        secure=not FRONTEND_URL.startswith("http://localhost"),
    )

    return {"message": "authenticated"}


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    """Return the currently authenticated user."""
    return current_user
