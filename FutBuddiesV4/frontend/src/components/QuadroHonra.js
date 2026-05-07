// ============================================================
//  FutBuddies - Quadro de Honra por Região
// ============================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { REGIOES, resolverImgUrl } from '../utils/constantes';
import Avatar from './Avatar';

const TROPHIES = ['🥇', '🥈', '🥉'];

export default function QuadroHonra({ regiaoInicial = '' }) {
  const [regiao, setRegiao] = useState(regiaoInicial);
  const [aba, setAba] = useState('ativos'); // 'ativos' | 'avaliados'
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState(false);

  const carregar = () => {
    setLoading(true);
    const params = regiao ? `?regiao=${encodeURIComponent(regiao)}` : '';
    api.get(`/quadro-honra${params}`)
      .then(res => setDados(res.data))
      .catch(() => setDados(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (aberto) carregar();
    // eslint-disable-next-line
  }, [regiao, aberto]);

  const lista = aba === 'ativos'
    ? (dados?.maisAtivos || [])
    : (dados?.melhorAvaliados || []);

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      {/* Header collapsible */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '0.25rem 0' }}
        onClick={() => setAberto(v => !v)}
      >
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
          🏆 Quadro de Honra
        </h3>
        <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>{aberto ? '▲' : '▼'}</span>
      </div>

      {aberto && (
        <>
          {/* Controls */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              {[['ativos', '⚡ Mais Ativos'], ['avaliados', '⭐ Melhor Avaliados']].map(([v, l]) => (
                <button key={v} type="button"
                  onClick={() => setAba(v)}
                  style={{
                    padding: '0.35rem 0.7rem', fontSize: '0.78rem', fontWeight: 600,
                    background: aba === v ? 'var(--primary)' : 'transparent',
                    color: aba === v ? '#050505' : 'var(--text-muted)',
                    border: 'none', cursor: 'pointer',
                  }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Region filter */}
            <select
              value={regiao}
              onChange={e => setRegiao(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', flex: 1, minWidth: 120 }}
            >
              <option value="">Todas as regiões</option>
              {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* List */}
          <div style={{ marginTop: '0.75rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}><div className="spinner" /></div>
            ) : lista.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
                Sem dados para esta semana.
              </p>
            ) : (
              lista.map((u, idx) => (
                <Link
                  key={u.id}
                  to={`/jogadores/${u.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.4rem 0.25rem',
                    borderBottom: idx < lista.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background 0.15s',
                  }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg-elev-1)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: '1.1rem', width: 24, textAlign: 'center', flexShrink: 0 }}>
                      {TROPHIES[idx] || `${idx + 1}.`}
                    </span>
                    <Avatar nome={u.nome} fotoUrl={u.foto_url} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.nickname || u.nome}
                      </p>
                    </div>
                    <span style={{
                      fontSize: '0.78rem', fontWeight: 700,
                      color: idx === 0 ? '#d97706' : 'var(--primary)',
                      background: idx === 0 ? 'rgba(245,158,11,0.15)' : 'rgba(var(--primary-rgb, 22,163,74),0.1)',
                      padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                    }}>
                      {aba === 'ativos'
                        ? `${u.jogos_semana} jogo${u.jogos_semana !== 1 ? 's' : ''}`
                        : `★ ${Number(u.media_nota).toFixed(1)}`}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
