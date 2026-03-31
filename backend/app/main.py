import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.routers import health, tenants

app = FastAPI(
    title="PolyPOI API",
    version="0.1.0",
    docs_url="/docs" if settings.app_env != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(tenants.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all: return JSON so CORS middleware can still add headers, and log the error."""
    logging.getLogger(__name__).exception(
        "Unhandled exception on %s %s", request.method, request.url
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
