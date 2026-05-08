// ============================================================
//  FutBuddies - Comparação com a média da plataforma
// ============================================================
import React, { useState, useEffect } from 'react';
import api from '../utils/api';

function Barra({ ratio, label, valor, media }) {
  const r = ratio ?? 0;
  const pct = Math.min(200, r * 100); // escala: 100% = igual à média
  const cor = r >= 1.5 ? 'var(--success)' : r >= 1 ? 'var(--primary)' : r >= 0.5 ? 'var(--warning)' : 'var(--danger,#ef4444)';

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>
          {valor} vs média {media}
          {ratio !== null && (
            <span style={{ marginLeft: '0.5rem', fontWeight: 700, color: cor }}>
              {r >= 1 ? `+${((r - 1) * 100).toFixed(0)}%` : `-${((1 - r) * 100).toFixed(0)}%`}
            </span>
          )}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-elev-2)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct / 2)}%`, height: '100%', background: cor, borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

export default function ComparacaoMedia({ utilizadorId }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/jogadores/${utilizadorId}/comparacao-media`)
      .then(r => setDados(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [utilizadorId]);

  if (loading) return <div style={{ height: 80 }}><div className="spinner" /></div>;
  if (!dados) return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sem dados.</p>;

  const { jogador, media, ratio } = dados;

  return (
    <div>
      <Barra label="⚽ Golos" valor={jogador.golos} media={media.golos} ratio={ratio.golos} />
      <Barra label="🎯 Assistências" valor={jogador.assistencias} media={media.assistencias} ratio={ratio.assistencias} />
      <Barra label="🏃 Jogos" valor={jogador.jogos} media={media.jogos} ratio={ratio.jogos} />
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
        Comparado com todos os jogadores ativos na plataforma.
      </p>
    </div>
  );
}
