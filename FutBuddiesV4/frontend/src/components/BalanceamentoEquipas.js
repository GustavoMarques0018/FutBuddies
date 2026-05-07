// ============================================================
//  FutBuddies - Balanceamento Automático de Equipas
// ============================================================
import React, { useState } from 'react';
import api from '../utils/api';
import Avatar from './Avatar';
import { useToast } from './Toast';
import './BalanceamentoEquipas.css';

export default function BalanceamentoEquipas({ jogoId, onAceitar }) {
  const [resultado, setResultado]   = useState(null);
  const [loading, setLoading]       = useState(false);
  const [aceitando, setAceitando]   = useState(false);
  const { addToast } = useToast();

  const sugerir = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/jogos/${jogoId}/balancear`);
      setResultado(r.data);
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro ao balancear.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const aceitar = async () => {
    if (!resultado) return;
    setAceitando(true);
    try {
      await api.post(`/jogos/${jogoId}/balancear/aceitar`, {
        equipaA: resultado.equipaA,
        equipaB: resultado.equipaB,
      });
      addToast('Equipas guardadas!', 'success');
      onAceitar?.();
      setResultado(null);
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro ao guardar.', 'error');
    } finally {
      setAceitando(false);
    }
  };

  const balance = resultado
    ? Math.min(100, Math.round(100 - Math.abs(resultado.ratingA - resultado.ratingB)))
    : 0;
  const balanceCor = balance >= 80 ? 'var(--success)' : balance >= 60 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="balanceamento-wrap">
      {!resultado ? (
        <button className="btn btn-ghost btn-sm" onClick={sugerir} disabled={loading}>
          {loading ? '⏳ A calcular...' : '⚖️ Balanceamento Automático'}
        </button>
      ) : (
        <div className="balanceamento-modal">
          <div className="balanceamento-header">
            <h4>⚖️ Sugestão de Equipas</h4>
            <div className="balanceamento-score">
              <span style={{ color: balanceCor, fontWeight: 700 }}>{balance}%</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>equilibrado</span>
            </div>
          </div>

          <div className="balanceamento-equipas">
            {[
              { label: 'Equipa A', jogadores: resultado.equipaA, rating: resultado.ratingA, cor: 'var(--primary)' },
              { label: 'Equipa B', jogadores: resultado.equipaB, rating: resultado.ratingB, cor: 'var(--info)' },
            ].map(eq => (
              <div key={eq.label} className="balanceamento-equipa">
                <div className="balanceamento-equipa-titulo" style={{ color: eq.cor }}>
                  {eq.label}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                    Rating: {eq.rating}
                  </span>
                </div>
                {eq.jogadores.map(p => (
                  <div key={p.id} className="balanceamento-jogador">
                    <Avatar nome={p.nome} fotoUrl={p.foto_url} size="xs" />
                    <span>{p.nickname || p.nome}</span>
                    {p.posicao_jogo && <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>{p.posicao_jogo}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={sugerir} disabled={loading}>🔀 Voltar a Calcular</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setResultado(null)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={aceitar} disabled={aceitando}>
              {aceitando ? '⏳' : '✓ Aceitar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
