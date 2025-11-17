// backend/src/lib/ia-engine.schema.ts
import { z } from "zod";

/**
 * Bloque de body del correo generado por el IA Engine.
 * Debe calzar con app/models/response.py → BodyBlock.
 */
export const BodyBlockSchema = z.object({
  title: z.string().min(1, "title no puede venir vacío"),
  // La bajada puede venir null o vacía, pero siempre normalizamos a string|null.
  subtitle: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (value == null) return null;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }),
  content: z.string().min(1, "content no puede venir vacío"),
});

/**
 * Variante/set de contenido de email.
 * Calza con app/models/response.py → GeneratedVariant.
 */
export const EmailVariantSchema = z.object({
  id: z.number().int().positive(),
  subject: z.string(),
  preheader: z.string(),
  body: BodyBlockSchema,
  cta: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      if (v == null) return undefined;
      const trimmed = v.trim();
      return trimmed ? trimmed : undefined;
    }),
});

/**
 * Respuesta del endpoint /ia/generate del IA Engine.
 */
export const GenerateEmailResponseSchema = z.object({
  engine: z.string(),
  variants: z.array(EmailVariantSchema),
  metadata: z.record(z.any()),
});

export type ZodEmailVariant = z.infer<typeof EmailVariantSchema>;
export type ZodIAResponse = z.infer<typeof GenerateEmailResponseSchema>;
