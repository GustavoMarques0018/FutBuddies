// ============================================================
//  FutBuddies - Constantes Partilhadas
// ============================================================

export const REGIOES = [
  'Lisboa', 'Porto', 'Braga', 'Coimbra', 'Aveiro', 'Leiria', 'Setúbal',
  'Faro', 'Évora', 'Viseu', 'Viana do Castelo', 'Bragança', 'Guarda',
  'Castelo Branco', 'Santarém', 'Portalegre', 'Beja', 'Odivelas',
  'Sintra', 'Amadora', 'Almada', 'Cascais', 'Oeiras', 'Loures',
  'Vila Nova de Gaia', 'Matosinhos', 'Gondomar', 'Maia', 'Valongo',
];

export const NIVEIS = ['Descontraído', 'Intermédio', 'Competitivo'];

export const POSICOES = ['Guarda-Redes', 'Defesa', 'Médio', 'Avançado', 'Polivalente'];

export const PES = ['Destro', 'Canhoto', 'Ambidiestro'];

export const EMBLEMAS = ['⚽', '🦁', '🐺', '🦅', '🐉', '⭐', '🔥', '💎', '🏆', '⚡', '🌟', '🎯'];

export const NIVEL_COR = {
  'Descontraído': { bg: 'rgba(34,197,94,0.15)', cor: '#16a34a', borda: '#16a34a' },
  'Intermédio':   { bg: 'rgba(245,158,11,0.15)', cor: '#d97706', borda: '#d97706' },
  'Competitivo':  { bg: 'rgba(239,68,68,0.15)',  cor: '#dc2626', borda: '#dc2626' },
};

export const getRegiaoGuardada = () => localStorage.getItem('fb_regiao') || '';
export const guardarRegiao = (r) => r ? localStorage.setItem('fb_regiao', r) : localStorage.removeItem('fb_regiao');

const isLocalDev =
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\d+\.\d+\.\d+\.\d+)$/.test(window.location.hostname);

const API_BASE = (process.env.REACT_APP_API_URL ||
  (isLocalDev ? `http://${window.location.hostname}:5000/api` : '/api'))
  .replace(/\/api\/?$/, '');

export const resolverImgUrl = (url) => {
  if (!url) return null;

  // URL Cloudinary (res.cloudinary.com) — devolver tal qual, é sempre válida
  if (url.includes('cloudinary.com')) return url;

  // URL absoluta com /uploads/ — extrair o path e reconstruir com o API_BASE actual.
  // Corrige URLs guardadas com host errado: localhost em dev, ou host Render antigo em prod.
  if (/^https?:\/\//.test(url) && url.includes('/uploads/')) {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    return API_BASE + path;
  }

  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads')) return API_BASE + url;
  return url;
};
