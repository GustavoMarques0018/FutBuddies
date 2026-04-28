// ============================================================
//  FutBuddies - EmptyState
//  Estado vazio com ícone, título, descrição e CTA opcional.
// ============================================================

import React from 'react';
import './EmptyState.css';

export default function EmptyState({ icon, titulo, descricao, acao, children }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      {titulo && <h3 className="empty-state-title">{titulo}</h3>}
      {descricao && <p className="empty-state-desc">{descricao}</p>}
      {acao && <div className="empty-state-actions">{acao}</div>}
      {children}
    </div>
  );
}
