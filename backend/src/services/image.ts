// backend/src/services/image.ts
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { getOpenAI, extractOpenAIError } from "./openai";

/** ===== Helpers internos ===== */
function pad2(n: number) {
  return String(n + 1).padStart(2, "0");
}
async function writeBuffer(p: string, buf: Buffer) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, buf);
}
function parseSize(size: ImageSizeUnion | undefined) {
  if (!size || size === "auto") return { width: undefined, height: undefined };
  const [w, h] = size.split("x").map((n) => parseInt(n, 10));
  return { width: w, height: h };
}

/** Tipos utilitarios */
type ImageSizeUnion =
  | "1024x1024"
  | "256x256"
  | "512x512"
  | "auto"
  | "1536x1024"
  | "1024x1536"
  | "1792x1024"
  | "1024x1792";

type ImageQualityUnion = "low" | "medium" | "high" | "auto";

/** Traducción flexible de etiquetas de calidad */
function normalizeQuality(raw?: string | null): ImageQualityUnion | undefined {
  if (!raw) return undefined;
  const q = String(raw).trim().toLowerCase();
  if (q === "standard") return "medium"; // evita error 400
  if (q === "hd") return "high";
  if (q === "low" || q === "medium" || q === "high" || q === "auto")
    return q as ImageQualityUnion;
  return undefined;
}

/** 🔧 Tamaños por modelo */
function pickSizeForModel(model: string, raw?: string): ImageSizeUnion {
  const rawTrim = (raw || "").trim() as ImageSizeUnion;

  // gpt-image-1: soporta 1024x1024, 1024x1536, 1536x1024, auto
  if (model === "gpt-image-1") {
    const allowed: ImageSizeUnion[] = ["auto", "1024x1024", "1536x1024", "1024x1536"];
    return allowed.includes(rawTrim) ? rawTrim : "1536x1024";
  }

  // DALL·E antiguos
  if (/dall-e-?3/i.test(model)) {
    const allowed: ImageSizeUnion[] = ["1024x1024", "1792x1024", "1024x1792"];
    return allowed.includes(rawTrim) ? rawTrim : "1792x1024";
  }
  if (/dall-?e-?2/i.test(model)) {
    const allowed: ImageSizeUnion[] = ["256x256", "512x512", "1024x1024"];
    return allowed.includes(rawTrim) ? rawTrim : "1024x1024";
  }
  return "1024x1024";
}

/** =========================
 * Normalizador a 16:9 (1792x1024)
 * ========================= */
export type NormalizeMode = "cover" | "contain" | "inside";

/**
 * Normaliza cualquier imagen a JPG 1792x1024.
 */
export async function normalizeJpeg(
  inputPath: string,
  outputPath: string,
  {
    mode = "cover",
    quality = 88,
    width = 1792,
    height = 1024,
  }: { mode?: NormalizeMode; quality?: number; width?: number; height?: number } = {}
) {
  // 1) Intento con attention
  await sharp(inputPath)
    .rotate()
    .resize(width, height, {
      fit: mode === "cover" ? "cover" : mode === "inside" ? "inside" : "contain",
      position: "attention",
      withoutEnlargement: false,
      background: mode === "contain" ? { r: 255, g: 255, b: 255, alpha: 1 } : undefined,
    })
    .toColourspace("srgb")
    .jpeg({ quality, mozjpeg: true, progressive: true, chromaSubsampling: "4:2:0" })
    .toFile(outputPath);

  const meta1 = await sharp(outputPath).metadata();
  if (meta1.width === width && meta1.height === height) return;

  // 2) Fallback con center
  await sharp(inputPath)
    .rotate()
    .resize(width, height, {
      fit: mode === "cover" ? "cover" : mode === "inside" ? "inside" : "contain",
      position: "center",
      withoutEnlargement: false,
      background: mode === "contain" ? { r: 255, g: 255, b: 255, alpha: 1 } : undefined,
    })
    .toColourspace("srgb")
    .jpeg({ quality, mozjpeg: true, progressive: true, chromaSubsampling: "4:2:0" })
    .toFile(outputPath);

  const meta2 = await sharp(outputPath).metadata();
  if (!(meta2.width === width && meta2.height === height)) {
    throw new Error(
      `normalizeJpeg: no se pudo fijar exactamente a ${width}x${height} (obtenido ${meta2.width}x${meta2.height}).`
    );
  }
}

/** (Opcional) quick compare cover/contain */
export async function generateHeroVariants(input: string, outDir: string, base: string) {
  const cover = path.join(outDir, `${base}_hero_cover_1792x1024.jpg`);
  const contain = path.join(outDir, `${base}_hero_contain_1792x1024.jpg`);
  await normalizeJpeg(input, cover, { mode: "cover", width: 1792, height: 1024 });
  await normalizeJpeg(input, contain, { mode: "contain", width: 1792, height: 1024 });
  return { cover, contain };
}

/** ========== Prompt builders ========== */
function buildEmailHeroPrompt({
  campaign,
  cluster,
  promptHint,
}: {
  campaign: string;
  cluster: string;
  promptHint?: string;
}) {
  const parts: string[] = [
    "Hero para email horizontal 3:2 (1536x1024) full-bleed (edge-to-edge).",
    "SIN texto, SIN logos, SIN marcas de agua, SIN marcos ni bordes, SIN barras.",
    "Llena por completo el lienzo horizontal; evita franjas vacías o fondos planos.",
    "Estilo fotorrealista corporativo, luz natural, moderno y limpio.",
    "Composición equilibrada con espacio negativo útil sin dejar 'aire'.",
    "Si hay personas: diversidad realista, expresiones naturales.",
    `Campaña: ${campaign}. Cluster: ${cluster}.`,
  ];
  if (promptHint && String(promptHint).trim()) {
    parts.push(`Pista creativa (opcional): ${String(promptHint).trim().slice(0, 240)}`);
  }
  return parts.join(" ");
}

/** ===== Timeout helpers ===== */
function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: any;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`timeout:${label}:${ms}ms`)), ms);
  });
  try {
    const out = await Promise.race([p, timeout]);
    clearTimeout(timer);
    // @ts-ignore
    return out;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/** ===== Fallback local (banner sólido 1792x1024) ===== */
async function createFallbackBanner(finalPath: string, rawPath: string) {
  const fallback = sharp({
    create: {
      width: 1792,
      height: 1024,
      channels: 3,
      background: { r: 235, g: 240, b: 248 },
    },
  })
    .jpeg({ quality: 90, mozjpeg: true, progressive: true })
    .toBuffer();

  const buf = await fallback;
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  await fs.writeFile(rawPath, buf);
  await fs.writeFile(finalPath, buf);

  return { width: 1792, height: 1024 };
}

/**
 * Genera la imagen HÉROE con tamaño permitido (1536x1024) y normaliza a 1792x1024 COVER.
 */
export async function generateHeroPNG({
  campaign,
  cluster,
  outDir,
  versionIndex,
  promptHint,
  mode = "cover",
}: {
  campaign: string;
  cluster: string;
  outDir: string;
  versionIndex: number;
  promptHint?: string;
  mode?: NormalizeMode;
}) {
  const client = getOpenAI();
  const model = process.env.OPENAI_IMAGE || "gpt-image-1";
  const size: ImageSizeUnion = pickSizeForModel(model, "1536x1024");
  const quality: ImageQualityUnion = "low"; // ⚡ ahora compatible y más rápido
  const prompt = buildEmailHeroPrompt({ campaign, cluster, promptHint });

  const base = `hero_v${pad2(versionIndex)}`;
  const tmpPath = path.join(outDir, `${base}.tmp.jpg`);
  const rawName = `${base}.raw.jpg`;
  const rawPath = path.join(outDir, rawName);
  const finalName = `${base}.jpg`;
  const finalPath = path.join(outDir, finalName);

  let b64: string | undefined;
  let lastErr: any;

  const MAX_ATTEMPTS = 2;
  const PER_ATTEMPT_TIMEOUT = 65000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`[image] attempt ${attempt}/${MAX_ATTEMPTS} model=${model} size=${size} quality=${quality}`);
      const params: any = { model, size, prompt, quality };
      const res = await withTimeout(client.images.generate(params), PER_ATTEMPT_TIMEOUT, "images.generate");
      b64 = (res as any)?.data?.[0]?.b64_json;
      if (b64) break;
      lastErr = new Error("La API no retornó imagen (b64_json vacío).");
    } catch (e: any) {
      lastErr = e;
      console.warn(`[image] attempt ${attempt} failed:`, e?.message || e);
      await delay(500);
    }
  }

  if (!b64) {
    console.error("[image] OpenAI falló o tardó demasiado; uso fallback local.");
    const metaFallback = await createFallbackBanner(finalPath, rawPath);
    return {
      fileName: finalName,
      url: finalName,
      rawFileName: rawName,
      meta: {
        model: `${model} (fallback)`,
        size,
        width: metaFallback.width,
        height: metaFallback.height,
        quality,
        sizeNormalized: `${metaFallback.width}x${metaFallback.height}`,
        fallback: true as any,
      } as any,
    };
  }

  const rawBuffer = Buffer.from(b64, "base64");
  await writeBuffer(tmpPath, rawBuffer);

  await sharp(tmpPath).rotate().toColourspace("srgb").jpeg({ quality: 90, mozjpeg: true }).toFile(rawPath);

  await normalizeJpeg(tmpPath, finalPath, { mode, width: 1792, height: 1024, quality: 88 });

  try {
    await fs.unlink(tmpPath);
  } catch {}

  const finalMeta = await sharp(finalPath).metadata();
  const realW = finalMeta.width;
  const realH = finalMeta.height;

  return {
    fileName: finalName,
    url: finalName,
    rawFileName: rawName,
    meta: { model, size, width: realW, height: realH, quality, sizeNormalized: `${realW}x${realH}` },
  };
}

/**
 * Banner genérico (horizontal)
 */
export async function generateBannerJPG({
  prompt,
  outDir,
  fileName,
  mode = "cover",
}: {
  prompt: string;
  outDir: string;
  fileName?: string;
  mode?: NormalizeMode;
}) {
  const client = getOpenAI();
  const model = process.env.OPENAI_IMAGE || "gpt-image-1";
  const size: ImageSizeUnion = pickSizeForModel(model, "1536x1024");
  const quality: ImageQualityUnion = "low"; // ⚡ igual que arriba

  const base = (fileName?.replace(/\.(jpg|jpeg|png|webp)$/i, "") || `banner_${Date.now()}`).trim();
  const tmpPath = path.join(outDir, `${base}.tmp.jpg`);
  const rawName = `${base}.raw.jpg`;
  const rawPath = path.join(outDir, rawName);
  const finalName = `${base}.jpg`;
  const finalPath = path.join(outDir, finalName);

  let b64: string | undefined;
  let lastErr: any;

  const MAX_ATTEMPTS = 2;
  const PER_ATTEMPT_TIMEOUT = 65000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`[banner] attempt ${attempt}/${MAX_ATTEMPTS} model=${model} size=${size} quality=${quality}`);
      const params: any = { model, size, prompt, quality };
      const res = await withTimeout(client.images.generate(params), PER_ATTEMPT_TIMEOUT, "images.generate");
      b64 = (res as any)?.data?.[0]?.b64_json;
      if (b64) break;
      lastErr = new Error("La API no retornó imagen (b64_json vacío).");
    } catch (e: any) {
      lastErr = e;
      console.warn(`[banner] attempt ${attempt} failed:`, e?.message || e);
      await delay(500);
    }
  }

  if (!b64) {
    console.error("[banner] OpenAI falló o tardó demasiado; uso fallback local.");
    const metaFallback = await createFallbackBanner(finalPath, rawPath);
    return {
      fileName: finalName,
      url: finalName,
      rawFileName: rawName,
      meta: {
        model: `${model} (fallback)`,
        size,
        width: metaFallback.width,
        height: metaFallback.height,
        quality,
        sizeNormalized: `${metaFallback.width}x${metaFallback.height}`,
        fallback: true as any,
      } as any,
    };
  }

  const rawBuffer = Buffer.from(b64, "base64");
  await writeBuffer(tmpPath, rawBuffer);

  await sharp(tmpPath).rotate().toColourspace("srgb").jpeg({ quality: 90, mozjpeg: true }).toFile(rawPath);

  await normalizeJpeg(tmpPath, finalPath, { mode, width: 1792, height: 1024, quality: 86 });

  try {
    await fs.unlink(tmpPath);
  } catch {}

  const finalMeta = await sharp(finalPath).metadata();
  const realW = finalMeta.width;
  const realH = finalMeta.height;

  return {
    fileName: finalName,
    url: finalName,
    rawFileName: rawName,
    meta: { model, size, width: realW, height: realH, quality, sizeNormalized: `${realW}x${realH}` },
  };
}
