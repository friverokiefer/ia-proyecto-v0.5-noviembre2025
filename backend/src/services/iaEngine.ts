// backend/src/services/iaEngine.ts
import "dotenv/config";
import { GenerateEmailResponseSchema } from "../lib/ia-engine.schema";
import { isValidCampaign, isValidCluster } from "../utils/validate";

/* ============================================================
 * Tipos
 * ============================================================ */

export type IaEngineFeedback = {
  subject?: string;
  preheader?: string;
  bodyContent?: string; // canonical
  body?: string; // compat
};

export type EmailSetLike = {
  id: number;
  subject: string;
  preheader: string;
  body: {
    title: string;
    subtitle?: string | null;
    content: string;
  };
  cta?: string;
};

/* ============================================================
 * Configuración
 * ============================================================ */

// Puerto por defecto del IA Engine en LOCAL (cuando lo corres a mano)
const DEFAULT_BASE_URL = "http://127.0.0.1:8000";

const rawBase = process.env.IA_ENGINE_BASE_URL || DEFAULT_BASE_URL;

// Normalizamos URL (evita "localhost" y elimina "/" final)
export const IA_ENGINE_BASE_URL = rawBase
  .replace("localhost", "127.0.0.1")
  .replace(/\/+$/, "");

export const IA_ENGINE_ENABLED =
  process.env.IA_ENGINE_ENABLED === "1" ||
  process.env.IA_ENGINE_ENABLED?.toLowerCase() === "true";

/* ============================================================
 * Helper: fetch con timeout
 * ============================================================ */

async function fetchWithTimeout(
  resource: string,
  options: any = {},
  timeoutMs = 30000
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
    throw new Error(`IA Engine network/timeout error: ${err?.message || err}`);
  }
}

/* ============================================================
 * Llamar Microservicio IA Engine (Python / FastAPI)
 * ============================================================ */

export async function generateEmailSetsViaIAEngine(params: {
  campaign: string;
  cluster: string;
  setCount: number;
  feedback?: IaEngineFeedback;
}): Promise<EmailSetLike[]> {
  if (!IA_ENGINE_ENABLED) {
    console.warn("[iaEngine] IA_ENGINE_ENABLED=0 → devolviendo vacío.");
    return [];
  }

  // Validaciones suaves de catálogo (no rompen flujo si falla)
  if (!isValidCampaign(params.campaign)) {
    console.warn(
      `[iaEngine] campaign fuera de catálogo: "${params.campaign}". Revisa backend/src/utils/constants.ts`
    );
  }
  if (!isValidCluster(params.cluster)) {
    console.warn(
      `[iaEngine] cluster fuera de catálogo: "${params.cluster}". Revisa backend/src/utils/constants.ts`
    );
  }

  const payload = {
    campaign: params.campaign,
    cluster: params.cluster,
    // IMPORTANTE: el motor Python espera "sets"
    sets: params.setCount,
    feedback: params.feedback ?? undefined,
  };

  const url = `${IA_ENGINE_BASE_URL}/ia/generate`;

  console.log("\n====================================");
  console.log("[iaEngine] POST →", url);
  console.log("[iaEngine] payload →", JSON.stringify(payload));
  console.log("====================================\n");

  /* -------------------------------
   * Llamada HTTP real
   * ------------------------------- */
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    30000
  );

  if (!res.ok) {
    let text = "";
    try {
      text = await res.text();
    } catch (_) {}

    throw new Error(
      `IA Engine responded ${res.status}: ${text || res.statusText}`
    );
  }

  /* -------------------------------
   * Parseo JSON seguro + validación schema
   * ------------------------------- */
  let raw: unknown;
  try {
    raw = await res.json();
  } catch (err) {
    throw new Error(`IA Engine JSON parse error: ${err}`);
  }

  const parsed = GenerateEmailResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      "[iaEngine] IA Engine payload inválido:",
      parsed.error.flatten()
    );
    throw new Error(
      "IA Engine retornó un payload inválido (mismatch con schema GenerateEmailResponse)."
    );
  }

  const variants: any[] = Array.isArray(parsed.data.variants)
    ? parsed.data.variants
    : [];

  /* ============================================================
   * Mapeo tipado de respuesta
   * ============================================================ */
  const mapped: EmailSetLike[] = variants
    .map((v: any, idx: number): EmailSetLike => {
      const rawId = v?.id ?? idx + 1;
      const idNum = Number(String(rawId).match(/\d+/)?.[0] ?? idx + 1);

      const body = v?.body ?? {};

      return {
        id: idNum,
        subject: String(v?.subject ?? "").trim(),
        preheader: String(v?.preheader ?? "").trim(),
        body: {
          title: String(body?.title ?? "").trim(),
          subtitle:
            body?.subtitle == null || body?.subtitle === ""
              ? null
              : String(body.subtitle),
          content: String(body?.content ?? "").trim(),
        },
        cta: v?.cta ? String(v.cta).trim() : undefined,
      };
    })
    .filter(
      (t: EmailSetLike) => t.subject || t.preheader || t.body.content
    );

  console.log("[iaEngine] ✔️ Variantes recibidas:", mapped.length);

  return mapped;
}
