// ============================================================
//  FutBuddies - Gerador de Poster (Canvas, client-side)
// ============================================================
import React, { useRef, useEffect, useState } from 'react';

function desenharPoster(canvas, jogo, equipaA, equipaB) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Fundo
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0f1117');
  grad.addColorStop(1, '#1a2235');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Faixa verde no topo
  ctx.fillStyle = '#00c06b';
  ctx.fillRect(0, 0, W, 6);

  // Logo / título
  ctx.fillStyle = '#00c06b';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚽ FutBuddies', W / 2, 38);

  // Título do jogo
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  const titulo = jogo.titulo || 'Jogo de Futebol';
  ctx.fillText(titulo.length > 30 ? titulo.slice(0, 28) + '…' : titulo, W / 2, 72);

  // Data e local
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px system-ui, sans-serif';
  const dataStr = jogo.data_jogo
    ? new Date(jogo.data_jogo).toLocaleString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';
  ctx.fillText(`🗓 ${dataStr}`, W / 2, 96);
  if (jogo.regiao || jogo.local) {
    ctx.fillText(`📍 ${jogo.local || jogo.regiao || ''}`, W / 2, 114);
  }

  // Divisor
  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(20, 130); ctx.lineTo(W - 20, 130); ctx.stroke();

  // Equipas
  const metade = W / 2;
  ['A', 'B'].forEach((eq, idx) => {
    const jogadores = idx === 0 ? (equipaA || []) : (equipaB || []);
    const xBase = idx === 0 ? 10 : metade + 10;
    const cor = idx === 0 ? '#00c06b' : '#3b82f6';

    ctx.fillStyle = cor;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Equipa ${eq}`, xBase, 155);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px system-ui, sans-serif';
    jogadores.slice(0, 10).forEach((p, i) => {
      const nome = (p.nickname || p.nome || '').slice(0, 18);
      ctx.fillText(`• ${nome}`, xBase, 176 + i * 20);
    });
  });

  // Divisor vertical
  ctx.strokeStyle = '#2d3748';
  ctx.beginPath(); ctx.moveTo(metade, 140); ctx.lineTo(metade, H - 30); ctx.stroke();

  // VS no meio
  ctx.fillStyle = '#4a5568';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VS', metade, 162);

  // Footer
  ctx.fillStyle = '#4a5568';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('futbuddies.vercel.app', W / 2, H - 12);
}

export default function GeradorPoster({ jogo, equipaA, equipaB, onFechar }) {
  const canvasRef = useRef(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      desenharPoster(canvasRef.current, jogo, equipaA, equipaB);
      setPronto(true);
    } catch {}
  }, [jogo, equipaA, equipaB]);

  const download = () => {
    const link = document.createElement('a');
    link.download = `futbuddies-${jogo.id || 'jogo'}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="card" style={{ padding: '1.25rem', maxWidth: 380, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0 }}>🖼️ Poster do Jogo</h4>
          <button className="btn btn-ghost btn-sm" onClick={onFechar}>✕</button>
        </div>

        <canvas
          ref={canvasRef}
          width={340}
          height={420}
          style={{ width: '100%', borderRadius: 8, display: 'block' }}
        />

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onFechar}>Fechar</button>
          {pronto && (
            <button className="btn btn-primary btn-sm" onClick={download}>
              ⬇️ Download PNG
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
