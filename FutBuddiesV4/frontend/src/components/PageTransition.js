import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Wrapper que aplica uma animação de entrada subtil sempre
 * que a rota muda. Scroll volta ao topo automaticamente e
 * uma barra de progresso no topo transmite a mudança.
 */
export default function PageTransition({ children }) {
  const location = useLocation();
  const [key, setKey] = useState(location.pathname);
  const [progress, setProgress] = useState(false);

  useEffect(() => {
    setKey(location.pathname + location.search);
    try { window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); }
    catch { window.scrollTo(0, 0); }
    setProgress(true);
    const t = setTimeout(() => setProgress(false), 600);
    return () => clearTimeout(t);
  }, [location.pathname, location.search]);

  return (
    <>
      <div className={`route-progress${progress ? ' active' : ''}`} aria-hidden="true" />
      <div key={key} className="page-enter">
        {children}
      </div>
    </>
  );
}
