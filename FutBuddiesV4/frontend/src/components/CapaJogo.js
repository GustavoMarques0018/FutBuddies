// ============================================================
//  FutBuddies - CapaJogo
//  Capa visual para os cards de jogo. Usa a imagem definida
//  (capa_url) se existir; caso contrário gera uma ilustração
//  SVG de uma cena de futebol (leve, escalável, sem downloads).
//  O acento de cor varia com o tipo de jogo (5x5 / 7x7 / 11x11).
//
//  Composição pensada para a "zona segura" central — o card usa
//  preserveAspectRatio=slice, que corta topo/fundo em cards largos
//  e as laterais em cards estreitos. Tudo o que importa fica ao centro.
// ============================================================

import React from 'react';
import { resolverImgUrl } from '../utils/constantes';
import './CapaJogo.css';

const ACENTO = { '5x5': '#22c55e', '7x7': '#0ea5e9', '11x11': '#a855f7' };

// Jogador em silhueta preenchida (membros grossos que se fundem num corpo
// sólido) numa pose de remate, virado para a bola ao centro.
function Jogador({ x, y, escala = 1, flip = false }) {
  const sx = flip ? -escala : escala;
  return (
    <g transform={`translate(${x},${y}) scale(${sx},${escala})`}
       stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"
       fill="none">
      <circle cx="0" cy="-32" r="7.5" fill="#ffffff" stroke="none" />
      <path d="M0,-25 L-2,-2" />      {/* tronco */}
      <path d="M-1,-19 L-13,-11" />   {/* braço de trás */}
      <path d="M-1,-19 L13,-16" />    {/* braço da frente */}
      <path d="M-2,-2 L-9,13" />      {/* perna de apoio */}
      <path d="M-2,-2 L16,5" />       {/* perna de remate */}
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
      <svg viewBox="0 0 400 132" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cj-relva" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1f9d4d" />
            <stop offset="1" stopColor="#0f6b34" />
          </linearGradient>
          <radialGradient id="cj-glow" cx="0.5" cy="0.0" r="0.85">
            <stop offset="0" stopColor={acento} stopOpacity="0.5" />
            <stop offset="0.7" stopColor={acento} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* relvado */}
        <rect width="400" height="132" fill="url(#cj-relva)" />

        {/* faixas de corte da relva */}
        {[0, 2, 4, 6].map(i => (
          <rect key={i} x={i * 57} y="0" width="57" height="132" fill="#ffffff" opacity="0.05" />
        ))}

        {/* marcações do campo (meio-círculo) */}
        <g stroke="#ffffff" strokeOpacity="0.22" fill="none" strokeWidth="2">
          <ellipse cx="200" cy="128" rx="78" ry="22" />
        </g>

        {/* brilho de acento (varia com o tipo) */}
        <rect width="400" height="132" fill="url(#cj-glow)" />

        {/* sombras no chão (assentam os jogadores) */}
        <g fill="#000000" opacity="0.13">
          <ellipse cx="146" cy="107" rx="26" ry="5" />
          <ellipse cx="254" cy="107" rx="26" ry="5" />
          <ellipse cx="200" cy="106" rx="12" ry="3" />
        </g>

        {/* dois jogadores a disputar a bola ao centro (maiores, centrados) */}
        <Jogador x="146" y="80" escala={1.5} />
        <Jogador x="254" y="80" escala={1.5} flip />

        {/* bola entre os dois */}
        <g transform="translate(200,99)">
          <circle r="9" fill="#ffffff" />
          <path d="M0,-6 L3.5,-1 L1.8,3.8 L-1.8,3.8 L-3.5,-1 Z" fill="#0f6b34" opacity="0.85" />
        </g>
      </svg>
    </div>
  );
}
