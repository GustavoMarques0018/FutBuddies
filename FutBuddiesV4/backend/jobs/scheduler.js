// ============================================================
//  FutBuddies - Scheduler (jobs periódicos sem dependências)
//  Fase B: limparExpiradas
//  Fase C: gerarPerguntasPosJogo (pergunta resultado e stats
//          pessoais após cada jogo concluído)
// ============================================================

const { query } = require('../config/database');
const { criarNotificacao } = require('../controllers/notificacoesController');

/**
 * Remove notificações expiradas. Corre ao arranque e de 10 em 10 min.
 */
async function limparExpiradas() {
  try {
    const r = await query(
      `DELETE FROM notificacoes
         WHERE expira_em IS NOT NULL AND expira_em < GETUTCDATE()`
    );
    if (r.rowsAffected[0] > 0) {
      console.log(`🧹 Scheduler: ${r.rowsAffected[0]} notificação(ões) expirada(s) removida(s).`);
    }
  } catch (err) {
    console.error('[Scheduler] limparExpiradas erro:', err.message);
  }
}

/**
 * Fase C — gerador de perguntas pós-jogo.
 *  - Para cada jogo cujo `data_jogo + 1h < now` e `data_jogo > now - 7d`:
 *    • cria notif 'resultado_jogo' ao criador (se ainda não existe)
 *    • cria notif 'resultado_pessoal' a cada participante (se ainda não existe)
 *  A idempotência vem de verificar se já há uma notif com mesmo
 *  (utilizador_id, jogo_id, tipo).
 */
async function gerarPerguntasPosJogo() {
  try {
    const jogos = await query(
      `SELECT id, titulo, criador_id
         FROM jogos
         WHERE DATEADD(HOUR, 1, data_jogo) < GETUTCDATE()
           AND data_jogo > DATEADD(DAY, -7, GETUTCDATE())
           AND estado <> 'cancelado'`
    );

    for (const j of jogos.recordset) {
      // ── 1. Notif ao criador (resultado oficial) ──
      const jaTemCriador = await query(
        `SELECT 1 FROM notificacoes
           WHERE utilizador_id = @uid AND jogo_id = @jid AND tipo = 'resultado_jogo'`,
        { uid: j.criador_id, jid: j.id }
      );
      if (jaTemCriador.recordset.length === 0) {
        await criarNotificacao({
          utilizadorId: j.criador_id,
          tipo: 'resultado_jogo',
          titulo: 'Qual foi o resultado?',
          mensagem: `Regista o resultado final do jogo "${j.titulo}".`,
          jogoId: j.id,
          acaoUrl: `/jogos/${j.id}/reportar`,
        });
      }

      // ── 2. Notif a cada participante (golos/assistências pessoais) ──
      const participantes = await query(
        `SELECT DISTINCT uid FROM (
            SELECT utilizador_id AS uid FROM inscricoes
                WHERE jogo_id = @jid AND estado = 'confirmado'
            UNION
            SELECT em.utilizador_id AS uid FROM inscricoes_equipa ie
                JOIN equipa_membros em ON em.equipa_id = ie.equipa_id
                WHERE ie.jogo_id = @jid AND ie.estado = 'confirmado'
         ) t`,
        { jid: j.id }
      );

      for (const p of participantes.recordset) {
        const jaTem = await query(
          `SELECT 1 FROM notificacoes
             WHERE utilizador_id = @uid AND jogo_id = @jid AND tipo = 'resultado_pessoal'`,
          { uid: p.uid, jid: j.id }
        );
        if (jaTem.recordset.length === 0) {
          await criarNotificacao({
            utilizadorId: p.uid,
            tipo: 'resultado_pessoal',
            titulo: 'Como correu o jogo?',
            mensagem: `Regista os teus golos e assistências em "${j.titulo}".`,
            jogoId: j.id,
            acaoUrl: `/jogos/${j.id}/reportar`,
          });
        }
      }
    }
  } catch (err) {
    console.error('[Scheduler] gerarPerguntasPosJogo erro:', err.message);
  }
}

/**
 * Após cada jogo em campo parceiro terminar, envia 1 notificação
 * ao criador (quem reservou) a pedir para avaliar o campo.
 * Idempotente via coluna jogos.avaliacao_campo_pedida.
 */
async function gerarPedidosAvaliacaoCampo() {
  try {
    const jogos = await query(
      `SELECT j.id, j.criador_id, j.titulo, c.nome AS campo_nome
         FROM jogos j
         JOIN campos c ON c.id = j.campo_id
        WHERE j.campo_id IS NOT NULL
          AND j.tipo_local = 'parceiro'
          AND (j.avaliacao_campo_pedida IS NULL OR j.avaliacao_campo_pedida = 0)
          AND DATEADD(HOUR, 1, j.data_jogo) < GETUTCDATE()
          AND j.data_jogo > DATEADD(DAY, -30, GETUTCDATE())
          AND j.estado <> 'cancelado'`
    );
    for (const j of jogos.recordset) {
      try {
        await criarNotificacao({
          utilizadorId: j.criador_id,
          tipo: 'sistema',
          titulo: `Avalia o campo "${j.campo_nome}"`,
          mensagem: `Como foi a tua experiência no campo após o jogo "${j.titulo}"? Dá-nos a tua opinião.`,
          jogoId: j.id,
          acaoUrl: `/jogos/${j.id}/avaliar-campo`,
        });
        await query(`UPDATE jogos SET avaliacao_campo_pedida = 1 WHERE id = @id`, { id: j.id });
      } catch (e) {
        console.warn('[Scheduler] avaliação campo falha jogo', j.id, e.message);
      }
    }
  } catch (err) {
    console.error('[Scheduler] gerarPedidosAvaliacaoCampo erro:', err.message);
  }
}

// Recalcula totais de golos/assistências/jogos a partir dos reportes.
// Roda uma vez ao arranque + a cada hora, para garantir consistência
// mesmo se algum UPDATE directo falhou.
async function sincronizarTotaisUtilizadores() {
  try {
    await query(
      `UPDATE u SET
         total_golos        = ISNULL(rp.sg, 0),
         total_assistencias = ISNULL(rp.sa, 0)
       FROM utilizadores u
       LEFT JOIN (
         SELECT utilizador_id, SUM(golos) AS sg, SUM(assistencias) AS sa
         FROM resultado_pessoal GROUP BY utilizador_id
       ) rp ON rp.utilizador_id = u.id`
    );
  } catch (err) {
    console.error('[Scheduler] sincronizarTotaisUtilizadores erro:', err.message);
  }
}

/**
 * Notifica todos os participantes 1h após o jogo para votarem no MVP.
 * Idempotente via jogos.mvp_pedido.
 */
async function gerarVotacoesMVP() {
  try {
    const jogos = await query(
      `SELECT id, titulo FROM jogos
        WHERE (mvp_pedido IS NULL OR mvp_pedido = 0)
          AND DATEADD(HOUR, 1, data_jogo) < GETUTCDATE()
          AND data_jogo > DATEADD(DAY, -2, GETUTCDATE())
          AND estado <> 'cancelado'`
    );
    for (const j of jogos.recordset) {
      const participantes = await query(
        `SELECT DISTINCT uid FROM (
            SELECT utilizador_id AS uid FROM inscricoes
                WHERE jogo_id = @jid AND estado = 'confirmado'
            UNION
            SELECT em.utilizador_id AS uid FROM inscricoes_equipa ie
                JOIN equipa_membros em ON em.equipa_id = ie.equipa_id
                WHERE ie.jogo_id = @jid AND ie.estado = 'confirmado'
         ) t`, { jid: j.id }
      );
      for (const p of participantes.recordset) {
        try {
          await criarNotificacao({
            utilizadorId: p.uid,
            tipo: 'sistema',
            titulo: 'Quem foi o MVP?',
            mensagem: `Vota no melhor jogador do jogo "${j.titulo}".`,
            jogoId: j.id,
            acaoUrl: `/jogos/${j.id}?mvp=1`,
          });
        } catch {}
      }
      await query(`UPDATE jogos SET mvp_pedido = 1 WHERE id = @id`, { id: j.id });
    }
  } catch (err) {
    console.error('[Scheduler] gerarVotacoesMVP erro:', err.message);
  }
}

/**
 * 30 min após início, marca como no_show quem não fez check-in, incrementa contador.
 * Idempotente via jogos.checkin_processado.
 */
async function processarNoShows() {
  try {
    const jogos = await query(
      `SELECT id FROM jogos
        WHERE (checkin_processado IS NULL OR checkin_processado = 0)
          AND DATEADD(MINUTE, 30, data_jogo) < GETUTCDATE()
          AND data_jogo > DATEADD(DAY, -2, GETUTCDATE())
          AND estado <> 'cancelado'`
    );
    for (const j of jogos.recordset) {
      const flagados = await query(
        `UPDATE inscricoes SET no_show = 1
          OUTPUT INSERTED.utilizador_id
          WHERE jogo_id = @jid AND estado = 'confirmado'
            AND checkin_at IS NULL AND (no_show IS NULL OR no_show = 0)`,
        { jid: j.id }
      );
      for (const row of (flagados.recordset || [])) {
        await query(
          `UPDATE utilizadores SET no_show_count = ISNULL(no_show_count,0) + 1 WHERE id = @id`,
          { id: row.utilizador_id }
        );
      }
      await query(`UPDATE jogos SET checkin_processado = 1 WHERE id = @id`, { id: j.id });
    }
  } catch (err) {
    console.error('[Scheduler] processarNoShows erro:', err.message);
  }
}

/**
 * Recalcula utilizadores.total_mvp a cada hora.
 * Para cada jogo "fechado" (>48h), o(s) votado(s) com mais votos conta(m)
 * +1 MVP. Em caso de empate, todos os empatados ganham MVP nesse jogo.
 */
async function sincronizarTotaisMVP() {
  try {
    await query(
      `;WITH votos_por_jogo AS (
          SELECT v.jogo_id, v.votado_id, COUNT(*) AS c
            FROM mvp_votos v
            JOIN jogos j ON j.id = v.jogo_id
           WHERE DATEADD(HOUR, 48, j.data_jogo) < GETUTCDATE()
           GROUP BY v.jogo_id, v.votado_id
       ),
       rank_por_jogo AS (
          SELECT jogo_id, votado_id, c,
                 MAX(c) OVER (PARTITION BY jogo_id) AS max_c
            FROM votos_por_jogo
       ),
       vencedores AS (
          SELECT votado_id AS uid, COUNT(*) AS total
            FROM rank_por_jogo
           WHERE c = max_c
           GROUP BY votado_id
       )
       UPDATE u SET total_mvp = ISNULL(v.total, 0)
         FROM utilizadores u
         LEFT JOIN vencedores v ON v.uid = u.id`
    );
  } catch (err) {
    console.error('[Scheduler] sincronizarTotaisMVP erro:', err.message);
  }
}

/**
 * Recalcula total_vitorias / total_derrotas / total_empates a partir
 * de resultados já registados + inscricoes_equipa (lado A/B).
 */
async function sincronizarTotaisVitorias() {
  try {
    await query(
      `;WITH base AS (
          SELECT em.utilizador_id AS uid,
                 CASE
                   WHEN ie.lado = 'A' AND r.golos_equipa_a > r.golos_equipa_b THEN 'V'
                   WHEN ie.lado = 'B' AND r.golos_equipa_b > r.golos_equipa_a THEN 'V'
                   WHEN ie.lado = 'A' AND r.golos_equipa_a < r.golos_equipa_b THEN 'D'
                   WHEN ie.lado = 'B' AND r.golos_equipa_b < r.golos_equipa_a THEN 'D'
                   WHEN r.golos_equipa_a = r.golos_equipa_b THEN 'E'
                 END AS outcome
            FROM inscricoes_equipa ie
            JOIN equipa_membros em ON em.equipa_id = ie.equipa_id
            JOIN resultado_jogo r ON r.jogo_id    = ie.jogo_id
           WHERE ie.estado = 'confirmado'
       ),
       agg AS (
          SELECT uid,
                 SUM(CASE WHEN outcome='V' THEN 1 ELSE 0 END) AS v,
                 SUM(CASE WHEN outcome='D' THEN 1 ELSE 0 END) AS d,
                 SUM(CASE WHEN outcome='E' THEN 1 ELSE 0 END) AS e
            FROM base
           GROUP BY uid
       )
       UPDATE u SET
         total_vitorias = ISNULL(a.v, 0),
         total_derrotas = ISNULL(a.d, 0),
         total_empates  = ISNULL(a.e, 0)
         FROM utilizadores u
         LEFT JOIN agg a ON a.uid = u.id`
    );
  } catch (err) {
    console.error('[Scheduler] sincronizarTotaisVitorias erro:', err.message);
  }
}

/**
 * Auto-cancela jogos que começam em ~10 minutos com menos de 50% de vagas preenchidas.
 */
async function autoCancelarJogosVazios() {
  try {
    const jogos = await query(`
      SELECT j.id, j.titulo, j.max_jogadores, j.criador_id,
             COUNT(CASE WHEN i.estado='confirmado' THEN 1 END) AS total_confirmados
      FROM jogos j
      LEFT JOIN inscricoes i ON i.jogo_id = j.id
      WHERE j.estado IN ('aberto', 'cheio')
        AND j.auto_cancelado IS NULL
        AND j.data_jogo BETWEEN DATEADD(MINUTE, 8, GETUTCDATE()) AND DATEADD(MINUTE, 12, GETUTCDATE())
      GROUP BY j.id, j.titulo, j.max_jogadores, j.criador_id
      HAVING COUNT(CASE WHEN i.estado='confirmado' THEN 1 END) < j.max_jogadores / 2
    `);
    for (const j of jogos.recordset) {
      await query(
        `UPDATE jogos SET estado='cancelado', auto_cancelado=1, updated_at=GETUTCDATE() WHERE id=@id`,
        { id: j.id }
      );
      const inscritos = await query(
        `SELECT utilizador_id FROM inscricoes WHERE jogo_id=@id AND estado='confirmado'`,
        { id: j.id }
      );
      for (const insc of inscritos.recordset) {
        try {
          await criarNotificacao({
            utilizadorId: insc.utilizador_id,
            tipo: 'cancelamento',
            titulo: '⚠️ Jogo cancelado automaticamente',
            mensagem: `O jogo "${j.titulo}" foi cancelado por não ter jogadores suficientes (menos de metade das vagas preenchidas).`,
            jogoId: j.id,
          });
        } catch {}
      }
    }
    if (jogos.recordset.length > 0) {
      console.log(`[Scheduler] autoCancelarJogosVazios: ${jogos.recordset.length} jogo(s) cancelado(s).`);
    }
  } catch (err) {
    console.error('[Scheduler] autoCancelarJogosVazios erro:', err.message);
  }
}

/**
 * Envia lembretes 2h antes do jogo a todos os participantes confirmados.
 */
async function enviarLembretes2H() {
  try {
    const jogos = await query(`
      SELECT j.id, j.titulo, j.local, j.regiao
      FROM jogos j
      WHERE j.estado IN ('aberto','cheio')
        AND j.lembrete_2h_enviado IS NULL
        AND j.data_jogo BETWEEN DATEADD(MINUTE, 110, GETUTCDATE()) AND DATEADD(MINUTE, 130, GETUTCDATE())
    `);
    for (const j of jogos.recordset) {
      const inscritos = await query(
        `SELECT utilizador_id FROM inscricoes WHERE jogo_id=@id AND estado='confirmado'`,
        { id: j.id }
      );
      const local = j.local || j.regiao || 'local definido';
      for (const insc of inscritos.recordset) {
        try {
          await criarNotificacao({
            utilizadorId: insc.utilizador_id,
            tipo: 'lembrete',
            titulo: '⚽ O teu jogo começa em 2 horas!',
            mensagem: `"${j.titulo}" em ${local}. Não te esqueças!`,
            jogoId: j.id,
            acaoUrl: `/jogos/${j.id}`,
          });
        } catch {}
      }
      await query(
        `UPDATE jogos SET lembrete_2h_enviado=1, updated_at=GETUTCDATE() WHERE id=@id`,
        { id: j.id }
      );
    }
    if (jogos.recordset.length > 0) {
      console.log(`[Scheduler] enviarLembretes2H: ${jogos.recordset.length} lembrete(s) enviado(s).`);
    }
  } catch (err) {
    console.error('[Scheduler] enviarLembretes2H erro:', err.message);
  }
}

// Processa deadlines de reservas pendentes (Fase D).
async function processarReservasPendentes() {
  try {
    const { processarDeadlinesReserva } = require('../controllers/pagamentosController');
    const n = await processarDeadlinesReserva();
    if (n > 0) console.log(`💳 ${n} reserva(s) processada(s) (expirada/confirmada).`);
  } catch (err) {
    console.error('[Scheduler] processarReservasPendentes erro:', err.message);
  }
}

// Guarda de concorrência para evitar sobreposição de ticks.
const _inFlight = new Set();
async function runOnce(nome, fn) {
  if (_inFlight.has(nome)) return; // ignora se anterior ainda corre
  _inFlight.add(nome);
  try { await fn(); }
  catch (err) { console.error(`[Scheduler] ${nome} falhou:`, err.message); }
  finally { _inFlight.delete(nome); }
}

// Pequena pausa para libertar o event-loop / pool entre queries pesadas.
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function iniciarScheduler() {
  console.log('⏰ Scheduler iniciado (tick de 5min).');

  // Tick imediato ao arranque (em cadeia, não em paralelo, para não
  // consumir todas as conexões do pool ao mesmo tempo).
  (async () => {
    await runOnce('limparExpiradas', limparExpiradas);
    await runOnce('gerarPerguntasPosJogo', gerarPerguntasPosJogo);
    await runOnce('gerarPedidosAvaliacaoCampo', gerarPedidosAvaliacaoCampo);
    await runOnce('gerarVotacoesMVP', gerarVotacoesMVP);
    await runOnce('processarNoShows', processarNoShows);
    await runOnce('sincronizarTotaisUtilizadores', sincronizarTotaisUtilizadores);
    await runOnce('sincronizarTotaisMVP', sincronizarTotaisMVP);
    await runOnce('sincronizarTotaisVitorias', sincronizarTotaisVitorias);
    await runOnce('processarReservasPendentes', processarReservasPendentes);
    await runOnce('avaliarConquistasTodos', avaliarConquistasTodos);
    await runOnce('autoCancelarJogosVazios', autoCancelarJogosVazios);
    await runOnce('enviarLembretes2H', enviarLembretes2H);
  })();

  // Tick 5min: apenas trabalho "leve" e recorrente.
  setInterval(async () => {
    await runOnce('limparExpiradas', limparExpiradas);
    await runOnce('gerarPerguntasPosJogo', gerarPerguntasPosJogo);
    await runOnce('gerarPedidosAvaliacaoCampo', gerarPedidosAvaliacaoCampo);
    await runOnce('gerarVotacoesMVP', gerarVotacoesMVP);
    await runOnce('processarNoShows', processarNoShows);
    await runOnce('processarReservasPendentes', processarReservasPendentes);
    await runOnce('autoCancelarJogosVazios', autoCancelarJogosVazios);
    await runOnce('enviarLembretes2H', enviarLembretes2H);
  }, 5 * 60 * 1000);

  // Tick 1h: agregações pesadas + avaliação de conquistas.
  setInterval(async () => {
    await runOnce('sincronizarTotaisUtilizadores', sincronizarTotaisUtilizadores);
    await runOnce('sincronizarTotaisMVP', sincronizarTotaisMVP);
    await runOnce('sincronizarTotaisVitorias', sincronizarTotaisVitorias);
    await runOnce('avaliarConquistasTodos', avaliarConquistasTodos);
  }, 60 * 60 * 1000);
}

// ── Avaliar conquistas para todos os utilizadores ativos ────
// Processa em lotes com pequena pausa para não saturar o pool DB.
const CONQUISTAS_BATCH   = 25;
const CONQUISTAS_SLEEP_MS = 150;
async function avaliarConquistasTodos() {
  const { avaliarConquistas } = require('../controllers/conquistasController');
  const r = await query(
    `SELECT DISTINCT id FROM utilizadores
       WHERE ativo = 1 AND (ISNULL(total_jogos,0) > 0 OR ISNULL(total_mvp,0) > 0)`
  );
  const users = r.recordset || [];
  let total = 0;
  for (let i = 0; i < users.length; i++) {
    try {
      const novas = await avaliarConquistas(users[i].id);
      total += novas.length;
    } catch (e) {
      console.warn('[Scheduler] conquistas user', users[i].id, e.message);
    }
    // Pausa a cada lote para deixar o pool respirar.
    if ((i + 1) % CONQUISTAS_BATCH === 0) await sleep(CONQUISTAS_SLEEP_MS);
  }
  if (total > 0) console.log(`🏅 ${total} conquista(s) desbloqueada(s) no tick (${users.length} users).`);
}

module.exports = { iniciarScheduler };
