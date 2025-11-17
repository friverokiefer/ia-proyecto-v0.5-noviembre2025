// backend/src/routes/history.ts
import { Router } from "express";
import {
  listEmailV2BatchIds,
  readJson,
  getObjectUpdatedAtMs,
  objectExists,
} from "../services/gcpStorage";

export const historyRouter = Router();

/**
 * GET /api/history?type=emails_v2
 * Respuesta: [{ batchId, count, createdAt }]
 * Lee directamente desde GCS: emails_v2/<batchId>/batch.json
 * - count considera cantidad de sets de contenido (trios) o imágenes del batch
 */
historyRouter.get("/", async (req, res) => {
  try {
    const type = String(req.query.type || "emails_v2").toLowerCase();
    if (type !== "emails_v2") {
      // hoy soportamos sólo emails_v2 (enfocado)
      return res.json([]);
    }

    const batchIds = await listEmailV2BatchIds();

    const rows = await Promise.all(
      batchIds.map(async (batchId) => {
        const batchKey = `emails_v2/${batchId}/batch.json`;
        let count = 0;
        let createdAtMs = 0;

        // intenta leer batch.json si existe
        const exists = await objectExists(batchKey);
        if (exists) {
          try {
            const batch = await readJson<any>(batchKey);
            const trios = Array.isArray(batch?.trios) ? batch.trios : [];
            const images = Array.isArray(batch?.images) ? batch.images : [];
            // "trios" en JSON = sets de contenido
            count = trios.length || images.length || 0;

            if (batch?.createdAt) {
              const t = Date.parse(String(batch.createdAt));
              createdAtMs = Number.isNaN(t) ? 0 : t;
            }
          } catch {
            // si falla el parse, queda en 0 y seguimos
          }
        }

        // si no hay createdAt, usamos metadata del objeto (última actualización)
        if (!createdAtMs) {
          createdAtMs = await getObjectUpdatedAtMs(batchKey);
        }

        return {
          batchId,
          count,
          createdAt: createdAtMs
            ? new Date(createdAtMs).toISOString()
            : undefined,
        };
      })
    );

    // ordenar por createdAt desc (si existe)
    rows.sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return tb - ta;
    });

    res.json(rows);
  } catch (e: any) {
    console.error("[history:list:GCS] error:", e);
    res.status(500).send(e?.message || "ErrorHistoryList");
  }
});
