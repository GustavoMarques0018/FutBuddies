// ============================================================
//  FutBuddies - GIF Picker (GIPHY API)
//  Usa REACT_APP_GIPHY_KEY em produção; fallback para a chave
//  pública beta da GIPHY (adequada para demos / projetos académicos).
//  https://developers.giphy.com/
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './GifPicker.css';

const GIPHY_KEY = process.env.REACT_APP_GIPHY_KEY || 'dc6zaTOxFJmzC';
const BASE      = 'https://api.giphy.com/v1/gifs';

async function fetchGiphy(endpoint, params = {}) {
  const qs = new URLSearchParams({ api_key: GIPHY_KEY, rating: 'g', lang: 'pt', ...params });
  const r  = await fetch(`${BASE}/${endpoint}?${qs}`);
  if (!r.ok) throw new Error(`GIPHY ${r.status}`);
  return r.json();
}

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

  const carregarTrending = useCallback(() => {
    setLoading(true);
    setErro(false);
    fetchGiphy('trending', { limit: 20 })
      .then(d => { setLista(d.data || []); setErro(false); })
      .catch(() => setErro(true))
      .finally(() => setLoading(false));
  }, []);

  // Carregar trending ao abrir
  useEffect(() => { carregarTrending(); }, [carregarTrending]);

  // Pesquisa com debounce 400ms
  const pesquisar = useCallback((q) => {
    clearTimeout(timerRef.current);
    if (!q.trim()) { carregarTrending(); return; }
    timerRef.current = setTimeout(() => {
      setLoading(true);
      setErro(false);
      fetchGiphy('search', { q, limit: 24 })
        .then(d => { setLista(d.data || []); setErro(false); })
        .catch(() => setErro(true))
        .finally(() => setLoading(false));
    }, 400);
  }, [carregarTrending]);

  useEffect(() => { pesquisar(query); }, [query, pesquisar]);

  // Helpers para extrair URLs do formato GIPHY
  const thumb  = (g) => g.images?.fixed_height_small?.url || g.images?.downsized?.url || g.images?.original?.url || '';
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
            <div className="gif-loading">
              <div className="spinner" />
            </div>
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
