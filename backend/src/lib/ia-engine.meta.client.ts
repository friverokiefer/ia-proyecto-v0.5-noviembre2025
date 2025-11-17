// backend/src/lib/ia-engine.meta.client.ts
import "dotenv/config";

/**
 * Cliente para obtener la metadata del IA Engine (Email V2):
 * campañas, clusters, mapping campaña→clusters, etc.
 */

export type IaEngineMeta = {
  campaigns: string[];
  clusters: string[];
  campaignClusters: Record<string, string[]>;
  // Campos extra que pueda exponer el IA Engine (no los usamos todos en el front)
  benefits?: Record<string, string[]>;
  ctas?: Record<string, string[]>;
  subjects?: Record<string, string[]>;
  clusterTone?: Record<string, string>;
};

/* ============================================================
 * Configuración base URL (igual criterio que services/iaEngine.ts)
 * ============================================================ */

// Puerto por defecto del IA Engine en LOCAL (cuando lo corres a mano)
const DEFAULT_BASE_URL = "http://127.0.0.1:8000";

const rawBase = process.env.IA_ENGINE_BASE_URL || DEFAULT_BASE_URL;

// Normalizamos URL (evita "localhost" y elimina "/" final)
export const IA_ENGINE_META_BASE_URL = rawBase
  .replace("localhost", "127.0.0.1")
  .replace(/\/+$/, "");

/* ============================================================
 * Helper: fetch con timeout
 * ============================================================ */

async function fetchWithTimeout(
  resource: string,
  options: any = {},
  timeoutMs = 15000
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return res;
  } catch (err: any) {
    clearTimeout(id);
    throw new Error(`IA Engine meta network/timeout error: ${err?.message || err}`);
  }
}

/* ============================================================
 * Cliente crudo: llama al /ia/meta del motor Python
 * ============================================================ */

export async function fetchIaEngineMeta(): Promise<IaEngineMeta> {
  const url = `${IA_ENGINE_META_BASE_URL}/ia/meta`;

  console.log("\n====================================");
  console.log("[iaEngine.meta] GET →", url);
  console.log("====================================\n");

  const res = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
    15000
  );

  if (!res.ok) {
    let text = "";
    try {
      text = await res.text();
    } catch (_) {
      // ignore
    }

    throw new Error(
      `IA Engine /ia/meta responded ${res.status}: ${text || res.statusText}`
    );
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch (err) {
    throw new Error(`IA Engine /ia/meta JSON parse error: ${err}`);
  }

  const data = raw as IaEngineMeta;

  if (!data || !Array.isArray(data.campaigns) || !Array.isArray(data.clusters)) {
    throw new Error("IA Engine /ia/meta payload inválido (faltan campaigns/clusters).");
  }

  return data;
}

/* ============================================================
 * Cache sencillo en memoria para no pegarle siempre a IA Engine
 * ============================================================ */

let _metaCache: {
  data: IaEngineMeta | null;
  fetchedAt: number;
} = {
  data: null,
  fetchedAt: 0,
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

export async function getIaEngineMetaCached(
  options?: { forceRefresh?: boolean }
): Promise<IaEngineMeta> {
  const now = Date.now();
  const force = options?.forceRefresh === true;

  if (!force && _metaCache.data && now - _metaCache.fetchedAt < CACHE_TTL_MS) {
    return _metaCache.data;
  }

  const meta = await fetchIaEngineMeta();
  _metaCache = {
    data: meta,
    fetchedAt: now,
  };
  return meta;
}
