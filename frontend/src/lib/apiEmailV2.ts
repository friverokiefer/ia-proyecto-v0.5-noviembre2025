// frontend/src/lib/apiEmailV2.ts
import { apiJson } from "./api";

/** ========= Tipos Email 2.0 ========= **/

export type EmailV2Feedback = {
  subject?: string;
  preheader?: string;
  bodyContent?: string;
  /**
   * Compatibilidad mínima con clientes antiguos:
   * se puede eliminar cuando nadie envíe "body".
   */
  body?: string;
};

/**
 * Payload para generar Email 2.0
 * - sets: número de Sets de Contenido (1..5)
 * - images: número de imágenes a generar (1..5)
 */
export type GenerateV2Payload = {
  campaign: string;
  cluster: string;
  sets: number; // 1..5
  images?: number; // 1..5
  feedback?: EmailV2Feedback;
};

/**
 * Set de contenido de email:
 * - subject + preheader
 * - body (title, subtitle, content)
 * - CTA opcional
 *
 * Debe calzar con:
 *  - backend/src/services/iaEngine.ts → EmailSetLike
 *  - ia-engine/app/models/response.py → GeneratedVariant
 */
export type EmailContentSet = {
  id: number; // 1..N
  subject: string;
  preheader: string;
  body: {
    title: string;
    subtitle?: string | null;
    content: string;
  };
  cta?: string;
};

export type EmailV2Image = {
  fileName: string;
  heroUrl: string; // absoluta (GCS) o relativa con proxy
  meta?: {
    model?: string;
    size?: string;
    quality?:
      | "standard"
      | "hd"
      | "low"
      | "medium"
      | "high"
      | "auto"
      | string;
    width?: number;
    height?: number;
    sizeNormalized?: string;
  };
  // === Metadatos para históricos SFMC ===
  sfmc?: {
    assetId?: number;
    publishedURL?: string;
    assetNameFinal?: string;
    savedAt?: string; // ISO
  };
};

/**
 * Respuesta al generar Email 2.0:
 * - sets: lista de Sets de Contenido
 * - images: imágenes generadas
 */
export type GenerateV2Response = {
  batchId: string;
  createdAt?: string;
  sets: EmailContentSet[];
  images: EmailV2Image[];
  bucketRoot?: string;
  jsonUrl?: string;
  manifestUrl?: string;
};

export type SaveV2Response = {
  ok: boolean;
  batchId: string;
  setCount: number;
  imageCount: number;
  updatedAt: string;
};

/** ========= Meta Email V2 (campañas / clusters) ========= **/

export type EmailV2Meta = {
  campaigns: string[];
  clusters: string[];
  campaignClusters: Record<string, string[]>;
};

/** ================== Helpers ================== */

export function slugBaseName(name: string): { base: string; ext: string } {
  const n = name.trim().replace(/\s+/g, "_");
  const dot = n.lastIndexOf(".");
  if (dot > -1) {
    return {
      base: n.slice(0, dot).replace(/[^A-Za-z0-9._-]/g, ""),
      ext: n.slice(dot + 1).toLowerCase(),
    };
  }
  return {
    base: n.replace(/[^A-Za-z0-9._-]/g, ""),
    ext: "png",
  };
}

export function buildUniqueAssetName(
  hintFileName: string,
  batchId: string,
  now: number = Date.now()
): { name: string; ext: "png" | "jpg" | "jpeg" | "gif" } {
  const { base, ext } = slugBaseName(hintFileName || "hero.png");
  const safeExt = (ext === "jpeg" || ext === "jpg" || ext === "png" || ext === "gif"
    ? ext
    : "png") as "png" | "jpg" | "jpeg" | "gif";
  const ts = String(now).slice(-8);
  const b = batchId.replace(/[^A-Za-z0-9_-]/g, "");
  const candidate = `${base}_${b}_${ts}.${safeExt}`;
  const trimmed =
    candidate.length > 128
      ? candidate.slice(0, 123) + "." + safeExt
      : candidate;
  return { name: trimmed, ext: safeExt };
}

/** ================== Endpoints ================== */

export async function getEmailV2Meta(): Promise<EmailV2Meta> {
  // Contract backend: GET /api/email-v2/meta
  return apiJson<EmailV2Meta>(
    "/api/email-v2/meta",
    { method: "GET" },
    { timeoutMs: 15_000 }
  );
}

export async function generateEmailsV2(
  payload: GenerateV2Payload
): Promise<GenerateV2Response> {
  const safeSets = Math.max(1, Math.min(5, Number(payload.sets) || 1));
  const safeImages =
    payload.images == null
      ? undefined
      : Math.max(1, Math.min(5, Number(payload.images)));

  let feedback = payload.feedback ? { ...payload.feedback } : undefined;

  // Compatibilidad mínima: si alguien sigue mandando feedback.body,
  // lo mapeamos a bodyContent.
  if (feedback && (feedback as any).body && !feedback.bodyContent) {
    (feedback as any).bodyContent = (feedback as any).body;
    delete (feedback as any).body;
  }

  const body = {
    ...payload,
    sets: safeSets,
    images: safeImages,
    feedback,
  };

  return apiJson<GenerateV2Response>("/api/generate-emails-v2", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateEmailsV2(
  batchId: string,
  sets: EmailContentSet[]
): Promise<SaveV2Response> {
  return apiJson<SaveV2Response>(
    `/api/emails-v2/${encodeURIComponent(batchId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ sets }),
    }
  );
}

export async function renderEmailHtml(args: {
  batchId?: string;
  selectedSet?: number;
  selectedImage?: number;
  save?: boolean;
  fileName?: string;
  data: {
    subject: string;
    preheader?: string;
    body: string;
    cta?: string;
    heroUrl?: string;
    brandColor?: string;
    unsubscribeUrl?: string;
    companyAddress?: string;
    companyName?: string;
    heroAlt?: string;
    baseUrl?: string;
  };
}): Promise<{ ok: boolean; html?: string; url?: string; key?: string; error?: string }> {
  return apiJson(
    "/api/generate-emails-v2/render-email-html",
    {
      method: "POST",
      body: JSON.stringify(args),
    }
  );
}

/** ================== SFMC Draft Email ================== */

export type SfmcImageInput = {
  name: string;
  extension: "png" | "jpg" | "jpeg" | "gif";
  base64?: string;
  gcsUrl?: string;
};

export type SfmcEmailInput = {
  name: string;
  subject: string;
  preheader?: string;
  htmlTemplate: string; // usar {{IMAGE_URL}} donde va el src
};

export type SfmcBatchMeta = {
  id: string;
  meta?: Record<string, unknown>;
};

export type SfmcDraftEmailPayload = {
  categoryId: number;
  image: SfmcImageInput;
  email: SfmcEmailInput;
  batch?: SfmcBatchMeta;
  dryRun?: boolean;
};

export type SfmcDraftEmailResponse = {
  ok: boolean;
  result?: {
    step?: {
      uploadImage?: {
        id: number;
        publishedURL: string;
        assetNameFinal?: string;
      };
      createEmailDraft?: {
        id: number;
        customerKey?: string;
      };
      persisted?: boolean;
      persistError?: string;
    };
  };
  error?: string;
};

export async function postSfmcDraftEmail(
  payload: SfmcDraftEmailPayload,
  opts?: { timeoutMs?: number }
): Promise<SfmcDraftEmailResponse> {
  return apiJson<SfmcDraftEmailResponse>(
    "/api/sfmc/draft-email",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    opts
  );
}
