// ============================================================
//  FutBuddies - Modal de Avaliação entre Jogadores (⭐ 1–5)
//  Aparece após jogo concluído no JogoDetalhe.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import Avatar from './Avatar';
import './AvaliarJogadores.css';

function Estrelas({ valor = 0, onChange, readonly = false }) {
  const [hover, setHover] = useState(0);
  const exibir = hover || valor;
  return (
    <div className="aval-estrelas" aria-label={`${valor} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`aval-estrela ${n <= exibir ? 'ativa' : ''} ${readonly ? 'readonly' : ''}`}
          onClick={() => !readonly && onChange(n)}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(0)}
          disabled={readonly}
          aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
        >
          ⭐
        </button>
      ))}
    </div>
  );
}

function CartaoJogador({ jogador, avaliacao, onChange, jaAvaliado }) {
  const { nota = 0, comentario = '' } = avaliacao || {};
  const nome = jogador.nickname || jogador.nome;

  return (
    <div className={`aval-card ${jaAvaliado ? 'ja-avaliado' : ''} ${nota > 0 ? 'com-nota' : ''}`}>
      <div className="aval-card-header">
        <Avatar
          nome={jogador.nome}
          fotoUrl={jogador.foto_url}
          size={42}
          perfilPublico
        />
        <div className="aval-card-info">
          <strong>{nome}</strong>
          {jogador.posicao && <span className="aval-posicao">{jogador.posicao}</span>}
        </div>
        {jaAvaliado && <span className="aval-ja-badge">✔ Avaliado</span>}
      </div>

      <Estrelas valor={nota} onChange={(n) => onChange(jogador.id, 'nota', n)} readonly={jaAvaliado} />

      {!jaAvaliado && nota > 0 && (
        <textarea
          className="aval-comentario"
          placeholder="Comentário opcional (ex: ótimo companheiro de equipa)…"
          value={comentario}
          onChange={e => onChange(jogador.id, 'comentario', e.target.value)}
          rows={2}
          maxLength={300}
        />
      )}

      {jaAvaliado && jogador.media_nota && (
        <p className="aval-media-info">
          Média neste jogo: <strong>{Number(jogador.media_nota).toFixed(1)} ⭐</strong>
          {' '}({jogador.total_avaliacoes} avaliação{jogador.total_avaliacoes !== 1 ? 'ões' : ''})
        </p>
      )}
    </div>
  );
}

export default function AvaliarJogadores({ jogoId, onFechar }) {
  const [jogadores, setJogadores]       = useState([]);
  const [jaAvaliados, setJaAvaliados]   = useState([]);
  const [avaliacoes, setAvaliacoes]     = useState({});  // { [jogadorId]: { nota, comentario } }
  const [loading, setLoading]           = useState(true);
  const [enviando, setEnviando]         = useState(false);
  const [concluido, setConcluido]       = useState(false);
  const [erro, setErro]                 = useState('');

  const carregar = useCallback(async () => {
    try {
      const r = await api.get(`/jogos/${jogoId}/avaliar-jogadores`);
      setJogadores(r.data.jogadores || []);
      setJaAvaliados(r.data.jaAvaliados || []);
    } catch (e) {
      setErro(e.response?.data?.mensagem || 'Erro ao carregar jogadores.');
    } finally {
      setLoading(false);
    }
  }, [jogoId]);

  useEffect(() => { carregar(); }, [carregar]);

  // Fechar com Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onFechar]);

  const handleChange = (jogadorId, campo, valor) => {
    setAvaliacoes(prev => ({
      ...prev,
      [jogadorId]: { ...(prev[jogadorId] || {}), [campo]: valor },
    }));
  };

  const handleEnviar = async () => {
    const payload = Object.entries(avaliacoes)
      .filter(([id]) => !jaAvaliados.includes(parseInt(id)))
      .map(([avaliado_id, { nota, comentario }]) => ({
        avaliado_id: parseInt(avaliado_id),
        nota,
        comentario: comentario || null,
      }))
      .filter(a => a.nota > 0);

    if (payload.length === 0) {
      setErro('Atribui pelo menos uma estrela a algum jogador.');
      return;
    }

    setEnviando(true);
    setErro('');
    try {
      await api.post(`/jogos/${jogoId}/avaliar-jogadores`, { avaliacoes: payload });
      setConcluido(true);
    } catch (e) {
      setErro(e.response?.data?.mensagem || 'Erro ao enviar avaliações.');
    } finally {
      setEnviando(false);
    }
  };

  const porAvaliar = jogadores.filter(j => !jaAvaliados.includes(j.id));
  const totalComNota = Object.values(avaliacoes).filter(a => !jaAvaliados.includes(parseInt(Object.keys(avaliacoes)[0])) && a.nota > 0).length;

  return (
    <div className="aval-backdrop" onClick={onFechar} role="dialog" aria-modal="true" aria-label="Avaliar jogadores">
      <div className="aval-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="aval-modal-header">
          <div>
            <h2>⭐ Avaliar Jogadores</h2>
            <p className="aval-modal-sub">Classifica os teus companheiros de jogo (1–5 estrelas)</p>
          </div>
          <button type="button" className="aval-fechar" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>

        {/* Corpo */}
        <div className="aval-modal-body">
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <div className="spinner" />
            </div>
          )}

          {!loading && concluido && (
            <div className="aval-sucesso">
              <div style={{ fontSize: '3rem' }}>🎉</div>
              <h3>Avaliações enviadas!</h3>
              <p>Obrigado pelo teu feedback. Ajuda a comunidade a reconhecer os melhores jogadores.</p>
              <button type="button" className="btn btn-primary" onClick={onFechar}>Fechar</button>
            </div>
          )}

          {!loading && !concluido && (
            <>
              {erro && <div className="aval-erro">{erro}</div>}

              {jogadores.length === 0 && (
                <div className="aval-vazio">
                  <p>Não há outros jogadores para avaliar neste jogo.</p>
                </div>
              )}

              {jogadores.length > 0 && (
                <div className="aval-lista">
                  {porAvaliar.length > 0 && (
                    <>
                      <p className="aval-secao-label">Por avaliar</p>
                      {porAvaliar.map(j => (
                        <CartaoJogador
                          key={j.id}
                          jogador={j}
                          avaliacao={avaliacoes[j.id]}
                          onChange={handleChange}
                          jaAvaliado={false}
                        />
                      ))}
                    </>
                  )}

                  {jaAvaliados.length > 0 && (
                    <>
                      <p className="aval-secao-label" style={{ marginTop: '1rem' }}>Já avaliados</p>
                      {jogadores.filter(j => jaAvaliados.includes(j.id)).map(j => (
                        <CartaoJogador
                          key={j.id}
                          jogador={j}
                          avaliacao={null}
                          onChange={() => {}}
                          jaAvaliado
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && !concluido && porAvaliar.length > 0 && (
          <div className="aval-modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleEnviar}
              disabled={enviando}
            >
              {enviando ? 'A enviar…' : `Enviar Avaliações`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
