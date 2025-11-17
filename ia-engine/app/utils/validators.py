# ia-engine/app/utils/validators.py
"""Utilidades de validación y normalización para el IA Engine.

Se encargan de:
- Normalizar nombres de campañas (aliases).
- Verificar si campaña / cluster existen en el catálogo oficial.
- Verificar combinaciones campaña–cluster coherentes.

IMPORTANTE: mantener alineado con:
- backend/src/utils/constants.ts (CAMPAIGNS, CLUSTERS, CAMPAIGN_CLUSTERS)
- app.utils.campaigns.py
- app.utils.clusters.py
"""

from __future__ import annotations

import logging
from typing import Dict, List, Tuple

from app.utils.campaigns import CAMPAIGNS_TONE, CAMPAIGN_ALIASES
from app.utils.clusters import (
    CLUSTERS as CLUSTERS_DEF,
    CAMPAIGN_CLUSTERS as CAMPAIGN_CLUSTERS_MAP,
)

logger = logging.getLogger(__name__)

# Conjuntos base (nombres canónicos)
ALL_CAMPAIGNS = set(CAMPAIGNS_TONE.keys())
ALL_CLUSTERS = set(CLUSTERS_DEF.keys())

# ============================================================
#  Mapa campaña → clusters válidos (canónico)
#  Se toma directamente desde app.utils.clusters.CAMPAIGN_CLUSTERS
# ============================================================

CAMPAIGN_CLUSTERS: Dict[str, List[str]] = CAMPAIGN_CLUSTERS_MAP


# ============================================================
#  Helpers de normalización / validación
# ============================================================

def normalize_campaign_name(name: str) -> str:
    """Aplica alias y limpia espacios a un nombre de campaña."""
    if not isinstance(name, str):
        return ""
    cleaned = name.strip()
    return CAMPAIGN_ALIASES.get(cleaned, cleaned)


def is_known_campaign(name: str) -> bool:
    """True si la campaña (normalizada) existe en el catálogo."""
    normalized = normalize_campaign_name(name)
    return normalized in ALL_CAMPAIGNS


def is_known_cluster(name: str) -> bool:
    """True si el cluster existe en el catálogo canónico."""
    if not isinstance(name, str):
        return False
    return name in ALL_CLUSTERS


def allowed_clusters_for_campaign(campaign: str) -> List[str]:
    """Clusters configurados para una campaña (después de normalizar alias)."""
    normalized = normalize_campaign_name(campaign)
    return CAMPAIGN_CLUSTERS.get(normalized, [])


def soft_validate_campaign_cluster(
    campaign: str,
    cluster: str,
) -> Tuple[str, str]:
    """
    Normaliza campaña, verifica catálogo y coherencia con el mapa campaña–cluster.

    NO lanza excepciones; solo:
    - Normaliza el nombre de campaña usando CAMPAIGN_ALIASES.
    - Emite warnings si algo está fuera de catálogo o combinación incoherente.

    Devuelve:
        (campaign_normalizada, cluster_original)
    """
    normalized_campaign = normalize_campaign_name(campaign)

    if normalized_campaign not in ALL_CAMPAIGNS:
        logger.warning(
            "IA-Engine: campaign fuera de catálogo: %r (normalizada=%r)",
            campaign,
            normalized_campaign,
        )

    if not is_known_cluster(cluster):
        logger.warning(
            "IA-Engine: cluster fuera de catálogo: %r",
            cluster,
        )
    else:
        allowed = CAMPAIGN_CLUSTERS.get(normalized_campaign)
        if allowed and cluster not in allowed:
            logger.warning(
                "IA-Engine: cluster %r no está configurado para campaign %r (allowed=%s)",
                cluster,
                normalized_campaign,
                allowed,
            )

    return normalized_campaign, cluster


def strict_validate_campaign_cluster(campaign: str, cluster: str) -> Tuple[str, str]:
    """
    Versión estricta: lanza ValueError si algo está fuera de catálogo
    o la combinación campaña–cluster no está configurada.

    Pensado para tests o validaciones offline, no para runtime crítico.
    """
    normalized_campaign = normalize_campaign_name(campaign)

    if normalized_campaign not in ALL_CAMPAIGNS:
        raise ValueError(
            f"campaign desconocida: {campaign!r} (normalizada={normalized_campaign!r})"
        )

    if not is_known_cluster(cluster):
        raise ValueError(f"cluster desconocido: {cluster!r}")

    allowed = CAMPAIGN_CLUSTERS.get(normalized_campaign, [])
    if allowed and cluster not in allowed:
        raise ValueError(
            f"cluster {cluster!r} no está configurado para campaign {normalized_campaign!r}. "
            f"Clusters permitidos: {allowed}"
        )

    return normalized_campaign, cluster


__all__ = [
    "CAMPAIGN_CLUSTERS",
    "ALL_CAMPAIGNS",
    "ALL_CLUSTERS",
    "normalize_campaign_name",
    "is_known_campaign",
    "is_known_cluster",
    "allowed_clusters_for_campaign",
    "soft_validate_campaign_cluster",
    "strict_validate_campaign_cluster",
]
