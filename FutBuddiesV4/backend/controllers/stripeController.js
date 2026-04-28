// ============================================================
//  FutBuddies - Stripe Connect Controller
//  Onboarding de donos de campo + eventos webhook
// ============================================================

const { query } = require('../config/database');
const { stripe, ativo, WEBHOOK_SECRET, APP_BASE_URL } = require('../config/stripe');

// ── Obter / criar conta Connect do utilizador ────────────────
async function getOrCreateAccount(userId, email, nome) {
  const exist = await query(
    `SELECT id, stripe_account_id FROM stripe_connect_accounts WHERE utilizador_id = @uid`,
    { uid: userId }
  );
  if (exist.recordset.length > 0) return exist.recordset[0].stripe_account_id;

  const account = await stripe.accounts.create({
    type: 'express',
    country: 'PT',
    email,
    business_profile: { name: nome || `Dono de Campo #${userId}`, product_description: 'Aluguer de campos de futebol' },
    capabilities: {
      card_payments: { requested: true },
      transfers:     { requested: true },
    },
    metadata: { futbuddies_user_id: String(userId) },
  });

  await query(
    `INSERT INTO stripe_connect_accounts (utilizador_id, stripe_account_id, status)
     VALUES (@uid, @aid, 'pendente')`,
    { uid: userId, aid: account.id }
  );

  return account.id;
}

// POST /api/stripe/connect/onboarding
// Cria (ou continua) o fluxo de onboarding — devolve URL para o utilizador completar
async function iniciarOnboarding(req, res) {
  try {
    if (!ativo()) return res.status(503).json({ sucesso: false, mensagem: 'Pagamentos desativados (Stripe não configurado).' });
    const uid = req.utilizador.id;
    const userR = await query(`SELECT email, nome, user_role FROM utilizadores WHERE id = @id`, { id: uid });
    if (!userR.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Utilizador não encontrado.' });
    const { email, nome, user_role } = userR.recordset[0];

    // ⚠ Só utilizadores aprovados como FIELD_OWNER (via candidatura) podem configurar pagamentos
    if (user_role !== 'FIELD_OWNER') {
      return res.status(403).json({
        sucesso: false,
        mensagem: 'Precisas de uma candidatura aprovada antes de configurar pagamentos.',
        requer_candidatura: true,
      });
    }

    const accountId = await getOrCreateAccount(uid, email, nome);
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${APP_BASE_URL}/dono-campo?onboarding=refresh`,
      return_url:  `${APP_BASE_URL}/dono-campo?onboarding=ok`,
      type: 'account_onboarding',
    });

    res.json({ sucesso: true, url: link.url });
  } catch (err) {
    console.error('[Stripe] iniciarOnboarding:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao iniciar onboarding.' });
  }
}

// GET /api/stripe/connect/status
// Devolve o estado da conta do dono
async function obterEstadoConta(req, res) {
  try {
    const uid = req.utilizador.id;
    const r = await query(
      `SELECT stripe_account_id, status, details_submitted, charges_enabled, payouts_enabled, requirements_json
       FROM stripe_connect_accounts WHERE utilizador_id = @uid`,
      { uid }
    );
    if (!r.recordset.length) return res.json({ sucesso: true, conta: null });

    const conta = r.recordset[0];

    // Refresh do estado junto da Stripe
    if (ativo()) {
      try {
        const acc = await stripe.accounts.retrieve(conta.stripe_account_id);
        const newStatus =
          acc.charges_enabled && acc.payouts_enabled ? 'ativo' :
          acc.requirements?.disabled_reason ? 'acao_necessaria' : 'pendente';

        await query(
          `UPDATE stripe_connect_accounts SET
             status=@st, details_submitted=@ds, charges_enabled=@ce, payouts_enabled=@pe,
             requirements_json=@rq, updated_at=GETUTCDATE()
           WHERE utilizador_id=@uid`,
          { uid, st: newStatus,
            ds: acc.details_submitted ? 1 : 0,
            ce: acc.charges_enabled ? 1 : 0,
            pe: acc.payouts_enabled ? 1 : 0,
            rq: JSON.stringify(acc.requirements || {}) }
        );
        conta.status = newStatus;
        conta.details_submitted = acc.details_submitted;
        conta.charges_enabled   = acc.charges_enabled;
        conta.payouts_enabled   = acc.payouts_enabled;
      } catch (e) { /* ignorar refresh falhado */ }
    }

    res.json({ sucesso: true, conta });
  } catch (err) {
    console.error('[Stripe] obterEstadoConta:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// POST /api/stripe/connect/dashboard-link
// Cria um link para o dashboard Express do Stripe
async function linkDashboard(req, res) {
  try {
    if (!ativo()) return res.status(503).json({ sucesso: false, mensagem: 'Stripe desativado.' });
    const r = await query(
      `SELECT stripe_account_id FROM stripe_connect_accounts WHERE utilizador_id = @uid`,
      { uid: req.utilizador.id }
    );
    if (!r.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Sem conta Stripe.' });
    const loginLink = await stripe.accounts.createLoginLink(r.recordset[0].stripe_account_id);
    res.json({ sucesso: true, url: loginLink.url });
  } catch (err) {
    console.error('[Stripe] linkDashboard:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// POST /api/stripe/webhook  (raw body!)
// Trata eventos: payment_intent.succeeded, .payment_failed, charge.refunded, account.updated
async function webhook(req, res) {
  if (!ativo()) return res.status(503).send('stripe disabled');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Webhook] assinatura inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotência
  try {
    const exist = await query(`SELECT id FROM stripe_events WHERE id = @id`, { id: event.id });
    if (exist.recordset.length) return res.json({ received: true, duplicated: true });
    await query(`INSERT INTO stripe_events (id, tipo) VALUES (@id, @tipo)`,
                { id: event.id, tipo: event.type });
  } catch (e) { /* continuar mesmo se falhar */ }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        await query(
          `UPDATE pagamentos SET status='succeeded', stripe_charge_id=@ch, updated_at=GETUTCDATE()
           WHERE stripe_payment_intent_id=@pi`,
          { pi: pi.id, ch: pi.latest_charge || null }
        );
        // Verificar se o jogo ficou totalmente pago
        const linha = await query(
          `SELECT jogo_id FROM pagamentos WHERE stripe_payment_intent_id=@pi`, { pi: pi.id }
        );
        if (linha.recordset[0]?.jogo_id) {
          await verificarConfirmacaoReserva(linha.recordset[0].jogo_id);
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        await query(
          `UPDATE pagamentos SET status='failed', updated_at=GETUTCDATE()
           WHERE stripe_payment_intent_id=@pi`,
          { pi: pi.id }
        );
        break;
      }
      case 'charge.refunded': {
        const ch = event.data.object;
        await query(
          `UPDATE pagamentos SET status='refunded', refund_id=@rf, updated_at=GETUTCDATE()
           WHERE stripe_charge_id=@ch`,
          { ch: ch.id, rf: ch.refunds?.data?.[0]?.id || null }
        );
        break;
      }
      case 'account.updated': {
        const acc = event.data.object;
        const ce = acc.charges_enabled, pe = acc.payouts_enabled;
        const newStatus = ce && pe ? 'ativo' : (acc.requirements?.disabled_reason ? 'acao_necessaria' : 'pendente');
        await query(
          `UPDATE stripe_connect_accounts SET
             status=@st, details_submitted=@ds, charges_enabled=@ce, payouts_enabled=@pe,
             requirements_json=@rq, updated_at=GETUTCDATE()
           WHERE stripe_account_id=@aid`,
          { aid: acc.id, st: newStatus,
            ds: acc.details_submitted ? 1 : 0,
            ce: ce ? 1 : 0, pe: pe ? 1 : 0,
            rq: JSON.stringify(acc.requirements || {}) }
        );
        break;
      }
      default:
        // ignorar
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[Webhook] erro a processar:', err);
    res.status(500).json({ error: err.message });
  }
}

// Helper: verifica se já foi pago o suficiente e confirma a reserva do jogo
async function verificarConfirmacaoReserva(jogoId) {
  const jR = await query(
    `SELECT preco_total_cents, modelo_pagamento, reserva_estado FROM jogos WHERE id = @id`,
    { id: jogoId }
  );
  const j = jR.recordset[0];
  if (!j || j.reserva_estado === 'confirmada' || j.reserva_estado === 'cancelada') return;

  const sR = await query(
    `SELECT ISNULL(SUM(valor_cents), 0) AS total
     FROM pagamentos WHERE jogo_id=@id AND status='succeeded'`,
    { id: jogoId }
  );
  const pago = sR.recordset[0].total;

  if (pago >= (j.preco_total_cents || 0)) {
    await query(
      `UPDATE jogos SET reserva_estado='confirmada', updated_at=GETUTCDATE() WHERE id=@id`,
      { id: jogoId }
    );
    // Notificar criador + jogadores (opcional)
    await query(
      `INSERT INTO notificacoes (utilizador_id, tipo, titulo, mensagem, jogo_id, acao_url, created_at)
       SELECT DISTINCT utilizador_id, 'sistema', '✅ Reserva confirmada',
              'O teu jogo foi totalmente pago. Reserva confirmada!', @id, CONCAT('/jogos/', @id), GETUTCDATE()
       FROM pagamentos WHERE jogo_id=@id AND status='succeeded'`,
      { id: jogoId }
    );
  }
}

module.exports = {
  iniciarOnboarding,
  obterEstadoConta,
  linkDashboard,
  webhook,
  verificarConfirmacaoReserva,
};
