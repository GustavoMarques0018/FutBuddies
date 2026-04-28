// ============================================================
//  FutBuddies - Histórico no perfil
//  Últimos jogos + barras mensais de golos/assistências + totais.
// ============================================================

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { IconBall, IconTrophy, IconCalendar, IconCrown } from './Icons';
import './HistoricoPerfil.css';

function formatarMes(ym) {
  // ym = "2026-04"
  const [y, m] = ym.split('-');
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${nomes[parseInt(m)-1]} ${y.slice(2)}`;
}

export default function HistoricoPerfil() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/utilizadores/me/historico')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:'2rem' }}><div className="spinner" /></div>;
  if (!data) return null;

  const { ultimos = [], porMes = [], totais = {} } = data;
  const maxGolos = Math.max(1, ...porMes.map(m => (m.golos || 0) + (m.assistencias || 0)));

  if (ultimos.length === 0) {
    return (
      <div className="historico-vazio">
        <p>Ainda não jogaste nenhum jogo concluído.</p>
        <Link to="/jogos" className="btn btn-primary">Explorar jogos</Link>
      </div>
    );
  }

  return (
    <div className="historico-wrap">
      {/* Totais destaque */}
      <div className="historico-kpis">
        <div className="historico-kpi"><IconBall size="1.3rem" color="var(--primary)" />
          <div><strong>{totais.total_golos ?? 0}</strong><span>Golos</span></div>
        </div>
        <div className="historico-kpi"><IconTrophy size="1.3rem" color="var(--primary)" />
          <div><strong>{totais.total_assistencias ?? 0}</strong><span>Assistências</span></div>
        </div>
        <div className="historico-kpi"><IconCrown size="1.3rem" color="#f5b301" />
          <div><strong>{totais.total_mvp ?? 0}</strong><span>MVP</span></div>
        </div>
        <div className="historico-kpi"><IconCalendar size="1.3rem" color="var(--text-secondary)" />
          <div><strong>{ultimos.length}</strong><span>Jogos recentes</span></div>
        </div>
      </div>

      {/* Gráfico por mês */}
      {porMes.length > 0 && (
        <div className="historico-chart">
          <h4>Últimos 6 meses</h4>
          <div className="historico-bars">
            {porMes.map(m => {
              const total = (m.golos || 0) + (m.assistencias || 0);
              const heightG = ((m.golos || 0) / maxGolos) * 100;
              const heightA = ((m.assistencias || 0) / maxGolos) * 100;
              return (
                <div key={m.mes} className="historico-bar-col" title={`${m.jogos} jogos · ${m.golos} golos · ${m.assistencias} assist.`}>
                  <div className="historico-bar-stack">
                    <div className="historico-bar-a" style={{ height: `${heightA}%` }} />
                    <div className="historico-bar-g" style={{ height: `${heightG}%` }} />
                  </div>
                  <span className="historico-bar-total">{total}</span>
                  <span className="historico-bar-label">{formatarMes(m.mes)}</span>
                </div>
              );
            })}
          </div>
          <div className="historico-legenda">
            <span><span className="dot g" /> Golos</span>
            <span><span className="dot a" /> Assistências</span>
          </div>
        </div>
      )}

      {/* Lista últimos jogos */}
      <div className="historico-lista">
        <h4>Últimos jogos</h4>
        {ultimos.slice(0, 10).map(j => {
          const venceu = j.equipa_vencedora
            ? (j.equipa_vencedora === 'A' ? 'V' : 'V') /* saber a minha equipa exige mais info */
            : null;
          return (
            <Link to={`/jogos/${j.id}`} key={j.id} className="historico-item">
              <div className="historico-item-data">
                <strong>{new Date(j.data_jogo).toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit' })}</strong>
                <span>{new Date(j.data_jogo).getFullYear()}</span>
              </div>
              <div className="historico-item-corpo">
                <h5>{j.titulo}</h5>
                <p>{j.regiao || j.local || '—'}</p>
              </div>
              <div className="historico-item-stats">
                <span className="h-stat g"><IconBall size="0.85em" /> {j.golos ?? 0}</span>
                <span className="h-stat a"><IconTrophy size="0.85em" /> {j.assistencias ?? 0}</span>
                {j.golos_equipa_a != null && (
                  <span className="h-placar">{j.golos_equipa_a}-{j.golos_equipa_b}</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
