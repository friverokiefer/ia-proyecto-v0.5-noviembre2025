// backend/src/services/openai.ts
import OpenAI from "openai";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

/**
 * Carga únicamente backend/.env
 * (__dirname = backend/src/services)
 */
const envPath = path.resolve(__dirname, "..", "..", ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

/** =========================
 * Configuración (env)
 * ========================= */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const OPENAI_ORG = process.env.OPENAI_ORG?.trim();
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL?.trim();

// Texto
const OPENAI_TEXT_MODEL =
  process.env.OPENAI_TEXT_MODEL?.trim() ||
  process.env.OPENAI_MODEL?.trim() ||
  // Compat con tus .env
  process.env.OPENAI_TEXT_JSON?.trim() ||
  "gpt-4o-mini";

const OPENAI_TEMPERATURE =
  process.env.OPENAI_TEMPERATURE != null ? Number(process.env.OPENAI_TEMPERATURE) : 0.7;
const OPENAI_TOP_P =
  process.env.OPENAI_TOP_P != null ? Number(process.env.OPENAI_TOP_P) : undefined;
const OPENAI_MAX_TOKENS =
  process.env.OPENAI_MAX_TOKENS != null ? Number(process.env.OPENAI_MAX_TOKENS) : 600;

// Imágenes
const OPENAI_IMAGE_MODEL =
  process.env.OPENAI_IMAGE_MODEL?.trim() ||
  process.env.IMAGE_MODEL?.trim() ||
  process.env.OPENAI_IMAGE?.trim() || // ← tu variable actual
  "gpt-image-1";

// ✅ Defaults seguros y permitidos para gpt-image-1
// Soportados: 1024x1024, 1024x1536, 1536x1024, auto
const IMAGE_SIZE_RAW = (process.env.IMAGE_SIZE?.trim() || "1536x1024").toLowerCase();
const IMAGE_QUALITY_RAW = (process.env.IMAGE_QUALITY?.trim() || "hd").toLowerCase();

// Timeouts
const OPENAI_TIMEOUT_MS =
  process.env.OPENAI_TIMEOUT_MS != null ? Number(process.env.OPENAI_TIMEOUT_MS) : 60_000;

/** =========================================
 * Cliente
 * ========================================= */
let _client: OpenAI | null = null;
export function getOpenAI() {
  if (!OPENAI_API_KEY) {
    throw new Error("Falta OPENAI_API_KEY en backend/.env");
  }
  if (_client) return _client;
  _client = new OpenAI({
    apiKey: OPENAI_API_KEY,
    ...(OPENAI_ORG ? { organization: OPENAI_ORG } : {}),
    ...(OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : {}),
    // @ts-ignore (SDK acepta timeout via defaultHeaders en runtime)
    timeout: OPENAI_TIMEOUT_MS,
  });
  return _client;
}

/** =========================================
 * Extractor de errores (mejorado)
 * ========================================= */
export function extractOpenAIError(e: any): { status?: number; message: string } {
  const status = e?.status || e?.response?.status;
  const message =
    e?.message ||
    e?.error?.message ||
    e?.response?.data?.error?.message ||
    e?.response?.data?.message ||
    "Error con OpenAI";
  return { status, message };
}

/** =========================================
 * Config helpers (para usar en servicios)
 * ========================================= */
export function getTextModelConfig() {
  return {
    model: OPENAI_TEXT_MODEL,
    temperature: OPENAI_TEMPERATURE,
    top_p: OPENAI_TOP_P,
    max_tokens: OPENAI_MAX_TOKENS,
  };
}

export function getImageModelConfig() {
  // Normaliza tamaño/calidad a valores válidos
  let size = IMAGE_SIZE_RAW;
  if (!["1024x1024", "1024x1536", "1536x1024", "auto"].includes(size)) {
    size = "1536x1024";
  }

  let quality = IMAGE_QUALITY_RAW;
  if (!["standard", "hd"].includes(quality)) {
    quality = "hd";
  }

  return {
    model: OPENAI_IMAGE_MODEL,
    size,
    quality,
  };
}

/** Metadata consolidada del generador (para _manifest.json) */
export function currentGeneratorMeta(extra?: Record<string, any>) {
  return {
    textModel: OPENAI_TEXT_MODEL,
    imageModel: OPENAI_IMAGE_MODEL,
    temperature: OPENAI_TEMPERATURE,
    top_p: OPENAI_TOP_P,
    max_tokens: OPENAI_MAX_TOKENS,
    baseURL: OPENAI_BASE_URL || null,
    organization: OPENAI_ORG || null,
    ...(extra || {}),
  };
}

/** =========================
 * Utilidades JSON robustas
 * ========================= */
function stripCodeFences(s: string) {
  return String(s || "").replace(/```json|```/gi, "").trim();
}
function tryParseJSON<T = any>(raw: string): T {
  const cleaned = stripCodeFences(raw);
  try {
    return JSON.parse(cleaned);
  } catch {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const maybe = cleaned.slice(start, end + 1);
    return JSON.parse(maybe);
  }
  throw new Error("No se pudo parsear JSON de la respuesta del modelo.");
}

/** =========================================
 * chatJSON: pide JSON y lo parsea con reintentos
 * ========================================= */
export async function chatJSON<T = any>({
  system,
  user,
  model = OPENAI_TEXT_MODEL,
  temperature = OPENAI_TEMPERATURE,
  top_p = OPENAI_TOP_P,
  max_tokens = OPENAI_MAX_TOKENS,
  retries = 2,
}: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  retries?: number;
}): Promise<T> {
  const client = getOpenAI();
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await client.chat.completions.create({
        model,
        temperature,
        top_p,
        max_tokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" as const },
      });
      const content = resp.choices?.[0]?.message?.content ?? "";
      return tryParseJSON<T>(content);
    } catch (e: any) {
      lastErr = e;
      if (attempt < retries) continue;
    }
  }
  const parsed = extractOpenAIError(lastErr);
  const err = new Error(parsed.message || "Fallo chatJSON");
  (err as any).status = parsed.status || 502;
  throw err;
}
