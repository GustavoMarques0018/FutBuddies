import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import Skeleton from './Skeleton';
import './Conquistas.css';

const CATEGORIAS = {
  inicio:    'Primeiros passos',
  volume:    'Volume de jogos',
  ataque:    'Ataque',
  meio:      'Meio-campo',
  destaque:  'Destaque',
  vitorias:  'Vitórias',
  combo:     'Combo',
  fair:      'Fair Play',
};

const TIERS = {
  bronze: { label: 'Bronze', cor: '#cd7f32' },
  prata:  { label: 'Prata',  cor: '#c0c0c0' },
  ouro:   { label: 'Ouro',   cor: '#f4c430' },
  lenda:  { label: 'Lenda',  cor: '#a855f7' },
};

/**
 * Props:
 *  - utilizadorId (opcional) — se dado, mostra públicas; senão usa /me
 */
export default function Conquistas({ utilizadorId = null }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [filtro, setFiltro] = useState('todas'); // todas | desbloqueadas | bloqueadas

  useEffect(() => {
    const url = utilizadorId
      ? `/jogadores/${utilizadorId}/conquistas`
      : '/utilizadores/me/conquistas';
    setLoading(true);
    api.get(url)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [utilizadorId]);

  if (loading) {
    return (
      <div className="conquistas-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} height={110} />
        ))}
      </div>
    );
  }

  if (!data) return <p className="muted">Não foi possível carregar as conquistas.</p>;

  const lista = (data.conquistas || []);
  const visiveis = lista.filter(b => {
    if (utilizadorId) return true; // no perfil público já vêm só desbloqueadas
    if (filtro === 'desbloqueadas') return b.desbloqueada;
    if (filtro === 'bloqueadas')    return !b.desbloqueada;
    return true;
  });

  // Agrupar por categoria
  const porCategoria = {};
  for (const b of visiveis) {
    const cat = b.categoria || 'outras';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(b);
  }

  const total = utilizadorId ? (data.total || 0) : (data.total || 0);
  const desbloqueadas = utilizadorId ? (data.conquistas?.length || 0) : (data.desbloqueadas || 0);
  const pct = total > 0 ? Math.round((desbloqueadas / total) * 100) : 0;

  return (
    <div className="conquistas">
      <div className="conquistas-header">
        <div className="conquistas-progresso">
          <div className="conquistas-progresso-bar">
            <div className="conquistas-progresso-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="conquistas-progresso-texto">
            <strong>{desbloqueadas}</strong>/{total} desbloqueadas ({pct}%)
          </div>
        </div>
        {!utilizadorId && (
          <div className="conquistas-filtros">
            {[['todas','Todas'], ['desbloqueadas','Desbloqueadas'], ['bloqueadas','Por desbloquear']].map(([k,l]) => (
              <button
                key={k}
                className={`conquistas-filtro ${filtro===k?'ativo':''}`}
                onClick={() => setFiltro(k)}
              >{l}</button>
            ))}
          </div>
        )}
      </div>

      {Object.keys(porCategoria).length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>
          Sem conquistas nesta secção.
        </p>
      ) : Object.entries(porCategoria).map(([cat, items]) => (
        <div key={cat} className="conquistas-seccao">
          <h4 className="conquistas-categoria">{CATEGORIAS[cat] || cat}</h4>
          <div className="conquistas-grid">
            {items.map(b => (
              <div
                key={b.id}
                className={`conquista-card ${b.desbloqueada ? 'desbloqueada' : 'bloqueada'} tier-${b.tier}`}
                style={{ '--tier-cor': TIERS[b.tier]?.cor || '#888' }}
                title={b.descricao}
              >
                <div className="conquista-icone">{b.desbloqueada ? b.icone : '🔒'}</div>
                <div className="conquista-info">
                  <div className="conquista-nome">{b.nome}</div>
                  <div className="conquista-descricao">{b.descricao}</div>
                  {b.desbloqueada && b.desbloqueada_em && (
                    <div className="conquista-data">
                      {new Date(b.desbloqueada_em).toLocaleDateString('pt-PT')}
                    </div>
                  )}
                </div>
                <span className="conquista-tier" style={{ background: TIERS[b.tier]?.cor }}>
                  {TIERS[b.tier]?.label || b.tier}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
