import asyncio
import logging

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

_security = HTTPBearer()
logger = logging.getLogger(__name__)

# Supabase cloud issues ES256 JWTs signed with an asymmetric key.
# PyJWKClient fetches the public key set and caches it (refreshes every hour).
_jwks_client = PyJWKClient(
    f"{settings.supabase_url}/auth/v1/.well-known/jwks.json",
    cache_jwk_set=True,
    lifespan=3600,
)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> dict:
    """Verify a Supabase-issued JWT (ES256 via JWKS) and return the decoded payload."""
    token = credentials.credentials
    try:
        # get_signing_key_from_jwt is sync + potentially does HTTP on first call
        signing_key = await asyncio.to_thread(
            _jwks_client.get_signing_key_from_jwt, token
        )
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            options={"verify_aud": False},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        )
    except jwt.InvalidTokenError as exc:
        logger.error("JWT verify failed [%s]: %s", type(exc).__name__, exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
