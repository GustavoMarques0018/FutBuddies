// ============================================================
//  FutBuddies - HeroCampo
//  Fundo animado (SVG) da homepage: relvado de estádio em
//  perspetiva com atletas em silhueta, bola, holofotes,
//  estrelas e partículas. Leve, adaptável a dia/noite e
//  respeita prefers-reduced-motion. Mesmo estilo das capas.
// ============================================================

import React from 'react';
import { useTheme } from '../context/ThemeContext';
import './HeroCampo.css';

// Atleta em silhueta (line-art), pose de remate
function Atleta({ x, y, s = 1, flip = false }) {
  const sx = flip ? -s : s;
  return (
    <g transform={`translate(${x},${y}) scale(${sx},${s})`} stroke="#ffffff" strokeWidth="6"
       strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9">
      <circle cx="0" cy="-30" r="6" fill="#ffffff" stroke="none" />
      <path d="M0,-24 L-1,-3" />
      <path d="M0,-19 L-11,-10" />
      <path d="M0,-19 L12,-14" />
      <path d="M-1,-3 L-8,13" />
      <path d="M-1,-3 L15,4" />
    </g>
  );
}

const ESTRELAS = [[40, 30], [110, 18], [180, 40], [300, 24], [360, 16], [250, 12], [80, 50]];
const PARTICULAS = [
  { x: 90, r: 1.6, d: 0, t: 9 }, { x: 200, r: 2, d: 2, t: 11 },
  { x: 300, r: 1.4, d: 1, t: 8 }, { x: 380, r: 1.8, d: 3, t: 12 },
  { x: 150, r: 1.4, d: 1.6, t: 10 }, { x: 340, r: 1.5, d: 2.4, t: 9 },
];

// Riscas de corte da relva em perspetiva
function riscas() {
  const N = 12, hy = 96, by = 200, vx = 210, k = 0.14, out = [];
  for (let i = 0; i < N; i++) {
    const xb1 = -60 + (540 * i) / N, xb2 = -60 + (540 * (i + 1)) / N;
    const xt1 = vx + (xb1 - vx) * k, xt2 = vx + (xb2 - vx) * k;
    out.push({ p: `${xt1},${hy} ${xt2},${hy} ${xb2},${by} ${xb1},${by}`, e: i % 2 === 0 });
  }
  return out;
}
const RISCAS = riscas();

export default function HeroCampo() {
  const { tema } = useTheme();
  const dark = tema !== 'light';
  const c = dark
    ? { sky0: '#0a1322', sky1: '#0d3320', g0: '#11763a', g1: '#0a3f20', line: '#dff6e6', glow: '#39ff14' }
    : { sky0: '#bfe6f7', sky1: '#9fd9bd', g0: '#2aa85a', g1: '#178a44', line: '#ffffff', glow: '#39ff14' };

  return (
    <div className="hero-bg-campo" aria-hidden="true">
      <svg viewBox="0 0 420 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hc-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.sky0} /><stop offset="1" stopColor={c.sky1} />
          </linearGradient>
          <linearGradient id="hc-grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.g0} /><stop offset="1" stopColor={c.g1} />
          </linearGradient>
          <radialGradient id="hc-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={c.glow} stopOpacity={dark ? 0.45 : 0.3} />
            <stop offset="1" stopColor={c.glow} stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="420" height="104" fill="url(#hc-sky)" />

        {dark && ESTRELAS.map(([x, y], i) => (
          <circle key={i} className="hc-twinkle" cx={x} cy={y} r="1.3" fill={c.line}
                  style={{ animationDelay: `${(i % 5) * 0.6}s` }} />
        ))}

        <ellipse className="hc-flicker" cx="95" cy="20" rx="120" ry="70" fill="url(#hc-glow)" />
        <ellipse className="hc-flicker" cx="330" cy="20" rx="120" ry="70" fill="url(#hc-glow)"
                 style={{ animationDelay: '1.5s' }} />

        <rect y="96" width="420" height="104" fill="url(#hc-grass)" />
        {RISCAS.map((s, i) => (<polygon key={i} points={s.p} fill="#ffffff" opacity={s.e ? 0.05 : 0} />))}

        <g stroke={c.line} strokeOpacity="0.22" fill="none" strokeWidth="1.5">
          <line x1="0" y1="96" x2="420" y2="96" />
          <ellipse cx="210" cy="196" rx="95" ry="26" />
        </g>

        {PARTICULAS.map((p, i) => (
          <circle key={i} className="hc-rise" cx={p.x} cy="180" r={p.r} fill={c.line}
                  style={{ animationDelay: `${p.d}s`, animationDuration: `${p.t}s` }} />
        ))}

        {/* atletas espalhados pelo relvado (profundidade) */}
        <Atleta x="80"  y="150" s={1.0} />
        <Atleta x="150" y="160" s={1.25} flip />
        <Atleta x="300" y="166" s={1.4} />
        <Atleta x="355" y="150" s={0.95} flip />

        {/* bola (flutuação subtil) */}
        <g className="hc-ball">
          <circle cx="245" cy="162" r="6" fill="#ffffff" />
          <path d="M245,158 L247.4,161.5 L246.2,164.6 L243.8,164.6 L242.6,161.5 Z" fill={c.g1} opacity="0.85" />
        </g>
      </svg>
    </div>
  );
}
