// ============================================================
//  FutBuddies - Pagina de Jogos (v3 — search, filter chips, game state)
// ============================================================

import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';
import { REGIOES, NIVEIS, NIVEL_COR, getRegiaoGuardada, guardarRegiao, resolverImgUrl } from '../utils/constantes';
import { IconBall, IconLock, IconStadium, IconMapPin, IconClock } from '../components/Icons';
import Countdown from '../components/Countdown';
import QuadroHonra from '../components/QuadroHonra';
import './Jogos.css';

// Carregamento dinâmico do mapa (evita carregar Leaflet se nunca abrir)
const JogosMapa = lazy(() => import('../components/JogosMapa'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the display state for a game based on its scheduled time. */
function computeGameState(jogo) {
  if (!jogo.data_jogo) return { estado: jogo.estado, hidden: false, aDecorrer: false };

  const now = Date.now();
  const gameTime = new Date(jogo.data_jogo).getTime();
  const gameEndWindow = gameTime + 60 * 60 * 1000; // +1 hour

  if (now >= gameEndWindow) {
    // Past the 1-hour window after kickoff -- hide entirely
    return { estado: jogo.estado, hidden: true, aDecorrer: false };
  }

  if (now >= gameTime && now < gameEndWindow) {
    // Currently in progress
    return { estado: 'a_decorrer', hidden: false, aDecorrer: true };
  }

  // Future game -- keep original state
  return { estado: jogo.estado, hidden: false, aDecorrer: false };
}

function getEstadoBadge(estado) {
  const map = {
    aberto:     { cls: 'badge-green',  label: 'Aberto' },
    cheio:      { cls: 'badge-red',    label: 'Cheio' },
    cancelado:  { cls: 'badge-gray',   label: 'Cancelado' },
    concluido:  { cls: 'badge-gray',   label: 'Concluido' },
    encerrado:  { cls: 'badge-gray',   label: 'Encerrado' },
    a_decorrer: { cls: 'badge-amber',  label: 'A decorrer' },
  };
  return map[estado] || { cls: 'badge-gray', label: estado };
}

function formatarData(data) {
  if (!data) return 'Data a definir';
  return new Date(data).toLocaleDateString('pt-PT', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Game Card (reused for both sections)
// ---------------------------------------------------------------------------
function JogoCard({ jogo }) {
  const badge = getEstadoBadge(jogo._displayEstado);
  const pct = Math.min(100, ((jogo.total_inscritos || 0) / (jogo.max_jogadores || 10)) * 100);
  const nivelCor = NIVEL_COR[jogo.nivel] || NIVEL_COR['Descontraído'];
  const isPrivado = jogo.visibilidade === 'privado';
  return (
    <Link to={`/jogos/${jogo.id}`} className="jogo-card card card-clickable">
      <div className="jogo-card-top">
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <span className="jogo-tipo">{jogo.tipo_jogo || '5x5'}</span>
          {isPrivado && <span title="Jogo Privado" style={{ fontSize: '0.85rem' }}><IconLock size="0.85rem" /></span>}
        </div>
        <span className={`badge ${badge.cls}`}>{badge.label}</span>
      </div>
      <h3 className="jogo-titulo">
        {jogo.modo_jogo === 'equipa' && <span style={{ marginRight: '0.35rem' }}><IconStadium size="0.85rem" /></span>}
        {jogo.titulo}
      </h3>
      <div className="jogo-info-list">
        {jogo.regiao && <p><IconMapPin size="0.85em" /> {jogo.regiao}</p>}
        {!isPrivado && jogo.local && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}><IconStadium size="0.75rem" /> {jogo.local}</p>}
        {isPrivado && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}><IconStadium size="0.75rem" /> Morada oculta</p>}
        <p><IconClock size="0.85em" /> {formatarData(jogo.data_jogo)}</p>
        {!jogo._aDecorrer && <Countdown alvo={jogo.data_jogo} />}
        {jogo._aDecorrer && (
          <p style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>
            Inscricoes desativadas — jogo a decorrer
          </p>
        )}
        {jogo.nivel && (
          <p>
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4,
              background: nivelCor.bg, color: nivelCor.cor, border: `1px solid ${nivelCor.borda}`,
            }}>
              {jogo.nivel}
            </span>
          </p>
        )}
      </div>
      <div className="jogo-vagas">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Jogadores</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>
            {jogo.total_inscritos || 0}/{jogo.max_jogadores || 10}
          </span>
        </div>
        <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${pct}%` }} /></div>
        {(jogo.vagas_disponiveis || 0) > 0 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.375rem', fontWeight: 600 }}>
            {jogo.vagas_disponiveis} vaga{jogo.vagas_disponiveis !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Jogos() {
  const { isAuthenticated } = useAuth();
  const { tema } = useTheme();

  // Data
  const [jogos, setJogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jogadoresDisponiveis, setJogadoresDisponiveis] = useState([]);

  // Search (debounced)
  const [pesquisa, setPesquisa] = useState('');

  // Filters
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroVis, setFiltroVis] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('');
  const [regiao, setRegiao] = useState(getRegiaoGuardada);
  const [ordenacao, setOrdenacao] = useState('data');

  // Vista: 'lista' | 'mapa'
  const [vista, setVista] = useState('lista');

  // ?filtro=meus → mostra só jogos do utilizador
  const [searchParams, setSearchParams] = useSearchParams();
  const meusJogos = searchParams.get('filtro') === 'meus';

  // Stable ref for pesquisa so the loader always uses the latest value
  const pesquisaRef = useRef(pesquisa);
  pesquisaRef.current = pesquisa;

  // -------------------------------------------------------------------
  // Load games from API
  // -------------------------------------------------------------------
  const carregarJogos = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroEstado)          params.append('estado', filtroEstado);
    if (filtroTipo)            params.append('tipo', filtroTipo);
    if (filtroVis)             params.append('visibilidade', filtroVis);
    if (filtroNivel)           params.append('nivel', filtroNivel);
    if (regiao)                params.append('regiao', regiao);
    if (pesquisaRef.current)   params.append('pesquisa', pesquisaRef.current);
    if (meusJogos)             params.append('meusJogos', '1');

    api.get(`/jogos?${params}`)
      .then(res => setJogos(res.data.jogos || []))
      .catch(() => setJogos([]))
      .finally(() => setLoading(false));
  }, [filtroEstado, filtroTipo, filtroVis, filtroNivel, regiao, meusJogos]);

  // Reload when any dropdown/chip filter changes
  useEffect(() => { carregarJogos(); }, [carregarJogos]);

  // Debounced search (400ms, same pattern as Equipas page)
  useEffect(() => {
    const t = setTimeout(carregarJogos, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [pesquisa]);

  // -------------------------------------------------------------------
  // Load available players when region changes
  // -------------------------------------------------------------------
  useEffect(() => {
    const params = regiao ? `?regiao=${encodeURIComponent(regiao)}` : '';
    api.get(`/jogadores/disponiveis${params}`)
      .then(res => setJogadoresDisponiveis(res.data.jogadores || []))
      .catch(() => setJogadoresDisponiveis([]));
  }, [regiao]);

  // -------------------------------------------------------------------
  // Region helper
  // -------------------------------------------------------------------
  const handleRegiaoChange = (r) => { guardarRegiao(r); setRegiao(r); };

  // -------------------------------------------------------------------
  // Apply client-side game state logic + sorting
  // -------------------------------------------------------------------
  const jogosProcessados = jogos.map(jogo => {
    const gs = computeGameState(jogo);
    return { ...jogo, _displayEstado: gs.estado, _hidden: gs.hidden, _aDecorrer: gs.aDecorrer };
  });

  // Separate live games from the rest
  const jogosADecorrer = jogosProcessados.filter(j => j._aDecorrer);
  const jogosVisiveis = jogosProcessados.filter(j => !j._hidden && !j._aDecorrer);

  const jogosOrdenados = [...jogosVisiveis].sort((a, b) => {
    if (ordenacao === 'data')  return new Date(a.data_jogo) - new Date(b.data_jogo);
    if (ordenacao === 'vagas') return (b.vagas_disponiveis || 0) - (a.vagas_disponiveis || 0);
    if (ordenacao === 'nome')  return (a.titulo || '').localeCompare(b.titulo || '');
    return 0;
  });

  // -------------------------------------------------------------------
  // Chip helper
  // -------------------------------------------------------------------
  const Chip = ({ active, onClick, children }) => (
    <button className={`btn btn-chip ${active ? 'btn-chip-active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  // Campo — dia: relva+céu dominam; noite: relva+lua. Posição ajustada para mostrar o horizonte.
  const pitchPhoto = tema === 'dark'
    ? { file: 'campo-night.jpg', position: 'center 60%' }
    : { file: 'campo-day.jpg',   position: 'center 55%' };

  return (
    <div className="jogos-page">
      <div
        className="jogos-bg-photo"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL}/${pitchPhoto.file})`,
          backgroundPosition: pitchPhoto.position,
        }}
      />
      <div className="container">
        {/* Header */}
        <div className="jogos-header">
          <div>
            <h1>Jogos</h1>
            <p>Encontra um jogo ou cria o teu proprio</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Alternar vista lista / mapa */}
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              {[['lista','☰ Lista'], ['mapa','🗺️ Mapa']].map(([v, l]) => (
                <button key={v} type="button"
                  onClick={() => setVista(v)}
                  style={{
                    padding: '0.45rem 0.85rem', fontSize: '0.8rem', fontWeight: 600,
                    background: vista === v ? 'var(--primary)' : 'transparent',
                    color: vista === v ? '#050505' : 'var(--text-muted)',
                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  {l}
                </button>
              ))}
            </div>
            {isAuthenticated && <Link to="/jogos/criar" className="btn btn-primary">+ Criar Jogo</Link>}
          </div>
        </div>

        {/* ── Live Games Banner ── */}
        {jogosADecorrer.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#d97706', margin: 0 }}>
                A Decorrer ({jogosADecorrer.length})
              </h2>
            </div>
            <div className="jogos-grid">
              {jogosADecorrer.map(jogo => <JogoCard key={jogo.id} jogo={jogo} />)}
            </div>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="jogos-filtros">

          {/* Row 1: Search + Region + Sort */}
          <div className="jogos-filtros-row1">
            <input
              type="text"
              className="jogos-search-input"
              placeholder="Pesquisar jogo..."
              value={pesquisa}
              onChange={e => setPesquisa(e.target.value)}
            />

            <div className="jogos-filtros-dropdowns">
              <select value={regiao} onChange={e => handleRegiaoChange(e.target.value)} className="jogos-select">
                <option value="">Todas as regioes</option>
                {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>

              <select value={ordenacao} onChange={e => setOrdenacao(e.target.value)} className="jogos-select">
                <option value="data">Data</option>
                <option value="vagas">Vagas</option>
                <option value="nome">Nome A-Z</option>
              </select>
            </div>
          </div>

          {/* Row 2: Compact filter chips */}
          <div className="jogos-filtros-row2">
            {/* Visibility */}
            <div className="jogos-chip-group">
              {[['', 'Todos'], ['publico', 'Publicos'], ['privado', 'Privados']].map(([v, l]) => (
                <Chip key={v} active={filtroVis === v} onClick={() => setFiltroVis(v)}>{l}</Chip>
              ))}
            </div>

            <span className="jogos-chip-separator" />

            {/* State */}
            <div className="jogos-chip-group">
              {[['', 'Todos'], ['aberto', 'Aberto'], ['cheio', 'Cheio']].map(([e, l]) => (
                <Chip key={e} active={filtroEstado === e} onClick={() => setFiltroEstado(e)}>{l}</Chip>
              ))}
            </div>

            <span className="jogos-chip-separator" />

            {/* Level */}
            <div className="jogos-chip-group">
              <Chip active={filtroNivel === ''} onClick={() => setFiltroNivel('')}>Todos os niveis</Chip>
              {NIVEIS.map(n => (
                <Chip key={n} active={filtroNivel === n} onClick={() => setFiltroNivel(n)}>{n}</Chip>
              ))}
            </div>

            <span className="jogos-chip-separator" />

            {/* Type */}
            <div className="jogos-chip-group">
              {[['', 'Todos'], ['5x5', '5x5'], ['7x7', '7x7'], ['11x11', '11x11']].map(([t, l]) => (
                <Chip key={t} active={filtroTipo === t} onClick={() => setFiltroTipo(t)}>{l}</Chip>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        {vista === 'mapa' ? (
          <Suspense fallback={<div className="jogos-loading"><div className="spinner" /></div>}>
            <JogosMapa jogos={jogosProcessados} />
          </Suspense>
        ) : loading ? (
          <div className="jogos-loading"><div className="spinner" /></div>
        ) : jogosOrdenados.length === 0 && jogosADecorrer.length === 0 ? (
          <div className="empty-state">
            <div className="icon"><IconBall size="2rem" /></div>
            <h3>Nenhum jogo encontrado</h3>
            <p>Tenta ajustar os filtros ou {regiao ? 'muda de regiao' : 'cria o primeiro jogo'}!</p>
            {isAuthenticated && <Link to="/jogos/criar" className="btn btn-primary" style={{ marginTop: '1rem' }}>+ Criar Jogo</Link>}
          </div>
        ) : (
          <div className="jogos-grid">
            {jogosOrdenados.map(jogo => <JogoCard key={jogo.id} jogo={jogo} />)}
          </div>
        )}

        {/* ── Jogadores Disponíveis ── */}
        {jogadoresDisponiveis.length > 0 && (
          <div className="card" style={{ marginTop: '2rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700 }}>
              🟢 Jogadores disponíveis{regiao ? ` em ${regiao}` : ''}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {jogadoresDisponiveis.map(j => (
                <Link
                  key={j.id}
                  to={`/jogadores/${j.id}`}
                  style={{
                    textDecoration: 'none', color: 'inherit',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    background: 'var(--bg-elev-1)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', padding: '0.3rem 0.6rem',
                    fontSize: '0.82rem',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
                  {j.nickname || j.nome}
                  {j.disponivel_regiao && <span style={{ color: 'var(--text-muted)', fontSize: '0.73rem' }}>· {j.disponivel_regiao}</span>}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Quadro de Honra ── */}
        <QuadroHonra regiaoInicial={regiao} />
      </div>
    </div>
  );
}
