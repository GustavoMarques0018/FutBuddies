// ============================================================
//  FutBuddies - Card visual de Nível e XP
// ============================================================

import React from 'react';
import { calcularXP, progressoNivel, tituloDoNivel } from '../utils/xp';
import './NivelCard.css';

export default function NivelCard({ utilizador, compacto = false }) {
  if (!utilizador) return null;
  const xp = calcularXP(utilizador);
  const { nivel, progresso, faltam, xpAtual, xpProx } = progressoNivel(xp);
  const titulo = tituloDoNivel(nivel);

  if (compacto) {
    return (
      <div className="nivel-card-compact" title={`Nível ${nivel} · ${titulo.nome}`}>
        <span className="nivel-card-emoji">{titulo.emoji}</span>
        <span className="nivel-card-num">Lvl {nivel}</span>
        <span className="nivel-card-xp-mini">{xp} XP</span>
      </div>
    );
  }

  return (
    <div className="nivel-card">
      <div className="nivel-card-header">
        <div className="nivel-card-titulo">
          <span className="nivel-card-emoji" style={{ filter: `drop-shadow(0 0 8px ${titulo.cor})` }}>
            {titulo.emoji}
          </span>
          <div>
            <div className="nivel-card-num-big" style={{ color: titulo.cor }}>Nível {nivel}</div>
            <div className="nivel-card-titulo-nome">{titulo.nome}</div>
          </div>
        </div>
        <div className="nivel-card-xp">
          <span className="nivel-card-xp-num">{xp.toLocaleString('pt-PT')}</span>
          <span className="nivel-card-xp-label">XP</span>
        </div>
      </div>

      <div className="nivel-card-bar">
        <div
          className="nivel-card-bar-fill"
          style={{ width: `${progresso}%`, background: titulo.cor }}
        />
      </div>
      <div className="nivel-card-bar-info">
        <span>{(xp - xpAtual).toLocaleString('pt-PT')} / {(xpProx - xpAtual).toLocaleString('pt-PT')} XP</span>
        <span>{faltam > 0 ? `Faltam ${faltam} XP para Nível ${nivel + 1}` : 'Nível máximo atingido!'}</span>
      </div>

      <div className="nivel-card-stats">
        <Stat icon="⚽" label="Jogos"      v={utilizador.total_jogos       || 0} />
        <Stat icon="🥅" label="Golos"      v={utilizador.total_golos       || 0} />
        <Stat icon="🅰️" label="Assists"    v={utilizador.total_assistencias|| 0} />
        <Stat icon="⭐" label="MVP"        v={utilizador.total_mvp         || 0} />
      </div>
    </div>
  );
}

function Stat({ icon, label, v }) {
  return (
    <div className="nivel-card-stat">
      <span className="nivel-card-stat-icon">{icon}</span>
      <span className="nivel-card-stat-num">{v}</span>
      <span className="nivel-card-stat-label">{label}</span>
    </div>
  );
}
