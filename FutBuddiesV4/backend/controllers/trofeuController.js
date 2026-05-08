// ============================================================
//  FutBuddies - Troféus de Época (mensal)
// ============================================================
const { query } = require('../config/database');

// Calcula e guarda troféus para um mês/ano específico
// Chamado pelo endpoint /admin/cron/trofeus ou manualmente
async function calcularTrofeus(mes, ano) {
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia   = new Date(ano, mes, 1);

  // ── Goleador do Mês ──────────────────────────────────────
  const goleadores = await query(
    `SELECT TOP 1 rp.utilizador_id, SUM(rp.golos) AS total
       FROM resultado_pessoal rp
       JOIN jogos j ON j.id = rp.jogo_id
       WHERE j.data_jogo >= @inicio AND j.data_jogo < @fim
         AND rp.golos > 0
       GROUP BY rp.utilizador_id
       ORDER BY total DESC`,
    { inicio: primeiroDia, fim: ultimoDia }
  );

  // ── Mais Presenças ───────────────────────────────────────
  const presencas = await query(
    `SELECT TOP 1 i.utilizador_id, COUNT(*) AS total
       FROM inscricoes i
       JOIN jogos j ON j.id = i.jogo_id
       WHERE j.data_jogo >= @inicio AND j.data_jogo < @fim
         AND i.estado = 'confirmado'
         AND j.estado IN ('concluido','encerrado')
       GROUP BY i.utilizador_id
       ORDER BY total DESC`,
    { inicio: primeiroDia, fim: ultimoDia }
  );

  // ── Mais MVPs ────────────────────────────────────────────
  const mvps = await query(
    `SELECT TOP 1 v.votado_id AS utilizador_id, COUNT(*) AS total
       FROM mvp_votos v
       JOIN jogos j ON j.id = v.jogo_id
       WHERE j.data_jogo >= @inicio AND j.data_jogo < @fim
       GROUP BY v.votado_id
       ORDER BY total DESC`,
    { inicio: primeiroDia, fim: ultimoDia }
  );

  const trofeus = [
    { tipo: 'goleador_mes', row: goleadores.recordset[0] },
    { tipo: 'presenca_mes', row: presencas.recordset[0] },
    { tipo: 'mvp_mes',      row: mvps.recordset[0] },
  ].filter(t => t.row);

  for (const t of trofeus) {
    await query(
      `MERGE trofeus_epoca AS target
         USING (SELECT @uid AS utilizador_id, @tipo AS tipo, @mes AS mes, @ano AS ano, @val AS valor) AS src
         ON target.utilizador_id=src.utilizador_id AND target.tipo=src.tipo AND target.mes=src.mes AND target.ano=src.ano
         WHEN MATCHED THEN UPDATE SET valor=src.valor
         WHEN NOT MATCHED THEN INSERT (utilizador_id,tipo,mes,ano,valor) VALUES (src.utilizador_id,src.tipo,src.mes,src.ano,src.valor);`,
      { uid: t.row.utilizador_id, tipo: t.tipo, mes, ano, val: t.row.total }
    );
  }

  return trofeus.length;
}

// POST /api/admin/cron/trofeus  (admin only)
async function cronTrofeus(req, res) {
  try {
    const agora = new Date();
    // Calcular para o mês anterior
    const mes = agora.getMonth() === 0 ? 12 : agora.getMonth();
    const ano = agora.getMonth() === 0 ? agora.getFullYear() - 1 : agora.getFullYear();
    const total = await calcularTrofeus(mes, ano);
    res.json({ sucesso: true, trofeus: total, mes, ano });
  } catch (err) {
    console.error('[Trofeus] cron:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/jogadores/:id/trofeus
async function getTrofeus(req, res) {
  try {
    const alvoId = parseInt(req.params.id);
    const r = await query(
      `SELECT tipo, mes, ano, valor FROM trofeus_epoca
         WHERE utilizador_id=@uid
         ORDER BY ano DESC, mes DESC`,
      { uid: alvoId }
    );
    res.json({ sucesso: true, trofeus: r.recordset });
  } catch (err) {
    console.error('[Trofeus] get:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

module.exports = { cronTrofeus, getTrofeus, calcularTrofeus };
