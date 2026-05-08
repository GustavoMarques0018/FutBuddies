// ============================================================
//  FutBuddies - Heatmap de Presenças (estilo GitHub)
// ============================================================
import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const COR = ['var(--bg-elev-2)', '#166534', '#16a34a', '#22c55e', '#4ade80'];

function corCelula(n) {
  if (n === 0) return COR[0];
  if (n === 1) return COR[1];
  if (n === 2) return COR[2];
  if (n === 3) return COR[3];
  return COR[4];
}

function diasDoAno() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(hoje);
  inicio.setFullYear(hoje.getFullYear() - 1);
  inicio.setDate(inicio.getDate() + 1); // 365 dias incluindo hoje
  const dias = [];
  for (let d = new Date(inicio); d <= hoje; d.setDate(d.getDate() + 1)) {
    dias.push(new Date(d).toISOString().slice(0, 10));
  }
  return dias;
}

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DIAS_PT  = ['D','S','T','Q','Q','S','S'];

export default function HeatmapPresencas({ utilizadorId }) {
  const [mapa, setMapa] = useState({});
  const [tooltip, setTooltip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/jogadores/${utilizadorId}/heatmap`)
      .then(r => {
        const m = {};
        (r.data.dias || []).forEach(d => { m[d.dia.slice(0, 10)] = d.jogos; });
        setMapa(m);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [utilizadorId]);

  if (loading) return <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  const todos = diasDoAno();
  const totalJogos = Object.values(mapa).reduce((s, v) => s + v, 0);

  // Organizar em semanas (colunas)
  // Encontrar o dia da semana do primeiro dia (0=Dom)
  const primeiro = new Date(todos[0]);
  const diaSemana = primeiro.getDay(); // 0=Dom
  const celulas = Array(diaSemana).fill(null).concat(todos); // padding no início

  // Agrupar em semanas de 7
  const semanas = [];
  for (let i = 0; i < celulas.length; i += 7) {
    semanas.push(celulas.slice(i, i + 7));
  }

  // Labels dos meses (posição X da coluna onde muda o mês)
  const mesesLabels = [];
  let mesAtual = -1;
  semanas.forEach((sem, si) => {
    const primDia = sem.find(d => d !== null);
    if (!primDia) return;
    const m = new Date(primDia).getMonth();
    if (m !== mesAtual) { mesesLabels.push({ si, label: MESES_PT[m] }); mesAtual = m; }
  });

  const CELL = 12;
  const GAP  = 2;
  const passo = CELL + GAP;

  return (
    <div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
        {totalJogos} jogo{totalJogos !== 1 ? 's' : ''} no último ano
      </p>

      <div style={{ overflowX: 'auto', paddingBottom: '0.25rem' }}>
        <svg
          width={semanas.length * passo + 30}
          height={7 * passo + 22}
          style={{ display: 'block' }}
        >
          {/* Labels dias da semana */}
          {[1, 3, 5].map(d => (
            <text key={d} x={2} y={22 + d * passo + CELL * 0.75}
              fontSize={9} fill="var(--text-muted)">{DIAS_PT[d]}</text>
          ))}

          {/* Labels meses */}
          {mesesLabels.map(({ si, label }) => (
            <text key={si + label} x={30 + si * passo} y={10}
              fontSize={9} fill="var(--text-muted)">{label}</text>
          ))}

          {/* Células */}
          {semanas.map((sem, si) =>
            sem.map((dia, di) => {
              if (!dia) return null;
              const jogos = mapa[dia] || 0;
              return (
                <rect
                  key={dia}
                  x={30 + si * passo}
                  y={22 + di * passo}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill={corCelula(jogos)}
                  style={{ cursor: jogos > 0 ? 'pointer' : 'default' }}
                  onMouseEnter={e => setTooltip({ dia, jogos, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })
          )}
        </svg>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: '0.4rem', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Menos</span>
        {COR.map((c, i) => (
          <div key={i} style={{ width: CELL, height: CELL, borderRadius: 2, background: c }} />
        ))}
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mais</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', top: tooltip.y - 40, left: tooltip.x - 60,
          background: 'var(--bg-elev-2)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '4px 8px', fontSize: '0.75rem',
          pointerEvents: 'none', zIndex: 9999, whiteSpace: 'nowrap',
        }}>
          <strong>{tooltip.jogos} jogo{tooltip.jogos !== 1 ? 's' : ''}</strong> em {new Date(tooltip.dia + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      )}
    </div>
  );
}
