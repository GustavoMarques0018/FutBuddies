// ============================================================
//  FutBuddies - FundoCampo
//  Fundo animado (SVG) para o login/registo: relvado de estádio
//  com riscas de corte, círculo central, bola e partículas.
//  Leve (~3 KB), adaptável a dia/noite, respeita prefers-reduced-motion.
// ============================================================

import React from 'react';
import { useTheme } from '../context/ThemeContext';
import './FundoCampo.css';

// Riscas de corte da relva em perspetiva (convergem para o horizonte)
function gerarRiscas() {
  const N = 12, horizonY = 520, botY = 960, vx = 720, k = 0.16;
  const riscas = [];
  for (let i = 0; i < N; i++) {
    const xb1 = -240 + (1920 * i) / N;
    const xb2 = -240 + (1920 * (i + 1)) / N;
    const xt1 = vx + (xb1 - vx) * k;
    const xt2 = vx + (xb2 - vx) * k;
    riscas.push({
      pts: `${xt1},${horizonY} ${xt2},${horizonY} ${xb2},${botY} ${xb1},${botY}`,
      par: i % 2 === 0,
    });
  }
  return riscas;
}

const RISCAS = gerarRiscas();
const ESTRELAS = [
  [180, 90], [360, 150], [520, 70], [900, 120], [1080, 80],
  [1240, 160], [1340, 60], [700, 60], [60, 180],
];
const PARTICULAS = [
  { x: 240, r: 3, d: 0,   t: 9 },  { x: 480, r: 2, d: 2.5, t: 11 },
  { x: 720, r: 4, d: 1.2, t: 8 },  { x: 960, r: 2, d: 3.4, t: 12 },
  { x: 1180, r: 3, d: 0.6, t: 10 }, { x: 1320, r: 2, d: 2,  t: 9 },
  { x: 360, r: 2, d: 4,   t: 13 }, { x: 1040, r: 3, d: 1.8, t: 10 },
];

export default function FundoCampo() {
  const { tema } = useTheme();
  const dark = tema === 'dark';

  const c = dark
    ? { sky0: '#0a1222', sky1: '#0e3320', g0: '#11763a', g1: '#0a4423', line: '#d8f3e2', glow: '#39ff14' }
    : { sky0: '#cfeafe', sky1: '#9fd9bd', g0: '#2aa85a', g1: '#178a44', line: '#ffffff', glow: '#7cffb0' };

  return (
    <div className="auth-bg-campo" aria-hidden="true">
      <svg viewBox="0 0 1440 960" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="fc-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.sky0} />
            <stop offset="1" stopColor={c.sky1} />
          </linearGradient>
          <linearGradient id="fc-grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.g0} />
            <stop offset="1" stopColor={c.g1} />
          </linearGradient>
          <radialGradient id="fc-holofote" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={c.glow} stopOpacity={dark ? 0.5 : 0.35} />
            <stop offset="1" stopColor={c.glow} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* céu */}
        <rect x="0" y="0" width="1440" height="540" fill="url(#fc-sky)" />

        {/* estrelas (só de noite) */}
        {dark && ESTRELAS.map(([x, y], i) => (
          <circle key={i} className="fc-twinkle" cx={x} cy={y} r="1.6" fill={c.line}
                  style={{ animationDelay: `${(i % 5) * 0.7}s` }} />
        ))}

        {/* holofotes */}
        <ellipse className="fc-flicker" cx="300" cy="120" rx="360" ry="220" fill="url(#fc-holofote)" />
        <ellipse className="fc-flicker" cx="1140" cy="120" rx="360" ry="220" fill="url(#fc-holofote)"
                 style={{ animationDelay: '1.5s' }} />

        {/* relvado */}
        <rect x="0" y="520" width="1440" height="440" fill="url(#fc-grass)" />
        {RISCAS.map((r, i) => (
          <polygon key={i} points={r.pts} fill="#ffffff" opacity={r.par ? 0.06 : 0} />
        ))}

        {/* marcações */}
        <g stroke={c.line} strokeOpacity="0.32" fill="none" strokeWidth="3">
          <line x1="0" y1="520" x2="1440" y2="520" />
          <ellipse cx="720" cy="770" rx="210" ry="56" />
        </g>
        <circle cx="720" cy="770" r="5" fill={c.line} fillOpacity="0.32" />

        {/* partículas a subir */}
        {PARTICULAS.map((p, i) => (
          <circle key={i} className="fc-rise" cx={p.x} cy="900" r={p.r} fill={c.line}
                  style={{ animationDelay: `${p.d}s`, animationDuration: `${p.t}s` }} />
        ))}

        {/* bola */}
        <g className="fc-ball">
          <circle cx="720" cy="690" r="20" fill="#ffffff" />
          <path d="M720,675 L731,683 L727,696 L713,696 L709,683 Z" fill={c.g1} opacity="0.85" />
        </g>
      </svg>
    </div>
  );
}
