// ============================================================
//  FutBuddies - Dashboard do Dono
//  KPIs + heatmap de ocupação (hora × dia da semana)
// ============================================================

const { query } = require('../config/database');

// GET /api/dono/dashboard
// Agrega, para todos os campos do dono autenticado, os últimos 90 dias:
//  - heatmap[7][24] com contagem de jogos por (DOW, hora)
//  - KPIs: total_jogos, receita_bruta_cents, receita_liquida_cents,
//          avaliacao_media, ocupacao_media_pct, no_shows
//  - receita_mensal[6] — série dos últimos 6 meses
//  - top_horarios — top 5 horários mais procurados
async function dashboard(req, res) {
  try {
    const uid = req.utilizador.id;

    // ── 1. Jogos nos últimos 90 dias ─────────────────────────
    const jogosR = await query(
      `SELECT j.id, j.data_jogo, j.max_jogadores,
              DATEPART(WEEKDAY, j.data_jogo) AS dow,    -- 1..7 (domingo=1 por default em pt-PT)
              DATEPART(HOUR, j.data_jogo)    AS hora,
              (SELECT COUNT(*) FROM inscricoes i
                WHERE i.jogo_id = j.id AND i.estado='confirmado') AS confirmados
         FROM jogos j
         JOIN campos c ON c.id = j.campo_id
        WHERE c.dono_id = @uid
          AND j.data_jogo >= DATEADD(DAY,-90, GETUTCDATE())
          AND j.estado NOT IN ('cancelado')`,
      { uid }
    );

    // Heatmap [7][24] indexado por DOW (0=segunda … 6=domingo)
    // DATEPART WEEKDAY depende de @@DATEFIRST; normalizamos:
    const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
    let totalOcupacao = 0;
    let jogosComLotacao = 0;

    for (const j of jogosR.recordset) {
      // dow 1-7 (configurável); convertemos para 0=Seg .. 6=Dom
      // Como @@DATEFIRST geralmente = 7 (Domingo), DOW 1=Dom, 2=Seg…7=Sáb
      // Normalizamos para 0=Seg … 6=Dom:
      const dowNorm = ((j.dow + 5) % 7); // 1→6, 2→0, 3→1 … 7→5 → gives Sunday=6, Mon=0 ✓
      const h = Math.max(0, Math.min(23, j.hora || 0));
      heatmap[dowNorm][h] += 1;
      if (j.max_jogadores > 0) {
        totalOcupacao += (j.confirmados / j.max_jogadores);
        jogosComLotacao++;
      }
    }
    const ocupacaoMediaPct = jogosComLotacao
      ? Math.round((totalOcupacao / jogosComLotacao) * 100)
      : 0;

    // ── 2. Receita bruta e líquida (90d) ─────────────────────
    const receitaR = await query(
      `SELECT
         ISNULL(SUM(p.valor_cents), 0) AS bruta,
         ISNULL(SUM(p.valor_cents - p.application_fee_cents), 0) AS liquida,
         COUNT(*) AS num_pagamentos
       FROM pagamentos p
       JOIN jogos j  ON j.id = p.jogo_id
       JOIN campos c ON c.id = j.campo_id
      WHERE c.dono_id = @uid
        AND p.status = 'succeeded'
        AND p.created_at >= DATEADD(DAY,-90, GETUTCDATE())`,
      { uid }
    );

    // ── 3. Avaliação média dos campos do dono ───────────────
    let avalMedia = null;
    try {
      const avalR = await query(
        `SELECT AVG(CAST(a.rating AS FLOAT)) AS m, COUNT(*) AS n
           FROM avaliacoes_campo a
           JOIN campos c ON c.id = a.campo_id
          WHERE c.dono_id = @uid`,
        { uid }
      );
      if (avalR.recordset[0].n > 0) avalMedia = Math.round(avalR.recordset[0].m * 10) / 10;
    } catch { /* tabela pode não existir em dev */ }

    // ── 4. No-shows nos campos do dono (90d) ────────────────
    let noShows = 0;
    try {
      const nsR = await query(
        `SELECT COUNT(*) AS n FROM inscricoes i
           JOIN jogos j  ON j.id = i.jogo_id
           JOIN campos c ON c.id = j.campo_id
          WHERE c.dono_id = @uid AND i.no_show = 1
            AND j.data_jogo >= DATEADD(DAY,-90, GETUTCDATE())`,
        { uid }
      );
      noShows = nsR.recordset[0].n || 0;
    } catch {}

    // ── 5. Receita mensal (últimos 6 meses) ─────────────────
    const mensalR = await query(
      `SELECT FORMAT(p.created_at, 'yyyy-MM') AS ym,
              SUM(p.valor_cents - p.application_fee_cents) AS liquida
         FROM pagamentos p
         JOIN jogos j  ON j.id = p.jogo_id
         JOIN campos c ON c.id = j.campo_id
        WHERE c.dono_id = @uid
          AND p.status = 'succeeded'
          AND p.created_at >= DATEADD(MONTH,-6, GETUTCDATE())
        GROUP BY FORMAT(p.created_at, 'yyyy-MM')
        ORDER BY ym`,
      { uid }
    );

    // ── 6. Top horários (dia-da-semana + hora) ──────────────
    const topHorarios = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (heatmap[d][h] > 0) topHorarios.push({ dow: d, hora: h, jogos: heatmap[d][h] });
      }
    }
    topHorarios.sort((a, b) => b.jogos - a.jogos);

    res.json({
      sucesso: true,
      kpis: {
        total_jogos: jogosR.recordset.length,
        receita_bruta_cents: receitaR.recordset[0].bruta || 0,
        receita_liquida_cents: receitaR.recordset[0].liquida || 0,
        num_pagamentos: receitaR.recordset[0].num_pagamentos || 0,
        avaliacao_media: avalMedia,
        ocupacao_media_pct: ocupacaoMediaPct,
        no_shows: noShows,
      },
      heatmap,           // heatmap[dow 0=Seg..6=Dom][hora 0..23]
      receita_mensal: mensalR.recordset,
      top_horarios: topHorarios.slice(0, 5),
    });
  } catch (err) {
    console.error('[DonoDashboard]:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao obter dashboard.' });
  }
}

module.exports = { dashboard };
