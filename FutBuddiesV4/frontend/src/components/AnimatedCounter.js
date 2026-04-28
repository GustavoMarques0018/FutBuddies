// ============================================================
//  Animated Counter — conta de 0 ao valor final em viewport
// ============================================================

import React, { useState, useEffect, useRef } from 'react';

export default function AnimatedCounter({ value = 0, duration = 1500, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          const start = performance.now();
          const tick = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(value * eased));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [value, duration]);

  return <span ref={ref}>{display.toLocaleString('pt-PT')}{suffix}</span>;
}
