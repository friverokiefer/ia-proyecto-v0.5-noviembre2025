// frontend/src/components/ui/ConfirmSendModal.tsx
import React, { useEffect, useRef } from "react";
import { EmailPreview } from "@/components/EmailPreview";

export type ConfirmSendModalProps = {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Preview completo del correo que se enviará como borrador */
  preview?: {
    subject: string;
    preheader?: string;
    title?: string;
    subtitle?: string | null;
    body: string;
    heroUrl?: string;
  };
  /** Nombre del archivo que se descargará (hint visual) – opcional */
  fileNameHint?: string;
  /** Ruta del logo horizontal; fallback automático a /salesforce.png si no existe */
  logoSrc?: string;
};

/**
 * Modal de confirmación para “Enviar a Salesforce Marketing Cloud”.
 */
export function ConfirmSendModal({
  open,
  busy = false,
  onClose,
  onConfirm,
  preview,
  fileNameHint,
  logoSrc = "/salesforce-horizontal.png",
}: ConfirmSendModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const headerLogoRef = useRef<HTMLImageElement | null>(null);

  // ESC para cerrar, focus en confirmar y bloqueo de scroll del body
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);

    const id = window.setTimeout(() => confirmBtnRef.current?.focus(), 50);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(id);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onClose]);

  // Fallback de logo horizontal -> cuadrado -> oculto
  useEffect(() => {
    if (!headerLogoRef.current) return;
    const img = headerLogoRef.current;
    const onErr = () => {
      if (img?.src?.includes("salesforce-horizontal")) {
        img.src = "/salesforce.png";
      } else {
        img.style.display = "none";
      }
    };
    img.addEventListener("error", onErr);
    return () => img.removeEventListener("error", onErr);
  }, [logoSrc]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sfmc-dialog-title"
      aria-describedby="sfmc-dialog-desc"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={() => (!busy ? onClose() : null)}
      />

      {/* Caja modal */}
      <div
        className="
          relative w-full max-w-[880px]
          rounded-2xl bg-white border shadow-2xl
          overflow-hidden
          animate-[modalIn_.16s_ease-out]
        "
      >
        {/* Header con logo */}
        <div
          className="
            flex items-center justify-between gap-3
            px-5 py-3
            bg-gradient-to-r from-sky-50 to-blue-50
            border-b
          "
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              ref={headerLogoRef}
              src={logoSrc}
              alt="Salesforce"
              className="h-7 w-auto object-contain"
            />
            <h3
              id="sfmc-dialog-title"
              className="truncate text-base md:text-lg font-semibold text-slate-900"
              title="Enviar a Salesforce Marketing Cloud"
            >
              Enviar a Salesforce Marketing Cloud
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white/60 disabled:opacity-60"
            title="Cerrar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.3 5.71a1 1 0 00-1.41 0L12 10.59 7.11 5.7A1 1 0 105.7 7.11L10.59 12l-4.9 4.89a1 1 0 101.41 1.41L12 13.41l4.89 4.9a1 1 0 001.41-1.41L13.41 12l4.9-4.89a1 1 0 000-1.4z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 md:p-6">
          <p id="sfmc-dialog-desc" className="text-sm text-slate-600">
            Se creará un <strong>borrador de email</strong> en{" "}
            <strong>Salesforce Marketing Cloud</strong> usando el set de
            contenido e imagen seleccionados. Esta acción no envía campañas a
            clientes.
          </p>

          {/* Card con preview real del correo */}
          {preview ? (
            <div className="mt-4 rounded-2xl border bg-slate-50 p-3">
              <div className="rounded-xl border bg-white p-2">
                {/* Limitar alto con scroll si fuese necesario */}
                <div className="max-h-[520px] overflow-auto rounded-xl">
                  <EmailPreview
                    subject={preview.subject}
                    preheader={preview.preheader}
                    title={preview.title || undefined}
                    subtitle={preview.subtitle ?? undefined}
                    body={preview.body}
                    heroUrl={preview.heroUrl}
                  />
                </div>
              </div>

              {/* Hint de archivo (opcional, por si quieres mostrar sfmc_draft_*.json u otra clave) */}
              {fileNameHint ? (
                <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-500">Referencia local:</span>
                  <span className="font-mono text-slate-800 break-all">
                    {fileNameHint}
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border bg-white p-4 text-sm text-slate-500">
              No hay preview disponible.
            </div>
          )}

          {/* Nota legal mínima */}
          <p className="mt-4 text-[11px] text-slate-500">
            * Esta acción no publica ni envía comunicaciones a ningún cliente.
            Solo crea o actualiza un borrador en Salesforce Marketing Cloud.
          </p>

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
              {busy ? "Enviando…" : "Confirmar envío a SFMC"}
            </button>
          </div>
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
}
