// ============================================================
//  FutBuddies - Balanceamento Automático de Equipas
// ============================================================
const { query } = require('../config/database');

// Algoritmo snake-draft por rating
function snakeDraft(jogadores) {
  // Ordenar por rating descrescente
  const sorted = [...jogadores].sort((a, b) => b.rating - a.rating);
  const A = [], B = [];
  sorted.forEach((p, i) => {
    if (i % 2 === 0) A.push(p);
    else B.push(p);
  });
  return { equipaA: A, equipaB: B };
}

function calcularRating(j) {
  return (j.total_golos || 0) * 2 + (j.total_assistencias || 0) + (j.media_avaliacao || 3) * 2;
}

function somaRating(equipa) {
  return equipa.reduce((s, p) => s + p.rating, 0);
}

// GET /api/jogos/:id/balancear
async function sugerir(req, res) {
  try {
    const jogoId  = parseInt(req.params.id);
    const uid     = req.utilizador.id;

    // Verificar se é criador
    const jogoR = await query(`SELECT criador_id FROM jogos WHERE id=@id`, { id: jogoId });
    if (!jogoR.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });
    if (jogoR.recordset[0].criador_id !== uid)
      return res.status(403).json({ sucesso: false, mensagem: 'Só o criador pode balancear as equipas.' });

    // Buscar jogadores inscritos com stats
    const r = await query(
      `SELECT u.id, u.nome, u.nickname, u.foto_url,
              ISNULL(u.total_golos, 0)         AS total_golos,
              ISNULL(u.total_assistencias, 0)  AS total_assistencias,
              ISNULL(u.total_jogos, 0)         AS total_jogos,
              i.posicao_jogo,
              (SELECT ISNULL(AVG(CAST(nota AS FLOAT)), 3.0)
               FROM avaliacoes_jogadores aj
               WHERE aj.avaliado_id = u.id) AS media_avaliacao
       FROM inscricoes i
       JOIN utilizadores u ON u.id = i.utilizador_id
       WHERE i.jogo_id = @jogoId AND i.estado = 'confirmado'`,
      { jogoId }
    );

    const jogadores = r.recordset.map(j => ({
      ...j,
      rating: calcularRating(j),
    }));

    if (jogadores.length < 2)
      return res.status(400).json({ sucesso: false, mensagem: 'São necessários pelo menos 2 jogadores inscritos.' });

    const { equipaA, equipaB } = snakeDraft(jogadores);
    const ratingA = somaRating(equipaA);
    const ratingB = somaRating(equipaB);
    const balanceScore = Math.round(100 - Math.abs(ratingA - ratingB));

    res.json({ sucesso: true, equipaA, equipaB, ratingA, ratingB, balanceScore });
  } catch (err) {
    console.error('[Balanceamento] sugerir:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/jogos/:id/balancear/aceitar
async function aceitar(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const uid    = req.utilizador.id;
    const { equipaA, equipaB } = req.body; // arrays de { id }

    const jogoR = await query(`SELECT criador_id FROM jogos WHERE id=@id`, { id: jogoId });
    if (!jogoR.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });
    if (jogoR.recordset[0].criador_id !== uid)
      return res.status(403).json({ sucesso: false, mensagem: 'Só o criador pode aceitar o balanceamento.' });

    for (const p of (equipaA || [])) {
      await query(
        `UPDATE inscricoes SET equipa='A' WHERE jogo_id=@jid AND utilizador_id=@uid`,
        { jid: jogoId, uid: p.id }
      );
    }
    for (const p of (equipaB || [])) {
      await query(
        `UPDATE inscricoes SET equipa='B' WHERE jogo_id=@jid AND utilizador_id=@uid`,
        { jid: jogoId, uid: p.id }
      );
    }

    res.json({ sucesso: true, mensagem: 'Equipas guardadas com sucesso!' });
  } catch (err) {
    console.error('[Balanceamento] aceitar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

module.exports = { sugerir, aceitar };
