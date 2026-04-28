// ============================================================
//  FutBuddies - Votação MVP do jogo
//  Mostra candidatos, permite votar (uma vez, editável até 48h),
//  revela MVP após votação fechada.
// ============================================================

import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useToast } from './Toast';
import { resolverImgUrl } from '../utils/constantes';
import { IconCrown, IconUser } from './Icons';
import './MVPVoting.css';

export default function MVPVoting({ jogoId, utilizadorId, onClose }) {
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const carregar = async () => {
    try {
      const r = await api.get(`/jogos/${jogoId}/mvp`);
      setData(r.data);
    } catch {
      addToast('Erro a carregar votação.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [jogoId]);

  const votar = async (votadoId) => {
    setSubmitting(true);
    try {
      await api.post(`/jogos/${jogoId}/mvp`, { votadoId });
      addToast('Voto registado!', 'success');
      await carregar();
    } catch (e) {
      addToast(e.response?.data?.mensagem || 'Erro a votar.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="mvp-loading"><div className="spinner" /></div>;
  if (!data) return null;

  const { candidatos = [], meuVoto, votacaoFechada, mvp } = data;
  const podeVotar = !votacaoFechada;
  const filtrados = candidatos.filter(c => c.id !== utilizadorId);

  return (
    <div className="mvp-box">
      <div className="mvp-header">
        <h3><IconCrown size="1.1rem" color="#f5b301" /> MVP do Jogo</h3>
        {onClose && <button className="mvp-close" onClick={onClose} aria-label="Fechar">×</button>}
      </div>

      {votacaoFechada && mvp ? (
        <div className="mvp-resultado">
          <div className="mvp-resultado-avatar">
            {mvp.foto_url
              ? <img src={resolverImgUrl(mvp.foto_url)} alt={mvp.nome} />
              : <div className="mvp-avatar-fallback"><IconUser size="2rem" /></div>}
            <div className="mvp-crown">👑</div>
          </div>
          <h4>{mvp.nome}</h4>
          {mvp.nickname && <p className="mvp-nick">"{mvp.nickname}"</p>}
          <p className="mvp-votos">{mvp.votos} {mvp.votos === 1 ? 'voto' : 'votos'}</p>
        </div>
      ) : votacaoFechada ? (
        <p className="mvp-msg">Votação encerrada — sem votos registados.</p>
      ) : (
        <>
          <p className="mvp-info">
            {meuVoto
              ? 'Já votaste. Podes mudar o teu voto até 48h após o jogo.'
              : 'Escolhe o melhor jogador do jogo (voto anónimo, resultado público após 48h).'}
          </p>
          <div className="mvp-grid">
            {filtrados.length === 0 && <p className="mvp-msg">Sem candidatos.</p>}
            {filtrados.map(c => (
              <button
                key={c.id}
                className={`mvp-candidato ${meuVoto === c.id ? 'selecionado' : ''}`}
                onClick={() => podeVotar && votar(c.id)}
                disabled={submitting}
              >
                {c.foto_url
                  ? <img src={resolverImgUrl(c.foto_url)} alt={c.nome} />
                  : <div className="mvp-avatar-fallback"><IconUser size="1.5rem" /></div>}
                <span className="mvp-nome">{c.nome}</span>
                {c.nickname && <span className="mvp-nick-small">"{c.nickname}"</span>}
                {meuVoto === c.id && <span className="mvp-check">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
