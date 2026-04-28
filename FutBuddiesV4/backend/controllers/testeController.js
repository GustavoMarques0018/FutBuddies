// ============================================================
//  FutBuddies - Rotas de TESTE (apagar em produção)
// ============================================================
const { stripe, ativo } = require('../config/stripe');

// Conta de destino fixada para testes — muda se mudares de conta Connect
const DEST_ACCOUNT = process.env.STRIPE_TEST_DESTINATION || 'acct_1TOia';

// POST /api/test/create-session
// Cria um PaymentIntent de 50€ com 10% de comissão para a plataforma
// e 45€ para a conta Connect do dono.
async function criarSessaoTeste(req, res) {
  try {
    if (!ativo()) return res.status(503).json({ sucesso: false, mensagem: 'Stripe desativado.' });

    const destino = req.body?.destino || DEST_ACCOUNT;
    const valor   = 5000; // 50.00 €
    const comissao = Math.round(valor * 0.10); // 10% -> 500 cents (5€)

    const pi = await stripe.paymentIntents.create({
      amount: valor,
      currency: 'eur',
      application_fee_amount: comissao,
      transfer_data: { destination: destino },
      automatic_payment_methods: { enabled: true },
      description: 'FutBuddies · Teste de reserva 50€',
      metadata: { futbuddies_teste: '1' },
    });

    res.json({
      sucesso: true,
      mensagem: 'PaymentIntent de teste criado. Usa o clientSecret no frontend ou confirma com CLI.',
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret,
      valor_cents: valor,
      comissao_cents: comissao,
      liquido_dono_cents: valor - comissao,
      destino,
    });
  } catch (err) {
    console.error('[Teste] create-session:', err.message);
    res.status(500).json({ sucesso: false, mensagem: err.message });
  }
}

module.exports = { criarSessaoTeste };
