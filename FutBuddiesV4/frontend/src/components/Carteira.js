import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import Skeleton from './Skeleton';
import './Carteira.css';

const TIPO_LABEL = {
  credito_manual:    { label: 'Crédito',    icone: '💰', cor: 'var(--success)' },
  credito_reembolso: { label: 'Reembolso',  icone: '↩️', cor: 'var(--success)' },
  credito_promo:     { label: 'Promoção',   icone: '🎁', cor: 'var(--primary)' },
  debito_pagamento:  { label: 'Pagamento',  icone: '💳', cor: 'var(--danger)' },
};

function cents(v) { return ((v || 0) / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }); }

export default function Carteira() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/carteira')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton height={180} />;
  if (!data) return <p className="muted">Não foi possível carregar a carteira.</p>;

  const saldo = data.saldo_cents || 0;
  const movs = data.movimentos || [];

  return (
    <div className="carteira">
      <div className="carteira-saldo-card">
        <div className="carteira-saldo-label">Saldo disponível</div>
        <div className="carteira-saldo-valor">{cents(saldo)}</div>
        <div className="carteira-saldo-nota">
          Usa o saldo para pagar inscrições em jogos parceiro. Reembolsos e créditos promocionais são adicionados automaticamente.
        </div>
      </div>

      <h4 className="carteira-titulo">Últimos movimentos</h4>
      {movs.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
          Ainda sem movimentos. O teu primeiro crédito aparece aqui.
        </p>
      ) : (
        <ul className="carteira-lista">
          {movs.map(m => {
            const meta = TIPO_LABEL[m.tipo] || { label: m.tipo, icone: '•', cor: 'var(--text)' };
            const positivo = m.valor_cents >= 0;
            return (
              <li key={m.id} className="carteira-mov">
                <div className="carteira-mov-icone">{meta.icone}</div>
                <div className="carteira-mov-info">
                  <div className="carteira-mov-titulo">{meta.label}</div>
                  <div className="carteira-mov-desc">{m.descricao || '—'}</div>
                  <div className="carteira-mov-data">{new Date(m.created_at).toLocaleString('pt-PT')}</div>
                </div>
                <div
                  className="carteira-mov-valor"
                  style={{ color: positivo ? 'var(--success)' : 'var(--danger)' }}
                >
                  {positivo ? '+' : ''}{cents(m.valor_cents)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
