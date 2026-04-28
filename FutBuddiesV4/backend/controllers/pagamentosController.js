// ============================================================
//  FutBuddies - Controlador de Pagamentos (Stripe)
// ============================================================

const { query } = require('../config/database');
const { stripe, ativo, calcularComissaoCents } = require('../config/stripe');
const { verificarConfirmacaoReserva } = require('./stripeController');

// POST /api/jogos/:id/pagar
// Cria um PaymentIntent para o utilizador atual pagar a sua quota.
// Usa destination charge (Stripe Connect) + application_fee_amount para
// garantir que o dono do campo só recebe após o jogo confirmado (captura
// manual não é usada aqui, mas o Stripe só liberta após "succeeded").
async function criarPagamento(req, res) {
  try {
    if (!ativo()) return res.status(503).json({ sucesso: false, mensagem: 'Pagamentos desativados.' });

    const jogoId = parseInt(req.params.id);
    const uid = req.utilizador.id;

    console.log(`[Pag] criarPagamento · jogo=${jogoId} user=${uid}`);

    // Carrega jogo + campo + conta Stripe do dono
    const jR = await query(
      `SELECT j.id, j.modelo_pagamento, j.preco_total_cents, j.preco_por_jogador_cents,
              j.reserva_estado, j.criador_id, j.titulo, j.campo_id,
              c.dono_id,
              sca.stripe_account_id, sca.charges_enabled
       FROM jogos j
       LEFT JOIN campos c ON c.id = j.campo_id
       LEFT JOIN stripe_connect_accounts sca ON sca.utilizador_id = c.dono_id
       WHERE j.id = @id`,
      { id: jogoId }
    );
    if (!jR.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });
    const j = jR.recordset[0];

    console.log(`[Pag] jogo=${j.id} modelo=${j.modelo_pagamento} total=${j.preco_total_cents}c porJog=${j.preco_por_jogador_cents}c reserva=${j.reserva_estado} campo=${j.campo_id} dono=${j.dono_id} acct=${j.stripe_account_id} charges=${j.charges_enabled}`);

    if (!j.modelo_pagamento) return res.status(400).json({ sucesso: false, mensagem: 'Jogo gratuito.' });
    if (j.reserva_estado === 'cancelada' || j.reserva_estado === 'expirada')
      return res.status(400).json({ sucesso: false, mensagem: 'Reserva cancelada.' });
    if (!j.campo_id)
      return res.status(400).json({ sucesso: false, mensagem: 'Este jogo não está associado a um campo parceiro.' });
    if (!j.stripe_account_id) {
      console.error('[Pag] ❌ Dono sem conta Stripe conectada. dono_id=', j.dono_id);
      return res.status(400).json({ sucesso: false, mensagem: 'O dono do campo ainda não configurou a conta Stripe.' });
    }
    if (!j.charges_enabled) {
      console.error('[Pag] ❌ Conta Stripe do dono existe mas charges_enabled=0. acct=', j.stripe_account_id);
      return res.status(400).json({ sucesso: false, mensagem: 'A conta Stripe do dono do campo ainda não está ativada.' });
    }
    if (!/^acct_[A-Za-z0-9]+$/.test(j.stripe_account_id)) {
      console.error('[Pag] ❌ stripe_account_id em formato inválido:', j.stripe_account_id);
      return res.status(500).json({ sucesso: false, mensagem: 'ID da conta Stripe do dono é inválido.' });
    }

    // Decidir valor a cobrar
    let valor;
    if (j.modelo_pagamento === 'total') {
      if (uid !== j.criador_id)
        return res.status(403).json({ sucesso: false, mensagem: 'Só o criador paga no modelo total.' });
      valor = j.preco_total_cents;
    } else {
      valor = j.preco_por_jogador_cents;
    }

    if (!valor || valor < 50) {
      console.error('[Pag] ❌ Valor inválido:', valor, 'cêntimos (mínimo Stripe = 50 cêntimos = 0.50€)');
      return res.status(400).json({ sucesso: false, mensagem: 'Valor inválido (mínimo €0.50).' });
    }

    // Evitar pagamento duplicado — incluindo o caso em que o webhook ainda não fez update
    const exist = await query(
      `SELECT id, status, stripe_payment_intent_id FROM pagamentos
       WHERE jogo_id=@jid AND utilizador_id=@uid AND status IN ('pending','succeeded')
       ORDER BY id DESC`,
      { jid: jogoId, uid }
    );
    if (exist.recordset[0]?.status === 'succeeded')
      return res.status(400).json({ sucesso: false, mensagem: 'Já pagaste este jogo.' });

    // Se há um PI pending, verifica o estado real no Stripe antes de deixar criar outro
    if (exist.recordset[0]?.stripe_payment_intent_id) {
      try {
        const oldPi = await stripe.paymentIntents.retrieve(exist.recordset[0].stripe_payment_intent_id);
        if (oldPi.status === 'succeeded') {
          // Sincroniza DB e bloqueia novo pagamento
          await query(
            `UPDATE pagamentos SET status='succeeded', stripe_charge_id=@ch, updated_at=GETUTCDATE() WHERE id=@id`,
            { ch: oldPi.latest_charge || null, id: exist.recordset[0].id }
          );
          try { await verificarConfirmacaoReserva(jogoId); } catch (_) {}
          return res.status(400).json({ sucesso: false, mensagem: 'Já pagaste este jogo.', sincronizado: true });
        }
        // Se ainda está por pagar, reutiliza o mesmo client_secret (evita criar PI duplicado)
        if (['requires_payment_method','requires_confirmation','requires_action','processing'].includes(oldPi.status)) {
          console.log(`[Pag] ↻ reutiliza PI existente ${oldPi.id} status=${oldPi.status}`);
          return res.json({
            sucesso: true,
            clientSecret: oldPi.client_secret,
            paymentIntentId: oldPi.id,
            valor_cents: oldPi.amount,
            comissao_cents: oldPi.application_fee_amount || 0,
            reutilizado: true,
          });
        }
      } catch (e) {
        console.warn('[Pag] não consegui verificar PI existente:', e.message);
        // continua para criar novo
      }
    }

    const comissao = calcularComissaoCents(valor);

    console.log(`[Pag] → Stripe paymentIntents.create amount=${valor}c fee=${comissao}c destino=${j.stripe_account_id}`);

    let pi;
    try {
      pi = await stripe.paymentIntents.create({
        amount: valor,
        currency: 'eur',
        application_fee_amount: comissao,
        transfer_data: { destination: j.stripe_account_id },
        automatic_payment_methods: { enabled: true },
        metadata: {
          futbuddies_jogo_id: String(jogoId),
          futbuddies_user_id: String(uid),
          futbuddies_modelo: j.modelo_pagamento,
        },
        description: `FutBuddies · ${j.titulo}`,
      });
      console.log(`[Pag] ✅ PaymentIntent criado: ${pi.id} status=${pi.status}`);
    } catch (stripeErr) {
      console.error('[Pag] ❌ STRIPE ERROR ─────────────────────');
      console.error('  type:       ', stripeErr.type);
      console.error('  code:       ', stripeErr.code);
      console.error('  decline:    ', stripeErr.decline_code);
      console.error('  param:      ', stripeErr.param);
      console.error('  statusCode: ', stripeErr.statusCode);
      console.error('  message:    ', stripeErr.message);
      console.error('  requestId:  ', stripeErr.requestId);
      console.error('─────────────────────────────────────');
      return res.status(502).json({
        sucesso: false,
        mensagem: `Stripe recusou: ${stripeErr.message}`,
        stripe_error: { type: stripeErr.type, code: stripeErr.code, param: stripeErr.param },
      });
    }

    // Se já existe um pending, atualiza; senão cria
    if (exist.recordset[0]?.status === 'pending') {
      await query(
        `UPDATE pagamentos SET stripe_payment_intent_id=@pi, valor_cents=@v, application_fee_cents=@fee,
         stripe_account_destino=@acc, updated_at=GETUTCDATE() WHERE id=@id`,
        { pi: pi.id, v: valor, fee: comissao, acc: j.stripe_account_id, id: exist.recordset[0].id }
      );
    } else {
      await query(
        `INSERT INTO pagamentos (jogo_id, utilizador_id, valor_cents, application_fee_cents,
                                 stripe_payment_intent_id, stripe_account_destino, status)
         VALUES (@jid, @uid, @v, @fee, @pi, @acc, 'pending')`,
        { jid: jogoId, uid, v: valor, fee: comissao, pi: pi.id, acc: j.stripe_account_id }
      );
    }

    res.json({
      sucesso: true,
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      valor_cents: valor,
      comissao_cents: comissao,
    });
  } catch (err) {
    console.error('[Pag] ❌ criarPagamento erro inesperado:', err.stack || err.message);
    res.status(500).json({ sucesso: false, mensagem: err.message || 'Erro.' });
  }
}

// GET /api/jogos/:id/pagamentos
// Lista pagamentos do jogo (criador + próprios jogadores)
async function listarPagamentosJogo(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const uid = req.utilizador.id;

    const isParticipanteR = await query(
      `SELECT 1 FROM jogos WHERE id=@j AND (criador_id=@u
       OR EXISTS (SELECT 1 FROM inscricoes WHERE jogo_id=@j AND utilizador_id=@u))`,
      { j: jogoId, u: uid }
    );
    if (!isParticipanteR.recordset.length)
      return res.status(403).json({ sucesso: false, mensagem: 'Sem acesso.' });

    const r = await query(
      `SELECT p.id, p.utilizador_id, p.valor_cents, p.application_fee_cents,
              p.status, p.created_at,
              u.nome, u.nickname, u.foto_url
       FROM pagamentos p JOIN utilizadores u ON u.id = p.utilizador_id
       WHERE p.jogo_id = @id
       ORDER BY p.created_at DESC`,
      { id: jogoId }
    );

    const tot = await query(
      `SELECT ISNULL(SUM(CASE WHEN status='succeeded' THEN valor_cents ELSE 0 END), 0) AS pago_cents,
              COUNT(CASE WHEN status='succeeded' THEN 1 END) AS jogadores_pagos,
              (SELECT preco_total_cents FROM jogos WHERE id=@id) AS total_cents
       FROM pagamentos WHERE jogo_id=@id`,
      { id: jogoId }
    );

    res.json({ sucesso: true, pagamentos: r.recordset, resumo: tot.recordset[0] });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// POST /api/jogos/:id/cobrir-diferenca
// (Opção B) Jogadores cobrem o valor restante para salvar o jogo
async function cobrirDiferenca(req, res) {
  try {
    if (!ativo()) return res.status(503).json({ sucesso: false, mensagem: 'Stripe desativado.' });
    const jogoId = parseInt(req.params.id);
    const uid = req.utilizador.id;

    const jR = await query(
      `SELECT j.preco_total_cents, j.reserva_estado, j.titulo, j.campo_id,
              c.dono_id, sca.stripe_account_id, sca.charges_enabled,
              ISNULL((SELECT SUM(valor_cents) FROM pagamentos WHERE jogo_id=j.id AND status='succeeded'), 0) AS pago
       FROM jogos j LEFT JOIN campos c ON c.id = j.campo_id
       LEFT JOIN stripe_connect_accounts sca ON sca.utilizador_id = c.dono_id
       WHERE j.id = @id`, { id: jogoId }
    );
    if (!jR.recordset.length) return res.status(404).json({ sucesso: false });
    const j = jR.recordset[0];

    const diferenca = (j.preco_total_cents || 0) - j.pago;
    if (diferenca <= 0) return res.json({ sucesso: true, mensagem: 'Já está pago.', diferenca: 0 });
    if (!j.stripe_account_id || !j.charges_enabled)
      return res.status(400).json({ sucesso: false, mensagem: 'Conta do dono inativa.' });

    const comissao = calcularComissaoCents(diferenca);
    const pi = await stripe.paymentIntents.create({
      amount: diferenca,
      currency: 'eur',
      application_fee_amount: comissao,
      transfer_data: { destination: j.stripe_account_id },
      metadata: { futbuddies_jogo_id: String(jogoId), futbuddies_user_id: String(uid),
                  futbuddies_modelo: 'diferenca' },
      description: `FutBuddies · Cobrir diferença · ${j.titulo}`,
    });

    await query(
      `INSERT INTO pagamentos (jogo_id, utilizador_id, valor_cents, application_fee_cents,
                               stripe_payment_intent_id, stripe_account_destino, status)
       VALUES (@jid, @uid, @v, @fee, @pi, @acc, 'pending')`,
      { jid: jogoId, uid, v: diferenca, fee: comissao, pi: pi.id, acc: j.stripe_account_id }
    );
    res.json({ sucesso: true, clientSecret: pi.client_secret, valor_cents: diferenca });
  } catch (err) {
    console.error('[Pagamentos] cobrirDiferenca:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// Interno: cancela reservas que não atingiram o valor antes do deadline
// Retorna quantos jogos foram processados
async function processarDeadlinesReserva() {
  if (!ativo()) return 0;
  const r = await query(
    `SELECT id, preco_total_cents,
            ISNULL((SELECT SUM(valor_cents) FROM pagamentos WHERE jogo_id = j.id AND status='succeeded'), 0) AS pago
     FROM jogos j
     WHERE reserva_estado = 'pendente'
       AND deadline_pagamento IS NOT NULL
       AND deadline_pagamento < GETUTCDATE()`
  );
  let processados = 0;
  for (const j of r.recordset) {
    if (j.pago >= j.preco_total_cents) {
      await query(`UPDATE jogos SET reserva_estado='confirmada' WHERE id=@id`, { id: j.id });
    } else {
      // Cancelar jogo + refund (sai dos listings)
      await query(
        `UPDATE jogos SET reserva_estado='expirada', estado='cancelado', updated_at=GETUTCDATE() WHERE id=@id`,
        { id: j.id }
      );
      const pR = await query(
        `SELECT id, stripe_payment_intent_id FROM pagamentos
         WHERE jogo_id=@id AND status='succeeded'`, { id: j.id }
      );
      for (const p of pR.recordset) {
        try {
          const refund = await stripe.refunds.create({
            payment_intent: p.stripe_payment_intent_id,
            reverse_transfer: true,
            refund_application_fee: true,
          });
          await query(
            `UPDATE pagamentos SET status='refunded', refund_id=@rf, updated_at=GETUTCDATE() WHERE id=@id`,
            { rf: refund.id, id: p.id }
          );
        } catch (e) { console.error('[Refund] erro:', e.message); }
      }
      // Notificar criador e inscritos
      await query(
        `INSERT INTO notificacoes (utilizador_id, tipo, titulo, mensagem, jogo_id, created_at)
         SELECT DISTINCT utilizador_id, 'sistema', '❌ Reserva expirada',
                'O valor total não foi atingido a tempo. Os pagamentos foram reembolsados.',
                @id, GETUTCDATE()
         FROM pagamentos WHERE jogo_id = @id`,
        { id: j.id }
      );
    }
    processados++;
  }
  return processados;
}

// POST /api/jogos/:id/sync-pagamento  { paymentIntentId }
// Fallback para quando o webhook do Stripe não chega (ex.: dev sem `stripe listen`).
// Vai ao Stripe verificar o estado real do PI e sincroniza a linha em `pagamentos`.
async function syncPagamento(req, res) {
  try {
    if (!ativo()) return res.status(503).json({ sucesso: false, mensagem: 'Stripe desativado.' });
    const jogoId = parseInt(req.params.id);
    const uid = req.utilizador.id;
    const { paymentIntentId } = req.body || {};
    if (!paymentIntentId) return res.status(400).json({ sucesso: false, mensagem: 'paymentIntentId obrigatório.' });

    const linhaR = await query(
      `SELECT id, jogo_id, utilizador_id, status FROM pagamentos
       WHERE stripe_payment_intent_id=@pi`,
      { pi: paymentIntentId }
    );
    if (!linhaR.recordset.length)
      return res.status(404).json({ sucesso: false, mensagem: 'Pagamento não encontrado.' });
    const linha = linhaR.recordset[0];
    if (linha.jogo_id !== jogoId || linha.utilizador_id !== uid)
      return res.status(403).json({ sucesso: false, mensagem: 'Sem acesso a este pagamento.' });

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log(`[Pag] sync ${paymentIntentId} → status=${pi.status}`);

    if (pi.status === 'succeeded' && linha.status !== 'succeeded') {
      await query(
        `UPDATE pagamentos SET status='succeeded', stripe_charge_id=@ch, updated_at=GETUTCDATE() WHERE id=@id`,
        { ch: pi.latest_charge || null, id: linha.id }
      );
      try { await verificarConfirmacaoReserva(jogoId); } catch (e) { console.warn('[Pag] verificar reserva falhou:', e.message); }
      // Envio de recibo por email (best-effort)
      try {
        const { enviarReciboPorEmail } = require('../utils/recibo');
        const info = await query(
          `SELECT p.id, p.valor_cents, p.application_fee_cents, p.created_at,
                  u.nome AS pagador_nome, u.email AS pagador_email,
                  j.titulo, j.data_jogo, j.local
             FROM pagamentos p
             JOIN utilizadores u ON u.id = p.utilizador_id
             JOIN jogos j       ON j.id = p.jogo_id
            WHERE p.id = @id`, { id: linha.id }
        );
        if (info.recordset.length) {
          const r = info.recordset[0];
          enviarReciboPorEmail({
            numero: `FB-${r.id}`,
            data: r.created_at,
            pagador: { nome: r.pagador_nome, email: r.pagador_email },
            jogo: { titulo: r.titulo, data_jogo: r.data_jogo, local: r.local },
            valor_cents: r.valor_cents,
            application_fee_cents: r.application_fee_cents,
          }).catch(() => {});
        }
      } catch (e) { console.warn('[Pag] recibo falhou:', e.message); }
      return res.json({ sucesso: true, status: 'succeeded', sincronizado: true });
    }
    if (pi.status === 'canceled' || pi.last_payment_error) {
      await query(
        `UPDATE pagamentos SET status='failed', updated_at=GETUTCDATE() WHERE id=@id AND status='pending'`,
        { id: linha.id }
      );
      return res.json({ sucesso: true, status: 'failed', sincronizado: true });
    }
    res.json({ sucesso: true, status: pi.status, sincronizado: false });
  } catch (err) {
    console.error('[Pag] syncPagamento:', err.message);
    res.status(500).json({ sucesso: false, mensagem: err.message || 'Erro.' });
  }
}

// GET /api/jogos/:id/pagamento-diagnostico
// Endpoint de debug — devolve tudo o que o backend "sabe" sobre a configuração
// de Stripe para o jogo: conta do dono, charges_enabled, destino, erros Stripe.
async function diagnostico(req, res) {
  try {
    const jogoId = parseInt(req.params.id);

    const jR = await query(
      `SELECT j.id, j.titulo, j.modelo_pagamento, j.preco_total_cents,
              j.preco_por_jogador_cents, j.reserva_estado, j.campo_id,
              c.dono_id, c.nome AS campo_nome,
              sca.stripe_account_id, sca.charges_enabled, sca.payouts_enabled,
              sca.details_submitted, sca.status AS connect_status
       FROM jogos j
       LEFT JOIN campos c ON c.id = j.campo_id
       LEFT JOIN stripe_connect_accounts sca ON sca.utilizador_id = c.dono_id
       WHERE j.id = @id`, { id: jogoId }
    );

    const diag = {
      sucesso: true,
      stripe_backend_configurado: ativo(),
      stripe_key_prefix: (process.env.STRIPE_SECRET_KEY || '').substring(0, 12) || null,
      jogo: jR.recordset[0] || null,
    };

    // Se há conta, pinga o Stripe para confirmar que existe
    if (stripe && jR.recordset[0]?.stripe_account_id) {
      try {
        const acct = await stripe.accounts.retrieve(jR.recordset[0].stripe_account_id);
        diag.stripe_conta_viva = {
          id: acct.id,
          charges_enabled: acct.charges_enabled,
          payouts_enabled: acct.payouts_enabled,
          details_submitted: acct.details_submitted,
          requirements_pending: acct.requirements?.currently_due || [],
        };
      } catch (e) {
        diag.stripe_conta_erro = { type: e.type, code: e.code, message: e.message };
      }
    }

    res.json(diag);
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: err.message });
  }
}

module.exports = {
  criarPagamento,
  listarPagamentosJogo,
  cobrirDiferenca,
  processarDeadlinesReserva,
  syncPagamento,
  diagnostico,
};
