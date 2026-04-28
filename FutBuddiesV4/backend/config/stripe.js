// ============================================================
//  FutBuddies - Stripe Helper (Connect + Payments)
// ============================================================
//
//  Requer as seguintes variáveis em .env:
//    STRIPE_SECRET_KEY        = sk_test_...
//    STRIPE_WEBHOOK_SECRET    = whsec_...
//    STRIPE_COMISSAO_PCT      = 5     (percentagem; default 5%)
//    APP_BASE_URL             = http://localhost:3000 (frontend)
//
// ============================================================

const Stripe = require('stripe');

const SECRET_KEY     = process.env.STRIPE_SECRET_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const COMISSAO_PCT   = parseFloat(process.env.STRIPE_COMISSAO_PCT || '5');
const APP_BASE_URL   = process.env.APP_BASE_URL || 'http://localhost:3000';

if (!SECRET_KEY) {
  console.warn('⚠️  STRIPE_SECRET_KEY ausente — funcionalidades de pagamento desativadas.');
} else {
  const prefix = SECRET_KEY.substring(0, 12);
  const isTest = SECRET_KEY.startsWith('sk_test_');
  const isLive = SECRET_KEY.startsWith('sk_live_');
  if (!isTest && !isLive) {
    console.error('❌ STRIPE_SECRET_KEY em formato inválido. Esperado sk_test_... ou sk_live_...  Recebido:', prefix + '...');
  } else {
    console.log(`✅ Stripe configurado · modo=${isTest ? 'TEST' : 'LIVE'} · prefix=${prefix}... · comissão=${COMISSAO_PCT}%`);
  }
  if (!WEBHOOK_SECRET) {
    console.warn('⚠️  STRIPE_WEBHOOK_SECRET ausente — webhook não vai validar assinaturas.');
  }
}

const stripe = SECRET_KEY ? new Stripe(SECRET_KEY, { apiVersion: '2023-10-16' }) : null;

// Diagnóstico: valida no arranque que a chave é aceite pelo Stripe
if (stripe) {
  stripe.balance.retrieve()
    .then(() => console.log('✅ Stripe API key aceite pelo Stripe.'))
    .catch((e) => console.error('❌ Stripe API key rejeitada:', e.type, '·', e.message));
}

function ativo() { return !!stripe; }

// Calcula comissão FutBuddies (em cêntimos) a partir do valor total
function calcularComissaoCents(valorCents) {
  return Math.max(1, Math.round((valorCents * COMISSAO_PCT) / 100));
}

module.exports = {
  stripe,
  ativo,
  WEBHOOK_SECRET,
  APP_BASE_URL,
  COMISSAO_PCT,
  calcularComissaoCents,
};
