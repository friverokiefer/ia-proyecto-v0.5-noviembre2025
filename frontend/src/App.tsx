// src/App.tsx
import React, { useEffect, useRef, useState } from "react";
import "./styles/index.css";

import {
  Email2Workspace,
  type PreviewData,
  type EmailContentSet,
} from "@/components/Email2Workspace";
import { Email2Sidebar } from "@/components/Email2Sidebar";
import { EmailPreview } from "@/components/EmailPreview";

import type { EmailV2Image } from "@/lib/apiEmailV2";
import { toast } from "sonner";

import { API_BASE as API_V2_BASE } from "@/lib/api";
import {
  postSfmcDraftEmail,
  type SfmcDraftEmailPayload,
} from "@/lib/apiEmailV2";

import { ConfirmSendModal } from "@/components/ui/ConfirmSendModal";

/* ========= ENV + helpers GCS ========= */
const VITE_GCS_BUCKET = (import.meta as any).env?.VITE_GCS_BUCKET || "";
const VITE_GCS_PREFIX = (import.meta as any).env?.VITE_GCS_PREFIX || "dev";
const VITE_SFMC_CATEGORY_ID = Number(
  (import.meta as any).env?.VITE_SFMC_CATEGORY_ID || NaN
);

function pathJoinAndEncode(...parts: (string | undefined | null)[]) {
  const segs: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    const trimmed = String(p).replace(/^\/+|\/+$/g, "");
    if (!trimmed) continue;
    for (const s of trimmed.split("/")) {
      if (!s) continue;
      segs.push(encodeURIComponent(s));
    }
  }
  return segs.join("/");
}

function gcsDirectObjectUrl(batchId: string, fileName: string) {
  if (!VITE_GCS_BUCKET) return null;
  const path = pathJoinAndEncode(VITE_GCS_PREFIX, "emails_v2", batchId, fileName);
  return `https://storage.googleapis.com/${VITE_GCS_BUCKET}/${path}`;
}

/** intenta mapear la heroUrl del preview a un item de `images` para obtener fileName/meta */
function resolveSelectedImage(
  live: PreviewData | null,
  images: EmailV2Image[]
): { fileName: string | null; heroUrl: string; meta?: EmailV2Image["meta"] } {
  if (!live || !live.heroUrl) {
    return { fileName: null, heroUrl: live?.heroUrl || "" };
  }

  let found = images.find(
    (im) => im.heroUrl && im.heroUrl === live.heroUrl
  );
  if (found) {
    return {
      fileName: found.fileName || null,
      heroUrl: live.heroUrl,
      meta: found.meta,
    };
  }

  found = images.find((im) => {
    const fname = im.fileName ? encodeURIComponent(im.fileName) : "";
    return (
      fname &&
      (live.heroUrl.includes(`/${fname}`) || live.heroUrl.endsWith(fname))
    );
  });

  if (found) {
    return {
      fileName: found.fileName || null,
      heroUrl: live.heroUrl,
      meta: found.meta,
    };
  }

  return { fileName: null, heroUrl: live.heroUrl };
}

/** intenta encontrar el set actualmente mostrado en el preview dentro de las ediciones (o base) */
function resolveSelectedSet(
  live: PreviewData | null,
  edited: EmailContentSet[] | null,
  base: EmailContentSet[]
): { index: number | null; set: EmailContentSet | null } {
  const source = edited && edited.length ? edited : base;
  if (!live || source.length === 0) {
    return { index: null, set: null };
  }

  const i = source.findIndex(
    (t) =>
      (t.subject || "") === live.subject &&
      (t.preheader || "") === live.preheader &&
      (t.body?.content || "") === live.content
  );

  if (i >= 0) {
    return { index: i, set: source[i] };
  }
  return { index: null, set: null };
}

/** Detección de extensión a partir de nombre/url */
function detectImageExtensionFrom(
  src: string,
  fallback: "png" | "jpg" | "jpeg" | "gif" = "png"
) {
  const s = (src || "").toLowerCase();
  if (/\.(png)(\?|#|$)/.test(s)) return "png";
  if (/\.(jpe?g)(\?|#|$)/.test(s)) return s.includes(".jpeg") ? "jpeg" : "jpg";
  if (/\.(gif)(\?|#|$)/.test(s)) return "gif";
  return fallback;
}

/** Escapar HTML (sin replaceAll) */
function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Plantilla mínima con {{IMAGE_URL}} para SFMC */
function buildSfmcHtmlTemplate(preview: PreviewData): string {
  const safeTitle = (preview.title || "").trim();
  const safeSubtitle = (preview.subtitle || "").trim();
  const safeBody = (preview.content || "")
    .trim()
    .replace(/\n/g, "<br/>");

  return [
    "<!DOCTYPE html>",
    "<html><body style='font-family:Arial, sans-serif; line-height:1.35;'>",
    `<h1 style='font-size:22px; margin:0 0 8px;'>${escapeHtml(
      safeTitle
    )}</h1>`,
    safeSubtitle
      ? `<p style='margin:0 0 12px; color:#555;'>${escapeHtml(
          safeSubtitle
        )}</p>`
      : "",
    `<img src='{{IMAGE_URL}}' alt='Hero' width='600' style='max-width:100%; border-radius:8px; display:block; margin:8px 0 16px;'/>`,
    `<div style='font-size:14px;'>${safeBody}</div>`,
    "</body></html>",
  ].join("");
}

export default function App() {
  const [batchId, setBatchId] = useState<string>("");
  const [contentSets, setContentSets] = useState<EmailContentSet[]>([]);
  const [images, setImages] = useState<EmailV2Image[]>([]);
  const [livePreview, setLivePreview] = useState<PreviewData | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [savedVisible, setSavedVisible] = useState(false);
  const [sfmcNotice, setSfmcNotice] = useState<string | null>(null);

  // Modal de confirmación SFMC
  const [confirmOpen, setConfirmOpen] = useState(false);

  // timers para animación de feedback
  const hideSavedRef = useRef<number | undefined>(undefined);
  const clearSavedRef = useRef<number | undefined>(undefined);

  // Recibimos ediciones sin forzar re-render
  const editedRef = useRef<EmailContentSet[] | null>(null);

  // ⚠️ Usamos `any` aquí porque el tipo GenerateV2Response está desfasado del backend
  function handleGenerated(resp: any) {
    const sets: EmailContentSet[] = resp?.sets || resp?.trios || [];
    const imgs: EmailV2Image[] = resp?.images || [];

    setBatchId(resp.batchId || "");
    setContentSets(sets);
    setImages(imgs);
    setLivePreview(null);
    setLastSavedAt(null);
    setSavedVisible(false);
    setSfmcNotice(null);
    editedRef.current = null;
  }

  function handleEditedChange(next: EmailContentSet[]) {
    editedRef.current = next;
  }

  async function handleSaveEdits() {
    if (!batchId) return;
    setIsSaving(true);
    try {
      const effectiveSets =
        editedRef.current && editedRef.current.length
          ? editedRef.current
          : contentSets;

      const payload = {
        // el backend ahora espera `sets` (ya no `trios`)
        sets: effectiveSets,
      };

      const res = await fetch(
        `${API_V2_BASE}/api/emails-v2/${encodeURIComponent(batchId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Error guardando Email 2.0");
      }
      const now = new Date().toLocaleTimeString();
      setLastSavedAt(now);

      if (hideSavedRef.current) window.clearTimeout(hideSavedRef.current);
      if (clearSavedRef.current) window.clearTimeout(clearSavedRef.current);
      setSavedVisible(true);
      hideSavedRef.current = window.setTimeout(
        () => setSavedVisible(false),
        2800
      );
      clearSavedRef.current = window.setTimeout(
        () => setLastSavedAt(null),
        3600
      );

      if (editedRef.current) setContentSets(editedRef.current);
      toast.success("Ediciones guardadas correctamente.");
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  /** Abre modal de confirmación SFMC */
  function handleUploadClick() {
    if (!batchId || !livePreview) {
      toast.warning(
        "Selecciona un set de contenido y una imagen para enviar a SFMC."
      );
      return;
    }
    setConfirmOpen(true);
  }

  /** Confirmado en modal: ENVÍO REAL a SFMC */
  async function handleConfirmSend() {
    if (!batchId || !livePreview) return;

    // 1) Guardar ediciones antes de enviar
    await handleSaveEdits();

    setIsUploading(true);
    try {
      // Resolver selección
      const { index: setIndex, set } = resolveSelectedSet(
        livePreview,
        editedRef.current,
        contentSets
      );
      const imgInfo = resolveSelectedImage(livePreview, images);

      // categoryId desde env o valor por defecto
      const categoryId =
        Number.isFinite(VITE_SFMC_CATEGORY_ID) && VITE_SFMC_CATEGORY_ID > 0
          ? VITE_SFMC_CATEGORY_ID
          : 339292; // ajustable

      // gcsUrl preferida si tenemos fileName
      const gcsUrl =
        imgInfo.fileName && batchId
          ? gcsDirectObjectUrl(batchId, imgInfo.fileName) ?? undefined
          : undefined;

      // extensión (para crear el asset correcto)
      const ext = detectImageExtensionFrom(
        imgInfo.fileName || imgInfo.heroUrl || "",
        "png"
      );

      // nombre del email (personaliza si quieres)
      const emailName = `email_${batchId}_${Date.now()}`;

      // html con placeholder {{IMAGE_URL}}
      const htmlTemplate = buildSfmcHtmlTemplate(livePreview);

      const payload: SfmcDraftEmailPayload = {
        categoryId,
        image: {
          name: imgInfo.fileName || "hero",
          extension: ext,
          gcsUrl: gcsUrl || livePreview.heroUrl, // si no hay gcsUrl, usamos heroUrl absoluta
        },
        email: {
          name: emailName,
          subject: livePreview.subject,
          preheader: livePreview.preheader,
          htmlTemplate,
        },
        batch: {
          id: batchId,
          meta: {
            setIndex,
            setId: set?.id ?? null,
          },
        },
        dryRun: false,
      };

      const res = await postSfmcDraftEmail(payload);
      if (!res.ok) throw new Error(res.error || "Falla en envío SFMC");

      setSfmcNotice(
        [
          "✅ Enviado a SFMC.",
          res.result?.step?.uploadImage?.publishedURL
            ? `Imagen publicada: ${res.result.step.uploadImage.publishedURL}`
            : "",
          res.result?.step?.createEmailDraft?.id
            ? `Email ID: ${res.result.step.createEmailDraft.id}`
            : "",
          res.result?.step?.createEmailDraft?.customerKey
            ? `CustomerKey: ${res.result.step.createEmailDraft.customerKey}`
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      );

      toast.success("Borrador de email creado en SFMC.");
      setConfirmOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Error enviando a SFMC.");
    } finally {
      setIsUploading(false);
    }
  }

  // Limpieza de timers al desmontar
  useEffect(() => {
    return () => {
      if (hideSavedRef.current) window.clearTimeout(hideSavedRef.current);
      if (clearSavedRef.current) window.clearTimeout(clearSavedRef.current);
    };
  }, []);

  const fileNameHint = batchId ? `sfmc_draft_${batchId}.json` : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <main
        className="
          mx-auto max-w-[1880px]
          px-3 md:px-5 lg:px-7
          xl:pl-3 xl:pr-6
          2xl:pl-4 2xl:pr-8
          grid gap-6
          grid-cols-1
          xl:grid-cols-[380px_minmax(820px,1fr)_480px]
          2xl:grid-cols-[420px_minmax(980px,1fr)_560px]
        "
        style={{ alignItems: "start" }}
      >
        {/* Columna izquierda */}
        <aside
          className="
            order-1 xl:order-none
            bg-white rounded-2xl border shadow-sm
            p-4 md:p-5
            sticky top-4 self-start
            max-h-[calc(100vh-2rem)] overflow-auto overscroll-contain
          "
        >
          <Email2Sidebar
            onGenerated={handleGenerated}
            currentBatchId={batchId}
          />
        </aside>

        {/* Columna central */}
        <section
          className="
            p-1 md:p-2 lg:p-3
            min-h-[calc(100vh-2rem)]
            overflow-auto overscroll-contain
          "
        >
          <Email2Workspace
            batchId={batchId}
            trios={contentSets} // prop legacy, concepto = sets de contenido
            images={images}
            showInternalPreview={false}
            onPreviewChange={setLivePreview}
            onEditedChange={handleEditedChange}
          />
        </section>

        {/* Columna derecha: Preview + botones */}
        <aside
          className="
            hidden xl:flex flex-col gap-4
            sticky top-4 self-start
            max-h-[calc(100vh-2rem)]
            overflow-auto overscroll-contain
            px-1
          "
        >
          <div className="text-sm font-semibold text-slate-700">
            Vista previa
          </div>

          {!livePreview ? (
            <div
              className="
                rounded-[20px] p-6
                bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_45%)]
                text-slate-500 text-sm
              "
            >
              Genera un lote y selecciona un{" "}
              <strong>set de contenido</strong> + una imagen para ver el
              preview aquí.
            </div>
          ) : (
            <>
              <EmailPreview
                subject={livePreview.subject}
                preheader={livePreview.preheader}
                title={livePreview.title || undefined}
                subtitle={livePreview.subtitle ?? undefined}
                body={livePreview.content}
                heroUrl={livePreview.heroUrl}
              />

              {/* Botones */}
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  disabled={!batchId || isSaving}
                  className={`
                    min-w-[160px] rounded-xl px-4 py-3 text-sm md:text-base font-semibold text-white shadow-sm transition
                    ${
                      isSaving
                        ? "bg-sky-400 cursor-wait"
                        : batchId
                        ? "bg-sky-600 hover:bg-sky-700 active:scale-[0.99]"
                        : "bg-gray-200 text-gray-500 cursor-not-allowed"
                    }
                  `}
                  title="Guardar ediciones en el batch (PUT /api/emails-v2/:batchId)"
                >
                  {isSaving ? "Guardando…" : "Guardar ediciones"}
                </button>

                <button
                  type="button"
                  onClick={handleUploadClick}
                  disabled={!batchId || isUploading}
                  className={`
                    min-w-[160px] rounded-xl px-4 py-3 text-sm md:text-base font-semibold text-white shadow-sm transition
                    ${
                      isUploading
                        ? "bg-emerald-400 cursor-wait"
                        : batchId
                        ? "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]"
                        : "bg-gray-200 text-gray-500 cursor-not-allowed"
                    }
                  `}
                  title="Crear borrador en SFMC con el set e imagen seleccionados"
                >
                  {isUploading ? "Enviando…" : "Enviar a SFMC"}
                </button>
              </div>

              {/* Mensajes bajo botones */}
              <div className="mt-2 text-center space-y-2">
                <div className="relative h-7">
                  {lastSavedAt && (
                    <div
                      className={`
                        pointer-events-none absolute inset-x-0 flex justify-center
                        transition-all duration-500
                        ${
                          savedVisible
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 -translate-y-1"
                        }
                      `}
                      aria-live="polite"
                    >
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm">
                        ✅ Guardado correctamente
                        {lastSavedAt ? ` · ${lastSavedAt}` : ""}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-neutral-500">
                  * Asegúrate de “Guardar ediciones” antes de enviar.
                </p>
                {sfmcNotice ? (
                  <p className="text-[12px] text-emerald-700">
                    {sfmcNotice}
                  </p>
                ) : null}
              </div>
            </>
          )}
        </aside>
      </main>

      {/* Modal de confirmación SFMC */}
      <ConfirmSendModal
        open={confirmOpen}
        busy={isUploading}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSend}
        preview={
          livePreview
            ? {
                subject: livePreview.subject,
                preheader: livePreview.preheader,
                title: livePreview.title,
                subtitle: livePreview.subtitle,
                body: livePreview.content,
                heroUrl: livePreview.heroUrl,
              }
            : undefined
        }
        fileNameHint={fileNameHint}
        logoSrc="/salesforce2.png"
      />

      <div className="h-6" />
    </div>
  );
}
