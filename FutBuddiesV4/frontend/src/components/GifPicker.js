// ============================================================
//  FutBuddies - GIF Picker (Tenor API v1)
//  Chave de demo Tenor — substitui por REACT_APP_TENOR_KEY em produção
//  https://tenor.com/developer/keyregistration
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './GifPicker.css';

const TENOR_KEY = process.env.REACT_APP_TENOR_KEY || 'LIVDSRZULELA';
const BASE      = 'https://api.tenor.com/v1';

async function fetchTenor(endpoint, params = {}) {
  const qs = new URLSearchParams({ key: TENOR_KEY, locale: 'pt_PT', contentfilter: 'low', ...params });
  const r   = await fetch(`${BASE}/${endpoint}?${qs}`);
  if (!r.ok) throw new Error(`Tenor ${r.status}`);
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

  // Carregar trending ao abrir
  useEffect(() => {
    setLoading(true);
    setErro(false);
    fetchTenor('trending', { limit: 20, media_filter: 'minimal' })
      .then(d => { setLista(d.results || []); setErro(false); })
      .catch(() => setErro(true))
      .finally(() => setLoading(false));
  }, []);

  // Pesquisa com debounce 400ms
  const pesquisar = useCallback((q) => {
    clearTimeout(timerRef.current);
    if (!q.trim()) {
      // Voltar a trending
      setLoading(true);
      setErro(false);
      fetchTenor('trending', { limit: 20, media_filter: 'minimal' })
        .then(d => { setLista(d.results || []); setErro(false); })
        .catch(() => setErro(true))
        .finally(() => setLoading(false));
      return;
    }
    timerRef.current = setTimeout(() => {
      setLoading(true);
      setErro(false);
      fetchTenor('search', { q, limit: 24, media_filter: 'minimal' })
        .then(d => { setLista(d.results || []); setErro(false); })
        .catch(() => setErro(true))
        .finally(() => setLoading(false));
    }, 400);
  }, []);

  useEffect(() => { pesquisar(query); }, [query, pesquisar]);

  // Helpers para extrair URLs do formato Tenor
  const thumb = (g) => g.media?.[0]?.tinygif?.url || g.media?.[0]?.gif?.url || '';
  const gifUrl = (g) => g.media?.[0]?.gif?.url || '';

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

        <p className="gif-credit">Powered by Tenor</p>
      </div>
    </div>
  );
}
