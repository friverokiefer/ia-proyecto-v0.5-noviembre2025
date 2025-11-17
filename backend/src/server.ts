// backend/src/server.ts
import express from "express";
import cors from "cors";
import path from "path";

// Rutas principales Email 2.0
import {
  generateEmailsV2Router,
  emailsV2Router,
} from "./routes/generateEmailV2";
import { historyRouter } from "./routes/history";
import generatedRouter from "./routes/generated";
import { sfmcRouter } from "./routes/sfmc";

// Meta (catálogo campañas / clusters)
import { emailV2MetaRouter } from "./routes/emailV2Meta";
import { metaEmailV2Router } from "./routes/metaEmailV2";

const app = express();
app.set("trust proxy", true);

// ===== CORS con lista blanca =====
/**
 * Orígenes permitidos:
 * - Lee FRONTEND_ORIGINS (coma-separado)
 * - Defaults seguros para dev (Vite y Docker front)
 */
const defaultAllowed = [
  "http://localhost:5173", // Vite dev
  "http://localhost:8081", // Front en Docker local
];

const envAllowed = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultAllowed, ...envAllowed])];

app.use(
  cors({
    origin: (origin, cb) => {
      // Requests sin Origin (curl/healthchecks) se permiten
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: false,
  })
);

// ===== Body parsers (tamaños grandes por base64 de imágenes) =====
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// ===== Static /generated (fallback local en disco) =====
const GENERATED_DIR =
  (process.env.GENERATED_BASE_PATH &&
    path.resolve(process.env.GENERATED_BASE_PATH)) ||
  path.resolve(__dirname, "..", "public", "generated");
console.log("🖼  Local /generated fallback dir:", GENERATED_DIR);

// ====== Rutas API ======

// Meta Email 2.0 (consumida por el frontend)
// → GET /api/email-v2/meta
app.use("/api/email-v2", emailV2MetaRouter);

// Alias plural opcional (por si lo usa otra pieza o scripts internos)
// → GET /api/emails-v2/meta
app.use("/api/emails-v2/meta", metaEmailV2Router);

// Generación y edición de Email 2.0
// → POST /api/generate-emails-v2
app.use("/api/generate-emails-v2", generateEmailsV2Router);
// → PUT /api/emails-v2/:batchId
app.use("/api/emails-v2", emailsV2Router);

// Historial y SFMC
// → GET /api/history?type=emails_v2
app.use("/api/history", historyRouter);
// → POST /api/sfmc/draft-email
app.use("/api/sfmc", sfmcRouter);

// Rutas /api/generated y /generated (JSON + redirect a GCS)
app.use(generatedRouter);

// Static local (último, como fallback)
app.use(
  "/generated",
  express.static(GENERATED_DIR, {
    fallthrough: true,
    maxAge: "1h",
    etag: true,
  })
);

// ===== Health endpoints =====
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/readyz", (_req, res) => res.status(200).send("ready"));

// ===== Error handler (último) =====
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("🔥 Unhandled error:", err?.stack || err);
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    "🌐 Allowed CORS origins:",
    allowedOrigins.join(", ") || "(none)"
  );
});
