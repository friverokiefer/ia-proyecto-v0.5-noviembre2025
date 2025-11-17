// backend/src/services/sfmc.service.ts
// Node 18+ (fetch global). ENV:
//  - SFMC_AUTH_URL (https://<subdomain>.auth.marketingcloudapis.com)
//  - SFMC_CLIENT_ID
//  - SFMC_CLIENT_SECRET
//  - SFMC_ACCOUNT_ID (opcional)

type TokenState = {
  accessToken: string;
  restBase: string; // https://<sub>.rest.marketingcloudapis.com
  expiresAt: number; // epoch ms
};

let tokenState: TokenState | null = null;
let inFlight: Promise<TokenState> | null = null;

const AUTH_URL = (process.env.SFMC_AUTH_URL || "").replace(/\/+$/, "");
const CLIENT_ID = process.env.SFMC_CLIENT_ID || "";
const CLIENT_SECRET = process.env.SFMC_CLIENT_SECRET || "";
const ACCOUNT_ID = process.env.SFMC_ACCOUNT_ID || undefined;

if (!AUTH_URL || !CLIENT_ID || !CLIENT_SECRET) {
  console.warn(
    "[SFMC] Faltan variables: SFMC_AUTH_URL, SFMC_CLIENT_ID, SFMC_CLIENT_SECRET."
  );
}

/** Permite saber desde las rutas si SFMC está configurado razonablemente */
export function isSfmcConfigured(): boolean {
  return Boolean(AUTH_URL && CLIENT_ID && CLIENT_SECRET);
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  rest_instance_url: string;
  soap_instance_url?: string;
};

async function safeText(resp: Response): Promise<string> {
  try {
    const txt = await resp.text();
    return txt?.slice(0, 4000) || "";
  } catch {
    return "";
  }
}

/** Llama /v2/token (siempre fresco) */
async function fetchToken(): Promise<TokenState> {
  if (!AUTH_URL) throw new Error("SFMC_AUTH_URL no configurado");
  if (!CLIENT_ID) throw new Error("SFMC_CLIENT_ID no configurado");
  if (!CLIENT_SECRET) throw new Error("SFMC_CLIENT_SECRET no configurado");

  const body: Record<string, unknown> = {
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  };
  if (ACCOUNT_ID) body.account_id = ACCOUNT_ID;

  const resp = await fetch(`${AUTH_URL}/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Accept-Charset": "utf-8",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await safeText(resp);
    throw new Error(`Token error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as TokenResponse;
  const now = Date.now();
  const restBase = (data.rest_instance_url || "").replace(/\/$/, "");
  if (!restBase) throw new Error("No rest_instance_url en /v2/token");

  return {
    accessToken: data.access_token,
    restBase,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
}

/** Obtiene token válido. Si expira en <60s, renueva. */
export async function getToken(): Promise<TokenState> {
  const margin = 60_000;
  const now = Date.now();
  if (tokenState && tokenState.expiresAt - now > margin) return tokenState;
  if (!inFlight) inFlight = fetchToken().finally(() => (inFlight = null));
  tokenState = await inFlight;
  return tokenState!;
}

/** Refresh inmediato (tras 401) */
async function refreshTokenNow(): Promise<TokenState> {
  tokenState = await fetchToken();
  return tokenState!;
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

/** Fetch REST con Bearer + retry en 401 */
async function sfmcFetch(
  path: string,
  init: RequestInit = {},
  retryOn401 = true
): Promise<Response> {
  let tk = await getToken();
  const url = joinUrl(tk.restBase, path);

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${tk.accessToken}`);
  if (!headers.has("Content-Type"))
    headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Accept-Charset", "utf-8");

  let resp = await fetch(url, { ...init, headers });

  if (resp.status === 401 && retryOn401) {
    tk = await refreshTokenNow();
    const url2 = joinUrl(tk.restBase, path);
    const headers2 = new Headers(init.headers || {});
    headers2.set("Authorization", `Bearer ${tk.accessToken}`);
    if (!headers2.has("Content-Type"))
      headers2.set("Content-Type", "application/json; charset=utf-8");
    headers2.set("Accept-Charset", "utf-8");
    resp = await fetch(url2, { ...init, headers: headers2 });
  }
  return resp;
}

async function sfmcJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const resp = await sfmcFetch(path, init, true);
  if (!resp.ok) {
    const text = await safeText(resp);
    throw new Error(`SFMC ${resp.status} ${resp.statusText}: ${text}`);
  }
  return (await resp.json()) as T;
}

/* =========================
 *  Helpers de negocio
 * ========================= */

function stripDataUrl(input: string): string {
  const m = /^data:[^;]+;base64,(.*)$/i.exec(input);
  return m ? m[1] : input;
}

/** Sube imagen por base64 (sin prefijo data:). Devuelve id + publishedURL. */
export async function uploadImageBase64(params: {
  base64: string;
  name: string;
  extension: "png" | "jpg" | "jpeg" | "gif";
  categoryId: number;
}): Promise<{ id: number; publishedURL: string }> {
  const clean = stripDataUrl(params.base64);
  const payload = {
    name: params.name,
    assetType: { name: "image", id: 28 },
    category: { id: params.categoryId },
    file: clean,
    fileProperties: {
      extension: params.extension,
      fileName: params.name,
    },
  };

  type UploadResp = {
    id: number;
    fileProperties?: { publishedURL?: string; secureUrl?: string };
    url?: string;
  };

  const data = await sfmcJson<UploadResp>(`/asset/v1/content/assets`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const publishedURL =
    data?.fileProperties?.publishedURL ||
    data?.fileProperties?.secureUrl ||
    data?.url;

  if (!publishedURL)
    throw new Error("publishedURL no disponible en la respuesta de imagen");
  return { id: data.id, publishedURL };
}

/** Crea Email HTML (htmlemail id=208). */
export async function createEmailDraft(params: {
  name: string;
  html: string;
  subject: string;
  preheader?: string;
  categoryId: number;
}): Promise<{ id: number; customerKey?: string }> {
  // Texto plano mínimo para evitar que SFMC derive codificación rara del view "text"
  const plainText = htmlToPlain(params.html);

  const payload = {
    name: params.name,
    assetType: { name: "htmlemail", id: 208 },
    category: { id: params.categoryId },
    channels: { email: true, web: false },
    status: { id: 1, name: "Draft" },
    views: {
      html: {
        // aunque SFMC no documente contentType aquí, mantenemos el meta en el HTML
        content: params.html,
      },
      text: {
        content: plainText,
      },
      subjectline: { content: params.subject },
      preheader: { content: params.preheader ?? "" },
    },
    data: {
      email: {
        options: {
          emailSubject: params.subject,
          preHeader: params.preheader ?? "",
        },
      },
    },
  };

  type EmailResp = { id: number; customerKey?: string };
  const data = await sfmcJson<EmailResp>(`/asset/v1/content/assets`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return { id: data.id, customerKey: data.customerKey };
}

function htmlToPlain(html: string): string {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Listados opcionales */
export async function listCategories(opts?: {
  page?: number;
  pageSize?: number;
  orderBy?: string;
}) {
  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 200;
  const orderBy = encodeURIComponent(opts?.orderBy ?? "name asc");
  return sfmcJson<any>(
    `/asset/v1/content/categories?page=${page}&pageSize=${pageSize}&$orderBy=${orderBy}`
  );
}

export async function listAssetsByCategory(
  categoryId: number,
  opts?: { pageSize?: number }
) {
  const pageSize = opts?.pageSize ?? 200;
  return sfmcJson<any>(
    `/asset/v1/content/assets?$filter=category.id%20eq%20${categoryId}&$orderBy=name%20asc&pageSize=${pageSize}`
  );
}

/** === NUEVO: Creador robusto con retry por nombre duplicado === */
export async function createImageWithUniqueName(params: {
  name: string;
  extension: "png" | "jpg" | "jpeg" | "gif";
  categoryId: number;
  base64: string;
  batchId?: string;
}): Promise<{ id: number; publishedURL: string; assetNameFinal: string }> {
  async function tryCreate(name: string) {
    const r = await uploadImageBase64({
      base64: params.base64,
      name,
      extension: params.extension,
      categoryId: params.categoryId,
    });
    return { ...r, assetNameFinal: name };
  }

  try {
    return await tryCreate(params.name);
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (!/Asset names .* must be unique/i.test(msg)) throw e;

    const m = /Suggested name:\s*([^"]+?)(?:\s*\)|"|$)/i.exec(msg);
    if (m?.[1]) {
      try {
        return await tryCreate(m[1].trim());
      } catch {
        /* continúa */
      }
    }

    const dot = params.name.lastIndexOf(".");
    const suffix =
      (params.batchId ? `_${params.batchId}` : "") +
      `_${Date.now().toString().slice(-8)}`;
    const renamed =
      dot > -1
        ? `${params.name.slice(0, dot)}${suffix}${params.name.slice(dot)}`
        : `${params.name}${suffix}`;
    return await tryCreate(renamed);
  }
}
