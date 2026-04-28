// ============================================================
//  FutBuddies - Banner de Cookies (RGPD)
// ============================================================

import React, { useState, useEffect } from 'react';
import './CookieBanner.css';

const COOKIE_KEY = 'fb_cookies_consent';

export default function CookieBanner() {
  const [visivel, setVisivel] = useState(false);
  const [detalhes, setDetalhes] = useState(false);

  useEffect(() => {
    const consentimento = localStorage.getItem(COOKIE_KEY);
    if (!consentimento) {
      // Pequeno delay para não aparecer logo no carregamento
      const timer = setTimeout(() => setVisivel(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const aceitarTudo = () => {
    localStorage.setItem(COOKIE_KEY, JSON.stringify({
      essenciais: true,
      analiticos: true,
      data: new Date().toISOString()
    }));
    setVisivel(false);
  };

  const aceitarEssenciais = () => {
    localStorage.setItem(COOKIE_KEY, JSON.stringify({
      essenciais: true,
      analiticos: false,
      data: new Date().toISOString()
    }));
    setVisivel(false);
  };

  if (!visivel) return null;

  return (
    <div className="cookie-banner-overlay">
      <div className="cookie-banner">
        <div className="cookie-banner-icon">🍪</div>
        <div className="cookie-banner-content">
          <h3>Usamos cookies</h3>
          <p>
            O FutBuddies utiliza cookies para garantir a melhor experiência possível.
            Os cookies essenciais são necessários para o funcionamento do site (autenticação, sessão).
            {!detalhes && (
              <button className="cookie-banner-link" onClick={() => setDetalhes(true)}>
                Saber mais
              </button>
            )}
          </p>

          {detalhes && (
            <div className="cookie-banner-detalhes">
              <div className="cookie-banner-tipo">
                <strong>✓ Cookies essenciais (obrigatórios)</strong>
                <span>Autenticação, sessão de utilizador, preferências básicas. Sem estes, o site não funciona.</span>
              </div>
              <div className="cookie-banner-tipo">
                <strong>○ Cookies analíticos (opcionais)</strong>
                <span>Ajudam-nos a perceber como usas a plataforma para melhorar a experiência.</span>
              </div>
              <button className="cookie-banner-link" onClick={() => setDetalhes(false)}>
                Esconder detalhes
              </button>
            </div>
          )}
        </div>
        <div className="cookie-banner-acoes">
          <button className="btn btn-ghost" onClick={aceitarEssenciais}>
            Apenas essenciais
          </button>
          <button className="btn btn-primary" onClick={aceitarTudo}>
            Aceitar tudo
          </button>
        </div>
      </div>
    </div>
  );
}
