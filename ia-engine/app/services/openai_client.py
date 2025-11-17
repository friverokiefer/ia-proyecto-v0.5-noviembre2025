# ia-engine/app/services/openai_client.py
"""Cliente OpenAI de bajo nivel para el IA Engine (Banco BICE).

Responsabilidad:
- Cargar configuración desde variables de entorno / .env.
- Crear un cliente OpenAI (soporta OPENAI_BASE_URL para endpoint privado).
- Exponer chat_json(system, user, **kwargs) que devuelve un dict (JSON parseado).
- Manejar timeouts y reintentos básicos.

NO conoce de GenerateRequest ni de campañas; eso lo maneja text_engine/prompts.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional

try:
    # En local cargamos .env; en GCP usarás env vars del servicio.
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass

from openai import OpenAI

logger = logging.getLogger(__name__)

# =========================
# Configuración base
# =========================

# Modelo por defecto para generación de emails en JSON
MODEL_JSON = (
    os.getenv("OPENAI_MODEL_EMAIL")
    or os.getenv("OPENAI_TEXT_JSON")
    or "gpt-4o-mini"
)

# Parámetros de sampling por defecto
TEMP = float(os.getenv("OPENAI_TEXT_TEMP", "0.6"))
TOP_P = float(os.getenv("OPENAI_TEXT_TOP_P", "0.9"))
MAX_TOKENS = int(os.getenv("OPENAI_TEXT_MAX_TOKENS", "900"))

# Timeouts y reintentos
REQUEST_TIMEOUT = float(os.getenv("OPENAI_REQUEST_TIMEOUT", "30"))  # segundos
MAX_RETRIES = int(os.getenv("OPENAI_MAX_RETRIES", "2"))

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    """
    Singleton simple del cliente OpenAI.

    Importante:
    - NO pasamos 'proxies' en los kwargs porque las versiones nuevas
      del SDK no aceptan ese argumento en el constructor.
    - Si en el futuro necesitas proxy, se configura vía HTTP_PROXY / HTTPS_PROXY
      a nivel de variables de entorno, no en el constructor.
    """
    global _client
    if _client is not None:
        return _client

    api_key = (
        os.getenv("OPENAI_API_KEY")
        or os.getenv("OPENAI_APIKEY")
        or os.getenv("OPENAI_TOKEN")
    )
    if not api_key:
        raise RuntimeError("IA-Engine: OPENAI_API_KEY no está configurada")

    base_url = (
        os.getenv("OPENAI_BASE_URL")
        or os.getenv("OPENAI_API_BASE")
        or os.getenv("OPENAI_ENDPOINT")
    )

    # Timeout de cliente (se puede tunear más fino usando httpx custom si algún día hace falta)
    try:
        client_timeout = float(os.getenv("OPENAI_CLIENT_TIMEOUT", "60"))
    except ValueError:
        client_timeout = 60.0

    kwargs: Dict[str, Any] = {
        "api_key": api_key,
        "timeout": client_timeout,
    }

    if base_url:
        kwargs["base_url"] = base_url

    # OJO: aquí antes se solía pasar "proxies", eso es lo que rompía en Docker.
    _client = OpenAI(**kwargs)
    logger.info("IA-Engine: cliente OpenAI inicializado (model=%s)", MODEL_JSON)
    return _client


def chat_json(
    system: str,
    user: str,
    *,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    top_p: Optional[float] = None,
    max_tokens: Optional[int] = None,
    timeout: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Llama a Chat Completions esperando un JSON en el contenido.

    Args:
        system: mensaje de sistema.
        user: mensaje de usuario (prompt principal).
        model: modelo a usar (fallback a MODEL_JSON).
        temperature, top_p, max_tokens: overrides opcionales.
        timeout: override opcional de timeout en segundos.

    Returns:
        dict parseado desde el contenido devuelto por el modelo.

    Raises:
        RuntimeError si falla tras los reintentos.
        json.JSONDecodeError si el contenido no es JSON válido.
    """
    client = _get_client()

    m = model or MODEL_JSON
    t = TEMP if temperature is None else float(temperature)
    p = TOP_P if top_p is None else float(top_p)
    mt = MAX_TOKENS if max_tokens is None else int(max_tokens)
    to = REQUEST_TIMEOUT if timeout is None else float(timeout)

    last_err: Optional[Exception] = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.debug(
                "IA-Engine: llamando a OpenAI (model=%s, attempt=%d/%d)",
                m,
                attempt,
                MAX_RETRIES,
            )

            resp = client.chat.completions.create(
                model=m,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=t,
                top_p=p,
                max_tokens=mt,
                response_format={"type": "json_object"},
                timeout=to,
            )

            if not resp.choices:
                raise RuntimeError(
                    "IA-Engine: respuesta sin choices desde OpenAI"
                )

            content = resp.choices[0].message.content or "{}"
            try:
                data = json.loads(content)
            except json.JSONDecodeError as exc:
                logger.error("IA-Engine: contenido no es JSON válido: %s", exc)
                # Logueamos un fragmento del contenido para debug si es muy largo
                snippet = content[:1000]
                logger.debug(
                    "Contenido bruto devuelto por el modelo (truncado a 1000 chars):\n%s",
                    snippet,
                )
                raise

            return data

        except Exception as exc:  # noqa: BLE001
            last_err = exc
            logger.warning(
                "IA-Engine: error llamando a OpenAI (attempt %d/%d): %s",
                attempt,
                MAX_RETRIES,
                exc,
            )
            if attempt >= MAX_RETRIES:
                break

    # Si llegamos acá, fallaron todos los intentos
    msg = f"IA-Engine: error llamando a OpenAI tras {MAX_RETRIES} intentos"
    logger.error(msg)
    raise RuntimeError(msg) from last_err


__all__ = ["chat_json", "MODEL_JSON"]
