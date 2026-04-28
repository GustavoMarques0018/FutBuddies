// ============================================================
//  FutBuddies - Controlador de Suporte (inbox admin)
// ============================================================

const { query } = require('../config/database');
const { criarNotificacao } = require('./notificacoesController');

// POST /api/suporte/mensagens  (auth opcional)
async function submeter(req, res) {
  try {
    const { assunto, mensagem, nome, email } = req.body || {};
    if (!assunto || !mensagem) {
      return res.status(400).json({ sucesso: false, mensagem: 'Assunto e mensagem são obrigatórios.' });
    }
    const uid = req.utilizador?.id || null;
    const r = await query(
      `INSERT INTO suporte_mensagens (utilizador_id, nome, email, assunto, mensagem)
       OUTPUT INSERTED.id
       VALUES (@uid, @nome, @email, @assunto, @mensagem)`,
      {
        uid,
        nome: (nome || req.utilizador?.nome || null),
        email: (email || req.utilizador?.email || null),
        assunto: assunto.slice(0, 200),
        mensagem: String(mensagem).slice(0, 5000),
      }
    );
    const msgId = r.recordset[0].id;

    // Notificar todos os admins
    try {
      const admins = await query(`SELECT id FROM utilizadores WHERE role = 'admin' AND ativo = 1`);
      for (const a of admins.recordset) {
        await criarNotificacao({
          utilizadorId: a.id,
          tipo: 'suporte_admin',
          titulo: `💬 Nova mensagem de suporte: ${assunto.slice(0, 80)}`,
          mensagem: String(mensagem).slice(0, 200),
          acaoUrl: `/admin?tab=suporte&msg=${msgId}`,
        });
      }
    } catch (e) { console.warn('[Suporte] notif admin falhou:', e?.message); }

    res.status(201).json({ sucesso: true, id: msgId });
  } catch (err) {
    console.error('[Suporte] submeter erro:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao enviar.' });
  }
}

// GET /api/admin/suporte?estado=aberta
async function listarAdmin(req, res) {
  try {
    const { estado } = req.query;
    const estados = ['aberta', 'em_analise', 'resolvida', 'arquivada'];
    const where = (estado && estados.includes(estado)) ? 'WHERE s.estado = @estado' : '';
    const r = await query(
      `SELECT s.*, u.nome AS utilizador_nome, u.email AS utilizador_email, u.foto_url,
              admin.nome AS respondida_por_nome
         FROM suporte_mensagens s
         LEFT JOIN utilizadores u     ON u.id = s.utilizador_id
         LEFT JOIN utilizadores admin ON admin.id = s.respondida_por
         ${where}
         ORDER BY s.created_at DESC`,
      estado ? { estado } : {}
    );
    res.json({ sucesso: true, mensagens: r.recordset });
  } catch (err) {
    console.error('[Suporte] listarAdmin erro:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// PUT /api/admin/suporte/:id
// Body: { estado?, resposta? }
async function atualizarAdmin(req, res) {
  try {
    const { id } = req.params;
    const { estado, resposta } = req.body || {};
    const estadosValidos = ['aberta', 'em_analise', 'resolvida', 'arquivada'];
    if (estado && !estadosValidos.includes(estado)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Estado inválido.' });
    }
    const sets = ['updated_at = GETUTCDATE()'];
    const params = { id: parseInt(id) };
    if (estado) { sets.push('estado = @estado'); params.estado = estado; }
    if (resposta !== undefined) {
      sets.push('resposta_admin = @resposta');
      sets.push('respondida_por = @adm');
      sets.push('respondida_em  = GETUTCDATE()');
      params.resposta = resposta;
      params.adm = req.utilizador.id;
    }
    await query(`UPDATE suporte_mensagens SET ${sets.join(', ')} WHERE id = @id`, params);

    // Se respondeu, notificar o utilizador (quando identificado)
    if (resposta) {
      try {
        const msgR = await query(
          `SELECT utilizador_id, assunto FROM suporte_mensagens WHERE id = @id`,
          { id: parseInt(id) }
        );
        const m = msgR.recordset[0];
        if (m?.utilizador_id) {
          await criarNotificacao({
            utilizadorId: m.utilizador_id,
            tipo: 'sistema',
            titulo: `Resposta ao teu pedido de suporte`,
            mensagem: (resposta || '').slice(0, 200),
            acaoUrl: `/suporte`,
          });
        }
      } catch (notifErr) {
        console.warn('[Suporte] Aviso: falha ao notificar:', notifErr.message);
      }
    }

    res.json({ sucesso: true });
  } catch (err) {
    console.error('[Suporte] atualizar erro:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// GET /api/admin/suporte/stats
async function statsAdmin(req, res) {
  try {
    const r = await query(
      `SELECT estado, COUNT(*) AS total
         FROM suporte_mensagens
         GROUP BY estado`
    );
    const out = { aberta: 0, em_analise: 0, resolvida: 0, arquivada: 0 };
    for (const row of r.recordset) out[row.estado] = row.total;
    res.json({ sucesso: true, stats: out });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

module.exports = { submeter, listarAdmin, atualizarAdmin, statsAdmin };
