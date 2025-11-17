// frontend/src/components/Email2Workspace.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { EmailV2Image, EmailContentSet } from "@/lib/apiEmailV2";
import { EmailPreview } from "./EmailPreview";

// 👇 re-export del tipo para que App.tsx pueda importarlo desde aquí
export type { EmailContentSet } from "@/lib/apiEmailV2";

export type PreviewData = {
  subject: string;
  preheader: string;
  title: string;
  subtitle: string | null;
  content: string;
  heroUrl: string;
};

// === Config GCS para asegurar URLs absolutas ===
const VITE_GCS_BUCKET = (import.meta as any).env?.VITE_GCS_BUCKET || "";
const VITE_GCS_PREFIX = (import.meta as any).env?.VITE_GCS_PREFIX || "dev";

function isAbsoluteUrl(u?: string) {
  return !!u && /^https?:\/\//i.test(u);
}

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

function absoluteHeroUrl(batchId: string, img: EmailV2Image): string {
  const current = img?.heroUrl || "";
  if (isAbsoluteUrl(current)) return current;
  const candidate = img?.fileName || current || (img as any)?.url || "";
  if (!candidate) return current;
  const url = gcsDirectObjectUrl(batchId, candidate);
  return url || current;
}

/** Normaliza un set (quita espacios, asegura body estructurado) */
function normalizeSet(t: EmailContentSet): EmailContentSet {
  const body = (t?.body || {}) as Partial<EmailContentSet["body"]>;
  return {
    ...t,
    subject: (t?.subject ?? "").trim(),
    preheader: (t?.preheader ?? "").trim(),
    body: {
      title: (body?.title ?? "").trim(),
      subtitle: (body?.subtitle ?? "") || null,
      content: body?.content ?? "",
    },
  };
}

/** === COMPONENTE ======================================================= */
export function Email2Workspace({
  batchId,
  trios,
  images,
  showInternalPreview = true,
  onPreviewChange,
  onEditedChange,
}: {
  batchId: string;
  trios: EmailContentSet[]; // prop legacy, concepto = sets de contenido
  images: EmailV2Image[];
  showInternalPreview?: boolean;
  onPreviewChange?: (data: PreviewData | null) => void;
  onEditedChange?: (sets: EmailContentSet[]) => void;
}) {
  const [edited, setEdited] = useState<EmailContentSet[]>(() =>
    (trios || []).map((t) => normalizeSet(t))
  );
  const [selectedSet, setSelectedSet] = useState<number | null>(
    (trios || []).length ? 0 : null
  );
  const [selectedImage, setSelectedImage] = useState<number | null>(
    images.length ? 0 : null
  );

  const prevBatchRef = useRef<string | null>(null);

  // Reset completo cuando cambia el batchId
  useEffect(() => {
    if (prevBatchRef.current !== batchId) {
      prevBatchRef.current = batchId;
      const norm = (trios || []).map((t) => normalizeSet(t));
      setEdited(norm);
      setSelectedSet(norm.length ? 0 : null);
      setSelectedImage(images.length ? 0 : null);
      return;
    }
  }, [batchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizar sets cuando cambian desde el padre (mismo batch)
  useEffect(() => {
    if (prevBatchRef.current !== batchId) return;
    const norm = (trios || []).map((t) => normalizeSet(t));
    setEdited(norm);
    setSelectedSet((prev) => {
      if (norm.length === 0) return null;
      if (prev == null) return 0;
      return prev >= norm.length ? norm.length - 1 : prev;
    });
  }, [trios, batchId]);

  // Sincronizar imágenes cuando cambian desde el padre (mismo batch)
  useEffect(() => {
    if (prevBatchRef.current !== batchId) return;
    setSelectedImage((prev) => {
      const len = images.length;
      if (len === 0) return null;
      if (prev == null) return 0;
      return prev >= len ? len - 1 : prev;
    });
  }, [images, batchId]);

  // Notificar ediciones al padre
  useEffect(() => {
    onEditedChange?.(edited);
  }, [edited, onEditedChange]);

  function updateSet(idx: number, patch: Partial<EmailContentSet>) {
    setEdited((prev) => {
      if (!prev[idx]) return prev;
      const next = [...prev];
      next[idx] = normalizeSet({ ...next[idx], ...patch });
      return next;
    });
  }

  function updateSetBody(idx: number, patch: Partial<EmailContentSet["body"]>) {
    setEdited((prev) => {
      if (!prev[idx]) return prev;
      const next = [...prev];
      next[idx] = normalizeSet({
        ...next[idx],
        body: { ...next[idx].body, ...patch },
      });
      return next;
    });
  }

  function autoResize(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  // Preview calculada (set + imagen)
  const preview = useMemo<PreviewData | null>(() => {
    if (selectedSet == null || selectedImage == null) return null;
    const t = edited[selectedSet];
    const img = images[selectedImage];
    if (!t || !img) return null;
    return {
      subject: t.subject,
      preheader: t.preheader,
      title: (t.body?.title ?? "").trim(),
      subtitle: t.body?.subtitle ?? null,
      content: t.body?.content ?? "",
      heroUrl: absoluteHeroUrl(batchId, img),
    };
  }, [edited, images, selectedSet, selectedImage, batchId]);

  // Exponer preview al padre (App.tsx) para SFMC y panel derecho
  useEffect(() => {
    onPreviewChange?.(preview);
  }, [preview, onPreviewChange]);

  const textarea =
    "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 resize-y leading-5";
  const cardStyle: React.CSSProperties = {
    flex: "0 0 clamp(320px, 33.333%, 420px)",
  };

  return (
    <div className="space-y-8">
      {/* SETS */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">
            Sets de Contenido
          </h3>
          <p className="text-xs text-neutral-500">
            Edita y selecciona 1 set + 1 imagen.
          </p>
        </div>

        {edited.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-neutral-500">
            Genera contenido en la izquierda (Email 2.0).
          </div>
        ) : (
          <div className="edge-fade-x flex gap-4 pb-2 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth overscroll-contain">
            {edited.map((t, idx) => {
              const active = selectedSet === idx;
              return (
                <div
                  key={t.id ?? idx}
                  className={
                    "snap-start rounded-2xl border bg-white p-4 shadow-sm space-y-3 " +
                    (active ? "ring-2 ring-sky-500" : "")
                  }
                  style={cardStyle}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="setSel"
                      checked={active}
                      onChange={() => setSelectedSet(idx)}
                    />
                    <span className="text-xs font-medium text-neutral-600">
                      Set #{idx + 1}
                    </span>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium">
                      Subject
                    </label>
                    <textarea
                      className={textarea}
                      rows={1}
                      onInput={autoResize}
                      style={{ minHeight: 64, maxHeight: 200 }}
                      value={t.subject}
                      onChange={(e) =>
                        updateSet(idx, { subject: e.target.value })
                      }
                      placeholder="Asunto del correo"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium">
                      Pre-header
                    </label>
                    <textarea
                      className={textarea}
                      rows={1}
                      onInput={autoResize}
                      style={{ minHeight: 64, maxHeight: 200 }}
                      value={t.preheader}
                      onChange={(e) =>
                        updateSet(idx, { preheader: e.target.value })
                      }
                      placeholder="Texto de vista previa"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium">
                      Título
                    </label>
                    <textarea
                      className={textarea}
                      rows={1}
                      onInput={autoResize}
                      style={{ minHeight: 64, maxHeight: 200 }}
                      value={t.body.title}
                      onChange={(e) =>
                        updateSetBody(idx, { title: e.target.value })
                      }
                      placeholder="Título del cuerpo"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium">
                      Bajada
                    </label>
                    <textarea
                      className={textarea}
                      rows={1}
                      onInput={autoResize}
                      style={{ minHeight: 64, maxHeight: 200 }}
                      value={t.body.subtitle || ""}
                      onChange={(e) =>
                        updateSetBody(idx, { subtitle: e.target.value })
                      }
                      placeholder="Subtítulo del cuerpo"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium">
                      Contenido
                    </label>
                    <textarea
                      className={textarea}
                      rows={5}
                      onInput={autoResize}
                      style={{ minHeight: 390, maxHeight: 520 }}
                      value={t.body.content}
                      onChange={(e) =>
                        updateSetBody(idx, { content: e.target.value })
                      }
                      placeholder="Contenido del cuerpo (texto libre)"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* IMÁGENES */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">Imágenes</h3>
          <p className="text-xs text-neutral-500">Elige 1 imagen.</p>
        </div>

        {images.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-neutral-500">
            No hay imágenes generadas todavía.
          </div>
        ) : (
          <div className="edge-fade-x flex gap-4 pb-2 overflow-x-auto snap-x snap-mandatory scroll-smooth overscroll-contain">
            {images.map((img, idx) => {
              const active = selectedImage === idx;
              const hero = absoluteHeroUrl(batchId, img);
              return (
                <button
                  key={img.fileName ?? idx}
                  type="button"
                  onClick={() => setSelectedImage(idx)}
                  className={
                    "snap-start group rounded-2xl border bg-white p-2 shadow-sm text-left transition " +
                    (active ? "ring-2 ring-sky-500" : "hover:shadow-md")
                  }
                  style={cardStyle}
                  title={`Seleccionar imagen #${idx + 1}`}
                >
                  <div
                    className="w-full overflow-hidden rounded-xl bg-neutral-100 flex items-center justify-center"
                    style={{ aspectRatio: "16 / 9" }}
                  >
                    <img
                      src={hero}
                      alt={`Imagen ${idx + 1}`}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-2 text-xs text-neutral-600">
                    {img.fileName}
                    {img.meta?.size ? <span> • {img.meta.size}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* PREVIEW interno */}
      {showInternalPreview && (
        <section id="preview-email-v2">
          <h3 className="mb-3 text-base font-semibold text-gray-800">
            Vista previa
          </h3>

          {!preview ? (
            <div className="rounded-2xl border bg-white p-6 text-neutral-500">
              Selecciona un set de contenido y una imagen para ver la vista
              previa.
            </div>
          ) : (
            <EmailPreview
              subject={preview.subject}
              preheader={preview.preheader}
              title={preview.title || undefined}
              subtitle={preview.subtitle ?? undefined}
              body={preview.content}
              heroUrl={preview.heroUrl}
            />
          )}
        </section>
      )}
    </div>
  );
}
