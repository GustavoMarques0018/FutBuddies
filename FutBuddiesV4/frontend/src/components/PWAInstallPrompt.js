// ============================================================
//  FutBuddies - PWA Install Prompt
//  Popup de primeira visita no mobile a ensinar
//  "Adicionar ao Ecrã Principal" (iOS + Android)
// ============================================================

import React, { useEffect, useState } from 'react';
import './PWAInstallPrompt.css';

const STORAGE_KEY = 'fb_pwa_prompt_dismissed_v1';
const DELAY_MS = 1500;

function detetarMobile() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Opera Mini|Mobile/i.test(ua);
}

function detetarIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  // iPad em iOS 13+ reporta MacIntel — verificar touch
  const isIPadOS = ua.includes('Mac') && 'ontouchend' in document;
  return isIOS || isIPadOS;
}

function emStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export default function PWAInstallPrompt() {
  const [visivel, setVisivel] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [passo, setPasso] = useState(0); // iOS multi-passo
  const isIOS = detetarIOS();

  useEffect(() => {
    if (!detetarMobile()) return;
    if (emStandalone()) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {}

    // Android / Chromium: apanhar o evento nativo
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Mostrar popup após pequeno delay (UX — não invadir assim que entra)
    const timer = setTimeout(() => setVisivel(true), DELAY_MS);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const fechar = (permanente = true) => {
    setVisivel(false);
    if (permanente) {
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    }
  };

  const instalarAndroid = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {}
    setDeferredPrompt(null);
    fechar(true);
  };

  if (!visivel) return null;

  return (
    <div className="pwa-overlay" onClick={() => fechar(false)}>
      <div className="pwa-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pwa-close" onClick={() => fechar(true)} aria-label="Fechar">×</button>
        <div className="pwa-scroll">
        <div className="pwa-header">
          <img src="/logo-icon.png" alt="FutBuddies" className="pwa-logo" />
          <div>
            <h3>Instala o FutBuddies</h3>
            <p>Acede mais rápido — como se fosse uma app.</p>
          </div>
        </div>

        <img src="/Image (6).jpg" alt="Exemplo de app instalada" className="pwa-showcase" />

        {isIOS ? (
          <>
            <div className="pwa-passos">
              <div className={`pwa-passo ${passo === 0 ? 'ativo' : ''}`}>
                <span className="pwa-passo-num">1</span>
                <p>
                  Toca no botão <strong>Partilhar</strong>
                  <span className="pwa-icon-ios-share" aria-hidden>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v12" />
                      <path d="M7 8l5-5 5 5" />
                      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                    </svg>
                  </span>
                  na barra do Safari.
                </p>
              </div>
              <div className={`pwa-passo ${passo === 1 ? 'ativo' : ''}`}>
                <span className="pwa-passo-num">2</span>
                <p>Desce e escolhe <strong>“Adicionar ao Ecrã Principal”</strong> ➕</p>
              </div>
              <div className={`pwa-passo ${passo === 2 ? 'ativo' : ''}`}>
                <span className="pwa-passo-num">3</span>
                <p>Confirma em <strong>“Adicionar”</strong>. Pronto — já tens o FutBuddies no teu ecrã!</p>
              </div>
            </div>
            <div className="pwa-acoes">
              {passo < 2 ? (
                <button className="btn btn-primary" onClick={() => setPasso(p => Math.min(2, p + 1))}>
                  Próximo passo →
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => fechar(true)}>
                  Percebido! ⚽
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => fechar(true)}>
                Agora não
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="pwa-passos">
              <div className="pwa-passo ativo">
                <span className="pwa-passo-num">1</span>
                <p>Abre o menu <strong>⋮</strong> no canto superior direito do browser.</p>
              </div>
              <div className="pwa-passo ativo">
                <span className="pwa-passo-num">2</span>
                <p>Toca em <strong>“Instalar app”</strong> ou <strong>“Adicionar ao ecrã principal”</strong>.</p>
              </div>
              <div className="pwa-passo ativo">
                <span className="pwa-passo-num">3</span>
                <p>Confirma — o FutBuddies aparece no teu ecrã como uma app nativa.</p>
              </div>
            </div>
            <div className="pwa-acoes">
              {deferredPrompt ? (
                <button className="btn btn-primary" onClick={instalarAndroid}>
                  📲 Instalar agora
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => fechar(true)}>
                  Percebido! ⚽
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => fechar(true)}>
                Agora não
              </button>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
