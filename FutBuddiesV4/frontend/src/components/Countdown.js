// ============================================================
//  FutBuddies - Countdown
//  Mostra tempo relativo até uma data futura. Atualiza a cada 30s.
//  Uso: <Countdown alvo={jogo.data_jogo} />
// ============================================================

import React, { useEffect, useState } from 'react';

function formatar(ms) {
  if (ms <= 0) return null;
  const seg = Math.floor(ms / 1000);
  const min = Math.floor(seg / 60);
  const h   = Math.floor(min / 60);
  const d   = Math.floor(h / 24);

  if (d >= 2)  return `daqui a ${d} dias`;
  if (d === 1) return 'amanhã';
  if (h >= 2)  return `daqui a ${h}h`;
  if (h === 1) return `daqui a 1h ${min % 60}m`;
  if (min >= 2) return `daqui a ${min} min`;
  if (min === 1) return 'daqui a 1 min';
  return 'a começar!';
}

export default function Countdown({ alvo, prefixo = '⏱', className = '', style = {} }) {
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  if (!alvo) return null;
  const alvoMs = new Date(alvo).getTime();
  const diff = alvoMs - agora;
  const txt = formatar(diff);
  if (!txt) return null; // já passou

  const urgente = diff > 0 && diff < 2 * 60 * 60 * 1000; // < 2h

  return (
    <span
      className={`countdown ${urgente ? 'countdown-urgente' : ''} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        fontSize: '0.85rem',
        color: urgente ? 'var(--warning)' : 'var(--text-secondary)',
        fontWeight: 600,
        ...style,
      }}
    >
      {prefixo && <span aria-hidden>{prefixo}</span>}
      {txt}
    </span>
  );
}
