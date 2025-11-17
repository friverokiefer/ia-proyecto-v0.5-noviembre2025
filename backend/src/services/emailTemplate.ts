// backend/src/services/emailTemplate.ts

/** Marca para identificar plantilla BICE en el backend (no borrar). */
export const EMAIL_STUDIO_TEMPLATE_MARK = "<!-- email-studio:template=bice_v2 -->";

/** Paleta y fuentes corporativas */
const BRAND = {
  title: "#326295",      // color de H1
  body: "#777777",       // texto principal
  legal: "#97999b",      // legales/can-spam
  fontStack: "Arial,Helvetica,sans-serif",
};

export type SfmcEmailData = {
  subject: string;
  preheader?: string;
  headerLogoUrl?: string;
  heroUrl?: string;             // usar "{{IMAGE_URL}}" si se reemplaza por publishedURL
  title?: string;
  subtitle?: string | null;
  bodyHtml?: string;
  legalDisclaimerHtml?: string;
  canSpamHtml?: string;
  footerLogoUrl?: string;
};

/**
 * Plantilla SFMC corporativa (600px + borde), con UTF-8 explícito y marca.
 * - Tipografía: Arial/Helvetica
 * - Título (H1): #326295
 * - Cuerpo: #777777 (párrafos y listas)
 */
export function renderSfmcTemplateV2(d: SfmcEmailData) {
  const {
    subject,
    preheader = "",
    headerLogoUrl = "https://image.info.bice.cl/lib/fe2b11717d6404787c1371/m/1/ed5676a1-10c5-4c03-b63b-4104eff6bdbd.png",
    heroUrl = "{{IMAGE_URL}}",
    title = "Título del correo",
    subtitle = "Bajada o subheadline",
    bodyHtml = `
      <p style="line-height:150%; font-size:15px; font-family:${BRAND.fontStack}; color:${BRAND.body}; margin:0 0 12px 0;">
        Cuerpo del correo. Puedes usar placeholders de SFMC como
        <b>%%CreatedDate%%</b>, <b>%%CaseNumber%%</b>, etc.
      </p>`,
    legalDisclaimerHtml = `
      <div style="line-height:1.35; font-family:${BRAND.fontStack}; font-size:13px; color:#a6a6a6;">
        Infórmese sobre la garantía estatal de los depósitos en su banco o en
        www<img src="http://multimedia.bice.cl/mailings/activos/punto_gris.png">cmfchile
        <img src="http://multimedia.bice.cl/mailings/activos/punto_gris.png">cl
      </div>`,
    canSpamHtml = `
      <div style="color:${BRAND.legal}; font-size:12px; text-align:justify; font-family:${BRAND.fontStack}; line-height:1.4;">
        <p style="margin:0;">Recibes este correo porque … | Dirección postal … |
        <a href="%%unsub_center_url%%" style="color:${BRAND.legal};">Darse de baja</a></p>
      </div>`,
    footerLogoUrl = headerLogoUrl,
  } = d;

  const hiddenPreheader = preheader
    ? `<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#ffffff;">
         ${escapeHtml(preheader)}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
       </div>`
    : "";

  return `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    ${EMAIL_STUDIO_TEMPLATE_MARK}
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
    <title>${escapeHtml(subject)}</title>
    <style type="text/css">
      ReadMsgBody{ width: 100%;}
      .ExternalClass {width: 100%;}
      .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div {line-height: 100%;}
      body {-webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; margin:0 !important; font-family:${BRAND.fontStack};}
      table td { border-collapse: collapse;}
      img {outline:0;}
      a img {border:none;}
      @-ms-viewport{ width: device-width;}
    </style>
    <style type="text/css">
      @media only screen and (max-width: 480px) {
        .container {width: 100% !important;}
        .content-padding{ padding:4px !important; }
        .mobile-hidden { display:none !important; }
        img { max-width:100% !important; height:auto !important; }
        .responsive-td {width:100% !important; display:block !important; padding:0 !important; }
        body { padding: 0px !important; font-size: 16px !important; line-height: 150% !important;}
        h1 { font-size: 22px !important; line-height: normal !important;}
        h2 { font-size: 20px !important; line-height: normal !important;}
        h3 { font-size: 18px !important; line-height: normal !important;}
      }
      @media only screen and (max-width: 640px) {
        .container { width:100% !important; }
        .mobile-hidden { display:none !important; }
        img { width:100% !important; height:auto !important;}
      }
    </style>
    <!--[if mso]>
      <style type="text/css">
          body, table, td {
              font-family: ${BRAND.fontStack};
              font-size:16px;
              color:${BRAND.body};
              line-height:1.35;
          }
      </style>
    <![endif]-->
  </head>
  <body bgcolor="#ffffff" text="${BRAND.body}" style="background-color:#ffffff; color:${BRAND.body}; padding:0; -webkit-text-size-adjust:none; font-size:16px; font-family:${BRAND.fontStack};">
    ${hiddenPreheader}
    <table width="100%" border="0" cellpadding="0" cellspacing="0" align="center">
      <tr><td align="center" valign="top"><custom type="header"/></td></tr>
      <tr>
        <td align="center">
          <table cellspacing="0" cellpadding="0" border="0" width="600" class="container" align="center">
            <tr><td>
              <table class="tb_properties border_style" style="background-color:#FFFFFF;" cellspacing="0" cellpadding="0" bgcolor="#ffffff" width="100%">
                <tr><td align="center" valign="top">
                  <table align="left" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr><td class="content_padding" style="">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">

                        <!-- MARCO + CONTENIDO -->
                        <tr><td>
                          <table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="border:1px solid #E4E4E4;background-color:#FFFFFF;min-width:100%;" class="slot-styling">
                            <tr><td class="camarker-inner" style="padding:0;">

                              <!-- LOGO SUPERIOR -->
                              <table cellpadding="0" cellspacing="0" width="100%" role="presentation" class="stylingblock-content-wrapper" style="background-color:transparent;min-width:100%;">
                                <tr>
                                  <td style="padding:20px 45px;">
                                    <table width="100%" role="presentation"><tr>
                                      <td align="right">
                                        <img src="${headerLogoUrl}" alt="Logo" height="40" width="201" style="display:block;height:40px;width:201px;text-align:right;padding:0;">
                                      </td>
                                    </tr></table>
                                  </td>
                                </tr>
                              </table>

                              <!-- HERO -->
                              <table cellpadding="0" cellspacing="0" width="100%" role="presentation" class="stylingblock-content-wrapper" style="min-width:100%;">
                                <tr>
                                  <td class="stylingblock-content-wrapper camarker-inner">
                                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation"><tr>
                                      <td align="center">
                                        <img src="${heroUrl}" alt="" width="714" style="display:block;padding:0;text-align:center;border:0;height:auto;width:100%;">
                                      </td>
                                    </tr></table>
                                  </td>
                                </tr>
                              </table>

                              <!-- TITULO + BAJADA -->
                              <table cellpadding="0" cellspacing="0" width="100%" role="presentation" class="stylingblock-content-wrapper" style="background-color:transparent;min-width:100%;">
                                <tr>
                                  <td style="padding:20px 45px;">
                                    <h1 style="margin:0 0 8px 0; font-size:22px; line-height:28px; color:${BRAND.title}; font-weight:bold; font-family:${BRAND.fontStack};">
                                      ${title}
                                    </h1>
                                    <p style="margin:0; font-size:16px; line-height:22px; color:${BRAND.body}; font-family:${BRAND.fontStack};">
                                      ${subtitle ?? ""}
                                    </p>
                                  </td>
                                </tr>
                              </table>

                              <!-- CUERPO -->
                              <table cellpadding="0" cellspacing="0" width="100%" role="presentation" class="stylingblock-content-wrapper" style="background-color:transparent;min-width:100%;">
                                <tr>
                                  <td style="padding:20px 45px;">
                                    <div style="line-height:150%; font-size:15px; font-family:${BRAND.fontStack}; color:${BRAND.body};">
                                      ${bodyHtml}
                                    </div>
                                  </td>
                                </tr>
                              </table>

                              <!-- LOGO INFERIOR -->
                              <table cellpadding="0" cellspacing="0" width="100%" role="presentation" class="stylingblock-content-wrapper" style="background-color:transparent;min-width:100%;">
                                <tr>
                                  <td style="padding:20px 45px;">
                                    <table width="100%"><tr>
                                      <td align="right">
                                        <img src="${footerLogoUrl}" alt="Logo" height="40" width="201" style="display:block;height:40px;width:201px;text-align:right;padding:0;">
                                      </td>
                                    </tr></table>
                                  </td>
                                </tr>
                              </table>

                              <!-- LEGAL + CAN-SPAM -->
                              <table cellpadding="0" cellspacing="0" width="100%" role="presentation" class="stylingblock-content-wrapper" style="min-width:100%;">
                                <tr>
                                  <td class="stylingblock-content-margin-cell" style="padding:10px 0px 0px;">
                                    <table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:#FFFFFF;min-width:100%;">
                                      <tr>
                                        <td style="padding:10px 45px 40px;">
                                          <hr style="border:none;border-top:1px solid #E4E4E4;margin:0 0 16px 0;">
                                          <div style="font-family:${BRAND.fontStack}; color:${BRAND.legal}; font-size:14px; text-align:justify;">
                                            ${legalDisclaimerHtml}
                                          </div>
                                          <div style="margin-top:10px;">
                                            ${canSpamHtml}
                                          </div>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                </tr>
                              </table>

                            </td></tr>
                          </table>
                        </td></tr>

                      </table>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td>
      </tr>
      <tr><td valign="top"><custom type="footer" /></td></tr>
    </table>
    <custom name="opencounter" type="tracking" />
  </body>
</html>`;
}

/* ========= Preview simple (sin SFMC), con la misma tipografía/colores ========= */
export function renderEmailHTML(args: {
  subject: string;
  preheader: string;
  title: string;
  subtitle?: string | null;
  body: string;
  heroUrl: string;
  headerLogoUrl?: string;
  footerLogoUrl?: string;
  showBrandHeader?: boolean;
  baseUrl?: string;
  heroAlt?: string;
}) {
  const {
    subject, preheader, title, subtitle = null, body, heroUrl,
    headerLogoUrl, footerLogoUrl, showBrandHeader = false, baseUrl = "", heroAlt = "",
  } = args;

  const absoluteHero = resolveHeroSrc(heroUrl, baseUrl);
  const { html: bodyHtml } = linesToHtml(body);

  const hiddenPre = preheader
    ? `<span style="display:none !important; color:transparent; opacity:0; visibility:hidden; height:0; width:0; overflow:hidden;">${escapeHtml(preheader)}</span>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(subject)}</title>
  <style>
    @media screen and (max-width:600px){
      .container{ width:100% !important; }
      .hero img{ width:100% !important; height:auto !important; }
      .p-sm{ padding:16px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:#f4f6f8; font-family:${BRAND.fontStack}; color:${BRAND.body};">
  ${hiddenPre}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="background:#f4f6f8;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="640" style="width:640px; max-width:100%; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #eef2f7; box-shadow:0 18px 45px rgba(7,48,121,.12);">
          ${ showBrandHeader && headerLogoUrl ? `<tr><td style="padding:16px 20px;" align="right"><img src="${escapeHtml(headerLogoUrl)}" alt="Logo" height="36" style="display:block; height:36px; width:auto; border:0;"></td></tr>` : "" }
          <tr>
            <td class="p-sm" style="padding:26px 28px 8px;">
              <h1 style="margin:0; text-align:center; font-family:${BRAND.fontStack}; font-size:26px; line-height:1.25; color:${BRAND.title}; font-weight:700;">
                ${escapeHtml(title)}
              </h1>
              ${ subtitle ? `<p style="margin:10px 0 18px 0; text-align:center; font-family:${BRAND.fontStack}; font-size:18px; line-height:1.45; color:${BRAND.body}; font-weight:700;">${escapeHtml(subtitle)}</p>` : "" }
            </td>
          </tr>
          ${ absoluteHero ? `<tr><td style="padding:0 24px 6px;"><img src="${absoluteHero}" alt="${escapeHtml(heroAlt)}" style="display:block; margin:0 auto; width:90%; max-width:560px; height:auto; border:0; border-radius:16px; background:transparent;"></td></tr>` : "" }
          <tr>
            <td class="p-sm" style="padding:14px 28px 24px;">
              <div style="font-family:${BRAND.fontStack}; font-size:15px; line-height:1.65; color:${BRAND.body};">${bodyHtml}</div>
              <div style="margin-top:20px; border-top:1px solid #E4E4E4; padding-top:12px;">
                <p style="margin:0; font-family:${BRAND.fontStack}; font-size:12px; color:${BRAND.legal};">
                  Este correo es informativo. Sujeto a evaluación y condiciones referenciales.
                </p>
              </div>
            </td>
          </tr>
          ${ footerLogoUrl ? `<tr><td align="right" style="padding:10px 20px 18px;"><img src="${escapeHtml(footerLogoUrl)}" alt="Logo" height="30" style="display:block; height:30px; width:auto; border:0;"></td></tr>` : "" }
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ===================== Helpers & exports ===================== */
export function isBiceTemplate(html?: string): boolean {
  return !!html && html.includes(EMAIL_STUDIO_TEMPLATE_MARK);
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveHeroSrc(heroUrl: string, baseUrl?: string) {
  const u = String(heroUrl || "").trim();
  if (!u) return "";
  if (/^(https?:)?\/\//i.test(u) || /^data:/i.test(u)) return u;
  const base = String(baseUrl || "").trim();
  if (!base) return `/${u.replace(/^\/+/, "")}`;
  const cleanBase = base.replace(/\/+$/, "");
  const cleanPath = u.replace(/^\/+/, "");
  return `${cleanBase}/${cleanPath}`;
}

/** Convierte texto plano en HTML: párrafos y listas con "- " agrupadas en <ul>, con color corporativo del body. */
function linesToHtml(input: string): { html: string } {
  const lines = String(input || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (list.length) {
      out.push(`<ul style="margin:0 0 12px 18px; padding:0; font-family:${BRAND.fontStack}; color:${BRAND.body};">${list.join("")}</ul>`);
      list = [];
    }
  };

  for (const l of lines) {
    if (/^-\s+/.test(l)) {
      const text = l.replace(/^-\s+/, "");
      list.push(
        `<li style="margin:0 0 6px 0; padding:0; line-height:1.6; font-size:15px; color:${BRAND.body}; font-family:${BRAND.fontStack};">${escapeHtml(text)}</li>`
      );
    } else {
      flushList();
      out.push(
        `<p style="margin:0 0 12px 0; line-height:1.6; font-size:15px; color:${BRAND.body}; font-family:${BRAND.fontStack};">${escapeHtml(l)}</p>`
      );
    }
  }
  flushList();

  return { html: out.join("") };
}
