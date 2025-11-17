// backend/src/utils/validate.ts
import {
  CAMPAIGNS,
  CLUSTERS,
  CAMPAIGN_CLUSTERS,
  type Campaign,
  type Cluster,
} from "./constants";

/**
 * Valida campaña exacta del catálogo canónico.
 *
 * Debe coincidir con ia-engine/app/utils/campaigns.py::CAMPAIGNS_TONE.keys().
 */
export function isValidCampaign(v: any): v is Campaign {
  return typeof v === "string" &&
    (CAMPAIGNS as readonly string[]).includes(v);
}

/**
 * Valida cluster exacto del catálogo canónico.
 *
 * Debe coincidir con ia-engine/app/utils/clusters.py::CLUSTERS.keys().
 */
export function isValidCluster(v: any): v is Cluster {
  return typeof v === "string" &&
    (CLUSTERS as readonly string[]).includes(v);
}

/**
 * Valida que un cluster sea compatible con una campaña
 * según el mapa CAMPAIGN_CLUSTERS.
 */
export function isClusterAllowedForCampaign(
  campaign: Campaign,
  cluster: string,
): boolean {
  const list = CAMPAIGN_CLUSTERS[campaign];
  if (!list) return false;
  return list.includes(cluster);
}
