import React, { useEffect, useMemo, useState } from "react";
import { NumberStepper } from "./NumberStepper";
import { uploadToGCP } from "@/lib/api";
import { listHistory, getHistoryBatch, type HistoryBatch, type EmailItem } from "@/lib/history";

export type SidebarState = {
  campaign: string;
  cluster: string;
  feedbackSubject: string;
  feedbackPre: string;
  feedbackBody: string;
  versions: number;
};

const EMAIL_STORAGE_KEY = "form:email";

export function Sidebar({
  state,
  setState,
  onGenerate,
  onDownloadCsv,
  canDownload,
  onLoadBatch,
  currentBatchId,
}: {
  state: SidebarState;
  setState: (patch: Partial<SidebarState>) => void;
  onGenerate: () => void;
  onDownloadCsv: () => void;
  canDownload: boolean;
  onLoadBatch?: (items: EmailItem[], batchId: string) => void;
  currentBatchId?: string;
}) {
  const [history, setHistory] = useState<HistoryBatch[]>([]);
  const [historyId, setHistoryId] = useState<string>("");
  const [loadedBatchId, setLoadedBatchId] = useState<string | undefined>(undefined);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadOk, setUploadOk] = useState<Awaited<ReturnType<typeof uploadToGCP>> | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ===== Persistencia: cargar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EMAIL_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const patch: Partial<SidebarState> = {};
      ["campaign", "cluster", "feedbackSubject", "feedbackPre", "feedbackBody", "versions"].forEach(
        (k) => {
          if (k in saved) (patch as any)[k] = saved[k];
        }
      );
      if (Object.keys(patch).length) setState(patch);
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Persistencia: guardar
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(EMAIL_STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* noop */
      }
    }, 200);
    return () => clearTimeout(id);
  }, [state]);

  // ===== Historial
  useEffect(() => {
    listHistory("emails_v2")
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  // Sync batch activo
  useEffect(() => {
    if (currentBatchId) {
      setLoadedBatchId(currentBatchId);
      setUploadOk(null);
      setUploadError(null);
    }
  }, [currentBatchId]);

  async function handleLoadHistory() {
    if (!historyId || !onLoadBatch) return;
    try {
      const { items, batchId } = await getHistoryBatch<EmailItem>("emails_v2", historyId);
      onLoadBatch(items, batchId);
      setLoadedBatchId(batchId);
      setUploadOk(null);
      setUploadError(null);
    } catch {
      /* noop */
    }
  }

  const effectiveBatchId = useMemo(
    () => loadedBatchId || currentBatchId || "",
    [loadedBatchId, currentBatchId]
  );

  const bestLink = (obj?: { consoleUrl?: string; url?: string } | null) =>
    obj?.consoleUrl || obj?.url || "";

  async function handleUploadToGCP() {
    if (!effectiveBatchId || isUploading) return;
    setIsUploading(true);
    setUploadOk(null);
    setUploadError(null);
    try {
      const resp = await uploadToGCP(effectiveBatchId, "emails_v2");
      setUploadOk(resp);
    } catch (e: any) {
      setUploadError(e?.message || "Error al subir lote a GCP");
    } finally {
      setIsUploading(false);
    }
  }

  const campaigns = [
    "Seguros de vida",
    "Crédito de consumo",
    "Crédito hipotecario",
    "Tarjeta de crédito",
    "Seguros de auto",
    "Cuenta corriente PyME",
    "Fondos mutuos / Inversión",
    "Consolidación de deudas",
  ];

  const clusters = [
    "Padres con hijos",
    "Preaprobados (alto score)",
    "Jóvenes (primer auto / primera tarjeta)",
    "Emprendedores PyME",
    "Clientes con deuda alta",
    "Usuarios con sueldo pagado en el banco",
    "Tech-savvy (100% digital)",
    "Región Metropolitana",
    "Regiones",
    "Visitantes de simulador / carrito abandonado",
    "Ex clientes (winback)",
    "Renta alta (segmento premium)",
  ];

  const input =
    "w-full rounded-lg border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-blue-500";

  // Derivados para feedback de subida
  const uploadedJsonLink = bestLink(uploadOk?.uploaded?.json);
  const uploadedManifestLink = bestLink(uploadOk?.uploaded?.manifest || null);
  const filesCount =
    uploadOk?.fileCount?.nonJson ??
    uploadOk?.uploaded?.files?.length ??
    0;
  const totalCount =
    uploadOk?.fileCount?.total ?? (filesCount ? filesCount + 1 + (uploadOk?.uploaded?.manifest ? 1 : 0) : undefined);
  const objectRoot = uploadOk?.objectRoot;

  return (
    <div className="rounded-2xl border bg-white p-4 md:p-5 shadow-sm space-y-4">
      <h3 className="text-base font-semibold">Email – Parámetros</h3>

      {/* ====== CAMPOS ====== */}
      <div>
        <label className="mb-1 block text-xs font-medium">Campaña *</label>
        <select
          className={input}
          value={state.campaign}
          onChange={(e) => setState({ campaign: e.target.value })}
        >
          <option value="" disabled>Selecciona…</option>
          {campaigns.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Cluster *</label>
        <select
          className={input}
          value={state.cluster}
          onChange={(e) => setState({ cluster: e.target.value })}
        >
          <option value="" disabled>Selecciona…</option>
          {clusters.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Feedback Asunto</label>
        <input
          className={input}
          placeholder="Ej: Haz el asunto más directo y enfocado"
          value={state.feedbackSubject}
          onChange={(e) => setState({ feedbackSubject: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Feedback Pre-header</label>
        <input
          className={input}
          placeholder="Ej: Que complemente el beneficio principal"
          value={state.feedbackPre}
          onChange={(e) => setState({ feedbackPre: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Feedback Body</label>
        <textarea
          className={input}
          rows={3}
          placeholder="Ej: Texto más breve y atacar objeciones"
          value={state.feedbackBody}
          onChange={(e) => setState({ feedbackBody: e.target.value })}
        />
      </div>

      <div className="min-w-[220px] shrink-0">
        <label className="mb-1 block text-xs font-medium">Versiones</label>
        {/* El contenedor evita que el stepper se achique y tape números */}
        <NumberStepper
          min={1}
          max={5}
          value={state.versions}
          onChange={(n) => setState({ versions: n })}
        />
      </div>

      {/* ====== BOTONES ====== */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onGenerate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Generar
        </button>

        <button
          onClick={onDownloadCsv}
          disabled={!canDownload}
          className="rounded-lg border px-4 py-2 text-sm text-gray-700 disabled:opacity-50"
        >
          Descargar CSV
        </button>
      </div>

      {/* ====== Enviar a GCP ====== */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleUploadToGCP}
          disabled={!effectiveBatchId || isUploading}
          aria-label="Enviar lote a Google Cloud Storage"
          className={`w-full text-center font-medium rounded-lg px-4 py-2 text-sm transition-all duration-200
            ${
              isUploading
                ? "bg-green-500 text-white cursor-wait animate-pulse"
                : effectiveBatchId
                ? "bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          title={
            !effectiveBatchId
              ? "Carga un lote desde Historial o genera uno nuevo para habilitar"
              : "Enviar lote (batch.json + imágenes) a GCP"
          }
        >
          {isUploading ? "Enviando a GCP…" : "Enviar a GCP"}
        </button>

        {effectiveBatchId && (
          <div className="mt-1 text-[11px] text-neutral-500">
            Lote activo: <span className="font-mono">{effectiveBatchId}</span>
          </div>
        )}
      </div>

      {/* Feedback de subida */}
      {(uploadOk || uploadError) && (
        <div className="text-xs rounded-lg border mt-2 p-2 space-y-1">
          {uploadOk ? (
            <>
              <div className="text-green-700 font-medium">✅ Lote enviado correctamente</div>
              {objectRoot && (
                <div className="text-neutral-600">
                  Ruta en bucket: <span className="font-mono">{objectRoot}</span>
                </div>
              )}

              <div className="text-neutral-700">
                • <span className="font-medium">batch.json:</span>{" "}
                {uploadedJsonLink ? (
                  <a className="underline" href={uploadedJsonLink} target="_blank" rel="noreferrer">abrir</a>
                ) : (
                  <span className="opacity-70">—</span>
                )}
              </div>

              <div className="text-neutral-700">
                • <span className="font-medium">_manifest.json:</span>{" "}
                {uploadOk?.uploaded?.manifest ? (
                  <a className="underline" href={uploadedManifestLink} target="_blank" rel="noreferrer">abrir</a>
                ) : (
                  <span className="opacity-70">no generado</span>
                )}
              </div>

              <div className="text-neutral-700">
                • <span className="font-medium">Archivos subidos:</span>{" "}
                {typeof totalCount === "number" ? totalCount : filesCount + 1}
                {uploadOk?.uploaded?.manifest ? " (incluye manifest)" : ""}
              </div>
            </>
          ) : (
            <div className="text-red-700">❌ {uploadError}</div>
          )}
        </div>
      )}

      {/* ====== HISTORIAL ====== */}
      <div className="border-t pt-3">
        <label className="mb-1 block text-xs font-medium">Historial de lotes</label>
        <div className="flex gap-2">
          <select
            className={input}
            value={historyId}
            onChange={(e) => {
              setHistoryId(e.target.value);
              setUploadOk(null);
              setUploadError(null);
            }}
          >
            <option value="">Selecciona un batch…</option>
            {history.map((h) => (
              <option key={h.batchId} value={h.batchId}>
                {h.batchId} {h.count ? `(${h.count})` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleLoadHistory}
            disabled={!historyId}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
            title="Cargar lote seleccionado"
          >
            Cargar
          </button>
        </div>
      </div>
    </div>
  );
}
