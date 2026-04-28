import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import Skeleton from './Skeleton';
import './DonoDashboard.css';

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function cents(v) { return ((v || 0) / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }); }

export default function DonoDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dono/dashboard')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const maxHeat = useMemo(() => {
    if (!data?.heatmap) return 0;
    let m = 0;
    for (const row of data.heatmap) for (const v of row) if (v > m) m = v;
    return m;
  }, [data]);

  if (loading) {
    return (
      <div className="dono-dash-loading">
        <Skeleton height={100} />
        <Skeleton height={300} />
      </div>
    );
  }

  if (!data?.sucesso) {
    return <p className="muted">Não foi possível carregar o dashboard.</p>;
  }

  const k = data.kpis;

  return (
    <div className="dono-dash">
      <div className="dono-dash-kpis">
        <KPI label="Jogos (90d)" value={k.total_jogos} icone="⚽" />
        <KPI label="Receita bruta" value={cents(k.receita_bruta_cents)} icone="💶" />
        <KPI label="Receita líquida" value={cents(k.receita_liquida_cents)} icone="💰" accent />
        <KPI label="Ocupação média" value={`${k.ocupacao_media_pct}%`} icone="📊" />
        <KPI label="Avaliação" value={k.avaliacao_media ? `${k.avaliacao_media}/5 ⭐` : '—'} icone="⭐" />
        <KPI label="No-shows" value={k.no_shows} icone="🚫" warn={k.no_shows > 0} />
      </div>

      <div className="dono-dash-card">
        <h3>Ocupação por dia × hora</h3>
        <p className="muted">Número de jogos nos últimos 90 dias.</p>
        <div className="dono-heatmap">
          <div className="dono-heatmap-hours">
            <div className="dono-heatmap-corner" />
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="dono-heatmap-hour-label">{h}</div>
            ))}
          </div>
          {DIAS.map((dia, d) => (
            <div key={dia} className="dono-heatmap-row">
              <div className="dono-heatmap-day-label">{dia}</div>
              {Array.from({ length: 24 }).map((_, h) => {
                const v = data.heatmap[d]?.[h] || 0;
                const intensity = maxHeat > 0 ? v / maxHeat : 0;
                return (
                  <div
                    key={h}
                    className="dono-heatmap-cell"
                    style={{
                      background: v === 0
                        ? 'var(--bg-elev-1)'
                        : `rgba(57, 255, 20, ${0.15 + intensity * 0.7})`,
                    }}
                    title={`${dia} ${h}h — ${v} jogo(s)`}
                  >
                    {v > 0 ? v : ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="dono-heatmap-legend">
          <span className="muted">Menos</span>
          <div className="dono-heatmap-legend-bar" />
          <span className="muted">Mais</span>
        </div>
      </div>

      {data.top_horarios?.length > 0 && (
        <div className="dono-dash-card">
          <h3>Horários mais procurados</h3>
          <ol className="dono-top-list">
            {data.top_horarios.map((t, i) => (
              <li key={i}>
                <span className="dono-top-rank">#{i + 1}</span>
                <span>{DIAS[t.dow]} às {String(t.hora).padStart(2, '0')}:00</span>
                <span className="dono-top-count">{t.jogos} jogo(s)</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {data.receita_mensal?.length > 0 && (
        <div className="dono-dash-card">
          <h3>Receita líquida mensal</h3>
          <div className="dono-mensal">
            {data.receita_mensal.map(m => {
              const max = Math.max(...data.receita_mensal.map(x => x.liquida));
              const pct = max > 0 ? (m.liquida / max) * 100 : 0;
              return (
                <div key={m.ym} className="dono-mensal-bar">
                  <div className="dono-mensal-fill" style={{ height: `${pct}%` }} />
                  <div className="dono-mensal-label">{m.ym.slice(5)}/{m.ym.slice(2,4)}</div>
                  <div className="dono-mensal-valor">{cents(m.liquida)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, icone, accent, warn }) {
  return (
    <div className={`dono-kpi ${accent ? 'accent' : ''} ${warn ? 'warn' : ''}`}>
      <div className="dono-kpi-icone">{icone}</div>
      <div className="dono-kpi-info">
        <div className="dono-kpi-label">{label}</div>
        <div className="dono-kpi-value">{value}</div>
      </div>
    </div>
  );
}
