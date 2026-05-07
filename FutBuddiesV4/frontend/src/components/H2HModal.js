// ============================================================
//  FutBuddies - Head-to-Head entre dois jogadores
// ============================================================
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import Avatar from './Avatar';

export default function H2HModal({ meuId, outroId, outroNome, outrFoto, onFechar }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/jogadores/${meuId}/h2h/${outroId}`)
      .then(r => setDados(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [meuId, outroId]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onFechar()}
    >
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h4 style={{ margin: 0 }}>⚔️ Head-to-Head</h4>
          <button className="btn btn-ghost btn-sm" onClick={onFechar}>✕</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', marginBottom: '1.25rem' }}>
          <div style={{ textAlign: 'center' }}>
            <Avatar nome="Tu" size="md" />
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', fontWeight: 600 }}>Tu</p>
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-muted)' }}>VS</span>
          <div style={{ textAlign: 'center' }}>
            <Avatar nome={outroNome} fotoUrl={outrFoto} size="md" />
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', fontWeight: 600 }}>{outroNome}</p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <div className="spinner" />
          </div>
        ) : !dados ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Sem dados disponíveis.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Jogos juntos */}
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <p style={{ margin: '0 0 0.25rem', fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
                {dados.jogos_juntos ?? 0}
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Jogos juntos</p>
            </div>

            {/* Golos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="card" style={{ padding: '0.875rem', textAlign: 'center' }}>
                <p style={{ margin: '0 0 0.2rem', fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>
                  {dados.meus_golos ?? 0}
                </p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Os teus golos</p>
              </div>
              <div className="card" style={{ padding: '0.875rem', textAlign: 'center' }}>
                <p style={{ margin: '0 0 0.2rem', fontSize: '1.5rem', fontWeight: 700, color: 'var(--info)' }}>
                  {dados.golos_dele ?? 0}
                </p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Golos de {outroNome?.split(' ')[0]}</p>
              </div>
            </div>

            {/* Mesma equipa vs lados opostos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="card" style={{ padding: '0.875rem', textAlign: 'center' }}>
                <p style={{ margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {dados.jogos_mesma_equipa ?? 0}
                </p>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mesma equipa</p>
              </div>
              <div className="card" style={{ padding: '0.875rem', textAlign: 'center' }}>
                <p style={{ margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: 700, color: 'var(--warning)' }}>
                  {dados.jogos_lados_opostos ?? 0}
                </p>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>Frente a frente</p>
              </div>
            </div>

            {/* Quando frente a frente: V/E/D */}
            {(dados.jogos_lados_opostos > 0) && (
              <div className="card" style={{ padding: '1rem' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>
                  Quando jogam frente a frente
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                  {[
                    { label: 'Vitórias', val: dados.vitorias ?? 0, cor: 'var(--success)' },
                    { label: 'Empates',  val: dados.empates  ?? 0, cor: 'var(--text-muted)' },
                    { label: 'Derrotas', val: dados.derrotas ?? 0, cor: 'var(--danger, #ef4444)' },
                  ].map(s => (
                    <div key={s.label}>
                      <p style={{ margin: '0 0 0.2rem', fontSize: '1.5rem', fontWeight: 800, color: s.cor }}>{s.val}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
