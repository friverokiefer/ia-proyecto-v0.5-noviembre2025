# ia-engine/app/utils/prompts.py
"""Construcción de prompts para el motor de texto (Email Studio IA Engine).

Se usa por el cliente OpenAI para generar variantes (sets de contenido) de email
con formato JSON.
"""

from __future__ import annotations

import json
from typing import Optional, Tuple

from app.models.request import EmailFeedback
from app.utils.campaigns import describe_campaign
from app.utils.clusters import describe_cluster

# Macros similares a backend/src/services/promptKit.ts
ES_CL = (
    "Escribe en español de Chile, claro, profesional y cercano. "
    "Evita regionalismos confusos y jerga excesiva."
)

SAFETY = (
    "No inventes datos no verificables. Si algo no es seguro, usa formulaciones conservadoras. "
    "No prometas aprobaciones definitivas; siempre habla de 'evaluación', 'oferta referencial' "
    "o 'condiciones sujetas a análisis'."
)

DELIVERABILITY = (
    "Evita mayúsculas sostenidas, signos de exclamación repetidos, emojis y palabras gatillantes "
    "de spam (gratis, regalo, urgente, gana dinero, 100% gratis, etc.)."
)

LENGTHS_EMAIL = (
    "Límites: subject 38–60 caracteres; preheader 60–110; title 22–60; subtitle 14–120; "
    "body 160–500 palabras; CTA breve (2–4 palabras)."
)

EMAIL_STRUCTURE = (
    "El body debe ser TEXTO PLANO (NO HTML). "
    "Estructura sugerida del body: "
    "1) Apertura con promesa/beneficio principal (2–3 frases). "
    "2) Lista de 3 beneficios en viñetas con '- ' al inicio (cada bullet 4–10 palabras). "
    "3) Cierre breve con urgencia suave y próxima acción. "
    "No incluyas disclaimers ni políticas en el body (se agregan aparte)."
)

ROLES_EMAIL = (
    "Roles de los campos: "
    "- subject: gancho corto y claro para el inbox. "
    "- preheader: complementa al subject; adelanta beneficio; NO lo repite. "
    "- title (H1 dentro del correo): introduce un ángulo NUEVO respecto de subject. "
    "- subtitle: profundiza o agrega beneficio adicional; NO repite preheader. "
    "- body: desarrollo en texto plano con bullets '- '. "
    "- cta: 2–4 palabras, imperativo suave (p. ej., 'Conoce más', 'Simula aquí')."
)

CONTRASTIVE_DEDUP = (
    "Evita duplicar subject/preheader dentro de title/subtitle. "
    "Si title o subtitle comparten 6+ palabras consecutivas o el mismo núcleo semántico "
    "con subject/preheader, REESCRÍBELOS con sinónimos o un ángulo distinto. "
    "Evita comenzar title/subtitle con las mismas 3 palabras del subject/preheader. "
    "Piensa internamente 2–3 alternativas para title/subtitle y elige la más distinta; "
    "NO muestres tu proceso, responde solo el JSON final."
)

TONE_CONSTRAINTS = (
    "Usa tono profesional, claro, sin tecnicismos innecesarios; enfócate en beneficios y claridad. "
    "Cuida que el mensaje sea consistente con la marca Banco BICE: sobrio, confiable, sin exceso de hype."
)

CREDIT_NAMING = (
    "Cuando la campaña sea de crédito de consumo, puedes referirte al producto como: "
    "'crédito', 'crédito de consumo', 'crédito de consumo del BICE', 'Crédito de Consumo BICE'. "
    "Si corresponde, puedes usar el placeholder [MONTO] para montos preaprobados. "
    "Si la campaña NO es de crédito (por ejemplo seguros, DAP u otros productos), "
    "no uses la palabra 'crédito' y ajusta el texto al producto descrito en la campaña."
)

NEUTRALITY = (
    "El mensaje debe ser neutro en cuanto a género (no uses 'él' o 'ella'); "
    "trata al cliente de 'tú' y no de 'usted'."
)

JSON_FIELDS = ["subject", "preheader", "title", "subtitle", "body", "cta"]


def _json_only_clause() -> str:
    return (
        "Responde SOLO con un objeto JSON válido con exactamente estas claves "
        f"(y solo estas): {', '.join(JSON_FIELDS)}. "
        "No uses backticks, ni explicaciones fuera del JSON, ni comentarios."
    )


def build_email_prompt(
    campaign: str,
    cluster: str,
    feedback: Optional[EmailFeedback],
    variant_index: int,
) -> Tuple[str, str]:
    """
    Construye system + user prompt para generar UN set de contenido de email.

    La salida esperada del modelo es un JSON con:
    {subject, preheader, title, subtitle, body, cta}
    """

    campaign_desc = describe_campaign(campaign)
    cluster_desc = describe_cluster(cluster, campaign)

    system = (
        "Eres copywriter especializado en email marketing bancario y compliance "
        "para Banco BICE en Chile. "
        f"{ES_CL} {SAFETY} {DELIVERABILITY} {LENGTHS_EMAIL} "
        f"{EMAIL_STRUCTURE} {ROLES_EMAIL} {CONTRASTIVE_DEDUP} "
        f"{TONE_CONSTRAINTS} {CREDIT_NAMING} {NEUTRALITY}"
    )

    payload = {
        "campaign": campaign,
        "campaign_description": campaign_desc,
        "cluster": cluster,
        "cluster_description": cluster_desc,
        "variant_index": variant_index,
        "rules": {
            "subject_preheader": (
                "Optimizados para inbox preview (concisos, claros, sin vender humo). "
                "Incluye el gancho principal dentro de los primeros 50 caracteres del subject."
            ),
            "title_subtitle": (
                "H1 + bajada dentro del correo; deben aportar un ángulo nuevo, "
                "no repetir subject/preheader."
            ),
            "cta": (
                "2–4 palabras, imperativo suave (p. ej., 'Conoce más', 'Simula aquí'). "
                "Sin signos de exclamación."
            ),
            "formatting": (
                "El body es TEXTO PLANO; separa párrafos con saltos de línea. "
                "Bullets con '- '. Sin HTML, sin links. "
                "No incluyas disclaimers legales; se agregan aparte en otra capa."
            ),
        },
    }

    if feedback and (feedback.subject or feedback.preheader or feedback.bodyContent or feedback.body):
        payload["user_feedback"] = {
            "subject_hint": feedback.subject or None,
            "preheader_hint": feedback.preheader or None,
            "body_hint": (feedback.bodyContent or feedback.body or None),
            "instruction": (
                "Refina la variante siguiendo estas pistas del usuario, "
                "manteniendo coherencia con campaña/cluster y las reglas de entregabilidad."
            ),
        }

    example = {
        "subject": "Tu próximo paso financiero, en minutos",
        "preheader": "Conoce beneficios exclusivos y comisiones preferentes",
        "title": "Beneficios que se notan desde el primer mes",
        "subtitle": "Acumula puntos, accede a descuentos y administra todo 100% online",
        "body": "(texto plano con párrafos y bullets '- ')",
        "cta": "Conoce más",
    }

    user_lines = [
        "Escribe UNA variante de email con los campos solicitados (subject, preheader, title, subtitle, body, cta).",
        "Contexto de campaña y cluster (JSON):",
        json.dumps(payload, ensure_ascii=False, indent=2),
        "Ejemplo de estilo (NO lo copies ni lo devuelvas literalmente):",
        json.dumps(example, ensure_ascii=False, indent=2),
        (
            "Asegúrate de que title/subtitle NO repitan ni parafraseen subject/preheader. "
            "Si detectas similitud, reescribe title/subtitle con sinónimos o un ángulo nuevo antes de responder."
        ),
        (
            "El body debe ser texto plano: usa saltos de línea para párrafos y '- ' para bullets. "
            "No incluyas disclaimers, links, ni HTML."
        ),
        _json_only_clause(),
    ]

    user = "\n- ".join(user_lines)
    return system, user
