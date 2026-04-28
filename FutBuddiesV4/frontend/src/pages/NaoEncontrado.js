// ============================================================
//  FutBuddies - Página 404
// ============================================================

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function NaoEncontrado() {
  const navigate = useNavigate();

  return (
    <div style={{
      padding: 'calc(var(--navbar-h) + 4rem) 0 4rem',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 1.5rem' }}>
        <div style={{
          fontSize: '5rem',
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          color: 'var(--primary)',
          lineHeight: 1,
          marginBottom: '0.5rem',
        }}>404</div>

        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚽</div>

        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>
          Página não encontrada
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: 1.7 }}>
          A página que procuras não existe ou foi movida. Volta ao início e continua a jogar!
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost"
            onClick={() => navigate(-1)}
          >
            ← Voltar
          </button>
          <Link to="/" className="btn btn-primary">
            Ir para o Início
          </Link>
          <Link to="/jogos" className="btn btn-outline">
            Ver Jogos
          </Link>
        </div>
      </div>
    </div>
  );
}
