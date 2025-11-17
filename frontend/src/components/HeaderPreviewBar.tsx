// frontend/src/components/HeaderPreviewBar.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, Send } from "lucide-react";

type CopyLabel = "subject" | "preheader";

export function HeaderPreviewBar({
  subject,
  preheader,
  batchId,
  onCopy,
  hideTokens = true,
  className = "",
  onSendToSFMC,
  sending = false,
  sendDisabled = false,
  sendLabel = "Enviar a SFMC",
}: {
  subject?: string;
  preheader?: string;
  batchId?: string;
  onCopy?: (txt: string, label: CopyLabel) => void;
  hideTokens?: boolean;
  className?: string;

  /** Callback opcional para enviar a SFMC (lo orquesta el padre) */
  onSendToSFMC?: () => void | Promise<void>;
  /** Estado visual de envío */
  sending?: boolean;
  /** Deshabilitar botón por validación o permisos */
  sendDisabled?: boolean;
  /** Etiqueta del botón */
  sendLabel?: string;
}) {
  async function handleCopy(txt: string, label: CopyLabel) {
    try {
      if (txt) await navigator.clipboard.writeText(txt);
      onCopy?.(txt, label);
    } catch {
      // noop
    }
  }

  return (
    <div
      className={
        "mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between " +
        className
      }
    >
      {/* Tokens opcionales (chips). Ocultos por defecto */}
      {!hideTokens && (
        <div className="flex-1 grid gap-3 md:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Asunto:</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm">
              {subject || "—"}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => subject && handleCopy(subject, "subject")}
                className="h-7 px-2"
                title="Copiar asunto"
              >
                <Copy size={14} />
              </Button>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">
              Pre-header:
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm">
              {preheader || "—"}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  preheader && handleCopy(preheader, "preheader")
                }
                className="h-7 px-2"
                title="Copiar pre-header"
              >
                <Copy size={14} />
              </Button>
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        {batchId ? (
          <div className="text-xs text-gray-500">
            Lote: <span className="font-medium">{batchId}</span>
          </div>
        ) : null}

        {/* Botón Enviar a SFMC (si el padre pasa callback) */}
        {onSendToSFMC && (
          <Button
            type="button"
            onClick={() => onSendToSFMC?.()}
            disabled={sending || sendDisabled}
            className="inline-flex items-center gap-2"
            title={sendLabel}
          >
            {sending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Send size={16} />
            )}
            <span>{sendLabel}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
