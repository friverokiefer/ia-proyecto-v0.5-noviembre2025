// frontend/src/lib/schemas.ts

/**
 * Tipos genéricos de campos y schemas.
 * Hoy no se usan en Email 2.0, pero se dejan por si en el futuro
 * se modelan formularios adicionales en el frontend.
 */

import type { SfmcDraftEmailPayload } from "./apiEmailV2";

export type Field =
  | {
      id: string;
      label: string;
      type: "text" | "url";
      required?: boolean;
      maxLength?: number;
      placeholder?: string;
    }
  | {
      id: string;
      label: string;
      type: "textarea";
      required?: boolean;
      maxLength?: number;
      placeholder?: string;
    }
  | {
      id: string;
      label: string;
      type: "select" | "radio";
      required?: boolean;
      options: string[];
    }
  | {
      id: string;
      label: string;
      type: "multiselect";
      required?: boolean;
      options: string[];
    }
  | {
      id: string;
      label: string;
      type: "number";
      required?: boolean;
      min?: number;
      max?: number;
    };

export type Schema = {
  id: string; // antes era "google_ads" | "meta_ads" | ...
  title: string;
  fields: Field[];
  image_formats?: any[];
  output_contract?: Record<string, any>;
};

/**
 * ==================== Validador SFMC payload ====================
 *
 * Esto SÍ se usa para el flujo de correo:
 * - Enviar imagen + HTML a Salesforce Marketing Cloud
 * - Validar que el backend recibe un payload consistente
 *
 * El contrato (tipos) vive en apiEmailV2.ts → SfmcDraftEmailPayload.
 */

export function validateSfmcDraftEmailPayload(
  p: SfmcDraftEmailPayload | any
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const isNonEmpty = (s: any) => typeof s === "string" && s.trim().length > 0;

  // categoryId
  if (typeof p?.categoryId !== "number" || !Number.isFinite(p.categoryId)) {
    errors.push("categoryId debe ser number");
  }

  // image
  const img = p?.image as SfmcDraftEmailPayload["image"] | undefined;
  if (!img || typeof img !== "object") {
    errors.push("image es requerido");
  } else {
    if (!isNonEmpty(img.name)) errors.push("image.name es requerido");

    if (
      !["png", "jpg", "jpeg", "gif"].includes(
        String(img.extension).toLowerCase()
      )
    ) {
      errors.push("image.extension inválido (png|jpg|jpeg|gif)");
    }

    if (!isNonEmpty((img as any).base64) && !isNonEmpty((img as any).gcsUrl)) {
      errors.push("image.base64 o image.gcsUrl es requerido");
    }
  }

  // email
  const em = p?.email as SfmcDraftEmailPayload["email"] | undefined;
  if (!em || typeof em !== "object") {
    errors.push("email es requerido");
  } else {
    if (!isNonEmpty(em.name)) errors.push("email.name es requerido");
    if (!isNonEmpty(em.subject)) errors.push("email.subject es requerido");
    if (!isNonEmpty(em.htmlTemplate)) {
      errors.push("email.htmlTemplate es requerido");
    }
  }

  return { ok: errors.length === 0, errors };
}
