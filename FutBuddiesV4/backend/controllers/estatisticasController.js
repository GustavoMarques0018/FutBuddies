// ============================================================
//  FutBuddies - Estatísticas Avançadas
//  • Análise de forma (mensal)
//  • Posição ideal sugerida
//  • Head-to-Head
//  • Streaks
//  • Previsão de desistências
//  • Histórico do campo
// ============================================================
const { query } = require('../config/database');

// GET /api/jogadores/:id/forma
async function analiseFoma(req, res) {
  try {
    const uid = parseInt(req.params.id);
    const r = await query(
      `SELECT
         YEAR(j.data_jogo)  AS ano,
         MONTH(j.data_jogo) AS mes,
         COUNT(DISTINCT rp.jogo_id)     AS jogos,
         ISNULL(SUM(rp.golos), 0)       AS golos,
         ISNULL(SUM(rp.assistencias), 0) AS assistencias
       FROM resultado_pessoal rp
       JOIN jogos j ON j.id = rp.jogo_id
       WHERE rp.utilizador_id = @uid
         AND j.data_jogo >= DATEADD(MONTH, -12, GETUTCDATE())
         AND j.estado = 'concluido'
       GROUP BY YEAR(j.data_jogo), MONTH(j.data_jogo)
       ORDER BY ano, mes`,
      { uid }
    );
    res.json({ sucesso: true, forma: r.recordset });
  } catch (err) {
    console.error('[Stats] analiseFoma:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/jogadores/:id/posicao-ideal
async function posicaoIdeal(req, res) {
  try {
    const uid = parseInt(req.params.id);
    const r = await query(
      `SELECT
         i.posicao_jogo                                   AS posicao,
         COUNT(DISTINCT rp.jogo_id)                       AS jogos,
         ISNULL(SUM(rp.golos), 0)                         AS golos,
         ISNULL(SUM(rp.assistencias), 0)                  AS assistencias,
         CAST(ISNULL(SUM(rp.golos + rp.assistencias), 0) AS FLOAT)
           / NULLIF(COUNT(DISTINCT rp.jogo_id), 0)        AS ga_por_jogo
       FROM resultado_pessoal rp
       JOIN inscricoes i ON i.jogo_id = rp.jogo_id AND i.utilizador_id = rp.utilizador_id
       WHERE rp.utilizador_id = @uid AND i.posicao_jogo IS NOT NULL
       GROUP BY i.posicao_jogo
       ORDER BY ga_por_jogo DESC`,
      { uid }
    );

    const posicoes = r.recordset;
    const ideal = posicoes.length > 0 ? posicoes[0] : null;
    res.json({ sucesso: true, posicoes, ideal });
  } catch (err) {
    console.error('[Stats] posicaoIdeal:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/jogadores/:id/h2h/:outroId
async function headToHead(req, res) {
  try {
    const p1 = parseInt(req.params.id);
    const p2 = parseInt(req.params.outroId);

    // Jogos em conjunto
    const jogosR = await query(
      `SELECT j.id, j.titulo, j.data_jogo,
              rj.golos_equipa_a, rj.golos_equipa_b,
              i1.equipa AS equipa_p1, i2.equipa AS equipa_p2,
              rp1.golos AS golos_p1, rp1.assistencias AS assist_p1,
              rp2.golos AS golos_p2, rp2.assistencias AS assist_p2
       FROM jogos j
       JOIN inscricoes i1 ON i1.jogo_id = j.id AND i1.utilizador_id = @p1 AND i1.estado = 'confirmado'
       JOIN inscricoes i2 ON i2.jogo_id = j.id AND i2.utilizador_id = @p2 AND i2.estado = 'confirmado'
       LEFT JOIN resultado_jogo rj ON rj.jogo_id = j.id
       LEFT JOIN resultado_pessoal rp1 ON rp1.jogo_id = j.id AND rp1.utilizador_id = @p1
       LEFT JOIN resultado_pessoal rp2 ON rp2.jogo_id = j.id AND rp2.utilizador_id = @p2
       WHERE j.estado = 'concluido'
       ORDER BY j.data_jogo DESC`,
      { p1, p2 }
    );

    const jogos = jogosR.recordset;
    let golosP1 = 0, golosP2 = 0, juntosVitorias = 0, juntosEmpates = 0, juntosDerrotas = 0;
    let p1vP2Vitorias = 0, p1vP2Derrotas = 0, p1vP2Empates = 0;

    for (const j of jogos) {
      golosP1 += j.golos_p1 || 0;
      golosP2 += j.golos_p2 || 0;
      const mesmaEquipa = j.equipa_p1 === j.equipa_p2;

      if (!j.golos_equipa_a && j.golos_equipa_a !== 0) continue;

      if (mesmaEquipa) {
        const ganhou = j.equipa_p1 === 'A'
          ? j.golos_equipa_a > j.golos_equipa_b
          : j.golos_equipa_b > j.golos_equipa_a;
        const empatou = j.golos_equipa_a === j.golos_equipa_b;
        if (empatou) juntosEmpates++;
        else if (ganhou) juntosVitorias++;
        else juntosDerrotas++;
      } else {
        const p1Ganhou = j.equipa_p1 === 'A'
          ? j.golos_equipa_a > j.golos_equipa_b
          : j.golos_equipa_b > j.golos_equipa_a;
        const empatou = j.golos_equipa_a === j.golos_equipa_b;
        if (empatou) p1vP2Empates++;
        else if (p1Ganhou) p1vP2Vitorias++;
        else p1vP2Derrotas++;
      }
    }

    // Info dos jogadores
    const usersR = await query(
      `SELECT id, nome, nickname, foto_url, total_golos, total_assistencias, total_jogos
       FROM utilizadores WHERE id IN (@p1, @p2)`,
      { p1, p2 }
    );
    const u = usersR.recordset;

    res.json({
      sucesso: true,
      jogador1: u.find(x => x.id === p1),
      jogador2: u.find(x => x.id === p2),
      totalJogosJuntos: jogos.length,
      golosP1, golosP2,
      juntosVitorias, juntosEmpates, juntosDerrotas,
      p1vP2: { vitorias: p1vP2Vitorias, empates: p1vP2Empates, derrotas: p1vP2Derrotas },
      jogosRecentes: jogos.slice(0, 5),
    });
  } catch (err) {
    console.error('[Stats] h2h:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/jogadores/:id/streak
async function getStreak(req, res) {
  try {
    const uid = parseInt(req.params.id);
    const r = await query(
      `SELECT streak_atual, streak_max FROM utilizadores WHERE id = @uid`,
      { uid }
    );
    if (!r.recordset.length) return res.status(404).json({ sucesso: false });
    res.json({ sucesso: true, ...r.recordset[0] });
  } catch (err) {
    res.status(500).json({ sucesso: false });
  }
}

// Recalcular streak (chamado internamente após resultado de jogo)
async function recalcularStreak(utilizadorId) {
  try {
    const r = await query(
      `SELECT rj.golos_equipa_a, rj.golos_equipa_b, i.equipa
       FROM jogos j
       JOIN inscricoes i ON i.jogo_id = j.id AND i.utilizador_id = @uid AND i.estado = 'confirmado'
       JOIN resultado_jogo rj ON rj.jogo_id = j.id
       WHERE j.estado = 'concluido'
       ORDER BY j.data_jogo DESC`,
      { uid: utilizadorId }
    );

    const jogos = r.recordset;
    let streakAtual = 0;
    for (const j of jogos) {
      const pontos = j.equipa === 'A'
        ? j.golos_equipa_a - j.golos_equipa_b
        : j.golos_equipa_b - j.golos_equipa_a;
      if (pontos >= 0) streakAtual++; // vitória ou empate
      else break;
    }

    await query(
      `UPDATE utilizadores
       SET streak_atual = @s,
           streak_max   = CASE WHEN @s > streak_max THEN @s ELSE streak_max END
       WHERE id = @uid`,
      { uid: utilizadorId, s: streakAtual }
    );
  } catch (_) { /* não bloquear */ }
}

// GET /api/jogos/:id/previsao-desistencias
async function previsaoDesistencias(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const uid    = req.utilizador.id;

    const jogoR = await query(`SELECT criador_id, data_jogo FROM jogos WHERE id=@id`, { id: jogoId });
    if (!jogoR.recordset.length) return res.status(404).json({ sucesso: false });
    if (jogoR.recordset[0].criador_id !== uid)
      return res.status(403).json({ sucesso: false });

    const diaSemana = new Date(jogoR.recordset[0].data_jogo).getDay(); // 0=Dom..6=Sáb

    // Taxa global de cancelamento por dia da semana
    const r = await query(
      `SELECT
         DATEPART(WEEKDAY, j.data_jogo) - 1 AS dia,
         COUNT(*) AS total,
         SUM(CASE WHEN i.estado = 'cancelado' THEN 1 ELSE 0 END) AS cancelamentos
       FROM inscricoes i
       JOIN jogos j ON j.id = i.jogo_id
       GROUP BY DATEPART(WEEKDAY, j.data_jogo)`,
      {}
    );

    const dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    const stats = r.recordset;
    const diaStat = stats.find(s => s.dia === diaSemana);
    const taxa = diaStat && diaStat.total > 0
      ? Math.round((diaStat.cancelamentos / diaStat.total) * 100)
      : null;

    // Taxa específica dos jogos deste criador
    const criadorR = await query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN i.estado='cancelado' THEN 1 ELSE 0 END) AS cancelamentos
       FROM inscricoes i
       JOIN jogos j ON j.id = i.jogo_id
       WHERE j.criador_id = @uid AND DATEPART(WEEKDAY, j.data_jogo) - 1 = @dia`,
      { uid, dia: diaSemana }
    );
    const cr = criadorR.recordset[0];
    const taxaCriador = cr.total > 5
      ? Math.round((cr.cancelamentos / cr.total) * 100)
      : null;

    res.json({
      sucesso: true,
      diaSemana: dias[diaSemana],
      taxaGlobal: taxa,
      taxaCriador,
      aviso: (taxaCriador || taxa || 0) >= 25,
      mensagem: taxaCriador !== null
        ? `Nos teus jogos de ${dias[diaSemana]}, ${taxaCriador}% dos jogadores costumam cancelar.`
        : taxa !== null
        ? `Globalmente, ${taxa}% das inscrições de ${dias[diaSemana]} são canceladas.`
        : null,
    });
  } catch (err) {
    console.error('[Stats] previsao:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/campos/:id/historico
async function historicoCampo(req, res) {
  try {
    const campoId = parseInt(req.params.id);

    const [totalR, jogadoresR, marcadoresR] = await Promise.all([
      query(
        `SELECT COUNT(*) AS total_jogos,
                SUM(ISNULL(rj.golos_equipa_a,0) + ISNULL(rj.golos_equipa_b,0)) AS total_golos
         FROM jogos j
         LEFT JOIN resultado_jogo rj ON rj.jogo_id = j.id
         WHERE j.campo_id = @cid AND j.estado = 'concluido'`,
        { cid: campoId }
      ),
      query(
        `SELECT COUNT(DISTINCT i.utilizador_id) AS total_jogadores
         FROM inscricoes i
         JOIN jogos j ON j.id = i.jogo_id
         WHERE j.campo_id = @cid AND i.estado = 'confirmado'`,
        { cid: campoId }
      ),
      query(
        `SELECT TOP 5 u.id, u.nome, u.nickname, u.foto_url,
                SUM(rp.golos) AS golos
         FROM resultado_pessoal rp
         JOIN utilizadores u ON u.id = rp.utilizador_id
         JOIN jogos j ON j.id = rp.jogo_id
         WHERE j.campo_id = @cid
         GROUP BY u.id, u.nome, u.nickname, u.foto_url
         ORDER BY golos DESC`,
        { cid: campoId }
      ),
    ]);

    res.json({
      sucesso: true,
      totalJogos:    totalR.recordset[0].total_jogos,
      totalGolos:    totalR.recordset[0].total_golos || 0,
      totalJogadores: jogadoresR.recordset[0].total_jogadores,
      topMarcadores: marcadoresR.recordset,
    });
  } catch (err) {
    console.error('[Stats] historicoCampo:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/traduzir
async function traduzir(req, res) {
  try {
    const { texto, para = 'pt' } = req.body;
    if (!texto) return res.status(400).json({ sucesso: false, mensagem: 'Texto obrigatório.' });

    const endpoint = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com/translate';
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: texto,
        source: 'auto',
        target: para,
        format: 'text',
        api_key: process.env.LIBRETRANSLATE_KEY || '',
      }),
    });

    if (!resp.ok) return res.status(502).json({ sucesso: false, mensagem: 'Serviço de tradução indisponível.' });
    const data = await resp.json();
    res.json({ sucesso: true, traducao: data.translatedText });
  } catch (err) {
    console.error('[Stats] traduzir:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

module.exports = {
  analiseFoma, posicaoIdeal, headToHead,
  getStreak, recalcularStreak,
  previsaoDesistencias, historicoCampo,
  traduzir,
};
