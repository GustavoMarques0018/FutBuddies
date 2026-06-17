// ============================================================
//  FutBuddies - IlustracaoVazio
//  Ilustração SVG (line-art) para estados vazios.
//  Usa currentColor → adapta-se automaticamente ao tema.
//  Variantes: 'baliza' (sem jogos), 'bola' (genérico).
// ============================================================

import React from 'react';

export default function IlustracaoVazio({ variante = 'baliza', tamanho = 120 }) {
  const props = {
    width: tamanho,
    height: tamanho * 0.72,
    viewBox: '0 0 140 100',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
    style: { color: 'var(--text-muted)', opacity: 0.7 },
  };

  if (variante === 'bola') {
    return (
      <svg {...props}>
        <g stroke="currentColor" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="70" cy="88" rx="34" ry="5" opacity="0.4" />
          <circle cx="70" cy="50" r="30" />
          <path d="M70,30 L82,40 L77,55 L63,55 L58,40 Z" opacity="0.7" />
          <path d="M70,30 L70,20 M82,40 L92,36 M77,55 L84,65 M63,55 L56,65 M58,40 L48,36" opacity="0.5" />
        </g>
      </svg>
    );
  }

  // 'baliza' — baliza vazia + bola
  return (
    <svg {...props}>
      <g stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* rede (fina) */}
        <g strokeWidth="1" opacity="0.35">
          <line x1="46" y1="26" x2="46" y2="72" />
          <line x1="62" y1="26" x2="62" y2="72" />
          <line x1="78" y1="26" x2="78" y2="72" />
          <line x1="94" y1="26" x2="94" y2="72" />
          <line x1="30" y1="38" x2="110" y2="38" />
          <line x1="30" y1="50" x2="110" y2="50" />
          <line x1="30" y1="62" x2="110" y2="62" />
        </g>
        {/* estrutura da baliza */}
        <g strokeWidth="3.2">
          <path d="M30,72 L30,26 L110,26 L110,72" />
        </g>
        {/* linha do chão */}
        <line x1="16" y1="72" x2="124" y2="72" strokeWidth="3.2" opacity="0.55" />
        {/* bola */}
        <g strokeWidth="2.4">
          <circle cx="70" cy="63" r="9" />
          <path d="M70,57 L74,61 L72,66 L68,66 L66,61 Z" opacity="0.7" />
        </g>
      </g>
    </svg>
  );
}
