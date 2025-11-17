// frontend/src/lib/api.ts

/**
 * Configuración base de API:
 * - En dev (Vite): rutas relativas → usa el proxy /api definido en vite.config.ts.
 * - En prod/stage: define VITE_API_BASE=https://<tu-servicio>.run.app (ideal sin slash final).
 * - Fallback para otros entornos: http://localhost:8080.
 */
const RAW_API_BASE = (import.meta as any).env?.VITE_API_BASE as string | undefined;
const IS_DEV = Boolean((import.meta as any).env?.DEV);

export const API_BASE: string =
  (RAW_API_BASE && RAW_API_BASE.replace(/\/+$/, "")) ||
  (IS_DEV ? "" : "http://localhost:8080");

type TimeoutOptions = { timeoutMs?: number };

function buildUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

/** Timeout helper */
export function withTimeout(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(id),
  };
}

/**
 * Lee respuesta como JSON si corresponde; si no, como texto
 * e intenta parsear a JSON. Último fallback: { error: string }.
 */
async function parseSmart(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

/**
 * fetch JSON robusto + timeout + bubbling de error detallado.
 * Siempre apunta a API_BASE + path.
 */
export async function fetchJson<T>(
  path: string,
  init?: RequestInit,
  opts: TimeoutOptions = {}
): Promise<T> {
  const url = buildUrl(path);
  const { timeoutMs = 45_000 } = opts;
  const t = withTimeout(timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      signal: t.signal,
      ...init,
    });

    const payload = (await parseSmart(res)) as any;

    if (!res.ok) {
      const msg =
        payload?.message ||
        payload?.error ||
        `${res.status} ${res.statusText}` ||
        "Error desconocido";

      console.error("API error payload:", payload);
      throw new Error(msg);
    }

    return payload as T;
  } finally {
    t.clear();
  }
}

/** POST JSON tipado */
export async function postJson<T>(
  path: string,
  body: unknown,
  opts?: TimeoutOptions
): Promise<T> {
  return fetchJson<T>(
    path,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    opts
  );
}

/**
 * Alias semántico cuando quieres enfatizar que es JSON.
 * Firma idéntica a fetchJson.
 */
export const apiJson = fetchJson;

/**
 * Devuelve una URL absoluta para imágenes.
 * - Si ya viene absoluta → se deja igual.
 * - Si es relativa → se monta sobre window.location.origin.
 */
export function absoluteImageUrl(url?: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;

  const base = window.location.origin.replace(/\/+$/, "");
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}

/**
 * Sube un lote completo a GCP llamando al backend.
 * @deprecated Preferir el flujo nuevo de Email 2.0 cuando sea posible.
 */
export async function uploadToGCP(
  batchId: string,
  type: "emails" | "emails_v2" | "blog" | "ads" | "social" | "meta" = "emails_v2"
): Promise<unknown> {
  return postJson("/api/upload-to-gcp", { batchId, type });
}
