// ============================================================
//  FutBuddies - Avaliações de Campos (rating + reporte)
// ============================================================
const { query } = require('../config/database');
const { criarNotificacao } = require('./notificacoesController');

// POST /api/jogos/:jogoId/avaliar-campo  { rating, comentario?, reportar?, motivoReport? }
async function submeter(req, res) {
  try {
    const jogoId = parseInt(req.params.jogoId);
    const uid = req.utilizador.id;
    const { rating, comentario, reportar, motivoReport } = req.body || {};

    const r = parseInt(rating);
    if (Number.isNaN(r) || r < 1 || r > 5)
      return res.status(400).json({ sucesso: false, mensagem: 'Rating tem de ser entre 1 e 5.' });

    // Confirmar que é um jogo com campo e que o user participou
    const jR = await query(
      `SELECT j.campo_id, j.data_jogo, c.nome AS campo_nome
         FROM jogos j
    LEFT JOIN campos c ON c.id = j.campo_id
        WHERE j.id = @id`,
      { id: jogoId }
    );
    if (!jR.recordset.length || !jR.recordset[0].campo_id)
      return res.status(400).json({ sucesso: false, mensagem: 'Jogo não tem campo reservado.' });
    const { campo_id, campo_nome } = jR.recordset[0];

    const inscR = await query(
      `SELECT id FROM inscricoes
         WHERE jogo_id = @jid AND utilizador_id = @uid AND estado = 'confirmado'`,
      { jid: jogoId, uid }
    );
    const inscEq = await query(
      `SELECT ie.id FROM inscricoes_equipa ie
         JOIN equipa_membros em ON em.equipa_id = ie.equipa_id
        WHERE ie.jogo_id = @jid AND em.utilizador_id = @uid AND ie.estado = 'confirmado'`,
      { jid: jogoId, uid }
    );
    if (inscR.recordset.length === 0 && inscEq.recordset.length === 0)
      return res.status(403).json({ sucesso: false, mensagem: 'Só participantes podem avaliar.' });

    // Upsert
    const existe = await query(
      `SELECT id FROM avaliacoes_campo WHERE jogo_id=@jid AND utilizador_id=@uid`,
      { jid: jogoId, uid }
    );
    if (existe.recordset.length) {
      await query(
        `UPDATE avaliacoes_campo
            SET rating=@r, comentario=@c, reportar=@rep, motivo_report=@mr
          WHERE id=@id`,
        { id: existe.recordset[0].id, r, c: comentario || null,
          rep: reportar ? 1 : 0, mr: reportar ? (motivoReport || null) : null }
      );
    } else {
      await query(
        `INSERT INTO avaliacoes_campo (campo_id, jogo_id, utilizador_id, rating, comentario, reportar, motivo_report)
         VALUES (@cid,@jid,@uid,@r,@c,@rep,@mr)`,
        { cid: campo_id, jid: jogoId, uid, r,
          c: comentario || null, rep: reportar ? 1 : 0, mr: reportar ? (motivoReport || null) : null }
      );
    }

    // Se o user reportou, avisar admins
    if (reportar) {
      try {
        const adm = await query(`SELECT id FROM utilizadores WHERE role='admin' AND ativo=1`);
        for (const a of adm.recordset) {
          await criarNotificacao({
            utilizadorId: a.id,
            tipo: 'sistema',
            titulo: `Reporte de campo: ${campo_nome || 'campo'}`,
            mensagem: (motivoReport || 'Um utilizador reportou este campo.').slice(0, 240),
            acaoUrl: '/admin?tab=candidaturas',
          });
        }
      } catch {}
    }

    res.json({ sucesso: true });
  } catch (err) {
    console.error('[AvaliacoesCampo] submeter:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// GET /api/campos/:id/avaliacoes  → lista + média
async function listarPorCampo(req, res) {
  try {
    const id = parseInt(req.params.id);
    const listaR = await query(
      `SELECT a.id, a.rating, a.comentario, a.reportar, a.created_at,
              u.nome AS utilizador_nome, u.foto_url AS utilizador_foto
         FROM avaliacoes_campo a
         JOIN utilizadores u ON u.id = a.utilizador_id
        WHERE a.campo_id = @id
     ORDER BY a.created_at DESC`,
      { id }
    );
    const media = listaR.recordset.length
      ? (listaR.recordset.reduce((s, a) => s + a.rating, 0) / listaR.recordset.length)
      : null;
    res.json({ sucesso: true, media, total: listaR.recordset.length, avaliacoes: listaR.recordset });
  } catch (err) {
    console.error('[AvaliacoesCampo] listar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

module.exports = { submeter, listarPorCampo };
