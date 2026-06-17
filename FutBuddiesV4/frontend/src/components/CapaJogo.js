// ============================================================
//  FutBuddies - CapaJogo
//  Capa visual para os cards de jogo. Usa a imagem definida
//  (capa_url) se existir; caso contrário gera uma ilustração
//  SVG de uma cena de futebol (leve, escalável, sem downloads).
//  O acento de cor varia com o tipo de jogo (5x5 / 7x7 / 11x11).
// ============================================================

import React from 'react';
import { resolverImgUrl } from '../utils/constantes';
import './CapaJogo.css';

const ACENTO = { '5x5': '#22c55e', '7x7': '#0ea5e9', '11x11': '#a855f7' };

// Jogador em "line-art" numa pose de remate
function Jogador({ x, y, escala = 1, flip = false }) {
  const sx = flip ? -escala : escala;
  return (
    <g transform={`translate(${x},${y}) scale(${sx},${escala})`}
       stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"
       fill="none" opacity="0.9">
      <circle cx="0" cy="-30" r="5.6" fill="#ffffff" stroke="none" />
      <path d="M0,-24 L-1,-4" />     {/* tronco */}
      <path d="M0,-19 L-10,-9" />    {/* braço de trás */}
      <path d="M0,-19 L11,-13" />    {/* braço da frente */}
      <path d="M-1,-4 L-8,13" />     {/* perna de apoio */}
      <path d="M-1,-4 L14,3" />      {/* perna de remate */}
    </g>
  );
}

export default function CapaJogo({ jogo = {}, altura, className = '' }) {
  const { capa_url, tipo_jogo } = jogo;
  const estilo = altura ? { height: altura } : undefined;

  // Imagem personalizada definida pelo criador
  if (capa_url) {
    return (
      <div className={`capa-jogo ${className}`} style={estilo}>
        <img src={resolverImgUrl(capa_url)} alt="" loading="lazy" />
      </div>
    );
  }

  const acento = ACENTO[tipo_jogo] || ACENTO['5x5'];

  return (
    <div className={`capa-jogo ${className}`} style={estilo} aria-hidden="true">
      <svg viewBox="0 0 400 130" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cj-relva" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1f9d4d" />
            <stop offset="1" stopColor="#0f6b34" />
          </linearGradient>
          <radialGradient id="cj-glow" cx="0.15" cy="0.12" r="0.95">
            <stop offset="0" stopColor={acento} stopOpacity="0.55" />
            <stop offset="0.6" stopColor={acento} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* relvado */}
        <rect width="400" height="130" fill="url(#cj-relva)" />

        {/* faixas de corte da relva */}
        {[0, 2, 4, 6].map(i => (
          <rect key={i} x={i * 50} y="0" width="50" height="130" fill="#ffffff" opacity="0.05" />
        ))}

        {/* marcações do campo */}
        <g stroke="#ffffff" strokeOpacity="0.28" fill="none" strokeWidth="2">
          <line x1="200" y1="0" x2="200" y2="130" />
          <ellipse cx="200" cy="130" rx="46" ry="22" />
        </g>
        <circle cx="200" cy="130" r="3" fill="#ffffff" fillOpacity="0.28" />

        {/* brilho de acento (varia com o tipo) */}
        <rect width="400" height="130" fill="url(#cj-glow)" />

        {/* jogadores */}
        <Jogador x="118" y="94" escala={1.05} />
        <Jogador x="268" y="88" escala={1.18} flip />
        <Jogador x="322" y="106" escala={0.8} />

        {/* bola */}
        <g transform="translate(150,110)">
          <circle r="7" fill="#ffffff" />
          <path d="M0,-5 L3,-1 L1.5,3 L-1.5,3 L-3,-1 Z" fill="#0f6b34" opacity="0.85" />
        </g>
      </svg>
    </div>
  );
}
