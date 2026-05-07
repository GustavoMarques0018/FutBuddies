// ============================================================
//  FutBuddies - Galeria de Fotos do Jogo
// ============================================================

const { query } = require('../config/database');

// GET /api/jogos/:id/fotos
async function getFotos(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const fotos = await query(
      `SELECT f.id, f.url, f.created_at,
              u.id AS utilizador_id, u.nome, u.nickname, u.foto_url AS utilizador_foto
       FROM fotos_jogo f
       JOIN utilizadores u ON u.id = f.utilizador_id
       WHERE f.jogo_id = @jogoId
       ORDER BY f.created_at DESC`,
      { jogoId }
    );
    res.json({ sucesso: true, fotos: fotos.recordset });
  } catch (err) {
    console.error('[FotosJogo] getFotos:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/jogos/:id/fotos
async function adicionarFoto(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const uid = req.utilizador.id;
    const { url } = req.body;

    if (!url) return res.status(400).json({ sucesso: false, mensagem: 'URL da foto é obrigatório.' });

    // Verificar se é inscrito ou criador
    const jogoR = await query(`SELECT criador_id FROM jogos WHERE id=@id`, { id: jogoId });
    if (!jogoR.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });
    const isCriador = jogoR.recordset[0].criador_id === uid;

    if (!isCriador) {
      const insc = await query(
        `SELECT id FROM inscricoes WHERE jogo_id=@jid AND utilizador_id=@uid AND estado='confirmado'`,
        { jid: jogoId, uid }
      );
      if (!insc.recordset.length)
        return res.status(403).json({ sucesso: false, mensagem: 'Só participantes podem adicionar fotos.' });
    }

    // Limite de 20 fotos por jogo
    const count = await query(
      `SELECT COUNT(*) AS total FROM fotos_jogo WHERE jogo_id=@jogoId`,
      { jogoId }
    );
    if (count.recordset[0].total >= 20)
      return res.status(400).json({ sucesso: false, mensagem: 'Limite de 20 fotos por jogo atingido.' });

    const r = await query(
      `INSERT INTO fotos_jogo (jogo_id, utilizador_id, url) OUTPUT INSERTED.id VALUES (@jogoId, @uid, @url)`,
      { jogoId, uid, url }
    );
    res.status(201).json({ sucesso: true, id: r.recordset[0].id });
  } catch (err) {
    console.error('[FotosJogo] adicionarFoto:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// DELETE /api/jogos/:jogoId/fotos/:fotoId
async function eliminarFoto(req, res) {
  try {
    const jogoId = parseInt(req.params.jogoId);
    const fotoId = parseInt(req.params.fotoId);
    const uid = req.utilizador.id;

    const fotoR = await query(
      `SELECT f.utilizador_id, j.criador_id
       FROM fotos_jogo f JOIN jogos j ON j.id = f.jogo_id
       WHERE f.id=@fotoId AND f.jogo_id=@jogoId`,
      { fotoId, jogoId }
    );
    if (!fotoR.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Foto não encontrada.' });

    const foto = fotoR.recordset[0];
    if (foto.utilizador_id !== uid && foto.criador_id !== uid)
      return res.status(403).json({ sucesso: false, mensagem: 'Sem permissão para eliminar esta foto.' });

    await query(`DELETE FROM fotos_jogo WHERE id=@id`, { id: fotoId });
    res.json({ sucesso: true });
  } catch (err) {
    console.error('[FotosJogo] eliminarFoto:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

module.exports = { getFotos, adicionarFoto, eliminarFoto };
