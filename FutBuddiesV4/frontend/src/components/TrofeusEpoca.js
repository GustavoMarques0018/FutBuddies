// ============================================================
//  FutBuddies - Troféus de Época Mensal
// ============================================================
import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const MESES = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const TIPO_META = {
  goleador_mes: { emoji: '🥇', label: 'Goleador do Mês', unidade: 'golos' },
  presenca_mes: { emoji: '📅', label: 'Mais Presenças',   unidade: 'jogos' },
  mvp_mes:      { emoji: '⭐', label: 'MVP do Mês',       unidade: 'votos MVP' },
};

export default function TrofeusEpoca({ utilizadorId }) {
  const [trofeus, setTrofeus] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/jogadores/${utilizadorId}/trofeus`)
      .then(r => setTrofeus(r.data.trofeus || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [utilizadorId]);

  if (loading) return <div style={{ height: 48, display: 'flex', alignItems: 'center' }}><div className="spinner" /></div>;
  if (!trofeus.length) return (
    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
      Ainda sem troféus. Destaca-te num mês para ganhar o primeiro! 🏆
    </p>
  );

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {trofeus.map((t, i) => {
        const meta = TIPO_META[t.tipo] || { emoji: '🏆', label: t.tipo, unidade: '' };
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            background: 'rgba(251,191,36,0.1)',
            border: '1px solid var(--warning)',
            borderRadius: 'var(--radius-sm)',
          }}
            title={`${meta.label} — ${t.valor} ${meta.unidade} em ${MESES[t.mes]} ${t.ano}`}
          >
            <span style={{ fontSize: '1.3rem' }}>{meta.emoji}</span>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--warning)' }}>
                {meta.label}
              </p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {MESES[t.mes]} {t.ano} · {t.valor} {meta.unidade}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
