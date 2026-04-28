// ============================================================
//  FutBuddies - MVP do jogo (votação anónima pós-jogo)
// ============================================================
const { query } = require('../config/database');

// Lista de candidatos (participantes confirmados do jogo) + info da votação
async function getVotacao(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const uid = req.utilizador.id;

    // Participantes confirmados (individual + equipa)
    const parts = await query(
      `SELECT DISTINCT u.id, u.nome, u.foto_url, u.nickname
         FROM (
            SELECT utilizador_id AS uid FROM inscricoes WHERE jogo_id=@jid AND estado='confirmado'
            UNION
            SELECT em.utilizador_id FROM inscricoes_equipa ie
              JOIN equipa_membros em ON em.equipa_id = ie.equipa_id
             WHERE ie.jogo_id=@jid AND ie.estado='confirmado'
         ) p
         JOIN utilizadores u ON u.id = p.uid`,
      { jid: jogoId }
    );

    // Já votou?
    const meuVoto = await query(
      `SELECT votado_id FROM mvp_votos WHERE jogo_id=@jid AND votante_id=@uid`,
      { jid: jogoId, uid }
    );

    // Contagem agregada (para revelar só após fim da votação — 48h após jogo)
    const jg = await query(
      `SELECT data_jogo FROM jogos WHERE id=@jid`,
      { jid: jogoId }
    );
    const votacaoFechada = jg.recordset[0]
      ? new Date(jg.recordset[0].data_jogo).getTime() + 48 * 60 * 60 * 1000 < Date.now()
      : false;

    let resultado = null;
    if (votacaoFechada) {
      const cnt = await query(
        `SELECT TOP 1 votado_id, COUNT(*) AS votos
           FROM mvp_votos WHERE jogo_id=@jid
          GROUP BY votado_id ORDER BY votos DESC`,
        { jid: jogoId }
      );
      if (cnt.recordset.length) {
        const mvp = await query(
          `SELECT id, nome, foto_url, nickname FROM utilizadores WHERE id=@id`,
          { id: cnt.recordset[0].votado_id }
        );
        resultado = { ...mvp.recordset[0], votos: cnt.recordset[0].votos };
      }
    }

    res.json({
      sucesso: true,
      candidatos: parts.recordset,
      meuVoto: meuVoto.recordset[0]?.votado_id || null,
      votacaoFechada,
      mvp: resultado,
    });
  } catch (err) {
    console.error('[MVP] getVotacao:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// POST /api/jogos/:id/mvp  { votadoId }
async function votar(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const uid = req.utilizador.id;
    const votadoId = parseInt(req.body.votadoId);
    if (!votadoId) return res.status(400).json({ sucesso: false, mensagem: 'Escolhe um jogador.' });
    if (votadoId === uid) return res.status(400).json({ sucesso: false, mensagem: 'Não podes votar em ti.' });

    // Confirmar que ambos participaram
    const ok = await query(
      `SELECT 1 AS ok WHERE EXISTS (
         SELECT 1 FROM inscricoes WHERE jogo_id=@jid AND utilizador_id=@uid AND estado='confirmado'
         UNION
         SELECT 1 FROM inscricoes_equipa ie JOIN equipa_membros em ON em.equipa_id=ie.equipa_id
          WHERE ie.jogo_id=@jid AND em.utilizador_id=@uid AND ie.estado='confirmado'
       )`,
      { jid: jogoId, uid }
    );
    if (!ok.recordset.length)
      return res.status(403).json({ sucesso: false, mensagem: 'Só participantes podem votar.' });

    // Janela: só entre fim do jogo e 48h depois
    const jg = await query(`SELECT data_jogo FROM jogos WHERE id=@jid`, { jid: jogoId });
    if (!jg.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });
    const fim = new Date(jg.recordset[0].data_jogo).getTime() + 60 * 60 * 1000; // +1h
    const limite = fim + 47 * 60 * 60 * 1000; // +48h no total
    const agora = Date.now();
    if (agora < fim) return res.status(400).json({ sucesso: false, mensagem: 'Votação abre após o jogo.' });
    if (agora > limite) return res.status(400).json({ sucesso: false, mensagem: 'Votação encerrada.' });

    // Upsert
    await query(
      `IF EXISTS (SELECT 1 FROM mvp_votos WHERE jogo_id=@jid AND votante_id=@uid)
         UPDATE mvp_votos SET votado_id=@v WHERE jogo_id=@jid AND votante_id=@uid;
       ELSE
         INSERT INTO mvp_votos (jogo_id, votante_id, votado_id) VALUES (@jid, @uid, @v);`,
      { jid: jogoId, uid, v: votadoId }
    );

    res.json({ sucesso: true });
  } catch (err) {
    console.error('[MVP] votar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

module.exports = { getVotacao, votar };
