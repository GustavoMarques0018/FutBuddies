// ============================================================
//  FutBuddies - GIF Picker (GIPHY)
//  Usa REACT_APP_GIPHY_KEY ou fallback público para demos
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './GifPicker.css';

const GIPHY_KEY = process.env.REACT_APP_GIPHY_KEY || 'dc6zaTOxFJmzC';
const GIPHY_URL = 'https://api.giphy.com/v1/gifs';

export default function GifPicker({ onSelect, onFechar }) {
  const [query, setQuery]       = useState('');
  const [gifs, setGifs]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [trending, setTrending] = useState([]);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  // Fechar com Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', h);
    inputRef.current?.focus();
    return () => window.removeEventListener('keydown', h);
  }, [onFechar]);

  // Carregar trending ao abrir
  useEffect(() => {
    fetch(`${GIPHY_URL}/trending?api_key=${GIPHY_KEY}&limit=18&rating=pg`)
      .then(r => r.json())
      .then(d => setTrending(d.data || []))
      .catch(() => {});
  }, []);

  // Pesquisa com debounce
  const pesquisar = useCallback((q) => {
    clearTimeout(timerRef.current);
    if (!q.trim()) { setGifs([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`${GIPHY_URL}/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=pg`);
        const d = await r.json();
        setGifs(d.data || []);
      } catch { setGifs([]); }
      finally { setLoading(false); }
    }, 400);
  }, []);

  useEffect(() => { pesquisar(query); }, [query, pesquisar]);

  const lista = query.trim() ? gifs : trending;

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
          <button className="gif-close" onClick={onFechar}>✕</button>
        </div>
        <div className="gif-grid">
          {loading && <div className="gif-loading"><div className="spinner" /></div>}
          {!loading && lista.length === 0 && (
            <p className="gif-empty">{query ? 'Sem resultados.' : 'A carregar trending...'}</p>
          )}
          {lista.map(g => (
            <button
              key={g.id}
              className="gif-item"
              onClick={() => onSelect(g.images.fixed_height.url, g.images.fixed_height.width, g.images.fixed_height.height)}
              title={g.title}
            >
              <img
                src={g.images.fixed_height_small.url}
                alt={g.title}
                loading="lazy"
                width={g.images.fixed_height_small.width}
                height={g.images.fixed_height_small.height}
              />
            </button>
          ))}
        </div>
        <p className="gif-credit">Powered by GIPHY</p>
      </div>
    </div>
  );
}
