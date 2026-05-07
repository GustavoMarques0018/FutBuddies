// ============================================================
//  FutBuddies - Votação por Mau Tempo
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useToast } from './Toast';

export default function VotacaoTempo({ jogo, isCriador, isInscrito, onAtualizar }) {
  const { addToast } = useToast();
  const [votacao, setVotacao] = useState(null);
  const [loading, setLoading] = useState(false);
  const [abrirLoading, setAbrirLoading] = useState(false);

  const podeVotar = isCriador || isInscrito;

  const carregarVotacao = () => {
    if (!podeVotar) return;
    api.get(`/jogos/${jogo.id}/votacao-tempo`)
      .then(res => setVotacao(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    if (jogo.votacao_tempo_aberta) {
      carregarVotacao();
    }
    // eslint-disable-next-line
  }, [jogo.id, jogo.votacao_tempo_aberta]);

  const handleAbrirVotacao = async () => {
    setAbrirLoading(true);
    try {
      await api.post(`/jogos/${jogo.id}/votacao-tempo/abrir`);
      addToast('Votação aberta! Todos os participantes já podem votar.', 'success');
      onAtualizar?.();
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro ao abrir votação.', 'error');
    } finally {
      setAbrirLoading(false);
    }
  };

  const handleVotar = async (voto) => {
    setLoading(true);
    try {
      const res = await api.post(`/jogos/${jogo.id}/votacao-tempo`, { voto });
      carregarVotacao();
      if (res.data.cancelado) {
        addToast('O jogo foi cancelado pela maioria dos votos.', 'warning');
        onAtualizar?.();
      } else {
        addToast('Voto registado!', 'success');
      }
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro ao votar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Only show if game is upcoming and not cancelled
  if (!jogo || ['cancelado', 'concluido'].includes(jogo.estado)) return null;
  if (!podeVotar) return null;

  // If votacao not open yet and user is criador, show button to open it
  if (!jogo.votacao_tempo_aberta) {
    if (!isCriador) return null;
    return (
      <div className="card" style={{ marginTop: '1rem', padding: '1rem', border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.5rem' }}>☔</span>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '0.9rem' }}>Mau tempo previsto?</strong>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Abre uma votação para decidir se o jogo se realiza.
            </p>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleAbrirVotacao}
            disabled={abrirLoading}
            style={{ whiteSpace: 'nowrap' }}
          >
            {abrirLoading ? '⏳' : '☔ Abrir Votação'}
          </button>
        </div>
      </div>
    );
  }

  // Votacao open
  const votos = votacao?.votos || { cancelar: 0, jogar: 0 };
  const meuVoto = votacao?.meuVoto || null;
  const totalVotos = votos.cancelar + votos.jogar;

  return (
    <div className="card" style={{ marginTop: '1rem', padding: '1rem', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.3rem' }}>☔</span>
        <strong style={{ fontSize: '0.95rem' }}>Votação: Jogar mesmo com mau tempo?</strong>
      </div>

      {/* Vote counts */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
        <span style={{ color: '#dc2626', fontWeight: 600 }}>
          ☔ Cancelar: {votos.cancelar}
        </span>
        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
          ⚽ Jogar: {votos.jogar}
        </span>
        {totalVotos > 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            ({totalVotos} voto{totalVotos !== 1 ? 's' : ''})
          </span>
        )}
      </div>

      {/* User's vote */}
      {meuVoto && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          O teu voto: <strong>{meuVoto === 'cancelar' ? '☔ Cancelar' : '⚽ Jogar'}</strong>
        </p>
      )}

      {/* Vote buttons */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          className="btn btn-sm"
          onClick={() => handleVotar('cancelar')}
          disabled={loading}
          style={{
            borderColor: 'var(--danger, #dc2626)',
            color: meuVoto === 'cancelar' ? '#fff' : 'var(--danger, #dc2626)',
            background: meuVoto === 'cancelar' ? 'var(--danger, #dc2626)' : 'transparent',
          }}
        >
          {loading ? '⏳' : '☔ Cancelar'}
        </button>
        <button
          className="btn btn-sm"
          onClick={() => handleVotar('jogar')}
          disabled={loading}
          style={{
            borderColor: 'var(--primary)',
            color: meuVoto === 'jogar' ? '#fff' : 'var(--primary)',
            background: meuVoto === 'jogar' ? 'var(--primary)' : 'transparent',
          }}
        >
          {loading ? '⏳' : '⚽ Jogar'}
        </button>
      </div>

      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
        O jogo cancela automaticamente se mais de 50% dos participantes votarem para cancelar.
      </p>
    </div>
  );
}
