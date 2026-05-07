// ============================================================
//  FutBuddies - Avaliação do Piso do Campo
// ============================================================
const { query } = require('../config/database');

// POST /api/jogos/:jogoId/avaliar-piso
async function submeterPiso(req, res) {
  try {
    const jogoId = parseInt(req.params.jogoId);
    const uid    = req.utilizador.id;
    const { nota, comentario } = req.body;

    if (!nota || nota < 1 || nota > 5)
      return res.status(400).json({ sucesso: false, mensagem: 'Nota entre 1 e 5 obrigatória.' });

    // Verificar participação e obter campo_id
    const jogoR = await query(
      `SELECT j.campo_id FROM jogos j
       LEFT JOIN inscricoes i ON i.jogo_id = j.id AND i.utilizador_id = @uid AND i.estado = 'confirmado'
       WHERE j.id = @jid AND j.campo_id IS NOT NULL
         AND (j.criador_id = @uid OR i.id IS NOT NULL)`,
      { jid: jogoId, uid }
    );
    if (!jogoR.recordset.length)
      return res.status(403).json({ sucesso: false, mensagem: 'Só participantes de jogos em campo parceiro podem avaliar o piso.' });

    const campoId = jogoR.recordset[0].campo_id;

    // Upsert
    const existe = await query(
      `SELECT id FROM avaliacoes_campo_piso WHERE campo_id=@cid AND utilizador_id=@uid AND jogo_id=@jid`,
      { cid: campoId, uid, jid: jogoId }
    );

    if (existe.recordset.length) {
      await query(
        `UPDATE avaliacoes_campo_piso SET nota=@nota, comentario=@com
         WHERE campo_id=@cid AND utilizador_id=@uid AND jogo_id=@jid`,
        { nota: parseInt(nota), com: comentario || null, cid: campoId, uid, jid: jogoId }
      );
    } else {
      await query(
        `INSERT INTO avaliacoes_campo_piso (campo_id, utilizador_id, jogo_id, nota, comentario)
         VALUES (@cid, @uid, @jid, @nota, @com)`,
        { cid: campoId, uid, jid: jogoId, nota: parseInt(nota), com: comentario || null }
      );
    }

    res.json({ sucesso: true, mensagem: 'Avaliação registada!' });
  } catch (err) {
    console.error('[AvalPiso] submeter:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/campos/:id/avaliacoes-piso
async function listarPiso(req, res) {
  try {
    const campoId = parseInt(req.params.id);

    const r = await query(
      `SELECT
         COUNT(*)               AS total,
         AVG(CAST(nota AS FLOAT)) AS media,
         SUM(CASE WHEN nota=5 THEN 1 ELSE 0 END) AS n5,
         SUM(CASE WHEN nota=4 THEN 1 ELSE 0 END) AS n4,
         SUM(CASE WHEN nota=3 THEN 1 ELSE 0 END) AS n3,
         SUM(CASE WHEN nota=2 THEN 1 ELSE 0 END) AS n2,
         SUM(CASE WHEN nota=1 THEN 1 ELSE 0 END) AS n1
       FROM avaliacoes_campo_piso WHERE campo_id = @cid`,
      { cid: campoId }
    );

    const recentes = await query(
      `SELECT TOP 5 acp.nota, acp.comentario, acp.created_at,
              u.nome, u.nickname, u.foto_url
       FROM avaliacoes_campo_piso acp
       JOIN utilizadores u ON u.id = acp.utilizador_id
       WHERE acp.campo_id = @cid AND acp.comentario IS NOT NULL
       ORDER BY acp.created_at DESC`,
      { cid: campoId }
    );

    const stats = r.recordset[0];
    res.json({
      sucesso: true,
      media: stats.media ? Math.round(stats.media * 10) / 10 : null,
      total: stats.total,
      distribuicao: { 5: stats.n5, 4: stats.n4, 3: stats.n3, 2: stats.n2, 1: stats.n1 },
      recentes: recentes.recordset,
    });
  } catch (err) {
    console.error('[AvalPiso] listar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

module.exports = { submeterPiso, listarPiso };
