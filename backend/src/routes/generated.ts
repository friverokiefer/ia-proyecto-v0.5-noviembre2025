// backend/src/routes/generated.ts
import { Router, Request, Response } from "express";
import {
  readJson,
  ensureReadUrl,
  cloudConsoleUrl,
  withPrefix,
  objectExists,
  listFilesByPrefix,
  publicObjectUrl,
  CFG,
} from "../services/gcpStorage";

const router = Router();

/** Ubica el JSON real del batch (batch.json, _batch.json, manifest.json, etc.) */
async function resolveBatchJsonKey(batchId: string): Promise<string | null> {
  const canonical = `emails_v2/${batchId}/batch.json`;
  if (await objectExists(canonical)) return canonical;

  const all = await listFilesByPrefix(`emails_v2/${batchId}/`);
  const jsons = all
    .filter((f) => f.name.toLowerCase().endsWith(".json"))
    .map((f) => f.name);

  if (!jsons.length) return null;

  const preferred = [/\/batch\.json$/i, /\/batch_v2\.json$/i, /\/_batch\.json$/i, /\/manifest\.json$/i];
  for (const rx of preferred) {
    const hit = jsons.find((n) => rx.test(n));
    if (hit) return hit;
  }
  return jsons[0] || null;
}

/** Decide la URL de imagen a exponer */
async function heroUrlForObjectKey(objectKey: string): Promise<string> {
  // Público + estilo "console" => viewer (storage.cloud.google.com)
  if (CFG.PUBLIC_READ && CFG.URL_STYLE === "console") {
    return publicObjectUrl(objectKey);
  }
  // Privado o estilo "direct": firmada o directa
  return ensureReadUrl(objectKey, 15);
}

/** Completa images[].heroUrl con URL legible */
async function normalizeImages(batchId: string, data: any) {
  if (!Array.isArray(data?.images)) return data;

  data.images = await Promise.all(
    data.images.map(async (img: any) => {
      const fileName = String(img?.fileName || img?.url || "").replace(/^\/+/, "");
      if (!fileName) return img;

      // Respetar si ya viene con http(s)
      if (img?.heroUrl && /^https?:\/\//i.test(String(img.heroUrl))) return img;

      const objectKey = `emails_v2/${batchId}/${fileName}`;
      try {
        const url = await heroUrlForObjectKey(objectKey);
        return { ...img, heroUrl: url, consoleUrl: cloudConsoleUrl(objectKey) };
      } catch {
        return img;
      }
    })
  );

  return data;
}

/** GET JSON del lote (siempre desde backend) */
async function getBatchJson(req: Request, res: Response) {
  const batchId = String(req.params.batchId || "").trim();
  if (!batchId) return res.status(400).send("batchId requerido");

  try {
    const key = await resolveBatchJsonKey(batchId);
    if (!key) return res.status(404).send(`No se encontró batch ${batchId}`);

    const data = await readJson<any>(key);
    const fixed = await normalizeImages(batchId, data);

    // Para que tengas un link “de vista” al JSON en cloud viewer (clic, no fetch):
    (fixed as any)._viewerUrl = publicObjectUrl(key);

    return res.json(fixed);
  } catch {
    return res.status(404).send(`No se encontró batch ${batchId}`);
  }
}

/** Redirección universal de objetos (imágenes) */
async function redirectObject(req: Request, res: Response) {
  const batchId = String(req.params.batchId || "").trim();
  const file = String((req.params as any).file || "").replace(/^\/+/, "");
  if (!batchId || !file) return res.status(400).send("batchId y archivo requeridos");

  const objectKey = withPrefix(`emails_v2/${batchId}/${file}`).replace(/^\/+/, "");
  try {
    // Si público+console: usa viewer. Si no, firma o directa según ensureReadUrl.
    const url =
      CFG.PUBLIC_READ && CFG.URL_STYLE === "console"
        ? publicObjectUrl(`emails_v2/${batchId}/${file}`)
        : await ensureReadUrl(`emails_v2/${batchId}/${file}`, 10);

    return res.redirect(302, url);
  } catch {
    return res.status(404).send("Objeto no encontrado");
  }
}

// JSON
router.get("/api/generated/emails_v2/:batchId/batch.json", getBatchJson);
router.get("/generated/emails_v2/:batchId/batch.json", getBatchJson);

// Archivos (wildcard)
router.get("/api/generated/emails_v2/:batchId/*", (req, res) => redirectObject(req, res));
router.get("/generated/emails_v2/:batchId/*", (req, res) => redirectObject(req, res));

export const generatedRouter = router;
export default router;
