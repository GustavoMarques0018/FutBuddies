// ============================================================
//  FutBuddies - Controlador de Resultados (Fase C)
//  Reporte pós-jogo do resultado global (criador) e dos golos
//  / assistências pessoais (cada participante).
// ============================================================

const { query } = require('../config/database');
const { inserirAtividade } = require('./feedController');
const { recalcularStreak } = require('./estatisticasController');
const { verificarOvertake } = require('./desafiosController');

// Helper: obter lista de participantes de um jogo (pick-up + equipas)
async function obterParticipantes(jogoId) {
  const r = await query(
    `SELECT utilizador_id FROM inscricoes
        WHERE jogo_id = @jid AND estado = 'confirmado'
     UNION
     SELECT em.utilizador_id FROM inscricoes_equipa ie
        JOIN equipa_membros em ON em.equipa_id = ie.equipa_id
        WHERE ie.jogo_id = @jid AND ie.estado = 'confirmado'`,
    { jid: jogoId }
  );
  return r.recordset.map(x => x.utilizador_id);
}

// GET /api/jogos/:id/resultado
// Devolve o resultado oficial (se existir) + lista de reportes pessoais
async function obterResultados(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const resJogo = await query(
      `SELECT rj.*, u.nome AS reportado_por_nome
         FROM resultado_jogo rj
         JOIN utilizadores u ON u.id = rj.reportado_por
         WHERE rj.jogo_id = @jid`,
      { jid: jogoId }
    );

    const resPess = await query(
      `SELECT rp.id, rp.utilizador_id, rp.golos, rp.assistencias, rp.created_at,
              u.nome, u.nickname, u.foto_url,
              -- Qual o "lado" (A/B) em que jogou? pick-up → inscricoes; equipa → inscricoes_equipa
              COALESCE(ins.equipa,
                       (SELECT TOP 1 ie.lado FROM inscricoes_equipa ie
                          JOIN equipa_membros em ON em.equipa_id = ie.equipa_id
                          WHERE ie.jogo_id = rp.jogo_id
                            AND em.utilizador_id = rp.utilizador_id)) AS lado
         FROM resultado_pessoal rp
         JOIN utilizadores u ON u.id = rp.utilizador_id
         LEFT JOIN inscricoes ins ON ins.jogo_id = rp.jogo_id AND ins.utilizador_id = rp.utilizador_id
         WHERE rp.jogo_id = @jid
         ORDER BY rp.golos DESC, rp.assistencias DESC`,
      { jid: jogoId }
    );

    const resultado = resJogo.recordset[0] || null;
    const pessoais = resPess.recordset;

    // Validação: soma de golos pessoais por lado ≤ golos oficiais do lado
    let aviso = null;
    if (resultado) {
      const somaA = pessoais.filter(p => p.lado === 'A').reduce((s, p) => s + p.golos, 0);
      const somaB = pessoais.filter(p => p.lado === 'B').reduce((s, p) => s + p.golos, 0);
      const partes = [];
      if (somaA > resultado.golos_equipa_a) partes.push(`Equipa A: ${somaA} golos reportados mas só ${resultado.golos_equipa_a} no placard.`);
      if (somaB > resultado.golos_equipa_b) partes.push(`Equipa B: ${somaB} golos reportados mas só ${resultado.golos_equipa_b} no placard.`);
      if (partes.length) aviso = partes.join(' ');
    }

    res.json({ sucesso: true, resultado, pessoais, aviso });
  } catch (err) {
    console.error('[Resultados] Erro ao obter:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// POST /api/jogos/:id/resultado
// Apenas o criador do jogo pode submeter o resultado oficial (upsert).
async function submeterResultadoJogo(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const utilizadorId = req.utilizador.id;
    const golosA = parseInt(req.body.golos_equipa_a);
    const golosB = parseInt(req.body.golos_equipa_b);

    if (isNaN(golosA) || isNaN(golosB) || golosA < 0 || golosB < 0)
      return res.status(400).json({ sucesso: false, mensagem: 'Golos inválidos.' });

    // Verificar se é o criador
    const j = await query(`SELECT criador_id FROM jogos WHERE id = @jid`, { jid: jogoId });
    if (j.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });
    if (j.recordset[0].criador_id !== utilizadorId)
      return res.status(403).json({ sucesso: false, mensagem: 'Só o criador do jogo pode reportar o resultado.' });

    // Upsert manual
    const existe = await query(`SELECT id FROM resultado_jogo WHERE jogo_id = @jid`, { jid: jogoId });
    if (existe.recordset.length > 0) {
      await query(
        `UPDATE resultado_jogo
            SET golos_equipa_a = @ga, golos_equipa_b = @gb,
                reportado_por = @uid, updated_at = GETUTCDATE()
          WHERE jogo_id = @jid`,
        { jid: jogoId, ga: golosA, gb: golosB, uid: utilizadorId }
      );
    } else {
      await query(
        `INSERT INTO resultado_jogo (jogo_id, golos_equipa_a, golos_equipa_b, reportado_por)
            VALUES (@jid, @ga, @gb, @uid)`,
        { jid: jogoId, ga: golosA, gb: golosB, uid: utilizadorId }
      );
    }

    // Marcar notif do criador como respondida
    await query(
      `UPDATE notificacoes SET respondida = 1, lida = 1
         WHERE utilizador_id = @uid AND jogo_id = @jid AND tipo = 'resultado_jogo'`,
      { uid: utilizadorId, jid: jogoId }
    );

    res.json({ sucesso: true, mensagem: 'Resultado registado.' });
  } catch (err) {
    console.error('[Resultados] Erro submeter jogo:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// POST /api/jogos/:id/resultado-pessoal
// Qualquer participante pode submeter os seus próprios golos/assistências (upsert).
async function submeterResultadoPessoal(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const utilizadorId = req.utilizador.id;
    const golos = parseInt(req.body.golos || 0);
    const ass = parseInt(req.body.assistencias || 0);

    if (isNaN(golos) || isNaN(ass) || golos < 0 || ass < 0 || golos > 50 || ass > 50)
      return res.status(400).json({ sucesso: false, mensagem: 'Valores inválidos.' });

    // Verificar se é participante
    const participantes = await obterParticipantes(jogoId);
    if (!participantes.includes(utilizadorId))
      return res.status(403).json({ sucesso: false, mensagem: 'Não participaste neste jogo.' });

    const existe = await query(
      `SELECT id FROM resultado_pessoal WHERE jogo_id = @jid AND utilizador_id = @uid`,
      { jid: jogoId, uid: utilizadorId }
    );
    if (existe.recordset.length > 0) {
      await query(
        `UPDATE resultado_pessoal
            SET golos = @g, assistencias = @a, updated_at = GETUTCDATE()
          WHERE jogo_id = @jid AND utilizador_id = @uid`,
        { jid: jogoId, uid: utilizadorId, g: golos, a: ass }
      );
    } else {
      await query(
        `INSERT INTO resultado_pessoal (jogo_id, utilizador_id, golos, assistencias)
            VALUES (@jid, @uid, @g, @a)`,
        { jid: jogoId, uid: utilizadorId, g: golos, a: ass }
      );
    }

    await query(
      `UPDATE notificacoes SET respondida = 1, lida = 1
         WHERE utilizador_id = @uid AND jogo_id = @jid AND tipo = 'resultado_pessoal'`,
      { uid: utilizadorId, jid: jogoId }
    );

    // Sincronizar totais no perfil do utilizador
    await query(
      `UPDATE utilizadores SET
         total_golos        = ISNULL((SELECT SUM(golos) FROM resultado_pessoal WHERE utilizador_id = @uid), 0),
         total_assistencias = ISNULL((SELECT SUM(assistencias) FROM resultado_pessoal WHERE utilizador_id = @uid), 0),
         total_jogos        = (
            SELECT COUNT(DISTINCT j.id) FROM jogos j
            WHERE j.estado = 'concluido' AND (
              EXISTS (SELECT 1 FROM inscricoes i WHERE i.jogo_id = j.id AND i.utilizador_id = @uid AND i.estado = 'confirmado')
              OR EXISTS (SELECT 1 FROM inscricoes_equipa ie
                         JOIN equipa_membros em ON em.equipa_id = ie.equipa_id
                         WHERE ie.jogo_id = j.id AND em.utilizador_id = @uid AND ie.estado = 'confirmado')
            )
         )
       WHERE id = @uid`,
      { uid: utilizadorId }
    );

    // Feed de atividade + streak + desafios (fire-and-forget)
    if (golos > 0) {
      try {
        await inserirAtividade(utilizadorId, 'golo_marcado', { jogoId, golos });
      } catch (e) { console.warn('[Feed] golo_marcado:', e.message); }
    }
    try { await recalcularStreak(utilizadorId); } catch (e) { console.warn('[Streak]:', e.message); }
    try { await verificarOvertake(utilizadorId); } catch (e) { console.warn('[Overtake]:', e.message); }

    res.json({ sucesso: true, mensagem: 'Dados pessoais registados.' });
  } catch (err) {
    console.error('[Resultados] Erro submeter pessoal:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

module.exports = {
  obterResultados, submeterResultadoJogo, submeterResultadoPessoal,
  obterParticipantes,
};
