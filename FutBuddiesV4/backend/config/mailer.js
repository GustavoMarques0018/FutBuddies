// ============================================================
//  FutBuddies - Mailer (Nodemailer + SMTP)
//  Envia emails de forma assíncrona (best-effort, nunca bloqueia
//  a resposta HTTP). Se SMTP_HOST não estiver definido, fica
//  inativo silenciosamente — apps continuam a funcionar.
//
//  Variáveis de ambiente:
//    SMTP_HOST     ex.: smtp.gmail.com
//    SMTP_PORT     ex.: 587
//    SMTP_SECURE   'true' para porta 465; default false
//    SMTP_USER     conta de envio
//    SMTP_PASS     password (Gmail: usar App Password)
//    SMTP_FROM     ex.: 'FutBuddies <no-reply@futbuddies.pt>'
//    APP_BASE_URL  ex.: https://futbuddies.vercel.app  (para CTAs)
// ============================================================

const nodemailer = require('nodemailer');

let transporter = null;
let mailerPronto = false;

function _init() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('ℹ️  Mailer inativo — falta SMTP_HOST/USER/PASS no .env.');
    return;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  mailerPronto = true;
  console.log(`✅ Mailer configurado · ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}`);
}
_init();

/**
 * Envia um email. Não bloqueia a resposta HTTP — qualquer erro é loggado.
 * @param {Object} opts
 *  - to: string (email destinatário)
 *  - subject: string
 *  - text: string (versão plain-text)
 *  - html: string (versão HTML, opcional)
 */
async function enviarEmail({ to, subject, text, html }) {
  if (!mailerPronto) return { enviado: false, motivo: 'mailer_inativo' };
  if (!to || !subject) return { enviado: false, motivo: 'missing_fields' };
  try {
    const from = process.env.SMTP_FROM || `FutBuddies <${process.env.SMTP_USER}>`;
    const info = await transporter.sendMail({ from, to, subject, text, html: html || undefined });
    return { enviado: true, id: info.messageId };
  } catch (err) {
    console.error('[Mailer] Falha:', err.message);
    return { enviado: false, motivo: err.message };
  }
}

/**
 * Template HTML mínimo, dark-friendly. Recebe título + corpo + CTA opcional.
 */
function gerarHtml({ titulo, corpo, ctaLabel, ctaUrl }) {
  const appUrl = process.env.APP_BASE_URL || 'https://futbuddies.vercel.app';
  const cta = ctaUrl
    ? `<a href="${ctaUrl}" style="display:inline-block;background:#39FF14;color:#0a0a0a;font-weight:700;padding:0.85rem 1.5rem;border-radius:10px;text-decoration:none;">${ctaLabel || 'Abrir FutBuddies'}</a>`
    : '';
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(titulo)}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;color:#f5f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;padding:2rem 1rem;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#131316;border:1px solid #1f1f24;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:1.25rem 1.5rem;border-bottom:1px solid #1f1f24;background:linear-gradient(135deg, rgba(57,255,20,0.10), transparent 70%);">
          <p style="margin:0;font-size:1.25rem;font-weight:800;letter-spacing:-0.02em;">
            <span style="color:#fff;">Fut</span><span style="color:#39FF14;">Buddies</span>
          </p>
        </td></tr>
        <tr><td style="padding:1.5rem 1.5rem 0.75rem;">
          <h2 style="margin:0 0 0.75rem;font-size:1.25rem;color:#f5f5f7;line-height:1.3;">${escapeHtml(titulo)}</h2>
          <div style="color:#b3b3ba;line-height:1.55;font-size:0.95rem;">${corpo}</div>
        </td></tr>
        ${cta ? `<tr><td style="padding:0.5rem 1.5rem 1.5rem;">${cta}</td></tr>` : ''}
        <tr><td style="padding:1rem 1.5rem;border-top:1px solid #1f1f24;background:#0c0c0e;">
          <p style="margin:0;font-size:0.75rem;color:#6b6b75;line-height:1.5;">
            Recebeste este email porque tens uma conta no FutBuddies.<br>
            Para gerir as tuas notificações, vai a
            <a href="${appUrl}/perfil" style="color:#39FF14;text-decoration:none;">o teu perfil</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function ativo() { return mailerPronto; }

module.exports = { enviarEmail, gerarHtml, ativo };
