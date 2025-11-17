"""Punto de entrada del microservicio Email Studio IA Engine (FastAPI)."""

from fastapi import FastAPI

from app.routers.generate import router as generate_router
from app.routers.meta import router as meta_router

app = FastAPI(
    title="Email Studio IA Engine",
    version="0.1.0",
    description="Microservicio de IA para generación de contenidos de Email Studio.",
)


@app.get("/health", tags=["health"])
def health_check() -> dict:
    """Endpoint simple de healthcheck para monitoreo."""
    return {"status": "ok"}


# Rutas principales del motor IA
# /ia/generate  → generación de sets de contenido (antes “trios”)
app.include_router(generate_router, prefix="/ia", tags=["ia"])

# /ia/meta      → catálogo de campañas / clusters para el frontend/backend
app.include_router(meta_router, prefix="/ia", tags=["meta"])
