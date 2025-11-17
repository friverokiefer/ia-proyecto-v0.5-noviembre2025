// frontend/src/components/EmailPreview.tsx
import React from "react";

export type EmailPreviewProps = {
  subject: string;
  preheader?: string;
  title?: string;
  subtitle?: string | null;
  body: string; // texto plano con \n (admite bullets: "- " o "• ")
  heroUrl?: string;
  heroAlt?: string;
  className?: string; // para ajustar padding/márgenes desde el contenedor
};

/**
 * Vista tipo “cliente de correo”.
 * - Renderiza lo que recibe (sin lógica de negocio).
 * - Body: agrupa líneas que empiezan con "- " o "• " en listas <ul>.
 * - Autolink: convierte http(s)://... y correos en <a>.
 */
export function EmailPreview({
  subject,
  preheader,
  title,
  subtitle,
  body,
  heroUrl,
  heroAlt = "Imagen principal del correo",
  className,
}: EmailPreviewProps) {
  /** Convierte URLs y correos en <a> sin usar innerHTML */
  const linkify = (text: string): React.ReactNode[] => {
    const URL_RE = /(https?:\/\/[^\s)]+)/gi;
    const MAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;

    const parts: React.ReactNode[] = [];
    const urlSplit = String(text || "").split(URL_RE);

    urlSplit.forEach((seg, i) => {
      if (i % 2 === 1) {
        // Es URL
        parts.push(
          <a
            key={`url-${i}`}
            href={seg}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {seg}
          </a>
        );
      } else {
        // Texto normal: ahora parseamos correos dentro
        const mailSplit = seg.split(MAIL_RE);
        let idx = 0;
        for (let j = 0; j < mailSplit.length; j++) {
          const chunk = mailSplit[j];
          if (j > 0) {
            const match = seg.slice(idx).match(MAIL_RE);
            if (match && match.index === 0) {
              const email = match[0];
              parts.push(
                <a
                  key={`mail-${i}-${j}`}
                  href={`mailto:${email}`}
                  className="underline"
                >
                  {email}
                </a>
              );
              idx += email.length;
            }
          }
          if (chunk) {
            parts.push(
              <React.Fragment key={`txt-${i}-${j}`}>{chunk}</React.Fragment>
            );
            idx += chunk.length;
          }
        }
      }
    });

    return parts.length ? parts : [text];
  };

  // Convierte texto plano en párrafos y listas
  const renderBody = (text: string) => {
    const lines = String(text || "").split(/\r?\n/);
    const blocks: React.ReactNode[] = [];
    let pendingList: string[] = [];

    const flushList = (key: string) => {
      if (pendingList.length === 0) return;
      blocks.push(
        <ul
          key={key}
          className="my-3 list-disc pl-6 text-[15px] leading-6 text-slate-800"
        >
          {pendingList.map((li, j) => (
            <li key={`${key}-li-${j}`}>{linkify(li)}</li>
          ))}
        </ul>
      );
      pendingList = [];
    };

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      const isBullet = /^(-|•)\s+/.test(trimmed);

      if (isBullet) {
        pendingList.push(trimmed.replace(/^(-|•)\s+/, ""));
      } else {
        flushList(`ul-${i}`);
        if (trimmed.length > 0) {
          blocks.push(
            <p
              key={`p-${i}`}
              className="my-3 whitespace-pre-wrap text-[15px] leading-6 text-slate-800"
            >
              {linkify(line)}
            </p>
          );
        }
      }
    });

    flushList("ul-end");
    return blocks.length ? blocks : null;
  };

  return (
    <div className={className}>
      {/* Marco con gradiente suave */}
      <div className="rounded-[20px] p-5 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_45%)]">
        {/* Encabezado: Subject + Preheader */}
        <div className="mx-auto max-w-[980px] px-4">
          <div className="mb-1 text-[14px] font-semibold text-slate-600">
            Asunto:
          </div>
          <div className="break-words text-2xl font-semibold leading-snug text-slate-900 md:text-3xl">
            {subject || "—"}
          </div>

          <div className="mt-5 mb-1 text-[14px] font-semibold text-slate-600">
            Preencabezado:
          </div>
          <div className="break-words text-lg leading-relaxed text-slate-700 md:text-xl">
            {preheader || "—"}
          </div>
        </div>

        {/* “Correo” central */}
        <div className="mx-auto mt-4 max-w-[980px] px-4">
          <div className="flex justify-center">
            <div
              className="
                w-full max-w-[640px] overflow-hidden rounded-none bg-white
                ring-1 ring-black/5 shadow-[0_28px_70px_-24px_rgba(0,0,0,0.35),0_10px_28px_rgba(0,0,0,0.12)]
              "
            >
              {(title || subtitle) && (
                <div className="px-6 pt-6">
                  {title ? (
                    <h4 className="text-center text-[24px] font-bold leading-snug text-[#2596be]">
                      {title}
                    </h4>
                  ) : null}
                  {subtitle ? (
                    <p className="mt-2 text-center text-[16px] font-semibold text-black">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
              )}

              {heroUrl ? (
                <div className="px-6 pt-4">
                  {/* Contenedor 16:9 */}
                  <div className="w-full aspect-[16/9] overflow-hidden rounded">
                    <img
                      src={heroUrl}
                      alt={heroAlt}
                      className="w-full h-full object-cover block"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              ) : null}

              <div className="px-6 py-7">
                {renderBody(body)}

                <div className="mt-7 border-t pt-4">
                  <p className="m-0 text-[12px] leading-5 text-slate-500">
                    Este correo es informativo. Sujeto a evaluación y
                    condiciones referenciales.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>      
    </div>
  );
}
