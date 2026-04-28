// ============================================================
//  FutBuddies - Página de Equipas
// ============================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { REGIOES, NIVEIS, NIVEL_COR, resolverImgUrl } from '../utils/constantes';
import './Equipas.css';

const sizeParaPx = (size) => {
  if (typeof size === 'number') return size;
  const s = String(size).trim();
  const n = parseFloat(s) || 1;
  if (s.endsWith('rem') || s.endsWith('em')) return Math.round(n * 16);
  if (s.endsWith('px')) return Math.round(n);
  return Math.round(n * 16);
};
const renderEmblema = (emblema, size = '2.5rem') => {
  if (!emblema) return <span style={{ fontSize: size }}>⚽</span>;
  if (emblema.startsWith('http') || emblema.startsWith('/uploads')) {
    const px = sizeParaPx(size);
    return <img src={resolverImgUrl(emblema)} alt="emblema" style={{ width: px, height: px, borderRadius: 8, objectFit: 'cover' }} />;
  }
  return <span style={{ fontSize: size }}>{emblema}</span>;
};

export default function Equipas() {
  const { isAuthenticated } = useAuth();
  const [equipas, setEquipas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroRegiao, setFiltroRegiao] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('');
  const [filtroRecrutar, setFiltroRecrutar] = useState(false);
  const [pesquisa, setPesquisa] = useState('');

  const carregarEquipas = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroRegiao)   params.append('regiao', filtroRegiao);
    if (filtroNivel)    params.append('nivel', filtroNivel);
    if (filtroRecrutar) params.append('recrutar', 'true');
    if (pesquisa)       params.append('pesquisa', pesquisa);
    api.get(`/equipas?${params}`)
      .then(res => setEquipas(res.data.equipas || []))
      .catch(() => setEquipas([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregarEquipas(); }, [filtroRegiao, filtroNivel, filtroRecrutar]);

  useEffect(() => {
    const t = setTimeout(carregarEquipas, 400);
    return () => clearTimeout(t);
  }, [pesquisa]);

  return (
    <div className="equipas-page">
      <div className="container">
        <div className="jogos-header">
          <div>
            <h1>Equipas</h1>
            <p>Encontra uma equipa ou cria a tua própria</p>
          </div>
          {isAuthenticated && <Link to="/equipas/criar" className="btn btn-primary">+ Criar Equipa</Link>}
        </div>

        {/* Filtros */}
        <div className="jogos-filtros">
          <input type="text" placeholder="🔍 Pesquisar equipa..." value={pesquisa}
            onChange={e => setPesquisa(e.target.value)} style={{ maxWidth: 260, fontSize: '0.875rem' }} />

          <select value={filtroRegiao} onChange={e => setFiltroRegiao(e.target.value)} style={{ fontSize: '0.875rem', maxWidth: 200 }}>
            <option value="">Todas as regiões</option>
            {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <div className="jogos-filtros-btns">
            <button className={`btn btn-sm ${filtroNivel === '' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltroNivel('')}>Todos</button>
            {NIVEIS.map(n => (
              <button key={n} className={`btn btn-sm ${filtroNivel === n ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltroNivel(n)}>{n}</button>
            ))}
          </div>

          <button className={`btn btn-sm ${filtroRecrutar ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFiltroRecrutar(r => !r)}>
            🔍 À procura de jogadores
          </button>
        </div>

        {loading ? (
          <div className="jogos-loading"><div className="spinner" /></div>
        ) : equipas.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🏆</div>
            <h3>Nenhuma equipa encontrada</h3>
            <p>Sê o primeiro a criar uma equipa na tua região!</p>
            {isAuthenticated && <Link to="/equipas/criar" className="btn btn-primary" style={{ marginTop: '1rem' }}>+ Criar Equipa</Link>}
          </div>
        ) : (
          <div className="equipas-grid">
            {equipas.map(equipa => {
              const nc = NIVEL_COR[equipa.nivel] || NIVEL_COR['Descontraído'];
              return (
                <Link key={equipa.id} to={`/equipas/${equipa.id}`} className="equipa-card card card-clickable">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ lineHeight: 1 }}>{renderEmblema(equipa.emblema, '2.5rem')}</div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: nc.bg, color: nc.cor, border: `1px solid ${nc.borda}` }}>{equipa.nivel}</span>
                      {equipa.a_recrutar && (
                        <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>🔍 Recrutar</span>
                      )}
                    </div>
                  </div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', fontFamily: 'var(--font-heading)' }}>{equipa.nome}</h3>
                  {equipa.descricao && <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '0.5rem', lineHeight: 1.5 }}>{equipa.descricao.substring(0, 80)}{equipa.descricao.length > 80 ? '...' : ''}</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: 'auto' }}>
                    {equipa.regiao && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📍 {equipa.regiao}</p>}
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>👥 {equipa.total_membros} membro{equipa.total_membros !== 1 ? 's' : ''}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>⚽ {equipa.total_jogos} jogo{equipa.total_jogos !== 1 ? 's' : ''}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>👑 {equipa.capitao_nome}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
