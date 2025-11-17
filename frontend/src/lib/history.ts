// frontend/src/lib/history.ts
import { API_BASE } from "./api";

export type HistoryBatch = {
  batchId: string;
  count?: number;
  createdAt?: string;
};

/**
 * Lista de lotes guardados por tipo.
 * Depende del endpoint backend /api/history?type=...
 * Si no existe el endpoint o falla, devuelve [].
 *
 * Para Email 2.0:
 *   type = "emails_v2"
 */
export async function listHistory(
  type: "emails" | "emails_v2" | "blog" | "ads" | "social" | "meta" = "emails_v2"
): Promise<HistoryBatch[]> {
  try {
    const url = `${API_BASE}/api/history?type=${encodeURIComponent(
      type
    )}&t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];

    const data = await res.json();

    // Normaliza output: espera un array [{ batchId, count?, createdAt? }]
    if (Array.isArray(data)) {
      return data.filter((x) => typeof x?.batchId === "string");
    }
    if (Array.isArray((data as any)?.items)) {
      return (data as any).items.filter(
        (x: any) => typeof x?.batchId === "string"
      );
    }
    return [];
  } catch {
    return [];
  }
}

/** Tipo minimal para items (compatible con la UI legacy) */
export type EmailItem = {
  campaign?: string;
  cluster?: string;
  version?: number;
  subject?: string;
  preheader?: string;
  body?: string;
  cta?: string;
  heroUrl?: string;
};

/**
 * Carga un lote existente desde el backend (emails_v2).
 * Estrategia: usa /api/export/csv?batchId=... y parsea a EmailItem[]
 *
 * Para Email 2.0 no se usa en la UI nueva (ahora cargamos desde GCS),
 * pero lo mantenemos para compatibilidad con pantallas legacy que
 * todavía lean CSV.
 */
export async function getHistoryBatch<T extends EmailItem = EmailItem>(
  type: "emails" | "emails_v2",
  batchId: string
): Promise<{ items: T[]; batchId: string }> {
  // Normalizamos "emails" → "emails_v2"
  const effectiveType = type === "emails" ? "emails_v2" : type;

  if (effectiveType !== "emails_v2") {
    return { items: [] as T[], batchId };
  }

  const url = `${API_BASE}/api/export/csv?batchId=${encodeURIComponent(
    batchId
  )}&t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("No se pudo cargar el batch (CSV)");
  }

  const csv = await res.text();
  const items = parseCsvToItems(csv) as T[];
  return { items, batchId };
}

/* =========================
 * Utils CSV (simple/robusto)
 * ========================= */

/** Parser CSV simple con soporte de comillas dobles y BOM */
function parseCsvToItems(csv: string): EmailItem[] {
  const data = String(csv || "").replace(/^\uFEFF/, ""); // quita BOM si existe
  const lines = data
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = {
    campaign: findHeader(header, ["campaign"]),
    cluster: findHeader(header, ["cluster"]),
    version: findHeader(header, ["version"]),
    subject: findHeader(header, ["subject"]),
    preheader: findHeader(header, ["preheader", "pre-header"]),
    body: findHeader(header, ["body", "content"]),
    cta: findHeader(header, ["cta"]),
    heroUrl: findHeader(header, [
      "herourl",
      "hero_url",
      "image",
      "imageurl",
      "image_url",
    ]),
  };

  const out: EmailItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (!cols.length) continue;

    const get = (k: keyof typeof idx) =>
      idx[k] >= 0 && idx[k] < cols.length ? cols[idx[k]] : "";

    const versionNum = Number(get("version"));
    out.push({
      campaign: get("campaign"),
      cluster: get("cluster"),
      version: Number.isNaN(versionNum) ? undefined : versionNum,
      subject: get("subject"),
      preheader: get("preheader"),
      body: get("body"),
      cta: get("cta"),
      heroUrl: get("heroUrl"),
    });
  }
  return out;
}

/** splitCsvLine: separa respetando comillas dobles (") y dobles comillas escapadas ("") */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"'; // comilla escapada
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Busca el primer alias presente en el header; si ninguno existe, -1 */
function findHeader(header: string[], aliases: string[]): number {
  for (const a of aliases) {
    const idx = header.indexOf(a);
    if (idx >= 0) return idx;
  }
  return -1;
}
