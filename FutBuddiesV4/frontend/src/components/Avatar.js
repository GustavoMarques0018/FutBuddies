// ============================================================
//  FutBuddies - Avatar reutilizável
//  Mostra foto do utilizador (se perfil_publico !== 0/false)
//  com fallback para iniciais coloridas determinísticas.
// ============================================================

import React from 'react';
import { resolverImgUrl } from '../utils/constantes';
import './Avatar.css';

/**
 * Props:
 *  - nome: string (obrigatório para iniciais)
 *  - fotoUrl: string | null
 *  - perfilPublico: bool (default true) — se false, ignora fotoUrl
 *  - size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number (px)   (default 'md' = 36)
 *  - className, title
 */
export default function Avatar({
  nome = '',
  fotoUrl,
  perfilPublico = true,
  size = 'md',
  className = '',
  title,
}) {
  const px = typeof size === 'number'
    ? size
    : { xs: 22, sm: 28, md: 36, lg: 48, xl: 72 }[size] || 36;

  const mostrarFoto = !!fotoUrl && perfilPublico !== false && perfilPublico !== 0;
  const src = mostrarFoto ? resolverImgUrl(fotoUrl) : null;

  const iniciais = (nome || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(s => s[0])
    .join('')
    .toUpperCase() || '?';

  // Cor determinística pelo nome (HSL — saturado e escuro o suficiente para legibilidade)
  const hash = Array.from(nome || '').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = hash % 360;

  const style = {
    width: px,
    height: px,
    fontSize: Math.max(10, px * 0.4),
    background: src ? 'transparent' : `hsl(${hue} 60% 32%)`,
  };

  return (
    <span
      className={`fb-avatar ${className}`}
      style={style}
      title={title || nome}
      aria-label={nome}
      role="img"
    >
      {src
        ? <img src={src} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        : <span className="fb-avatar-initials">{iniciais}</span>}
    </span>
  );
}
