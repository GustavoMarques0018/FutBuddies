// ============================================================
//  FutBuddies - Controlador de Notificações
// ============================================================

const { query } = require('../config/database');

// GET /api/notificacoes
// Lista as notificações do utilizador atual (não expiradas), mais recentes primeiro
async function listarNotificacoes(req, res) {
  try {
    const utilizadorId = req.utilizador.id;
    const { apenas_nao_lidas } = req.query;

    let where = 'WHERE n.utilizador_id = @uid AND (n.expira_em IS NULL OR n.expira_em > GETUTCDATE())';
    if (apenas_nao_lidas === 'true') where += ' AND n.lida = 0';

    const resultado = await query(
      `SELECT TOP 50 n.id, n.tipo, n.titulo, n.mensagem, n.jogo_id, n.equipa_id,
                     n.acao_url, n.lida, n.respondida, n.created_at, n.expira_em,
                     j.titulo AS jogo_titulo,
                     e.nome AS equipa_nome, e.emblema AS equipa_emblema
         FROM notificacoes n
         LEFT JOIN jogos  j ON j.id = n.jogo_id
         LEFT JOIN equipas e ON e.id = n.equipa_id
         ${where}
         ORDER BY n.created_at DESC`,
      { uid: utilizadorId }
    );

    res.json({ sucesso: true, notificacoes: resultado.recordset });
  } catch (err) {
    console.error('[Notif] Erro listar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar notificações.' });
  }
}

// GET /api/notificacoes/nao-lidas-count
// Devolve apenas o contador — chamado com frequência (polling na navbar)
async function contarNaoLidas(req, res) {
  try {
    const utilizadorId = req.utilizador.id;
    const r = await query(
      `SELECT COUNT(*) AS total FROM notificacoes
         WHERE utilizador_id = @uid AND lida = 0
           AND (expira_em IS NULL OR expira_em > GETUTCDATE())`,
      { uid: utilizadorId }
    );
    res.json({ sucesso: true, total: r.recordset[0].total });
  } catch (err) {
    console.error('[Notif] Erro contar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// PUT /api/notificacoes/:id/lida
async function marcarLida(req, res) {
  try {
    const { id } = req.params;
    const utilizadorId = req.utilizador.id;
    const r = await query(
      `UPDATE notificacoes SET lida = 1
         WHERE id = @id AND utilizador_id = @uid`,
      { id: parseInt(id), uid: utilizadorId }
    );
    if (r.rowsAffected[0] === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Notificação não encontrada.' });
    res.json({ sucesso: true });
  } catch (err) {
    console.error('[Notif] Erro marcarLida:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// PUT /api/notificacoes/lidas
// Marca TODAS do utilizador como lidas
async function marcarTodasLidas(req, res) {
  try {
    const utilizadorId = req.utilizador.id;
    await query(
      `UPDATE notificacoes SET lida = 1 WHERE utilizador_id = @uid AND lida = 0`,
      { uid: utilizadorId }
    );
    res.json({ sucesso: true });
  } catch (err) {
    console.error('[Notif] Erro marcarTodasLidas:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// DELETE /api/notificacoes/:id
async function eliminarNotificacao(req, res) {
  try {
    const { id } = req.params;
    const utilizadorId = req.utilizador.id;
    const r = await query(
      `DELETE FROM notificacoes WHERE id = @id AND utilizador_id = @uid`,
      { id: parseInt(id), uid: utilizadorId }
    );
    if (r.rowsAffected[0] === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Notificação não encontrada.' });
    res.json({ sucesso: true });
  } catch (err) {
    console.error('[Notif] Erro eliminar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// ── Helpers internos (usados por outros controllers / scheduler) ──

/**
 * Cria uma notificação para um utilizador específico.
 * Usa-se em: broadcasts do admin, gerador pós-jogo (Fase C), eventos de sistema.
 */
async function criarNotificacao({ utilizadorId, tipo, titulo, mensagem = null,
                                   jogoId = null, equipaId = null, acaoUrl = null,
                                   expiraEm = null, enviarEmail: enviarEmailOpt = true }) {
  await query(
    `INSERT INTO notificacoes (utilizador_id, tipo, titulo, mensagem, jogo_id, equipa_id, acao_url, expira_em)
       VALUES (@uid, @tipo, @titulo, @msg, @jid, @eid, @url, @exp)`,
    {
      uid: utilizadorId, tipo, titulo, msg: mensagem,
      jid: jogoId, eid: equipaId, url: acaoUrl, exp: expiraEm,
    }
  );

  const appUrl = process.env.APP_BASE_URL || 'https://futbuddies.vercel.app';
  const ctaUrl = acaoUrl
    ? (acaoUrl.startsWith('http') ? acaoUrl : `${appUrl}${acaoUrl}`)
    : `${appUrl}/notificacoes`;

  // ── Web Push (best-effort) ───────────────────────────────
  try {
    const { enviarPush } = require('./webPushController');
    enviarPush(utilizadorId, {
      titulo, corpo: mensagem || '',
      url: acaoUrl || '/notificacoes',
    }).catch(() => {});
  } catch { /* push controller pode não estar carregado */ }

  // ── Email (best-effort, opt-in via coluna receber_emails) ──
  if (enviarEmailOpt) {
    enviarEmailNotificacao({ utilizadorId, titulo, mensagem, ctaUrl, tipo })
      .catch((e) => console.warn('[Notif] email falhou:', e.message));
  }
}

/**
 * Envia versão email de uma notificação. Lê o email do utilizador e
 * verifica a flag `receber_emails`. Best-effort, nunca bloqueia.
 */
async function enviarEmailNotificacao({ utilizadorId, titulo, mensagem, ctaUrl, tipo }) {
  const mailer = require('../config/mailer');
  if (!mailer.ativo()) return;

  const r = await query(
    `SELECT email, nome,
            COALESCE(receber_emails, 1) AS receber_emails
       FROM utilizadores WHERE id = @uid`,
    { uid: utilizadorId }
  );
  const u = r.recordset[0];
  if (!u || !u.email || !u.receber_emails) return;

  // Para tipos "ruidosos" (chat) podemos no futuro filtrar por preferências;
  // por agora envia tudo.
  void tipo;

  const corpoHtml = `<p>Olá ${(u.nome || '').split(' ')[0] || 'jogador'},</p>
<p>${(mensagem || '').replace(/\n/g, '<br>')}</p>`;
  const corpoTxt = `Olá ${(u.nome || '').split(' ')[0] || 'jogador'},\n\n${mensagem || ''}\n\nAbre: ${ctaUrl}`;

  await mailer.enviarEmail({
    to: u.email,
    subject: `[FutBuddies] ${titulo}`,
    text: corpoTxt,
    html: mailer.gerarHtml({
      titulo, corpo: corpoHtml,
      ctaLabel: 'Abrir no FutBuddies', ctaUrl,
    }),
  });
}

/**
 * Cria a mesma notificação para uma lista de utilizadores (batch broadcast).
 */
async function criarNotificacaoBroadcast({ utilizadorIds, tipo, titulo,
                                            mensagem = null, acaoUrl = null,
                                            expiraEm = null }) {
  if (!utilizadorIds?.length) return;
  // SQL Server não tem array nativo — inserimos um a um. Para escalas maiores
  // trocar para tabela temporária + INSERT ... SELECT. OK para <1000 users.
  for (const uid of utilizadorIds) {
    await criarNotificacao({ utilizadorId: uid, tipo, titulo, mensagem, acaoUrl, expiraEm });
  }
}

module.exports = {
  listarNotificacoes, contarNaoLidas, marcarLida, marcarTodasLidas, eliminarNotificacao,
  // helpers
  criarNotificacao, criarNotificacaoBroadcast,
};
