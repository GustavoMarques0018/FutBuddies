// ============================================================
//  FutBuddies - Sorteio balanceado de equipas
//  Usa total_golos + total_assistencias + total_mvp como "rating"
//  e distribui por greedy (snake draft) para balancear.
// ============================================================

const { query } = require('../config/database');

// GET /api/jogos/:id/sortear — só criador
async function sortear(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const uid = req.utilizador.id;

    const jR = await query(`SELECT criador_id, max_jogadores, modo_jogo FROM jogos WHERE id=@id`, { id: jogoId });
    if (!jR.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });
    if (jR.recordset[0].criador_id !== uid)
      return res.status(403).json({ sucesso: false, mensagem: 'Só o criador pode sortear.' });
    if (jR.recordset[0].modo_jogo === 'equipas')
      return res.status(400).json({ sucesso: false, mensagem: 'Este jogo já é por equipas.' });

    // Participantes confirmados + rating
    const pR = await query(
      `SELECT u.id, u.nome, u.foto_url, u.nickname,
              ISNULL(u.total_golos,0)*2 + ISNULL(u.total_assistencias,0) + ISNULL(u.total_mvp,0)*3 AS rating
         FROM utilizadores u
         JOIN inscricoes i ON i.utilizador_id = u.id
        WHERE i.jogo_id = @jid AND i.estado = 'confirmado'`,
      { jid: jogoId }
    );
    const jogadores = pR.recordset;
    if (jogadores.length < 2)
      return res.status(400).json({ sucesso: false, mensagem: 'Mínimo 2 jogadores confirmados.' });

    // Ordenar desc por rating + jitter aleatório (para empates dão sorteios diferentes)
    const ranked = jogadores
      .map(j => ({ ...j, _score: j.rating + Math.random() * 0.5 }))
      .sort((a, b) => b._score - a._score);

    // Snake draft: A,B,B,A,A,B,B,A...
    const A = [], B = [];
    let direcao = 1; // 1 → A primeiro
    for (let i = 0; i < ranked.length; i += 2) {
      const primeiro = ranked[i];
      const segundo  = ranked[i + 1];
      if (direcao === 1) {
        A.push(primeiro);
        if (segundo) B.push(segundo);
      } else {
        B.push(primeiro);
        if (segundo) A.push(segundo);
      }
      direcao *= -1;
    }

    const soma = arr => arr.reduce((s, j) => s + (j.rating || 0), 0);

    res.json({
      sucesso: true,
      equipaA: A.map(({ _score, ...rest }) => rest),
      equipaB: B.map(({ _score, ...rest }) => rest),
      ratingA: soma(A),
      ratingB: soma(B),
    });
  } catch (err) {
    console.error('[Sorteio] sortear:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

module.exports = { sortear };
