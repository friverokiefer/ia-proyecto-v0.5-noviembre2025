// backend/src/routes/sfmc.ts
import { Router } from "express";
import {
  createEmailDraft,
  createImageWithUniqueName,
  isSfmcConfigured,
} from "../services/sfmc.service";
import {
  isBiceTemplate,
  renderSfmcTemplateV2,
} from "../services/emailTemplate";

export const sfmcRouter = Router();

/**
 * POST /api/sfmc/draft-email
 * Body:
 * {
 *   categoryId: number,
 *   image: { name, extension, base64?, gcsUrl? },
 *   email: { name, subject, preheader?, htmlTemplate },
 *   batch?: { id: string, meta?: {...} },
 *   dryRun?: boolean
 * }
 */
sfmcRouter.post("/draft-email", async (req, res) => {
  try {
    // Validar configuración SFMC antes de hacer nada "caro"
    if (!isSfmcConfigured()) {
      return res.status(500).json({
        ok: false,
        error:
          "SFMC no está configurado: revisa SFMC_AUTH_URL, SFMC_CLIENT_ID y SFMC_CLIENT_SECRET en backend/.env",
      });
    }

    const { categoryId, image, email, batch, dryRun } = req.body || {};

    const envCategory =
      process.env.SFMC_DEFAULT_CATEGORY_ID || process.env.SFMC_CATEGORY_ID;
    const targetCategory: number = toNumber(categoryId ?? envCategory);

    if (!targetCategory || Number.isNaN(targetCategory)) {
      return res
        .status(400)
        .json({ ok: false, error: "categoryId inválido o ausente" });
    }
    if (!image || !email) {
      return res
        .status(400)
        .json({ ok: false, error: "Faltan 'image' o 'email' en el body" });
    }

    const result: any = { step: {} };

    // --- SIMULACIÓN (dryRun) ---
    if (dryRun) {
      const htmlIn = String(email.htmlTemplate || "");
      const htmlEnsured = ensureCorporateHtml({
        inHtml: htmlIn,
        subject: String(email.subject || ""),
        preheader: String(email.preheader || ""),
        // usamos placeholder para asegurar reemplazo posterior
        heroUrl: "{{IMAGE_URL}}",
      });
      const htmlSim = htmlEnsured.replace(
        /{{\s*IMAGE_URL\s*}}/g,
        "<PUBLISHED_URL>"
      );
      result.step.simulated = {
        emailName: email.name,
        html: htmlSim.slice(0, 1200),
      };
      return res.json({ ok: true, result });
    }

    // --- Resolver base64 de la imagen (desde base64, GCS firmado o público) ---
    let base64: string | undefined =
      typeof image.base64 === "string" && image.base64
        ? stripDataPrefix(image.base64)
        : undefined;

    if (!base64 && image.gcsUrl)
      base64 = await fetchAsBase64NoPrefix(image.gcsUrl);
    if (!base64) {
      return res.status(400).json({
        ok: false,
        error: "No se pudo obtener base64 de la imagen",
      });
    }

    const ext = normalizeExt(image.extension || extFromName(image.name) || "png");
    if (!ext) {
      return res.status(400).json({
        ok: false,
        error: "Extensión inválida (png|jpg|jpeg|gif)",
      });
    }

    // --- Subida robusta con nombre único ---
    const uploaded = await createImageWithUniqueName({
      name: image.name,
      extension: ext,
      categoryId: targetCategory,
      base64,
      batchId: batch?.id,
    });
    result.step.uploadImage = uploaded; // {id, publishedURL, assetNameFinal}

    // --- Garantizar plantilla corporativa + reemplazo de imagen ---
    const inHtml = String(email.htmlTemplate || "");
    const ensuredHtml = ensureCorporateHtml({
      inHtml,
      subject: String(email.subject || ""),
      preheader: String(email.preheader || ""),
      // siempre forzamos a placeholder para usar la imagen subida a SFMC
      heroUrl: "{{IMAGE_URL}}",
    });

    const finalHtml = ensuredHtml.replace(
      /{{\s*IMAGE_URL\s*}}/g,
      uploaded.publishedURL
    );

    // --- Crear borrador en SFMC ---
    const draft = await createEmailDraft({
      name: String(email.name || `email_${Date.now()}`),
      html: finalHtml,
      subject: String(email.subject || ""),
      preheader: String(email.preheader || ""),
      categoryId: targetCategory,
    });
    result.step.createEmailDraft = draft; // {id, customerKey}

    // --- Persistencia opcional del comprobante en GCS ---
    if (process.env.GCP_BUCKET_NAME && batch?.id) {
      try {
        await saveJsonToGCS(
          process.env.GCP_BUCKET_NAME,
          `dev/emails_v2/${batch.id}/sfmc_result.json`,
          { inputs: scrubInputs(req.body), result }
        );
        result.step.persisted = true;
      } catch (e: any) {
        result.step.persisted = false;
        result.step.persistError = e?.message ?? String(e);
      }
    }

    return res.json({ ok: true, result });
  } catch (err: any) {
    console.error("Error en /api/sfmc/draft-email:", err);
    return res.status(500).json({
      ok: false,
      error:
        err?.message || "Error interno en /api/sfmc/draft-email",
    });
  }
});

/* ================= Helpers locales ================= */

function toNumber(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}
function stripDataPrefix(s: string): string {
  const i = s.indexOf("base64,");
  return i >= 0 ? s.substring(i + "base64,".length) : s;
}
function extFromName(name?: string): string | undefined {
  if (!name) return undefined;
  const m = name.toLowerCase().match(/\.(png|jpg|jpeg|gif)$/i);
  return m ? m[1] : undefined;
}
function normalizeExt(
  extRaw: string
): "png" | "jpg" | "jpeg" | "gif" | null {
  const e = String(extRaw).toLowerCase().replace(/^\./, "");
  if (e === "png" || e === "jpg" || e === "jpeg" || e === "gif") return e;
  return null;
}

/** Descarga objeto como base64 (sin prefijo) desde GCS público/firmado o vía SDK si gs:// */
async function fetchAsBase64NoPrefix(url: string): Promise<string> {
  if (
    url.startsWith("gs://") ||
    url.startsWith("https://storage.cloud.google.com/")
  ) {
    const { Storage } = await import("@google-cloud/storage");
    const storage = new Storage();

    let bucket = "";
    let object = "";

    if (url.startsWith("gs://")) {
      const rest = url.slice(5);
      const slash = rest.indexOf("/");
      if (slash < 0) throw new Error("gcsUrl inválida (sin objeto)");
      bucket = rest.slice(0, slash);
      object = rest.slice(slash + 1);
    } else {
      const u = new URL(url);
      const parts = u.pathname.replace(/^\/+/, "").split("/");
      bucket = parts.shift() || "";
      object = parts.join("/");
    }
    if (!bucket || !object)
      throw new Error("No se pudo parsear bucket/obj desde gcsUrl");

    const file = storage.bucket(bucket).file(object);
    const [buf] = await file.download();
    return buf.toString("base64");
  }

  const resp: any = await fetch(url);
  if (!resp.ok) {
    const txt = await safeText(resp);
    throw new Error(`GET ${url} -> ${resp.status}: ${txt}`);
  }
  const ab = await resp.arrayBuffer();
  return Buffer.from(ab).toString("base64");
}

async function safeText(resp: any): Promise<string> {
  try {
    const txt = await resp.text();
    return txt?.slice(0, 1024) || "";
  } catch {
    return "";
  }
}

async function saveJsonToGCS(bucketName: string, path: string, json: unknown) {
  const { Storage } = await import("@google-cloud/storage");
  const storage = new Storage();
  const file = storage.bucket(bucketName).file(path);
  const data = Buffer.from(JSON.stringify(json, null, 2));
  await file.save(data, {
    contentType: "application/json; charset=utf-8",
    resumable: false,
    public: false,
  });
}

/** Evita guardar el base64 original en el comprobante */
function scrubInputs(body: any) {
  const c = JSON.parse(JSON.stringify(body || {}));
  if (c?.image?.base64) c.image.base64 = "<omitted>";
  return c;
}

/**
 * Garantiza plantilla BICE.
 * - Si ya viene nuestra plantilla → se respeta tal cual.
 * - Si viene HTML “simple” → lo parsea y lo envuelve en la plantilla corporativa.
 */
function ensureCorporateHtml(opts: {
  inHtml: string;
  subject: string;
  preheader: string;
  heroUrl?: string; // usar "{{IMAGE_URL}}" cuando queramos forzar reemplazo
}): string {
  const { inHtml, subject, preheader, heroUrl = "{{IMAGE_URL}}" } = opts;
  const raw = String(inHtml || "");

  if (isBiceTemplate(raw)) {
    // Ya es plantilla corporativa; nos aseguramos de que exista meta UTF-8.
    if (!/charset\s*=\s*utf-?8/i.test(raw)) {
      return raw.replace(
        /<head>/i,
        `<head>\n<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />`
      );
    }
    return raw;
  }

  // Parseo mínimo de HTML simple (h1, p y primera img)
  const parsed = parseSimpleEmailHtml(raw);

  // Armamos plantilla BICE con hero como placeholder (se reemplaza después)
  const html = renderSfmcTemplateV2({
    subject,
    preheader,
    heroUrl, // normalmente "{{IMAGE_URL}}"
    title: parsed.title || " ",
    subtitle: parsed.subtitle || "",
    bodyHtml: parsed.bodyHtml || "",
  });

  return html;
}

/**
 * Extrae {title, subtitle, heroUrl, bodyHtml} de un HTML simple.
 * Tolerante a minúsculas/mayúsculas y sin dependencias de DOM.
 */
function parseSimpleEmailHtml(raw: string): {
  title?: string;
  subtitle?: string;
  heroUrl?: string;
  bodyHtml?: string;
} {
  const html = String(raw || "");

  // h1
  const h1m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1m ? stripTags(h1m[1]).trim() : undefined;

  // primer p justo después del h1 (si existe), si no, primer p del documento
  let subtitle: string | undefined;
  if (h1m) {
    const afterH1 = html.slice(h1m.index! + h1m[0].length);
    const pm = afterH1.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    subtitle = pm ? stripTags(pm[1]).trim() : undefined;
  } else {
    const pm = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    subtitle = pm ? stripTags(pm[1]).trim() : undefined;
  }

  // primera imagen
  const im = html.match(/<img[^>]+src=['"]([^'"]+)['"][^>]*>/i);
  const heroUrl = im ? im[1] : undefined;

  // body: todo lo que no sea el héroe, con <br> preservados; si venía <div>/texto plano, lo dejamos
  // Simple: quitamos el primer <h1> y el primer <p> y devolvemos lo demás como body
  let bodyHtml = html;
  if (h1m) bodyHtml = bodyHtml.replace(h1m[0], "");
  const pm = html.match(/<p[^>]*>[\s\S]*?<\/p>/i);
  if (pm) bodyHtml = bodyHtml.replace(pm[0], "");
  if (im) bodyHtml = bodyHtml.replace(im[0], "");
  // si quedó documento completo, intenta recortar al contenido dentro de <body>
  const bm = bodyHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bm) bodyHtml = bm[1];

  bodyHtml = bodyHtml.trim();
  if (!bodyHtml) bodyHtml = "";

  return { title, subtitle, heroUrl, bodyHtml };
}

function stripTags(s: string): string {
  return String(s || "").replace(/<[^>]*>/g, "");
}
