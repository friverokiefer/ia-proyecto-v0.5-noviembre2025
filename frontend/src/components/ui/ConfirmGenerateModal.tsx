import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type ConfirmGenerateModalProps = {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  summary: {
    campaign: string;
    cluster: string;
    sets: number;    // Sets de Contenido
    images: number;  // Imágenes
  };
};

/**
 * Modal de confirmación para “Generar”.
 * - Portal a <body> para evitar stacking-contexts
 * - Z-index alto y bloqueo de scroll
 * - Botones coherentes con el botón "Generar"
 */
export function ConfirmGenerateModal({
  open,
  busy = false,
  onClose,
  onConfirm,
  summary,
}: ConfirmGenerateModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);

    // lock scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const id = window.setTimeout(() => confirmBtnRef.current?.focus(), 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(id);
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gen-dialog-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={() => (!busy ? onClose() : null)}
      />

      {/* Caja modal */}
      <div
        className="
          relative w-full max-w-[560px]
          rounded-2xl bg-white border shadow-2xl
          p-5 md:p-6
          animate-[modalIn_.16s_ease-out]
        "
      >
        <h3 id="gen-dialog-title" className="text-base md:text-lg font-semibold text-slate-900">
          Confirmar generación de contenido
        </h3>

        <p className="mt-2 text-sm text-slate-600">
          Vas a generar <strong>{summary.sets}</strong> <em>Sets de Contenido</em> y{" "}
          <strong>{summary.images}</strong> imagen(es) para:
        </p>

        <div className="mt-3 rounded-xl border bg-slate-50 p-3">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Campaña</dt>
              <dd className="font-medium text-slate-800">{summary.campaign || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Cluster</dt>
              <dd className="font-medium text-slate-800">{summary.cluster || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Sets de Contenido</dt>
              <dd className="font-medium text-slate-800">{summary.sets}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Imágenes</dt>
              <dd className="font-medium text-slate-800">{summary.images}</dd>
            </div>
          </dl>

          <p className="mt-3 text-[12px] text-slate-500">
            Consejo: revisa que “Campaña” y “Cluster” sean los correctos antes de confirmar para evitar lotes innecesarios.
          </p>
        </div>

        {/* Botones */}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`
              rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition
              ${busy ? "bg-sky-400 cursor-wait" : "bg-sky-600 hover:bg-sky-700 active:scale-[0.99]"}
            `}
          >
            {busy ? "Generando…" : "Confirmar generación"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: .6; transform: translateY(4px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
}
