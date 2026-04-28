import React, { useEffect, useRef, useState } from 'react';

/**
 * Wrapper que adiciona animação de entrada quando o elemento
 * entra no viewport. Usa IntersectionObserver (uma vez).
 *
 * Props:
 *  - delay: 0 | 1 | 2 | 3  (corresponde a delay-1/-2/-3 em CSS)
 *  - as: componente/tag HTML (default 'div')
 *  - className, children, ...rest
 */
export default function Reveal({ delay = 0, as: Tag = 'div', className = '', children, ...rest }) {
  const ref = useRef(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visivel) return;
    // Fallback: se IntersectionObserver não existe, revela imediatamente
    if (typeof IntersectionObserver === 'undefined') { setVisivel(true); return; }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisivel(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visivel]);

  const delayCls = delay > 0 ? ` delay-${Math.min(3, delay)}` : '';
  return (
    <Tag
      ref={ref}
      className={`reveal${visivel ? ' reveal-visible' : ''}${delayCls} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
