// ============================================================
//  FutBuddies — Command Palette (Cmd/Ctrl + K)
//  Pesquisa rápida global: jogos, equipas, jogadores e atalhos
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './CommandPalette.css';

export default function CommandPalette() {
  const [aberto, setAberto] = useState(false);
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState({ jogos: [], equipas: [], jogadores: [] });
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Atalhos rápidos sempre disponíveis
  const atalhos = [
    { id: 'go-jogos',   label: 'Ver Jogos',           hint: 'Navegação',  icon: '⚽', path: '/jogos' },
    { id: 'go-equipas', label: 'Ver Equipas',         hint: 'Navegação',  icon: '🏆', path: '/equipas' },
    { id: 'go-criar',   label: 'Criar novo jogo',     hint: 'Ação',       icon: '➕', path: '/jogos/criar', auth: true },
    { id: 'go-perfil',  label: 'O meu perfil',        hint: 'Conta',      icon: '👤', path: '/perfil', auth: true },
    { id: 'go-amigos',  label: 'Os meus amigos',      hint: 'Conta',      icon: '👥', path: '/amigos', auth: true },
    { id: 'go-sobre',   label: 'Sobre o FutBuddies',  hint: 'Info',       icon: 'ℹ️', path: '/sobre' },
  ].filter(a => !a.auth || isAuthenticated);

  // Toggle com Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAberto(prev => !prev);
      }
      if (e.key === 'Escape' && aberto) setAberto(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [aberto]);

  // Foco automático quando abre
  useEffect(() => {
    if (aberto) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setActiveIdx(0);
    }
  }, [aberto]);

  // Pesquisa debounced
  useEffect(() => {
    if (!aberto || !query.trim()) {
      setResultados({ jogos: [], equipas: [], jogadores: [] });
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      Promise.all([
        api.get(`/jogos?pesquisa=${encodeURIComponent(query)}&limite=5`).catch(() => ({ data: { jogos: [] } })),
        api.get(`/equipas?pesquisa=${encodeURIComponent(query)}&limite=5`).catch(() => ({ data: { equipas: [] } })),
        api.get(`/utilizadores?pesquisa=${encodeURIComponent(query)}&limite=5`).catch(() => ({ data: { utilizadores: [] } })),
      ]).then(([j, e, u]) => {
        setResultados({
          jogos: (j.data.jogos || []).slice(0, 4),
          equipas: (e.data.equipas || []).slice(0, 4),
          jogadores: (u.data.utilizadores || []).slice(0, 4),
        });
      }).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, aberto]);

  const handleClose = useCallback(() => setAberto(false), []);

  const navegarPara = (path) => {
    navigate(path);
    handleClose();
  };

  // Lista plana para navegação por teclado
  const itens = [
    ...(query.trim() === '' ? atalhos.map(a => ({ ...a, tipo: 'atalho' })) : []),
    ...resultados.jogos.map(j => ({ id: `j-${j.id}`, label: j.titulo, hint: `Jogo · ${j.regiao || 'Sem região'}`, icon: '⚽', path: `/jogos/${j.id}`, tipo: 'jogo' })),
    ...resultados.equipas.map(e => ({ id: `e-${e.id}`, label: e.nome, hint: `Equipa · ${e.regiao || 'Sem região'}`, icon: '🏆', path: `/equipas/${e.id}`, tipo: 'equipa' })),
    ...resultados.jogadores.map(u => ({ id: `u-${u.id}`, label: u.nickname || u.nome, hint: `Jogador · ${u.regiao || u.posicao || ''}`, icon: '👤', path: `/jogadores/${u.id}`, tipo: 'jogador' })),
  ];

  // Navegação por teclado
  useEffect(() => {
    if (!aberto) return;
    const handler = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, itens.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = itens[activeIdx];
        if (item) navegarPara(item.path);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line
  }, [aberto, itens, activeIdx]);

  // Reset active index quando muda a query
  useEffect(() => { setActiveIdx(0); }, [query]);

  if (!aberto) return null;

  return (
    <div className="cmdk-overlay" onClick={handleClose}>
      <div className="cmdk-panel" onClick={e => e.stopPropagation()}>
        <div className="cmdk-input-wrap">
          <span className="cmdk-search-icon">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar jogos, equipas, jogadores ou navegar..."
            className="cmdk-input"
          />
          <span className="cmdk-esc">esc</span>
        </div>

        <div className="cmdk-results">
          {loading && <div className="cmdk-loading"><div className="spinner" /></div>}

          {!loading && itens.length === 0 && query.trim() !== '' && (
            <div className="cmdk-empty">Nada encontrado para "{query}"</div>
          )}

          {!loading && query.trim() === '' && (
            <div className="cmdk-section-title">Atalhos</div>
          )}

          {!loading && itens.map((item, idx) => (
            <button
              key={item.id}
              className={`cmdk-item ${idx === activeIdx ? 'active' : ''}`}
              onClick={() => navegarPara(item.path)}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              <span className="cmdk-item-icon">{item.icon}</span>
              <span className="cmdk-item-label">{item.label}</span>
              <span className="cmdk-item-hint">{item.hint}</span>
            </button>
          ))}
        </div>

        <div className="cmdk-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>↵</kbd> abrir</span>
          <span><kbd>esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
