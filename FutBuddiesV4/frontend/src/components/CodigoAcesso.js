// ============================================================
//  FutBuddies - Componente Codigo de Acesso (mostrar/ocultar)
// ============================================================

import React, { useState } from 'react';
import { useToast } from './Toast';

// Icones inline
const IconLock = ({ size = '1em' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconEye = ({ size = '1em' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = ({ size = '1em' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const IconCopy = ({ size = '1em' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export default function CodigoAcesso({ codigo, label = 'Código de Acesso' }) {
  const [visivel, setVisivel] = useState(false);
  const { addToast } = useToast();

  if (!codigo) return null;

  const oculto = '•'.repeat(codigo.length);

  const copiar = () => {
    navigator.clipboard.writeText(codigo);
    addToast('Código copiado!', 'success');
  };

  return (
    <div className="codigo-acesso-box">
      <div className="codigo-acesso-label">
        <IconLock size="0.85em" />
        <span>{label}:</span>
      </div>
      <div
        className="codigo-acesso-valor"
        onClick={() => setVisivel(v => !v)}
        title={visivel ? 'Clica para ocultar' : 'Clica para revelar'}
      >
        {visivel ? codigo : oculto}
      </div>
      <div className="codigo-acesso-acoes">
        <button
          type="button"
          className="codigo-acesso-btn"
          onClick={() => setVisivel(v => !v)}
          title={visivel ? 'Ocultar' : 'Mostrar'}
        >
          {visivel ? <IconEyeOff /> : <IconEye />}
        </button>
        <button
          type="button"
          className="codigo-acesso-btn"
          onClick={copiar}
          title="Copiar"
        >
          <IconCopy />
        </button>
      </div>
    </div>
  );
}
