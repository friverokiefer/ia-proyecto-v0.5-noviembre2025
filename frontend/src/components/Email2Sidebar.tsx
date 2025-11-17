// frontend/src/components/Email2Sidebar.tsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  generateEmailsV2,
  type GenerateV2Payload,
  type GenerateV2Response,
  getEmailV2Meta,
  type EmailV2Meta,
} from "@/lib/apiEmailV2";
import { listHistory, type HistoryBatch } from "@/lib/history";
import { loadFormState, saveFormState } from "@/lib/storage";
import { toast } from "sonner";
import { ConfirmGenerateModal } from "@/components/ui/ConfirmGenerateModal";

/* =========================
 * Tipos y estilos
 * ========================= */
export type Email2SidebarState = {
  campaign: string;
  cluster: string;
  feedbackSubject: string;
  feedbackPreheader: string;
  feedbackBody: string; // backend lo normaliza
  setCount: number; // 1..5 (Sets de Contenido)
  imageCount: number; // 1..5
};

const FORM_TYPE = "email_v2";
const input =
  "w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500";
const textarea = input + " resize-y leading-5";

/* =========================
 * Alias para compatibilidad
 * ========================= */

// Alias de campañas legacy → campañas canónicas del IA Engine
const CAMPAIGN_ALIASES: Record<string, string> = {
  // Nombres antiguos de campañas de consumo
  "Crédito de Consumo BICE": "Crédito de consumo - Persona",
  "Consolidación de deudas": "Refinanciar deuda",
  "Ordena tus deudas": "Refinanciar deuda",
  // Productos que ahora son subcasos
  "Tarjeta de crédito": "Apertura producto - Tarjeta de crédito",
  "Cuenta corriente PyME": "Apertura producto - Cuenta corriente",
  // Variantes de DAP / inversión
  "DAP (Depósito a Plazo)": "DAP (Depósito a plazo)",
  "DAP (Deposito a plazo)": "DAP (Depósito a plazo)",
  "Fondos mutuos / Inversión": "DAP (Depósito a plazo)",
  // Seguros específicos pasan a campaña genérica de seguros
  "Seguros de auto": "Seguros",
  "Seguros de vida": "Seguros",
};

// Alias de clusters legacy → clusters canónicos del IA Engine
const CLUSTER_ALIASES: Record<string, string> = {
  "Cluster Auto - Familiar": "Auto familiar",
  "Cluster Auto - Soltero": "Auto soltero",
  "Cluster cambio moto": "Cambio de moto",
  "Cluster mejora hogar": "Mejora del hogar",
  "Cluster propensos - Proyectos Familiares": "Proyectos familiares",
  "Cluster propensos - Proyectos Personales": "Proyectos personales",
  "Cluster reorganiza finanzas Joven": "Reorganizar finanzas joven",
  "Cluster reorganiza finanzas Senior": "Reorganizar finanzas senior",
  "Cluster viajeros - Familiar": "Viajes familiares",
  "Cluster viajeros - Soltero": "Viajes solteros",
};

function normalizeCampaignClient(
  name: string | null | undefined,
  catalog: string[]
): string {
  if (!name) return "";
  const trimmed = name.trim();
  const alias = CAMPAIGN_ALIASES[trimmed] ?? trimmed;
  if (catalog.length > 0 && !catalog.includes(alias)) {
    return "";
  }
  return alias;
}

function normalizeClusterClient(
  name: string | null | undefined,
  catalog: string[]
): string {
  if (!name) return "";
  const trimmed = name.trim();
  const alias = CLUSTER_ALIASES[trimmed] ?? trimmed;
  if (catalog.length > 0 && !catalog.includes(alias)) {
    return "";
  }
  return alias;
}

/* =========================
 * GCS helpers (solo lectura)
 * ========================= */
const VITE_GCS_BUCKET = (import.meta as any).env?.VITE_GCS_BUCKET || "";
const VITE_GCS_PREFIX = (import.meta as any).env?.VITE_GCS_PREFIX || "dev";

function gcsDirectObjectUrl(batchId: string, fileName: string, v?: string) {
  if (!VITE_GCS_BUCKET) return null;
  const safePrefix = String(VITE_GCS_PREFIX || "").replace(/^\/+|\/+$/g, "");
  const clean = String(fileName || "").replace(/^\/+/, "");
  const encoded = [safePrefix, "emails_v2", batchId, clean]
    .map(encodeURIComponent)
    .join("/");
  const qs = v ? `?v=${encodeURIComponent(v)}` : "";
  return `https://storage.googleapis.com/${VITE_GCS_BUCKET}/${encoded}${qs}`;
}
function gcsBatchJsonUrl(batchId: string) {
  return gcsDirectObjectUrl(batchId, "batch.json");
}
function gcsManifestUrl(batchId: string) {
  return gcsDirectObjectUrl(batchId, "_manifest.json");
}

/** Reconstruye heroUrl estables a partir de fileName o heroUrl relativos */
function normalizeImagesFromGCS(json: any, batchId: string) {
  if (!json || !VITE_GCS_BUCKET) return json;
  const src: any[] = Array.isArray(json.images) ? json.images : [];

  json.images = src.map((img: any) => {
    const fileName =
      String(img?.fileName || img?.url || "").replace(/^\/+/, "") ||
      (typeof img?.heroUrl === "string"
        ? img.heroUrl.match(/\/emails_v2\/[^/]+\/(.+?)(?:\?|$)/)?.[1] || ""
        : "");
    if (!fileName) return img;

    const url = gcsDirectObjectUrl(batchId, fileName, batchId);
    return { ...img, fileName, heroUrl: url || img?.heroUrl || "" };
  });

  return json;
}

/** Extrae batchId si el usuario pegó una URL completa de GCS o de batch.json */
function extractBatchId(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // patrón /emails_v2/<batchId>/
  const m1 = s.match(/\/emails_v2\/([^/]+)\//i);
  if (m1?.[1]) return decodeURIComponent(m1[1]);

  // patrón ...batch.json con /emails_v2/<batchId>/batch.json
  const m2 = s.match(/\/emails_v2\/([^/]+)\/batch\.json/i);
  if (m2?.[1]) return decodeURIComponent(m2[1]);

  // patrón simple tipo 2025-10-26_023504 (flexible)
  const m3 = s.match(/[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}/);
  if (m3?.[0]) return m3[0];

  // si viene sólo un ID ya válido (sin slashes)
  if (!s.includes("/") && s.length >= 8) return s;

  return null;
}

/* =========================
 * Utilidades UI y state
 * ========================= */
function autoGrow(e: React.FormEvent<HTMLTextAreaElement>) {
  const el = e.currentTarget;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
function readCount(value: string, min = 1, max = 5, fallback = 1) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function formatDuration(ms: number) {
  if (!ms || ms < 0) return "0s";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  if (m === 0) return `${ss}s`;
  return `${m}m ${ss.toString().padStart(2, "0")}s`;
}

/**
 * Normaliza estado leído desde storage:
 * - Clampa rangos de setCount / imageCount
 * (la normalización campaña/cluster se hace una vez que tengamos meta)
 */
function normalizeStateRaw(
  raw: Partial<Email2SidebarState>
): Partial<Email2SidebarState> {
  const patch: Partial<Email2SidebarState> = { ...raw };

  if (typeof patch.setCount === "number") {
    patch.setCount = Math.max(1, Math.min(5, patch.setCount));
  }
  if (typeof patch.imageCount === "number") {
    patch.imageCount = Math.max(1, Math.min(5, patch.imageCount));
  }

  return patch;
}

/* =========================
 * Sección colapsable simple
 * ========================= */
function Collapsible({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border bg-white">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 px-4 py-3"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.185l3.71-3.954a.75.75 0 111.08 1.04l-4.24 4.52a.75.75 0 01-1.08 0l-4.24-4.52a.75.75 0 01.02-1.06z" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>}
    </div>
  );
}

/* =========================
 * Componente principal
 * ========================= */
export function Email2Sidebar({
  onGenerated,
  currentBatchId,
}: {
  /** Callback cuando el backend termina de generar */
  onGenerated?: (resp: GenerateV2Response) => void;
  currentBatchId?: string;
}) {
  const [state, setState] = useState<Email2SidebarState>({
    campaign: "",
    cluster: "",
    feedbackSubject: "",
    feedbackPreheader: "",
    feedbackBody: "",
    setCount: 3,
    imageCount: 2,
  });

  // Meta del IA Engine (catálogo campañas / clusters)
  const [meta, setMeta] = useState<EmailV2Meta | null>(null);
  const [metaLoading, setMetaLoading] = useState<boolean>(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  // Historial + batch activo
  const [history, setHistory] = useState<HistoryBatch[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | undefined>(
    currentBatchId
  );

  // Buscador
  const [query, setQuery] = useState<string>("");

  // Progreso (cronómetro y estado)
  const [isGenerating, setIsGenerating] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const elapsedLabel = useMemo(() => formatDuration(elapsed), [elapsed]);

  // Modal de confirmación de generación
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Timers para retries del historial y cleanup
  const pendingTimers = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      // cleanup on unmount
      pendingTimers.current.forEach((id) => clearTimeout(id));
      pendingTimers.current = [];
    };
  }, []);

  /* ========= Cargar meta (campañas / clusters) ========= */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setMetaLoading(true);
        const data = await getEmailV2Meta();
        if (!cancelled) {
          setMeta(data);
          setMetaError(null);
        }
      } catch (e: any) {
        console.error("Error cargando meta EmailV2:", e);
        if (!cancelled) {
          setMetaError("No se pudo cargar el catálogo de campañas y clusters.");
          toast.error("No se pudo cargar el catálogo de campañas/clusters.");
        }
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ========= Helpers de historial ========= */
  const refreshHistory = useCallback(async (silent = true) => {
    try {
      const data = await listHistory("emails_v2");
      setHistory(data);
    } catch (e) {
      if (!silent) toast.error("No se pudo actualizar el historial.");
    }
  }, []);

  /** Inserta optimistamente el nuevo batch en el tope (evita recargar la página) */
  const optimisticInsertBatch = useCallback((resp: GenerateV2Response) => {
    setHistory((prev) => {
      if (prev.some((h) => h.batchId === resp.batchId)) return prev;
      const count =
        (Array.isArray(resp.images) ? resp.images.length : 0) ||
        (resp as any).count ||
        undefined;
      const fresh: HistoryBatch = { batchId: resp.batchId, count } as HistoryBatch;
      return [fresh, ...prev];
    });
  }, []);

  /** Reintenta traer el historial con pequeños retrasos hasta ver el batch nuevo */
  const catchUpHistoryFor = useCallback((targetBatchId: string) => {
    const delays = [700, 1500, 3500]; // milisegundos
    const timers: number[] = [];

    const run = async () => {
      try {
        const data = await listHistory("emails_v2");
        setHistory(data);
        // si ya está, cancelamos el resto
        if (data.some((h) => h.batchId === targetBatchId)) {
          timers.forEach((id) => clearTimeout(id));
        }
      } catch {
        /* ignore */
      }
    };

    delays.forEach((ms) => {
      const id = window.setTimeout(run, ms);
      timers.push(id);
      pendingTimers.current.push(id);
    });
  }, []);

  // Persistencia local: cargar
  useEffect(() => {
    try {
      const stored = loadFormState<Email2SidebarState>(FORM_TYPE);
      if (stored) {
        const normalized = normalizeStateRaw(stored);
        setState((prev) => ({ ...prev, ...normalized }));
      }
    } catch {
      // ignore
    }
  }, []);

  // Persistencia local: guardar (pequeño debounce)
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        saveFormState(FORM_TYPE, state);
      } catch {
        // ignore
      }
    }, 180);
    return () => clearTimeout(id);
  }, [state]);

  // Historial al montar
  useEffect(() => {
    refreshHistory(true);
  }, [refreshHistory]);

  // Cronómetro
  useEffect(() => {
    if (!isGenerating || !startedAt) return;
    const t = window.setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => clearInterval(t);
  }, [isGenerating, startedAt]);

  // Sync de batch activo desde el padre
  useEffect(() => {
    if (currentBatchId) {
      setActiveBatchId(currentBatchId);
    }
  }, [currentBatchId]);

  // Re-normalizar campaña/cluster cuando ya tenemos meta (catálogo oficial)
  useEffect(() => {
    if (!meta) return;
    const campaignsCatalog = meta.campaigns ?? [];
    const clustersCatalog = meta.clusters ?? [];

    setState((prev) => {
      const normalizedCampaign = normalizeCampaignClient(
        prev.campaign,
        campaignsCatalog
      );
      let normalizedCluster = normalizeClusterClient(
        prev.cluster,
        clustersCatalog
      );

      if (normalizedCampaign && normalizedCluster) {
        const allowed = meta.campaignClusters?.[normalizedCampaign] ?? [];
        if (!allowed.includes(normalizedCluster)) {
          normalizedCluster = "";
        }
      }

      if (
        normalizedCampaign === prev.campaign &&
        normalizedCluster === prev.cluster
      ) {
        return prev;
      }

      return {
        ...prev,
        campaign: normalizedCampaign,
        cluster: normalizedCluster,
      };
    });
  }, [meta]);

  // Si cambia la campaña y el cluster ya no aplica, lo limpiamos
  useEffect(() => {
    if (!meta) return;
    setState((s) => {
      if (!s.campaign || !s.cluster) return s;
      const allowed = meta.campaignClusters?.[s.campaign] ?? [];
      if (!allowed.includes(s.cluster)) {
        return { ...s, cluster: "" };
      }
      return s;
    });
  }, [state.campaign, meta]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter((h) => h.batchId.toLowerCase().includes(q));
  }, [history, query]);

  const availableCampaigns: string[] = useMemo(
    () => meta?.campaigns ?? [],
    [meta]
  );

  const availableClusters: string[] = useMemo(() => {
    if (!state.campaign || !meta) return [];
    return meta.campaignClusters?.[state.campaign] ?? [];
  }, [state.campaign, meta]);

  /* ========= Confirmación antes de generar ========= */
  function handleGenerate() {
    if (!meta) {
      toast.error(
        "Aún no se cargan las campañas y clusters. Intenta recargar la página."
      );
      return;
    }

    if (!state.campaign || !state.cluster) {
      toast.warning("Selecciona campaña y cluster antes de generar.");
      return;
    }
    if (isGenerating) return; // evita doble clic
    // Validaciones suaves de rangos
    const setsOk = state.setCount >= 1 && state.setCount <= 5;
    const imgOk = state.imageCount >= 1 && state.imageCount <= 5;
    if (!setsOk || !imgOk) {
      toast.warning("Revisa los rangos: Sets 1–5 e Imágenes 1–5.");
      return;
    }
    setConfirmOpen(true);
  }

  async function doGenerateAfterConfirm() {
    // Cierra el modal y ejecuta la generación real
    setConfirmOpen(false);

    setIsGenerating(true);
    const started = Date.now();
    setStartedAt(started);
    setElapsed(0);

    try {
      const payload: GenerateV2Payload = {
        campaign: state.campaign,
        cluster: state.cluster,
        sets: state.setCount,
        images: state.imageCount,
        feedback: {
          subject: state.feedbackSubject || undefined,
          preheader: state.feedbackPreheader || undefined,
          body: state.feedbackBody || undefined,
        } as any,
      };
      const resp = await generateEmailsV2(payload);

      // Activar lote y notificar arriba
      setActiveBatchId(resp.batchId);
      onGenerated?.(resp);

      // 👉 Hace visible el nuevo batch inmediatamente
      optimisticInsertBatch(resp);
      // y luego sincroniza con el backend por si tarda en listar
      catchUpHistoryFor(resp.batchId);

      toast.success(
        `Lote ${resp.batchId} generado en ${formatDuration(Date.now() - started)}`
      );
    } catch (e: any) {
      toast.error(e?.message || "Error al generar Email");
    } finally {
      setIsGenerating(false);
      setElapsed((prev) => (prev === 0 ? Date.now() - started : prev));
    }
  }

  /** Intenta hidratar imágenes desde _manifest.json cuando batch.json no las trae */
  async function hydrateFromManifest(batchId: string, baseJson: any) {
    try {
      const mUrl = `${gcsManifestUrl(batchId)}?t=${Date.now()}`;
      const res = await fetch(mUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = await res.json();
      const imgs = Array.isArray(manifest?.images) ? manifest.images : [];
      if (imgs.length === 0) return baseJson;

      const images = imgs.map((m: any) => {
        const fileName = String(m?.fileName || "").replace(/^\/+/, "");
        const heroUrl = gcsDirectObjectUrl(batchId, fileName, batchId) || "";
        return {
          fileName,
          heroUrl,
          meta: {
            size: m?.sizeDeclared,
            sizeNormalized: m?.sizeNormalized,
          },
        };
      });

      return { ...baseJson, images };
    } catch {
      return baseJson;
    }
  }

  /** Cargar lote directamente desde GCS (público) */
  async function handleLoadHistory(rawInput: string) {
    if (!rawInput) return;
    if (!VITE_GCS_BUCKET) {
      toast.error("Falta VITE_GCS_BUCKET en el frontend (.env).");
      return;
    }

    const parsedId = extractBatchId(rawInput) || rawInput.trim();
    if (!parsedId) {
      toast.error("No se pudo identificar el batchId.");
      return;
    }

    const url = `${gcsBatchJsonUrl(parsedId)}?t=${Date.now()}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let json = await res.json();

      json = normalizeImagesFromGCS(json, parsedId);

      // Si las imágenes vienen vacías, intentamos hidratar desde el manifest
      if (!Array.isArray(json.images) || json.images.length === 0) {
        json = await hydrateFromManifest(parsedId, json);
      }

      const setsFromJson =
        Array.isArray(json.sets) && json.sets.length
          ? json.sets
          : Array.isArray(json.trios)
          ? json.trios
          : [];

      const resp: GenerateV2Response = {
        batchId: json.batchId || parsedId,
        createdAt: json.createdAt,
        sets: setsFromJson,
        images: json.images || [],
      };
      setActiveBatchId(resp.batchId);
      onGenerated?.(resp);
      toast.success(`Lote ${resp.batchId} cargado desde GCS`);

      // Refrescamos historial (ej. si el conteo cambió)
      refreshHistory(true);
    } catch (err: any) {
      toast.error(`No se pudo leer el lote desde GCS: ${err?.message || "Error"}`);
      console.error("Load from GCS failed:", err);
    }
  }

  const disabled = isGenerating || metaLoading;

  const batchJsonUrl = useMemo(() => {
    if (!activeBatchId) return null;
    return gcsBatchJsonUrl(activeBatchId || "");
  }, [activeBatchId]);

  return (
    <div className="space-y-4">
      {/* Título + estado */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">
          Email – Parámetros
        </h3>

        {/* Estado de generación / resultado */}
        <div className="flex items-center gap-2">
          {isGenerating ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700 border border-sky-200">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Generando… {elapsedLabel}
            </span>
          ) : activeBatchId ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200">
              ✅ Listo{elapsed ? ` · ${formatDuration(elapsed)}` : ""}
            </span>
          ) : metaLoading ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600 border border-slate-200">
              Cargando catálogo…
            </span>
          ) : metaError ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700 border border-rose-200">
              ⚠️ Error de catálogo
            </span>
          ) : null}
        </div>
      </div>

      {/* Batch info breve */}
      {activeBatchId && (
        <div className="text-[11px] text-neutral-600">
          Lote activo: <span className="font-mono">{activeBatchId}</span>
          {batchJsonUrl ? (
            <>
              {" · "}
              <a
                className="underline"
                href={batchJsonUrl}
                target="_blank"
                rel="noreferrer"
              >
                batch.json
              </a>
            </>
          ) : null}
        </div>
      )}

      {/* ====== Secciones ====== */}
      <Collapsible title="📘 Parámetros base" defaultOpen>
        {metaError && (
          <p className="mb-2 text-[11px] text-rose-600">
            No se pudo cargar el catálogo de campañas/clusters. Revisa backend / IA
            Engine.
          </p>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium">Campaña *</label>
          <select
            className={input}
            disabled={disabled || !availableCampaigns.length}
            value={state.campaign}
            onChange={(e) =>
              setState((s) => ({ ...s, campaign: e.target.value, cluster: "" }))
            }
          >
            <option value="" disabled>
              {availableCampaigns.length
                ? "Selecciona…"
                : metaLoading
                ? "Cargando campañas…"
                : "Sin campañas disponibles"}
            </option>
            {availableCampaigns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium">Cluster *</label>
          <select
            className={input}
            disabled={disabled || !state.campaign || !availableClusters.length}
            value={state.cluster}
            onChange={(e) =>
              setState((s) => ({ ...s, cluster: e.target.value }))
            }
          >
            <option value="" disabled>
              {state.campaign
                ? availableClusters.length
                  ? "Selecciona…"
                  : "Sin clusters configurados para esta campaña"
                : "Elige una campaña primero"}
            </option>
            {availableClusters.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-neutral-500">
            La combinación de campaña y cluster define el tono y el enfoque del
            contenido generado desde el IA Engine.
          </p>
        </div>
      </Collapsible>

      <Collapsible title="🧠 Instrucciones para la IA" defaultOpen>
        <div>
          <label className="mb-1 block text-[11px] font-medium">
            Feedback para el Asunto
          </label>
          <textarea
            className={textarea}
            rows={2}
            disabled={disabled}
            placeholder="Ej: Haz el asunto más directo y enfocado en el ahorro."
            value={state.feedbackSubject}
            onChange={(e) =>
              setState((s) => ({ ...s, feedbackSubject: e.target.value }))
            }
            onInput={autoGrow}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium">
            Feedback para el Pre-header
          </label>
          <textarea
            className={textarea}
            rows={2}
            disabled={disabled}
            placeholder="Ej: Que complemente el asunto destacando el beneficio principal."
            value={state.feedbackPreheader}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                feedbackPreheader: e.target.value,
              }))
            }
            onInput={autoGrow}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium">
            Feedback para el Body
          </label>
          <textarea
            className={textarea}
            rows={4}
            disabled={disabled}
            placeholder="Ej: Incluye una mención sobre cuotas flexibles y proceso 100% online."
            value={state.feedbackBody}
            onChange={(e) =>
              setState((s) => ({ ...s, feedbackBody: e.target.value }))
            }
            onInput={autoGrow}
          />
        </div>
      </Collapsible>

      <Collapsible title="⚙️ Configuración" defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium">
              Sets de Contenido
            </label>
            <input
              type="number"
              min={1}
              max={5}
              inputMode="numeric"
              className={input}
              value={state.setCount}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  setCount: readCount(e.target.value, 1, 5, s.setCount),
                }))
              }
            />
            <p className="mt-1 text-[11px] text-neutral-500">
              Generaremos {state.setCount} set(s) de Subject + Preheader +
              Cuerpo.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Imágenes</label>
            <input
              type="number"
              min={1}
              max={5}
              inputMode="numeric"
              className={input}
              value={state.imageCount}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  imageCount: readCount(e.target.value, 1, 5, s.imageCount),
                }))
              }
            />
            <p className="mt-1 text-[11px] text-neutral-500">
              Puedes pedir de 1 a 5 imágenes.
            </p>
          </div>
        </div>
      </Collapsible>

      <Collapsible title="🕓 Historial de lotes" defaultOpen>
        {/* buscador */}
        <div className="relative">
          <input
            className={`${input} pl-9 pr-24`}
            placeholder="Buscar o pegar batchId o URL de batch.json…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const pastedId = extractBatchId(query || "");
                const first = filtered[0]?.batchId || pastedId || query.trim();
                if (first) handleLoadHistory(first);
              }
            }}
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4a6 6 0 014.8 9.6l4.3 4.3-1.4 1.4-4.3-4.3A6 6 0 1110 4m0 2a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          </span>
          {query && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => handleLoadHistory(query)}
                title="Cargar por ID/URL"
              >
                Cargar
              </button>
              <button
                type="button"
                className="rounded-lg border px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setQuery("")}
                title="Limpiar búsqueda"
              >
                Limpiar
              </button>
            </div>
          )}
        </div>

        {/* lista scrollable */}
        <div className="max-h-[320px] overflow-auto rounded-xl border">
          <ul className="divide-y">
            {filtered.length === 0 ? (
              <li className="p-4 text-sm text-neutral-500">Sin resultados.</li>
            ) : (
              filtered.map((h) => (
                <li
                  key={h.batchId}
                  className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[13px] text-slate-900">
                      {h.batchId}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      items: {h.count ?? "—"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLoadHistory(h.batchId)}
                    className="shrink-0 rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
                    title={`Cargar ${h.batchId}`}
                  >
                    Cargar
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </Collapsible>

      {/* ====== Footer sticky: Acción principal ====== */}
      <div
        className="
          sticky bottom-0 -mx-4 sm:-mx-0 px-4 sm:px-0 py-4
          bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70
          border-t rounded-b-2xl
        "
      >
        <button
          onClick={handleGenerate}
          disabled={isGenerating || metaLoading}
          className={`w-full rounded-2xl px-6 py-4 text-base md:text-lg font-semibold text-white shadow-sm transición
            ${
              isGenerating || metaLoading
                ? "bg-sky-400 cursor-wait"
                : "bg-sky-600 hover:bg-sky-700 active:scale-[0.99]"
            }`}
        >
          {isGenerating
            ? "Generando…"
            : metaLoading
            ? "Cargando catálogo…"
            : "Generar"}
        </button>

        {isGenerating && (
          <div className="mt-3 w-full h-1.5 overflow-hidden rounded bg-neutral-200">
            <div className="h-full w-1/3 animate-[loading_1.4s_ease-in-out_infinite] rounded bg-sky-500" />
          </div>
        )}
      </div>

      {/* Modal de confirmación de generación */}
      <ConfirmGenerateModal
        open={confirmOpen}
        busy={isGenerating}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doGenerateAfterConfirm}
        summary={{
          campaign: state.campaign,
          cluster: state.cluster,
          sets: state.setCount,
          images: state.imageCount,
        }}
      />

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-120%); }
          50% { transform: translateX(40%); }
          100% { transform: translateX(120%); }
        }
      `}</style>
    </div>
  );
}
