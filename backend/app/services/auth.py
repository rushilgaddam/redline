"""Real authentication for engineers/reviewers: bcrypt password hashing +
signed JWT session tokens, verified server-side on every mutating request
that acts *as* a specific engineer.

Per MOCKS.md's Auth section, full production auth is SSO/SAML via an IdP
(WorkOS/Auth0) — this doesn't replace that, but it closes the concrete gap
that existed before it: "nothing stops any client from claiming to be any
user_id." A request now has to present a token this server issued and
signed, not just say who it is.

Technicians stay identity-by-phone-number with no password, matching real
SMS/MMS (a phone number *is* the identity there, same as production Twilio)
— that's an intentional, documented boundary, not an oversight. Seeded demo
users (no password ever set) can still sign in with identifier only, so the
local demo experience is unchanged; any account that has set a real
password is fully gated behind it.
"""
import os
import time

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

JWT_ALGORITHM = "HS256"
JWT_TTL_SECONDS = 12 * 3600  # 12h session

_DEV_DEFAULT_SECRET = "redline-dev-secret-not-for-production"
_SECRET = os.environ.get("REDLINE_JWT_SECRET")
if not _SECRET:
    _SECRET = _DEV_DEFAULT_SECRET
    print(
        "[auth] WARNING: REDLINE_JWT_SECRET is not set — using an insecure "
        "development default. Set REDLINE_JWT_SECRET before deploying this "
        "anywhere real; every token issued with the default secret is "
        "forgeable by anyone who reads this source file."
    )


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed/legacy hash — fail closed, never crash the login request.
        return False


def issue_token(user: models.User) -> str:
    now = int(time.time())
    payload = {
        "sub": user.id,
        "role": user.role,
        "iat": now,
        "exp": now + JWT_TTL_SECONDS,
    }
    return jwt.encode(payload, _SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, _SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expired — sign in again") from None
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid session token") from None


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> models.User:
    """FastAPI dependency — requires a valid `Authorization: Bearer <token>`
    header and returns the real, database-backed user it names. Raises 401
    if the header is missing, malformed, expired, or names a user that no
    longer exists."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing Authorization bearer token")
    token = authorization.split(" ", 1)[1].strip()
    claims = decode_token(token)
    user = db.get(models.User, claims.get("sub"))
    if not user:
        raise HTTPException(401, "Session no longer valid")
    return user


def require_engineer(user: models.User) -> models.User:
    if user.role not in ("engineer", "reviewer", "admin"):
        raise HTTPException(403, "Engineer or reviewer account required")
    return user
