# ia-engine/app/services/text_engine.py
"""Motor de texto para Emails V2 (Banco BICE).

Genera *sets de contenido* para emails.

Cada set incluye:
- id
- subject
- preheader
- body.{title, subtitle, content}
- cta
"""

from __future__ import annotations

import logging
from typing import List, Dict, Any

from app.models.request import GenerateRequest
from app.models.response import GeneratedVariant, BodyBlock
from app.services.openai_client import chat_json
from app.utils.validators import soft_validate_campaign_cluster
from app.utils.prompts import build_email_prompt

logger = logging.getLogger(__name__)


def _extract_feedback(req: GenerateRequest) -> Dict[str, str]:
    """Normaliza feedback opcional desde GenerateRequest para logs/debug."""
    fb = getattr(req, "feedback", None)

    def _get(attr: str) -> str:
        if fb is None:
            return ""
        if isinstance(fb, dict):
            return str(fb.get(attr) or "").strip()
        return str(getattr(fb, attr, "") or "").strip()

    body_hint = _get("bodyContent") or _get("body")

    data = {
        "subject_hint": _get("subject"),
        "preheader_hint": _get("preheader"),
        "body_hint": body_hint,
    }
    logger.debug("IA-Engine feedback normalizado: %s", data)
    return data


def _stub_variant(req: GenerateRequest, idx: int) -> GeneratedVariant:
    """
    Fallback determinístico si OpenAI falla.

    IMPORTANTE:
    - No exponemos el feedback bruto (por ejemplo, la URL del héroe).
    - Dejamos un texto genérico pero utilizable, que el equipo puede editar.
    """
    campaign, cluster = soft_validate_campaign_cluster(
        req.campaign, req.cluster
    )

    # Solo para logging, no para mostrarle al usuario
    _extract_feedback(req)

    title = f"{campaign} · {cluster}"
    subtitle = (
        "Texto generado automáticamente. Revisa y ajusta antes de enviar."
    )
    body_content = (
        "Contenido generado automáticamente por el IA Engine para Banco BICE.\n\n"
        f"Campaña: {campaign}\n"
        f"Cluster: {cluster}\n\n"
        "Este set se generó como fallback luego de un error con el motor de IA. "
        "Por favor revisa el texto, completa beneficios, condiciones y llamados "
        "a la acción según los lineamientos comerciales vigentes."
    )
    subject = f"{campaign}: alternativa {idx + 1}"
    preheader = f"Perfil {cluster} · Set {idx + 1}"

    return GeneratedVariant(
        id=idx + 1,
        subject=subject,
        preheader=preheader,
        body=BodyBlock(
            title=title,
            subtitle=subtitle,
            content=body_content,
        ),
        cta="Conoce más",
    )


def _map_json_to_variant(
    data: Dict[str, Any],
    *,
    campaign: str,
    cluster: str,
    index: int,
) -> GeneratedVariant:
    """
    Mapea el dict devuelto por OpenAI al modelo GeneratedVariant.

    Es tolerante a pequeñas variaciones de claves:
    - body vs content vs bodyContent
    - subtitle vs bajada vs subheading
    """
    subject = str(data.get("subject", "")).strip()
    preheader = str(data.get("preheader", "")).strip()
    title = str(data.get("title", "")).strip()

    subtitle_raw = (
        data.get("subtitle")
        or data.get("bajada")
        or data.get("subheading")
    )

    body = str(
        data.get("body")
        or data.get("content")
        or data.get("bodyContent")
        or ""
    ).strip()

    cta_raw = data.get("cta")

    subtitle = None
    if subtitle_raw is not None:
        s = str(subtitle_raw).strip()
        subtitle = s or None

    # Si no viene subtítulo pero sí body, usamos la primera línea como bajada
    if subtitle is None and body:
        first_line = body.split("\n", 1)[0].strip()
        if len(first_line) > 160:
            first_line = first_line[:157] + "..."
        subtitle = first_line or None

    cta = None
    if isinstance(cta_raw, str) and cta_raw.strip():
        cta = cta_raw.strip()

    if not subject and not preheader and not body:
        raise ValueError(
            "Respuesta de OpenAI vacía (sin subject, preheader ni body)."
        )

    if not title:
        title = f"{campaign} · {cluster}"

    return GeneratedVariant(
        id=index + 1,
        subject=subject,
        preheader=preheader,
        body=BodyBlock(
            title=title,
            subtitle=subtitle,
            content=body,
        ),
        cta=cta,
    )


def _clamp_sets(n: int) -> int:
    """
    Limita la cantidad de sets permitidos.

    Regla actual de negocio: 1..5 sets.
    """
    try:
        value = int(n)
    except (TypeError, ValueError):
        value = 1

    if value < 1:
        return 1
    if value > 5:
        return 5
    return value


def generate_sets(request: GenerateRequest) -> List[GeneratedVariant]:
    """
    Genera N *sets de contenido* para un email
    (subject, preheader, title, subtitle, body, cta).

    Usa OpenAI como motor principal y cae al stub si algo falla
    a nivel de cada variante.
    """
    # Normalizamos campaña/cluster (warnings suaves si algo no cuadra)
    campaign, cluster = soft_validate_campaign_cluster(
        request.campaign, request.cluster
    )
    request.campaign = campaign
    request.cluster = cluster

    # Número de sets (clamp 1..5)
    total_sets = _clamp_sets(getattr(request, "sets", 1) or 1)
    variants: List[GeneratedVariant] = []

    logger.info(
        "IA-Engine: generando %d sets de contenido (campaign=%s, cluster=%s)",
        total_sets,
        campaign,
        cluster,
    )

    for i in range(total_sets):
        try:
            # 1) Construir prompt específico para este set
            system, user = build_email_prompt(
                campaign=request.campaign,
                cluster=request.cluster,
                feedback=request.feedback,
                variant_index=i + 1,
            )

            # 2) Llamar a OpenAI en modo JSON
            data = chat_json(system, user)

            # 3) Mapear al modelo tipado
            variant = _map_json_to_variant(
                data,
                campaign=request.campaign,
                cluster=request.cluster,
                index=i,
            )
            variants.append(variant)

        except Exception as exc:  # noqa: BLE001
            # No rompemos todo el batch; dejamos rastro y usamos stub.
            logger.exception(
                "IA-Engine: error generando set %d, uso stub: %s",
                i + 1,
                exc,
            )
            variants.append(_stub_variant(request, i))

    logger.info(
        "IA-Engine: generados %d sets (incluyendo stubs si hubo errores).",
        len(variants),
    )
    return variants


# Alias más explícito para el resto de la app / futuro refactor
def generate_email_sets(request: GenerateRequest) -> List[GeneratedVariant]:
    """
    Wrapper semántico sobre generate_sets, pensado para uso externo.
    """
    return generate_sets(request)


__all__ = ["generate_sets", "generate_email_sets"]
