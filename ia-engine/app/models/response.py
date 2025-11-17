# ia-engine/app/models/response.py
"""Modelos de response para el motor de IA de emails V2.

A nivel de API hablamos de *sets de contenido*:
cada elemento de `variants` es un set con:
- subject
- preheader
- body.{title, subtitle, content}
- cta
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class BodyBlock(BaseModel):
    """
    Bloque de body del correo.

    Coincide con lo que espera el backend Node:
    body: { title, subtitle, content }
    """

    title: str = Field(
        ...,
        description="Título (H1) dentro del correo.",
    )
    subtitle: Optional[str] = Field(
        default=None,
        description="Subtítulo o bajada debajo del título.",
    )
    content: str = Field(
        ...,
        description="Body del correo en texto plano.",
    )


class GeneratedVariant(BaseModel):
    """
    Set de contenido de email generado por el motor de IA.

    Estos campos encajan directo con el contrato actual del backend:
    - id                 → identificador de la variante (1..N).
    - subject, preheader → se sanitizan en Node.
    - body               → objeto { title, subtitle, content }.
    - cta                → CTA corto (2–4 palabras).
    """

    id: int = Field(
        ...,
        description="Identificador de la variante (secuencial, 1..N).",
    )

    subject: str = Field(
        ...,
        description="Asunto del correo.",
    )

    preheader: str = Field(
        ...,
        description="Preheader del correo.",
    )

    body: BodyBlock = Field(
        ...,
        description="Bloque de contenido principal del correo.",
    )

    cta: Optional[str] = Field(
        default=None,
        description="Llamado a la acción (CTA breve).",
    )


class GenerateResponse(BaseModel):
    """Respuesta estándar del endpoint /ia/generate."""

    engine: str = Field(
        ...,
        description="Motor de IA utilizado para la generación.",
    )

    variants: List[GeneratedVariant] = Field(
        default_factory=list,
        description="Lista de sets de contenido generados.",
    )

    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Metadatos de la llamada (tokens, duración, mensajes internos, etc.).",
    )
