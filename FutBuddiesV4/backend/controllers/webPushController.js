// ============================================================
//  FutBuddies - Web Push (opcional)
//  Requer dependência `web-push` e as variáveis de ambiente:
//    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:)
//  Sem essas variáveis, as rotas respondem 503 mas o app continua.
// ============================================================

const { query } = require('../config/database');

let webpush = null;
let vapidPronto = false;
try {
  webpush = require('web-push');
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT || 'mailto:suporte@futbuddies.pt';
  if (pub && priv) {
    webpush.setVapidDetails(sub, pub, priv);
    vapidPronto = true;
    console.log('✅ Web Push configurado (VAPID)');
  } else {
    console.warn('ℹ️  Web Push inativo — VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não definidos.');
  }
} catch (e) {
  console.warn('ℹ️  Web Push inativo — dependência `web-push` não instalada.');
}

// GET /api/push/vapid-public-key
function vapidKey(req, res) {
  if (!vapidPronto) return res.status(503).json({ sucesso: false, mensagem: 'Push desativado.' });
  res.json({ sucesso: true, key: process.env.VAPID_PUBLIC_KEY });
}

// POST /api/push/subscrever  { endpoint, keys:{p256dh, auth} }
async function subscrever(req, res) {
  try {
    if (!vapidPronto) return res.status(503).json({ sucesso: false, mensagem: 'Push desativado.' });
    const uid = req.utilizador.id;
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth)
      return res.status(400).json({ sucesso: false, mensagem: 'Subscrição inválida.' });

    await query(
      `IF EXISTS (SELECT 1 FROM push_subs WHERE endpoint=@ep)
         UPDATE push_subs SET utilizador_id=@uid, p256dh=@p, auth=@a, updated_at=GETUTCDATE() WHERE endpoint=@ep;
       ELSE
         INSERT INTO push_subs (utilizador_id, endpoint, p256dh, auth, created_at, updated_at)
         VALUES (@uid, @ep, @p, @a, GETUTCDATE(), GETUTCDATE());`,
      { uid, ep: endpoint, p: keys.p256dh, a: keys.auth }
    );
    res.json({ sucesso: true });
  } catch (err) {
    console.error('[Push] subscrever:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// POST /api/push/desinscrever  { endpoint }
async function desinscrever(req, res) {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ sucesso: false, mensagem: 'Endpoint obrigatório.' });
    await query(`DELETE FROM push_subs WHERE endpoint=@ep`, { ep: endpoint });
    res.json({ sucesso: true });
  } catch (err) {
    console.error('[Push] desinscrever:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// ── Helper interno — enviar push a um utilizador ─────────────
async function enviarPush(utilizadorId, { titulo, corpo, url = '/', icone = '/logo192.png' }) {
  if (!vapidPronto || !webpush) return { enviadas: 0 };
  try {
    const r = await query(
      `SELECT endpoint, p256dh, auth FROM push_subs WHERE utilizador_id=@uid`,
      { uid: utilizadorId }
    );
    let enviadas = 0;
    const payload = JSON.stringify({ titulo, corpo, url, icone });
    for (const s of r.recordset) {
      const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await webpush.sendNotification(sub, payload);
        enviadas++;
      } catch (err) {
        // 404/410 = subscrição expirada → apagar
        if (err.statusCode === 404 || err.statusCode === 410) {
          try { await query(`DELETE FROM push_subs WHERE endpoint=@ep`, { ep: s.endpoint }); } catch {}
        } else {
          console.warn('[Push] falha envio:', err.statusCode, err.body || err.message);
        }
      }
    }
    return { enviadas };
  } catch (err) {
    console.error('[Push] enviarPush:', err);
    return { enviadas: 0, erro: err.message };
  }
}

module.exports = { vapidKey, subscrever, desinscrever, enviarPush, vapidPronto };
