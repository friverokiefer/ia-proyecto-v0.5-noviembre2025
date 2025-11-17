// backend/test-gcp.ts
import "dotenv/config";
import fs from "fs";
import path from "path";
import { Storage } from "@google-cloud/storage";

function abs(p?: string) {
  if (!p) return "";
  if (p.startsWith("./") || p.startsWith("../")) return path.resolve(process.cwd(), p);
  return p;
}

async function main() {
  const projectId = process.env.GCP_PROJECT_ID;
  const bucketName = process.env.GCP_BUCKET_NAME;
  const keyRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const keyFile = abs(keyRaw);

  if (!projectId) throw new Error("Falta GCP_PROJECT_ID en backend/.env");
  if (!bucketName) throw new Error("Falta GCP_BUCKET_NAME en backend/.env");
  if (!keyFile) throw new Error("Falta GOOGLE_APPLICATION_CREDENTIALS en backend/.env");
  if (!fs.existsSync(keyFile)) {
    throw new Error(`No existe el archivo de credenciales en: ${keyFile}`);
  }

  console.log("🔐 Credenciales:", keyFile);
  console.log("📦 Proyecto:", projectId);
  console.log("🪣 Bucket:", bucketName);

  const storage = new Storage({ projectId, keyFilename: keyFile });

  // 1) Listar buckets
  console.log("\n🔍 Listando buckets…");
  const [buckets] = await storage.getBuckets();
  console.log("✅ Buckets:");
  for (const b of buckets) console.log("  -", b.name);

  // 2) Subir JSON de prueba
  const bucket = storage.bucket(bucketName);
  const objectPath = `${process.env.GCP_PREFIX || "dev"}/tests/connection-check-${Date.now()}.json`;
  await bucket.file(objectPath).save(
    Buffer.from(JSON.stringify({ ok: true, when: new Date().toISOString() }, null, 2)),
    { resumable: false, contentType: "application/json", validation: "crc32c", metadata: { cacheControl: "no-store" } }
  );
  console.log(`\n✅ Subido: gs://${bucketName}/${objectPath}`);
}

main().catch((err) => {
  console.error("❌ Error en prueba GCP:");
  console.error(err?.message || err);
  process.exit(1);
});
