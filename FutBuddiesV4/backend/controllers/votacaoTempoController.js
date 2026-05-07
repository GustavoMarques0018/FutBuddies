// ============================================================
//  FutBuddies - Votação por Mau Tempo
// ============================================================

const { query } = require('../config/database');
const { criarNotificacao } = require('./notificacoesController');

// POST /api/jogos/:id/votacao-tempo/abrir
async function abrirVotacao(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const uid = req.utilizador.id;

    const jogoR = await query(`SELECT criador_id, estado FROM jogos WHERE id=@id`, { id: jogoId });
    if (!jogoR.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });

    const jogo = jogoR.recordset[0];
    if (jogo.criador_id !== uid)
      return res.status(403).json({ sucesso: false, mensagem: 'Só o criador pode abrir a votação.' });
    if (['cancelado', 'concluido'].includes(jogo.estado))
      return res.status(400).json({ sucesso: false, mensagem: 'Jogo já encerrado.' });

    await query(`UPDATE jogos SET votacao_tempo_aberta=1, updated_at=GETUTCDATE() WHERE id=@id`, { id: jogoId });
    res.json({ sucesso: true });
  } catch (err) {
    console.error('[VotacaoTempo] abrirVotacao:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/jogos/:id/votacao-tempo
async function votar(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const uid = req.utilizador.id;
    const { voto } = req.body;

    if (!['cancelar', 'jogar'].includes(voto))
      return res.status(400).json({ sucesso: false, mensagem: 'Voto inválido. Use "cancelar" ou "jogar".' });

    const jogoR = await query(
      `SELECT j.id, j.titulo, j.criador_id, j.estado, j.max_jogadores, j.votacao_tempo_aberta
       FROM jogos j WHERE j.id=@id`, { id: jogoId }
    );
    if (!jogoR.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });

    const jogo = jogoR.recordset[0];
    if (!jogo.votacao_tempo_aberta)
      return res.status(400).json({ sucesso: false, mensagem: 'Votação não está aberta.' });
    if (['cancelado', 'concluido'].includes(jogo.estado))
      return res.status(400).json({ sucesso: false, mensagem: 'Jogo já encerrado.' });

    // Verificar se é inscrito ou criador
    const isCriador = jogo.criador_id === uid;
    if (!isCriador) {
      const insc = await query(
        `SELECT id FROM inscricoes WHERE jogo_id=@jid AND utilizador_id=@uid AND estado='confirmado'`,
        { jid: jogoId, uid }
      );
      if (!insc.recordset.length)
        return res.status(403).json({ sucesso: false, mensagem: 'Só participantes podem votar.' });
    }

    // Upsert vote
    await query(
      `IF EXISTS (SELECT 1 FROM votacoes_tempo WHERE jogo_id=@jid AND utilizador_id=@uid)
         UPDATE votacoes_tempo SET voto=@voto WHERE jogo_id=@jid AND utilizador_id=@uid
       ELSE
         INSERT INTO votacoes_tempo (jogo_id, utilizador_id, voto) VALUES (@jid, @uid, @voto)`,
      { jid: jogoId, uid, voto }
    );

    // Check majority: >50% of confirmados voted 'cancelar'
    const totalInscR = await query(
      `SELECT COUNT(*) AS t FROM inscricoes WHERE jogo_id=@jid AND estado='confirmado'`, { jid: jogoId }
    );
    const totalInscritos = totalInscR.recordset[0].t;

    const cancelarR = await query(
      `SELECT COUNT(*) AS t FROM votacoes_tempo WHERE jogo_id=@jid AND voto='cancelar'`, { jid: jogoId }
    );
    const votosCancelar = cancelarR.recordset[0].t;

    if (totalInscritos > 0 && votosCancelar > totalInscritos / 2) {
      // Auto-cancel
      await query(
        `UPDATE jogos SET estado='cancelado', updated_at=GETUTCDATE() WHERE id=@jid AND estado NOT IN ('cancelado','concluido')`,
        { jid: jogoId }
      );
      const inscritos = await query(
        `SELECT utilizador_id FROM inscricoes WHERE jogo_id=@jid AND estado='confirmado'`, { jid: jogoId }
      );
      for (const i of inscritos.recordset) {
        try {
          await criarNotificacao({
            utilizadorId: i.utilizador_id,
            tipo: 'cancelamento',
            titulo: '☔ Jogo cancelado por mau tempo',
            mensagem: `O jogo "${jogo.titulo}" foi cancelado pela maioria dos participantes devido ao mau tempo.`,
            jogoId,
            acaoUrl: `/jogos/${jogoId}`,
          });
        } catch {}
      }
      return res.json({ sucesso: true, cancelado: true });
    }

    res.json({ sucesso: true, cancelado: false });
  } catch (err) {
    console.error('[VotacaoTempo] votar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/jogos/:id/votacao-tempo
async function getVotacao(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const uid = req.utilizador.id;

    const votos = await query(
      `SELECT voto, COUNT(*) AS total FROM votacoes_tempo WHERE jogo_id=@jid GROUP BY voto`, { jid: jogoId }
    );

    const meuVotoR = await query(
      `SELECT voto FROM votacoes_tempo WHERE jogo_id=@jid AND utilizador_id=@uid`,
      { jid: jogoId, uid }
    );

    const resumo = { cancelar: 0, jogar: 0 };
    for (const r of votos.recordset) resumo[r.voto] = r.total;

    res.json({ sucesso: true, votos: resumo, meuVoto: meuVotoR.recordset[0]?.voto || null });
  } catch (err) {
    console.error('[VotacaoTempo] getVotacao:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

module.exports = { abrirVotacao, votar, getVotacao };
