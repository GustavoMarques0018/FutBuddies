// ============================================================
//  FutBuddies - Geração de recibos PDF + envio por email
//  Dependências opcionais: pdfkit, nodemailer
//  Config via env:
//    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//    (se ausente, gera PDF mas não envia)
// ============================================================

const fs = require('fs');
const path = require('path');

let PDFDocument = null;
let nodemailer = null;
try { PDFDocument = require('pdfkit'); } catch {}
try { nodemailer = require('nodemailer'); } catch {}

const OUT_DIR = path.join(__dirname, '..', 'uploads', 'recibos');
try { fs.mkdirSync(OUT_DIR, { recursive: true }); } catch {}

function fmtEuro(c) { return ((c || 0) / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }); }

/**
 * Gera PDF e devolve o caminho absoluto.
 * data = { numero, data, pagador:{nome,email}, jogo:{titulo,data_jogo,local}, valor_cents, application_fee_cents }
 */
async function gerarReciboPDF(data) {
  if (!PDFDocument) throw new Error('pdfkit não instalado. Executa `npm i pdfkit`.');
  return new Promise((resolve, reject) => {
    try {
      const filePath = path.join(OUT_DIR, `recibo-${data.numero || Date.now()}.pdf`);
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Cabeçalho
      doc.fontSize(22).fillColor('#39ff14').text('FutBuddies', { align: 'left' });
      doc.fontSize(10).fillColor('#888').text('Recibo de inscrição em jogo', { align: 'left' });
      doc.moveDown();

      // Meta
      doc.fillColor('#000').fontSize(11);
      doc.text(`Recibo nº: ${data.numero}`);
      doc.text(`Data: ${new Date(data.data || Date.now()).toLocaleString('pt-PT')}`);
      doc.moveDown();

      // Pagador
      doc.fontSize(12).fillColor('#555').text('Pagador', { underline: true });
      doc.fillColor('#000').fontSize(11);
      doc.text(`${data.pagador?.nome || '—'}`);
      if (data.pagador?.email) doc.text(data.pagador.email);
      doc.moveDown();

      // Jogo
      doc.fontSize(12).fillColor('#555').text('Detalhes do Jogo', { underline: true });
      doc.fillColor('#000').fontSize(11);
      doc.text(`Jogo: ${data.jogo?.titulo || '—'}`);
      if (data.jogo?.data_jogo) doc.text(`Data do jogo: ${new Date(data.jogo.data_jogo).toLocaleString('pt-PT')}`);
      if (data.jogo?.local)     doc.text(`Local: ${data.jogo.local}`);
      doc.moveDown();

      // Valores
      doc.fontSize(12).fillColor('#555').text('Valores', { underline: true });
      doc.fillColor('#000').fontSize(11);
      doc.text(`Valor pago: ${fmtEuro(data.valor_cents)}`);
      if (data.application_fee_cents != null) {
        doc.fillColor('#888').fontSize(9)
           .text(`(inclui taxa de serviço FutBuddies: ${fmtEuro(data.application_fee_cents)})`);
      }
      doc.moveDown(2);

      // Rodapé
      doc.fontSize(9).fillColor('#888').text(
        'Este documento serve como comprovativo de pagamento. Para questões, contacta suporte@futbuddies.pt.',
        { align: 'center' }
      );

      doc.end();
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    } catch (err) { reject(err); }
  });
}

// Transportador cached
let _transporter = null;
function getTransporter() {
  if (!nodemailer) return null;
  if (_transporter) return _transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;
  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587'),
    secure: parseInt(SMTP_PORT || '587') === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return _transporter;
}

/**
 * Gera recibo e envia por email. Silencioso em caso de falta de SMTP/deps.
 * Devolve { enviado, pdfPath, erro? }
 */
async function enviarReciboPorEmail(data) {
  try {
    if (!PDFDocument) return { enviado: false, erro: 'pdfkit em falta' };
    const pdfPath = await gerarReciboPDF(data);
    const tx = getTransporter();
    if (!tx || !data.pagador?.email) return { enviado: false, pdfPath, erro: 'SMTP/email não configurado' };
    await tx.sendMail({
      from: process.env.SMTP_FROM || 'FutBuddies <no-reply@futbuddies.pt>',
      to: data.pagador.email,
      subject: `Recibo FutBuddies — ${data.jogo?.titulo || 'Jogo'}`,
      text: `Olá ${data.pagador.nome || ''},\n\nObrigado pelo pagamento. Em anexo o recibo em PDF.\n\n— FutBuddies`,
      attachments: [{ filename: path.basename(pdfPath), path: pdfPath }],
    });
    return { enviado: true, pdfPath };
  } catch (err) {
    console.warn('[Recibo] envio falhou:', err.message);
    return { enviado: false, erro: err.message };
  }
}

module.exports = { gerarReciboPDF, enviarReciboPorEmail };
