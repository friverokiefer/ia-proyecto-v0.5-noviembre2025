// backend/src/utils/constants.ts

/** =========================
 *  Catálogos principales
 *  ========================= */
/**
 * Campañas oficiales que puede seleccionar el usuario.
 *
 * IMPORTANTE:
 * - Estos textos deben coincidir EXACTAMENTE con:
 *     ia-engine/app/utils/campaigns.py::CAMPAIGNS_TONE.keys()
 * - También deben coincidir con lo que envía el frontend.
 *
 * El IA Engine (Python) es la fuente de verdad de tono/beneficios/CTAs;
 * este archivo actúa como espejo tipado en Node para validaciones y legacy.
 */
export const CAMPAIGNS = [
  "Crédito de consumo - Persona",
  "Crédito de consumo - Empresa",
  "DAP (Depósito a plazo)",
  "Crédito hipotecario",
  "Refinanciar deuda",
  "Apertura producto - Cuenta corriente",
  "Apertura producto - Tarjeta de crédito",
  "Seguros",
] as const;

export type Campaign = (typeof CAMPAIGNS)[number];

/**
 * Drivers / clusters oficiales asignados por campaña.
 *
 * Deben reflejar:
 *   ia-engine/app/utils/clusters.py::CAMPAIGN_CLUSTERS
 *
 * El front nuevo debería tomar catálogos desde /ia/meta,
 * pero este mapa se mantiene para:
 *   - validaciones backend
 *   - compatibilidad con flujos antiguos
 */

const CONSUMO_PERSONA_CLUSTERS = [
  "Auto familiar",
  "Auto soltero",
  "Cambio de moto",
  "Mejora del hogar",
  "Proyectos familiares",
  "Proyectos personales",
  "Reorganizar finanzas joven",
  "Reorganizar finanzas senior",
  "Viajes familiares",
  "Viajes solteros",
] as const;

const CONSUMO_EMPRESA_CLUSTERS = [
  "Capital de trabajo",
  "Inversión en activos",
  "Ordenar pasivos empresa",
  "Expansión del negocio",
  "Capital para impuestos",
] as const;

const DAP_CLUSTERS = [
  "Ahorro objetivo",
  "Fondo de emergencia",
  "Inversión conservadora",
  "Plan de corto plazo",
  "Plan de largo plazo",
] as const;

const HIPOTECARIO_CLUSTERS = [
  "Primera vivienda",
  "Mejora de vivienda actual",
  "Inversión inmobiliaria",
  "Refinanciar hipotecario",
] as const;

const REFINANCIAR_DEUDA_CLUSTERS = [
  "Consolidar deudas consumo",
  "Bajar dividendo hipotecario",
  "Reorganizar tarjetas de crédito",
  "Ordenar líneas y sobregiros",
] as const;

const CC_CLUSTERS = [
  "Cuenta sueldo",
  "Cuenta para PyME",
  "Cuenta alta renta",
  "Cuenta para profesional independiente",
] as const;

const TC_CLUSTERS = [
  "Viajes internacionales",
  "Compras diarias",
  "Compras online",
  "Segmento alta renta",
] as const;

const SEGUROS_CLUSTERS = [
  "Seguro de auto",
  "Seguro de vida",
  "Seguro de hogar",
  "Seguro de viaje",
  "Seguro de salud",
] as const;

export const CAMPAIGN_CLUSTERS: Record<Campaign, string[]> = {
  "Crédito de consumo - Persona": [...CONSUMO_PERSONA_CLUSTERS],
  "Crédito de consumo - Empresa": [...CONSUMO_EMPRESA_CLUSTERS],
  "DAP (Depósito a plazo)": [...DAP_CLUSTERS],
  "Crédito hipotecario": [...HIPOTECARIO_CLUSTERS],
  "Refinanciar deuda": [...REFINANCIAR_DEUDA_CLUSTERS],
  "Apertura producto - Cuenta corriente": [...CC_CLUSTERS],
  "Apertura producto - Tarjeta de crédito": [...TC_CLUSTERS],
  "Seguros": [...SEGUROS_CLUSTERS],
};

/**
 * Lista plana de clusters posibles. Derivada de CAMPAIGN_CLUSTERS.
 * Debe coincidir con ia-engine/app/utils/clusters.py::CLUSTERS.keys()
 */
export const CLUSTERS: string[] = Array.from(
  new Set<string>(Object.values(CAMPAIGN_CLUSTERS).flat()),
);

export type Cluster = (typeof CLUSTERS)[number];

/** =========================
 *  Helpers de segmentación (legacy-safe)
 *  ========================= */

/**
 * Devuelve los clusters válidos para una campaña.
 * Útil para validaciones y para flujos antiguos.
 */
export function getClustersForCampaign(campaign: Campaign): string[] {
  return CAMPAIGN_CLUSTERS[campaign] ?? [];
}

/**
 * Devuelve las campañas donde aparece un cluster dado.
 */
export function getCampaignsForCluster(cluster: string): Campaign[] {
  const value = String(cluster);
  return (CAMPAIGNS as readonly Campaign[]).filter((c) =>
    (CAMPAIGN_CLUSTERS[c] ?? []).includes(value),
  );
}

/**
 * Subjects genéricos de fallback (solo para motores antiguos).
 * En Email V2 el texto lo genera el IA Engine, pero se dejan
 * estos ejemplos para posibles flows legacy.
 */
export function genericSubjectsFor(campaign: Campaign) {
  return [
    `${campaign}: solución a tu medida`,
    `${campaign} con proceso 100% online`,
    `${campaign}: asesoría experta y transparente`,
    `${campaign} rápido y claro`,
    `${campaign}: condiciones competitivas`,
  ];
}
