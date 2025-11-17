// backend/src/services/textGen.ts
/**
 * Fallback determinístico (sin LLM) para emails.
 * Útil si hay rate-limits, fallos de red o activas FALLBACK_TEXT_ONLY=1.
 *
 * A partir de Etapa 4:
 * - No mantiene catálogos propios de CTAs/beneficios/tono.
 * - Puede recibirlos inyectados desde el IA Engine/meta.
 */

export type Feedback = { subject?: string; preheader?: string; body?: string };

function clampChars(str: string, min: number, max: number) {
  const s = str.trim().replace(/\s+/g, " ");
  if (s.length > max) return s.slice(0, max - 1).trimEnd() + "…";
  if (s.length < min) return s; // no forzamos padding
  return s;
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function genericSubjectsFor(campaign: string) {
  return [
    `${campaign}: solución a tu medida`,
    `${campaign} con proceso 100% online`,
    `${campaign}: asesoría experta y transparente`,
    `${campaign} rápido y claro`,
    `${campaign}: condiciones competitivas`,
  ];
}

/**
 * Fallback simple basado en texto plano.
 *
 * Si se entregan metadatos desde el IA Engine (subjects/benefits/ctas/clusterTone),
 * se usan como primera opción. Si no, se construye todo con defaults genéricos.
 */
export function generateText({
  campaign,
  cluster,
  versionIndex,
  feedback,
  benefits,
  ctas,
  clusterTone,
  subjects,
}: {
  campaign: string;
  cluster: string;
  versionIndex: number;
  feedback?: Feedback;
  benefits?: string[];
  ctas?: string[];
  clusterTone?: string;
  subjects?: string[];
}) {
  const safeIndex = Math.abs(versionIndex) || 0;

  // Subjects
  const subjectPool =
    (subjects && subjects.length > 0 ? subjects : undefined) ??
    genericSubjectsFor(campaign);
  let subject = subjectPool[safeIndex % subjectPool.length];

  // CTAs
  const ctaPool =
    (ctas && ctas.length > 0 ? ctas : undefined) ?? [
      "Conocer más",
      "Simula aquí",
      "Ver detalles",
    ];
  const cta = ctaPool[safeIndex % ctaPool.length];

  // Bullets / beneficios
  const defaultBullets = [
    "tasa competitiva",
    "respuesta rápida",
    "proceso 100% online",
  ];
  const cleanedBenefits =
    benefits
      ?.map((b) => String(b || "").trim())
      .filter((b) => b.length > 0) ?? [];
  const bullets =
    cleanedBenefits.length > 0
      ? cleanedBenefits.slice(0, 3)
      : defaultBullets;

  // Tono
  const tone =
    clusterTone ??
    `Te acompañamos con una propuesta clara para el segmento "${cluster}".`;

  // preheader y body
  const firstBullet = bullets[0] || "condiciones competitivas";
  const secondBullet = bullets[1] || "proceso simple";

  let preheader = `${capitalize(
    firstBullet,
  )}, ${secondBullet}. Proceso simple y claro.`;

  let body =
    `${tone}\n` +
    `Te ofrecemos condiciones competitivas y un proceso transparente para ${campaign.toLowerCase()}.\n` +
    bullets.map((b) => `- ${b}`).join("\n") +
    `\nSujeto a evaluación. Condiciones referenciales que pueden variar.`;

  // feedback opcional (muy simple, no destructivo)
  if (feedback?.subject) {
    // señal de que el usuario quiere ajustar el subject
    subject = clampChars(feedback.subject, 30, 70);
  }
  if (feedback?.preheader) {
    preheader = clampChars(feedback.preheader, 50, 120);
  }
  if (feedback?.body) {
    body += `\n¿Dudas? ${feedback.body.trim()}`;
  }

  // Longitudes “email-safe”
  subject = clampChars(subject, 38, 60);
  preheader = clampChars(preheader, 60, 110);

  return { subject, preheader, body, cta };
}
