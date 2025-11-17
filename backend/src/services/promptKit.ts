// backend/src/services/promptKit.ts
/**
 * promptKit.ts
 * Centraliza prompts + presets de modelos + utilidades.
 *
 * IMPORTANTE:
 * - Para Email V2, el motor de TEXTO se movió al microservicio IA Engine (Python).
 * - Este módulo se mantiene principalmente para:
 *    - Prompts de IMAGEN (hero) usados por backend/src/services/image.ts
 *    - Endpoints legacy que aún llamen directo a OpenAI desde Node.
 */

export type TextPreset = "lite" | "quality" | "json";

export const MODELS = {
  text: {
    lite: process.env.OPENAI_TEXT_LITE || "gpt-4o-mini",
    quality: process.env.OPENAI_TEXT_QUALITY || "gpt-4o",
    json: process.env.OPENAI_TEXT_JSON || "gpt-4o-mini",
  },
  image: {
    default: process.env.OPENAI_IMAGE || "gpt-image-1",
  },
} as const;

export function pickTextModel(preset: TextPreset): string {
  if (preset === "quality") return MODELS.text.quality;
  if (preset === "json") return MODELS.text.json;
  return MODELS.text.lite;
}
export function pickImageModel(): string {
  return MODELS.image.default;
}

/* ===========================
 * Macros reutilizables
 * =========================== */
const macros = {
  esCL:
    "Escribe en español de Chile, claro, profesional y cercano. Evita regionalismos confusos y jerga excesiva.",
  safety:
    "No inventes datos no verificados. Si algo no es seguro, usa formulaciones conservadoras. No prometas aprobaciones definitivas; habla de 'evaluación' u 'oferta referencial'.",
  jsonOnly: (fields: string[]) =>
    `Responde SOLO con un objeto JSON válido con exactamente estas claves (y solo estas): ${fields.join(
      ", ",
    )}. No uses backticks, ni explicaciones fuera del JSON, ni comentarios.`,
  deliverability:
    "Evita mayúsculas sostenidas, signos de exclamación repetidos, emojis y palabras gatillantes de spam (gratis, regalo, urgente, gana dinero, 100% gratis, etc.).",
  lengthsEmail:
    "Límites: subject 38–60 caracteres; preheader 60–110; title 22–60; subtitle 14–120; body 160–500 palabras; CTA breve (2–4 palabras).",
  emailStructure: [
    "El body debe ser TEXTO PLANO (NO HTML).",
    "Estructura sugerida del body:",
    "1) Apertura con promesa/beneficio principal (2–3 frases).",
    "2) Lista de 3 beneficios en viñetas con '- ' al inicio (cada bullet 4–10 palabras).",
    "3) Cierre breve con urgencia suave y próxima acción.",
    "No incluyas disclaimers ni políticas en el body (se agregan aparte).",
  ].join(" "),
  rolesEmail: [
    "Roles de los campos:",
    "- subject: gancho corto y claro para el inbox.",
    "- preheader: complementa al subject; adelanta beneficio; NO lo repite.",
    "- title (H1 dentro del correo): introduce un ángulo NUEVO respecto de subject.",
    "- subtitle: profundiza o agrega beneficio adicional; NO repite preheader.",
    "- body: desarrollo en texto plano con bullets '- '.",
    "- cta: 2–4 palabras, imperativo suave (p. ej., 'Conoce más', 'Simula aquí').",
  ].join(" "),
  contrastiveDeDup: [
    "Evita duplicar subject/preheader dentro de title/subtitle.",
    "Si title o subtitle comparten 6+ palabras consecutivas o el mismo núcleo semántico con subject/preheader, REESCRÍBELOS con sinónimos o un ángulo distinto.",
    "Evita comenzar title/subtitle con las mismas 3 palabras del subject/preheader.",
    "Piensa internamente 2–3 alternativas para title/subtitle y elige la más distinta; NO muestres tu proceso, responde solo el JSON final.",
  ].join(" "),
  toneConstraints:
    "Usa tono profesional, claro, sin tecnicismos innecesarios; enfócate en beneficios y claridad. Cuida que el mensaje sea consistente con la marca Banco BICE: sobrio, confiable, sin exceso de hype.",
  creditNaming:
    "Para hacer referencia al crédito, puedes mencionarlo como: 'crédito', 'crédito de consumo', 'crédito de consumo del BICE', 'Crédito de Consumo BICE'. Si corresponde, puedes usar el placeholder [MONTO] para montos preaprobados.",
  neutrality:
    "El mensaje debe ser neutro en cuanto a género (no uses 'él' o 'ella'); trata al cliente de 'tú' y no de 'usted'.",
  copyMeta:
    "Si el payload incluye beneficios (benefits), CTAs sugeridas (cta_suggestions), asuntos de referencia (subject_suggestions) o un tono de cluster (cluster_tone_hint), úsalos como guía principal. Puedes parafrasearlos, pero no los contradigas ni inventes beneficios que cambien su sentido.",
};

/* ===========================
 * EMAILS (texto, IA) – LEGACY
 * =========================== */
export type EmailFeedback = {
  subject?: string;
  preheader?: string;
  bodyContent?: string;
};

export type EmailCtx = {
  campaign: string;
  cluster: string;
  tone?: string;
  /**
   * Metadatos opcionales traídos desde /ia/meta:
   * - benefits: beneficios sugeridos para la campaña.
   * - ctas: CTAs sugeridas para la campaña.
   * - subjects: asuntos de referencia.
   * - clusterTone: línea de tono específica del cluster.
   */
  benefits?: string[];
  ctas?: string[];
  subjects?: string[];
  clusterTone?: string;
  feedback?: EmailFeedback; // integra 3 campos
};

export type EmailTextPrompt = {
  system: string;
  user: string;
  fields: string[];
  modelPreset: TextPreset;
};

export function buildPromptEmailText(ctx: EmailCtx): EmailTextPrompt {
  const fields = ["subject", "preheader", "title", "subtitle", "body", "cta"];

  const system = [
    "Eres copywriter especializado en email marketing bancario y compliance para Banco BICE en Chile.",
    macros.esCL,
    macros.safety,
    macros.deliverability,
    macros.lengthsEmail,
    macros.emailStructure,
    macros.rolesEmail,
    macros.contrastiveDeDup,
    macros.toneConstraints,
    macros.creditNaming,
    macros.neutrality,
    macros.copyMeta,
  ].join(" ");

  const payload: Record<string, any> = {
    campaign: ctx.campaign,
    cluster: ctx.cluster,
    tone: ctx.tone || "Profesional cercano",
    rules: {
      subject_preheader:
        "Optimizados para inbox preview (concisos, claros, sin vender humo).",
      title_subtitle:
        "H1 + bajada dentro del correo; deben aportar ángulo nuevo respecto a subject/preheader.",
      cta:
        "2–4 palabras, imperativo suave (p. ej., 'Conoce más', 'Simula aquí'). Sin signos.",
      formatting:
        "El body es TEXTO PLANO; separa párrafos con saltos de línea. Bullets con '- '. Sin HTML.",
    },
  };

  // Metadatos de copy (opcionales, desde IA Engine)
  if (ctx.benefits && ctx.benefits.length > 0) {
    payload.benefits = ctx.benefits;
  }
  if (ctx.ctas && ctx.ctas.length > 0) {
    payload.cta_suggestions = ctx.ctas;
  }
  if (ctx.subjects && ctx.subjects.length > 0) {
    payload.subject_suggestions = ctx.subjects;
  }
  if (ctx.clusterTone) {
    payload.cluster_tone_hint = ctx.clusterTone;
  }

  if (
    ctx.feedback &&
    (ctx.feedback.subject ||
      ctx.feedback.preheader ||
      ctx.feedback.bodyContent)
  ) {
    payload.user_feedback = {
      subject_hint: ctx.feedback.subject || null,
      preheader_hint: ctx.feedback.preheader || null,
      body_hint: ctx.feedback.bodyContent || null,
      instruction:
        "Refina la variante siguiendo estas pistas del usuario. Mantén coherencia con campaña/cluster y las reglas de entregabilidad.",
    };
  }

  const example = [
    "EJEMPLO DE ESTILO (no lo copies, no lo devuelvas):",
    "{",
    `  "subject": "Tu próximo paso financiero, en minutos",`,
    `  "preheader": "Conoce beneficios exclusivos y comisiones preferentes",`,
    `  "title": "Beneficios que se notan desde el primer mes",`,
    `  "subtitle": "Acumula puntos, accede a descuentos y administra todo 100% online",`,
    `  "body": "(texto plano con párrafos y bullets '- ')",`,
    `  "cta": "Conoce más"`,
    "}",
  ].join("\n");

  const user = [
    "Escribe UNA variante de email con los campos solicitados (subject, preheader, title, subtitle, body, cta).",
    JSON.stringify(payload, null, 2),
    example,
    "Si el payload incluye 'benefits' o 'cta_suggestions', úsalos como base para los bullets y la llamada principal. Puedes resumir o reordenar, pero sin cambiar su sentido.",
    "Asegura que title/subtitle NO repitan ni parafraseen subject/preheader. Si detectas similitud, reescribe title/subtitle con sinónimos o un ángulo nuevo antes de responder.",
    "El body debe ser texto plano: usa saltos de línea para párrafos y '- ' para bullets. No incluyas disclaimers, links, ni HTML.",
    macros.jsonOnly(fields),
  ].join("\n- ");

  return { system, user, fields, modelPreset: "json" };
}

/* ===========================
 * Prompts de IMAGEN (hero)
 * =========================== */
export type ImageKind = "emailHero";

export function buildImagePrompt(kind: ImageKind, ctx: any): string {
  if (kind !== "emailHero") {
    throw new Error(`ImageKind no soportado: ${kind}`);
  }
  const base = [
    "Hero para email, orientación horizontal 3:2 (1536×1024) full-bleed (edge-to-edge).",
    "NO texto, NO logos, NO marcas de agua, NO marcos ni bordes, NO barras arriba/abajo.",
    "No solid color background ni gradientes planos: usa una escena realista con sujeto y entorno, con profundidad y textura.",
    "Llena completamente el lienzo 3:2 (sin padding). Evita dejar franjas o áreas vacías.",
    "Estilo fotorrealista corporativo bancario; luz natural; limpio y moderno.",
    "Composición equilibrada con espacio negativo útil sin vacíos visibles.",
    "Si aparecen personas: expresiones naturales, diversidad realista, vestimenta ejecutiva.",
    `Contexto campaña: ${ctx.campaign}. Cluster: ${ctx.cluster}.`,
  ];
  if (ctx?.promptHint) {
    base.push(
      `Inspiración/escena (opcional, concisa): ${String(ctx.promptHint).slice(
        0,
        240,
      )}`,
    );
  }
  return base.join(" ");
}
