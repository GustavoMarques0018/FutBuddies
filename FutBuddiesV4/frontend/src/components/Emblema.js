// ============================================================
//  FutBuddies - Componente Emblema (emoji OU imagem carregada)
//  Uso: <Emblema valor={equipa.emblema} tamanho={40} />
// ============================================================

import React from 'react';
import { resolverImgUrl } from '../utils/constantes';

export default function Emblema({ valor, tamanho = 32, inline = false, style }) {
  const isUrl = typeof valor === 'string' && (valor.startsWith('http') || valor.startsWith('/uploads'));
  const baseStyle = inline
    ? { display: 'inline-block', verticalAlign: 'middle', lineHeight: 1, ...style }
    : { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, ...style };

  if (isUrl) {
    const px = typeof tamanho === 'number' ? `${tamanho}px` : tamanho;
    return (
      <img
        src={resolverImgUrl(valor)}
        alt="emblema"
        style={{
          width: px,
          height: px,
          borderRadius: 8,
          objectFit: 'cover',
          flexShrink: 0,
          verticalAlign: inline ? 'middle' : undefined,
          ...style,
        }}
      />
    );
  }
  // Emoji / texto
  const fontSize = typeof tamanho === 'number' ? `${Math.round(tamanho * 0.75)}px` : tamanho;
  return (
    <span style={{ ...baseStyle, fontSize }}>
      {valor || '⚽'}
    </span>
  );
}
