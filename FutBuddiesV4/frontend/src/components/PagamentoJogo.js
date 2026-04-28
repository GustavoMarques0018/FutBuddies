// ============================================================
//  FutBuddies - Painel de Pagamento do Jogo (Stripe Elements)
// ============================================================
import React, { useEffect, useState } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '../utils/api';
import { getStripePromise, stripeAtivo } from '../utils/stripe';
import { useToast } from './Toast';
import './PagamentoJogo.css';

const fmt = (c) => `€${((c || 0) / 100).toFixed(2)}`;

export default function PagamentoJogo({ jogo, utilizador, onAtualizar }) {
  const [resumo, setResumo] = useState(null);
  const [abrir, setAbrir]   = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [valorCents, setValorCents]     = useState(0);
  const [modo, setModo] = useState('pagar'); // 'pagar' | 'diferenca'
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const stripePromise = getStripePromise();

  const carregar = async () => {
    try {
      const { data } = await api.get(`/jogos/${jogo.id}/pagamentos`);
      setResumo(data);
    } catch { /* ignore */ }
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [jogo.id]);

  if (!jogo.modelo_pagamento) return null;

  const jaPaguei = resumo?.pagamentos?.some(
    p => p.utilizador_id === utilizador?.id && p.status === 'succeeded'
  );
  const diferenca = (jogo.preco_total_cents || 0) - (resumo?.resumo?.pago_cents || 0);
  const progresso = Math.min(100,
    ((resumo?.resumo?.pago_cents || 0) / (jogo.preco_total_cents || 1)) * 100
  );

  const deadlinePassou = jogo.deadline_pagamento && new Date(jogo.deadline_pagamento) < new Date();

  const iniciarPagamento = async (endpoint) => {
    if (!stripeAtivo()) { addToast('Stripe não configurado.', 'error'); return; }
    setLoading(true);
    try {
      const { data } = await api.post(`/jogos/${jogo.id}/${endpoint}`);
      setClientSecret(data.clientSecret);
      setValorCents(data.valor_cents);
      setModo(endpoint === 'pagar' ? 'pagar' : 'diferenca');
      setAbrir(true);
    } catch (e) {
      addToast(e.response?.data?.mensagem || 'Erro.', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="pagamento-card card">
      <div className="pag-header">
        <h3>💳 Pagamento {jogo.modelo_pagamento === 'dividido' ? '(Dividido)' : '(Total)'}</h3>
        <span className={`badge ${jogo.reserva_estado || ''}`}>
          {jogo.reserva_estado === 'confirmada' && '✅ Reserva Confirmada'}
          {jogo.reserva_estado === 'pendente'   && '⏳ Reserva Pendente'}
          {jogo.reserva_estado === 'expirada'   && '❌ Reserva Expirada'}
          {jogo.reserva_estado === 'cancelada'  && '❌ Cancelada'}
        </span>
      </div>

      <div className="pag-bar-wrap">
        <div className="pag-bar"><div className="pag-bar-fill" style={{ width: `${progresso}%` }} /></div>
        <div className="pag-bar-info">
          <strong>{fmt(resumo?.resumo?.pago_cents)}</strong> pago de <strong>{fmt(jogo.preco_total_cents)}</strong>
          <span className="tiny"> · {resumo?.resumo?.jogadores_pagos || 0} jogador(es)</span>
        </div>
      </div>

      {jogo.deadline_pagamento && jogo.reserva_estado === 'pendente' && (
        <p className="deadline">
          ⏰ Deadline: {new Date(jogo.deadline_pagamento).toLocaleString('pt-PT')}
        </p>
      )}

      <div className="pag-actions">
        {!jaPaguei && jogo.reserva_estado !== 'expirada' && jogo.reserva_estado !== 'cancelada' && (
          <button className="btn btn-primary" onClick={() => iniciarPagamento('pagar')} disabled={loading}>
            {loading ? 'A abrir…' : '💳 Pagar Agora'}
          </button>
        )}
        {jaPaguei && <span className="badge ok">✅ Já pagaste</span>}

        {/* Opção B: cobrir diferença (quando faltam poucos minutos e nem todos pagaram) */}
        {!deadlinePassou && diferenca > 0 && jogo.reserva_estado === 'pendente' &&
         jogo.modelo_pagamento === 'dividido' && (
          <button className="btn btn-secondary" onClick={() => iniciarPagamento('cobrir-diferenca')} disabled={loading}>
            🆘 Cobrir Diferença ({fmt(diferenca)})
          </button>
        )}
      </div>

      {abrir && clientSecret && stripePromise && (
        <div className="modal-backdrop" onClick={() => setAbrir(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <header>
              <h3>{modo === 'diferenca' ? 'Cobrir Diferença' : 'Pagamento'} · {fmt(valorCents)}</h3>
              <button className="close" onClick={() => setAbrir(false)}>×</button>
            </header>
            <div className="modal-body">
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                <StripeForm onSucesso={async (paymentIntentId) => {
                  setAbrir(false);
                  addToast('Pagamento efetuado!', 'success');
                  // Sincroniza DB imediatamente (não depende do webhook).
                  try {
                    await api.post(`/jogos/${jogo.id}/sync-pagamento`, { paymentIntentId });
                  } catch (e) {
                    console.warn('[Pag] sync falhou:', e?.response?.data?.mensagem || e.message);
                  }
                  // Refrescar resumo/jogo
                  await carregar();
                  onAtualizar?.();
                }} />
              </Elements>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StripeForm({ onSucesso }) {
  const stripe = useStripe();
  const elements = useElements();
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setEnviando(true); setErro('');
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });
    if (error) { setErro(error.message || 'Falha no pagamento.'); setEnviando(false); return; }
    if (paymentIntent?.status === 'succeeded') onSucesso(paymentIntent.id);
    else setErro('Pagamento em processamento.');
    setEnviando(false);
  };

  return (
    <form onSubmit={submit} className="stripe-form">
      <PaymentElement />
      {erro && <div className="erro">{erro}</div>}
      <button type="submit" className="btn btn-primary w-full" disabled={!stripe || enviando}>
        {enviando ? 'A processar…' : 'Pagar'}
      </button>
    </form>
  );
}
