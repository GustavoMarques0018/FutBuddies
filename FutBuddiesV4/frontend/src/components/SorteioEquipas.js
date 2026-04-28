// ============================================================
//  FutBuddies - Sorteio Balanceado de Equipas (modal)
// ============================================================

import React, { useState } from 'react';
import api from '../utils/api';
import { useToast } from './Toast';
import { resolverImgUrl } from '../utils/constantes';
import { IconShield, IconUser } from './Icons';
import './SorteioEquipas.css';

export default function SorteioEquipas({ jogoId, onClose }) {
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const sortear = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/jogos/${jogoId}/sortear`);
      setData(r.data);
    } catch (e) {
      addToast(e.response?.data?.mensagem || 'Erro a sortear.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Primeiro sorteio automático
  React.useEffect(() => { sortear(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="sorteio-backdrop" onClick={onClose}>
      <div className="sorteio-modal" onClick={e => e.stopPropagation()}>
        <button className="sorteio-close" onClick={onClose} aria-label="Fechar">×</button>
        <h2>🎲 Sorteio Balanceado</h2>
        <p className="sorteio-sub">Equipas distribuídas com base no histórico de golos, assistências e MVPs.</p>

        {loading && !data && <div className="sorteio-loading"><div className="spinner" /></div>}

        {data && (
          <>
            <div className="sorteio-equipas">
              <div className="sorteio-equipa a">
                <h3><IconShield size="1.1rem" color="var(--primary)" /> Equipa A</h3>
                <span className="sorteio-rating">Rating {data.ratingA}</span>
                <ul>
                  {data.equipaA.map(p => (
                    <li key={p.id}>
                      {p.foto_url
                        ? <img src={resolverImgUrl(p.foto_url)} alt={p.nome} />
                        : <span className="sorteio-avatar-fb"><IconUser size="1rem" /></span>}
                      <div>
                        <strong>{p.nickname || p.nome}</strong>
                        <small>{p.rating} pts</small>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="sorteio-vs">VS</div>
              <div className="sorteio-equipa b">
                <h3><IconShield size="1.1rem" color="var(--info)" /> Equipa B</h3>
                <span className="sorteio-rating">Rating {data.ratingB}</span>
                <ul>
                  {data.equipaB.map(p => (
                    <li key={p.id}>
                      {p.foto_url
                        ? <img src={resolverImgUrl(p.foto_url)} alt={p.nome} />
                        : <span className="sorteio-avatar-fb"><IconUser size="1rem" /></span>}
                      <div>
                        <strong>{p.nickname || p.nome}</strong>
                        <small>{p.rating} pts</small>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="sorteio-actions">
              <button className="btn btn-secondary" onClick={sortear} disabled={loading}>
                {loading ? 'A sortear…' : '🔄 Sortear novamente'}
              </button>
              <button className="btn btn-primary" onClick={onClose}>Fechar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
