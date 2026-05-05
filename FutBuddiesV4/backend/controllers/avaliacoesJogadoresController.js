// ============================================================
//  FutBuddies - Avaliações entre Jogadores (sistema de 5 estrelas)
//  Após um jogo concluído, cada participante pode avaliar os outros.
// ============================================================

const { query } = require('../config/database');
const { criarNotificacao } = require('./notificacoesController');

// GET /api/jogos/:id/avaliar-jogadores
// Devolve: { jogadores: [...], jaAvaliados: [avaliado_id, ...] }
async function getJogadoresParaAvaliar(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const uid    = req.utilizador.id;

    // Verificar que o jogo existe e está concluído
    const jogoRes = await query(
      `SELECT id, titulo, estado FROM jogos WHERE id = @jogoId`,
      { jogoId }
    );
    if (!jogoRes.recordset.length)
      return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });

    const jogo = jogoRes.recordset[0];
    if (jogo.estado !== 'concluido')
      return res.status(400).json({ sucesso: false, mensagem: 'Só podes avaliar jogadores de jogos concluídos.' });

    // Lista de todos os participantes confirmados (excluindo o próprio)
    const jogadoresRes = await query(
      `SELECT DISTINCT u.id, u.nome, u.nickname, u.foto_url, u.posicao
         FROM utilizadores u
         JOIN (
           SELECT utilizador_id AS uid FROM inscricoes
            WHERE jogo_id = @jogoId AND estado = 'confirmado'
           UNION
           SELECT em.utilizador_id AS uid FROM equipa_membros em
             JOIN inscricoes_equipa ie ON ie.equipa_id = em.equipa_id
            WHERE ie.jogo_id = @jogoId AND ie.estado = 'confirmado'
         ) p ON p.uid = u.id
        WHERE u.id <> @uid AND u.ativo = 1`,
      { jogoId, uid }
    );

    // Ids já avaliados por este utilizador neste jogo
    const jaAvaliadosRes = await query(
      `SELECT avaliado_id FROM avaliacoes_jogadores
        WHERE jogo_id = @jogoId AND avaliador_id = @uid`,
      { jogoId, uid }
    );
    const jaAvaliados = jaAvaliadosRes.recordset.map(r => r.avaliado_id);

    // Média das avaliações recebidas por cada jogador neste jogo
    const mediasRes = await query(
      `SELECT avaliado_id, AVG(CAST(nota AS FLOAT)) AS media, COUNT(*) AS total
         FROM avaliacoes_jogadores
        WHERE jogo_id = @jogoId
        GROUP BY avaliado_id`,
      { jogoId }
    );
    const mediasMap = {};
    for (const m of mediasRes.recordset) mediasMap[m.avaliado_id] = m;

    const jogadores = jogadoresRes.recordset.map(j => ({
      ...j,
      media_nota: mediasMap[j.id]?.media ?? null,
      total_avaliacoes: mediasMap[j.id]?.total ?? 0,
    }));

    res.json({ sucesso: true, jogo: { id: jogo.id, titulo: jogo.titulo }, jogadores, jaAvaliados });
  } catch (err) {
    console.error('[AvalJogadores] getJogadoresParaAvaliar erro:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/jogos/:id/avaliar-jogadores
// Body: { avaliacoes: [{ avaliado_id, nota, comentario? }, ...] }
async function submeterAvaliacoes(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const uid    = req.utilizador.id;
    const { avaliacoes } = req.body;

    if (!Array.isArray(avaliacoes) || avaliacoes.length === 0)
      return res.status(400).json({ sucesso: false, mensagem: 'Nenhuma avaliação enviada.' });

    // Verificar jogo concluído
    const jogoRes = await query(
      `SELECT id, titulo, estado FROM jogos WHERE id = @jogoId`,
      { jogoId }
    );
    if (!jogoRes.recordset.length)
      return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });
    if (jogoRes.recordset[0].estado !== 'concluido')
      return res.status(400).json({ sucesso: false, mensagem: 'Jogo ainda não concluído.' });

    const jogoTitulo = jogoRes.recordset[0].titulo;

    // Verificar que o avaliador participou
    const participouRes = await query(
      `SELECT 1 AS ok FROM (
         SELECT utilizador_id FROM inscricoes WHERE jogo_id=@jogoId AND estado='confirmado'
         UNION
         SELECT em.utilizador_id FROM equipa_membros em
           JOIN inscricoes_equipa ie ON ie.equipa_id = em.equipa_id
          WHERE ie.jogo_id=@jogoId AND ie.estado='confirmado'
       ) p WHERE p.utilizador_id = @uid`,
      { jogoId, uid }
    );
    if (!participouRes.recordset.length)
      return res.status(403).json({ sucesso: false, mensagem: 'Não participaste neste jogo.' });

    let guardadas = 0;

    for (const av of avaliacoes) {
      const { avaliado_id, nota, comentario } = av;
      if (!avaliado_id || nota == null) continue;
      const notaInt = parseInt(nota);
      if (notaInt < 1 || notaInt > 5) continue;
      if (parseInt(avaliado_id) === uid) continue;

      await query(
        `MERGE avaliacoes_jogadores AS tgt
         USING (VALUES (@jogoId, @uid, @avaliadoId)) AS src(jogo_id, avaliador_id, avaliado_id)
           ON tgt.jogo_id = src.jogo_id AND tgt.avaliador_id = src.avaliador_id AND tgt.avaliado_id = src.avaliado_id
         WHEN MATCHED THEN
           UPDATE SET nota = @nota, comentario = @comentario
         WHEN NOT MATCHED THEN
           INSERT (jogo_id, avaliador_id, avaliado_id, nota, comentario)
           VALUES (@jogoId, @uid, @avaliadoId, @nota, @comentario);`,
        { jogoId, uid, avaliadoId: parseInt(avaliado_id), nota: notaInt, comentario: comentario?.substring(0, 300) || null }
      );
      guardadas++;

      // Notificar o avaliado se nota alta
      if (notaInt >= 4) {
        const estrelas = '⭐'.repeat(notaInt);
        criarNotificacao({
          utilizadorId: parseInt(avaliado_id),
          tipo: 'resultado_pessoal',
          titulo: `${estrelas} Recebeste uma avaliação no jogo "${jogoTitulo}"`,
          mensagem: comentario ? `"${comentario.substring(0, 80)}"` : null,
          jogoId,
        }).catch(() => {});
      }
    }

    res.json({ sucesso: true, mensagem: `${guardadas} avaliação(ões) guardada(s).`, guardadas });
  } catch (err) {
    console.error('[AvalJogadores] submeterAvaliacoes erro:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/jogadores/:id/avaliacoes — estatísticas de avaliação para perfil público
async function getAvaliacoesPerfil(req, res) {
  try {
    const avaliadoId = parseInt(req.params.id);
    const r = await query(
      `SELECT
         ROUND(AVG(CAST(nota AS FLOAT)), 1) AS media,
         COUNT(*) AS total,
         SUM(CASE WHEN nota=5 THEN 1 ELSE 0 END) AS cinco,
         SUM(CASE WHEN nota=4 THEN 1 ELSE 0 END) AS quatro,
         SUM(CASE WHEN nota=3 THEN 1 ELSE 0 END) AS tres,
         SUM(CASE WHEN nota=2 THEN 1 ELSE 0 END) AS dois,
         SUM(CASE WHEN nota=1 THEN 1 ELSE 0 END) AS um
       FROM avaliacoes_jogadores WHERE avaliado_id = @avaliadoId`,
      { avaliadoId }
    );
    const ultimas = await query(
      `SELECT TOP 5 aj.nota, aj.comentario, aj.created_at,
              u.nome AS avaliador_nome, u.nickname AS avaliador_nickname
         FROM avaliacoes_jogadores aj
         JOIN utilizadores u ON u.id = aj.avaliador_id
        WHERE aj.avaliado_id = @avaliadoId AND aj.comentario IS NOT NULL
        ORDER BY aj.created_at DESC`,
      { avaliadoId }
    );
    res.json({ sucesso: true, stats: r.recordset[0] || { total: 0 }, ultimas: ultimas.recordset });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

module.exports = { getJogadoresParaAvaliar, submeterAvaliacoes, getAvaliacoesPerfil };
