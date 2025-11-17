# ia-engine/app/utils/meta.py
from typing import Dict, Any, List

from app.utils.campaigns import CAMPAIGNS_TONE
from app.utils.clusters import CLUSTERS as CLUSTERS_DEF, CAMPAIGN_CLUSTERS
from app.utils.copy_meta import BENEFITS, CTAS, SUBJECTS, CLUSTER_TONE


def get_meta() -> Dict[str, Any]:
    """
    Devuelve el catálogo de campañas, clusters y metadatos de copy
    que usarán backend y frontend.

    - `campaigns`: nombres canónicos de campaña (keys de CAMPAIGNS_TONE).
    - `clusters`: nombres canónicos de cluster (keys de CLUSTERS).
    - `campaignClusters`: mapa campaña → [clusters válidos].
    - `benefits`: beneficios sugeridos por campaña (keys canónicas).
    - `ctas`: CTAs sugeridas por campaña (keys canónicas).
    - `subjects`: asuntos de referencia por campaña (keys canónicas).
    - `clusterTone`: lineamientos de tono por cluster (keys = clusters canónicos).

    La compatibilidad con nombres antiguos se maneja con aliases en:
    - app.utils.campaigns.CAMPAIGN_ALIASES
    """
    campaigns: List[str] = list(CAMPAIGNS_TONE.keys())
    clusters: List[str] = list(CLUSTERS_DEF.keys())

    return {
        "campaigns": campaigns,
        "clusters": clusters,
        "campaignClusters": CAMPAIGN_CLUSTERS,
        "benefits": BENEFITS,
        "ctas": CTAS,
        "subjects": SUBJECTS,
        "clusterTone": CLUSTER_TONE,
    }
