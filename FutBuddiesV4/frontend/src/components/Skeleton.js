// ============================================================
//  FutBuddies - Skeleton loader
//  Uso: <Skeleton w="100%" h="1rem" />  <Skeleton circle size={48} />
// ============================================================

import React from 'react';
import './Skeleton.css';

export default function Skeleton({ w = '100%', h = '1rem', circle = false, size, radius, style = {}, className = '' }) {
  const s = {
    width: circle ? size : w,
    height: circle ? size : h,
    borderRadius: circle ? '50%' : (radius ?? 'var(--radius-sm)'),
    ...style,
  };
  return <span className={`skeleton ${className}`} style={s} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <Skeleton h="180px" radius="var(--radius)" />
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Skeleton w="70%" h="1.2rem" />
        <Skeleton w="50%" h="0.9rem" />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <Skeleton w="60px" h="24px" radius="var(--radius-pill)" />
          <Skeleton w="80px" h="24px" radius="var(--radius-pill)" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
