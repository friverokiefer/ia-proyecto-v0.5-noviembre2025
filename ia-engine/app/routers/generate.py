# ia-engine/app/routers/generate.py
"""Rutas principales del motor de IA (generación de contenidos)."""

from fastapi import APIRouter, HTTPException

from app.models.request import GenerateRequest
from app.models.response import GenerateResponse
from app.services.text_engine import generate_sets

router: APIRouter = APIRouter()


@router.post("/generate", response_model=GenerateResponse)
def generate_content(payload: GenerateRequest) -> GenerateResponse:
    """
    Endpoint principal del motor de IA.

    - Recibe: engine, campaign, cluster, sets, feedback.
    - Devuelve: una lista de sets de contenido:
        {subject, preheader, body.{title, subtitle, content}, cta}
    """
    try:
        variants = generate_sets(payload)
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(e))

    return GenerateResponse(
        engine=payload.engine,
        variants=variants,
        metadata={
            "message": "IA Engine OK (OpenAI)",
            "sets": len(variants),
        },
    )


__all__ = ["router"]
