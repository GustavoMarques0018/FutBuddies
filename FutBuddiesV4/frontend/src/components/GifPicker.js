// ============================================================
//  FutBuddies - GIF Picker
//  Chama o backend como proxy → sem problemas de CORS.
//  Backend usa GIPHY_KEY env var no Render.
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import './GifPicker.css';

export default function GifPicker({ onSelect, onFechar }) {
  const [query, setQuery]     = useState('');
  const [lista, setLista]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  // Fechar com Escape, focar input ao abrir
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', h);
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.removeEventListener('keydown', h);
  }, [onFechar]);

  const carregar = useCallback((q = '') => {
    setLoading(true);
    setErro(false);
    const params = q ? { q, limit: 24 } : { limit: 20 };
    api.get('/gifs', { params })
      .then(r => { setLista(r.data?.data || []); setErro(false); })
      .catch(() => setErro(true))
      .finally(() => setLoading(false));
  }, []);

  // Trending ao abrir
  useEffect(() => { carregar(); }, [carregar]);

  // Pesquisa com debounce 450ms
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => carregar(query), query ? 450 : 0);
    return () => clearTimeout(timerRef.current);
  }, [query, carregar]);

  // Helpers para extrair URLs do formato GIPHY
  const thumb  = (g) => g.images?.fixed_height_small?.url || g.images?.downsized?.url || '';
  const gifUrl = (g) => g.images?.original?.url || g.images?.downsized?.url || '';

  return (
    <div className="gif-backdrop" onClick={onFechar}>
      <div className="gif-modal" onClick={e => e.stopPropagation()}>
        <div className="gif-header">
          <input
            ref={inputRef}
            className="gif-search"
            placeholder="🔍 Pesquisar GIFs..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button className="gif-close" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>

        <div className="gif-grid">
          {loading && (
            <div className="gif-loading"><div className="spinner" /></div>
          )}
          {!loading && erro && (
            <p className="gif-empty">
              Erro ao carregar GIFs.<br />
              <small>Verifica a ligação à internet.</small>
            </p>
          )}
          {!loading && !erro && lista.length === 0 && (
            <p className="gif-empty">Sem resultados para "{query}".</p>
          )}
          {!loading && !erro && lista.map(g => {
            const t = thumb(g);
            const u = gifUrl(g);
            if (!t || !u) return null;
            return (
              <button
                key={g.id}
                className="gif-item"
                onClick={() => onSelect(u)}
                title={g.title || 'GIF'}
              >
                <img src={t} alt={g.title || 'gif'} loading="lazy" />
              </button>
            );
          })}
        </div>

        <p className="gif-credit">Powered by GIPHY</p>
      </div>
    </div>
  );
}
