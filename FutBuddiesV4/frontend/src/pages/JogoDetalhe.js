// ============================================================
//  FutBuddies - Detalhe do Jogo + Chat (WebSocket)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { REGIOES, NIVEIS, NIVEL_COR, resolverImgUrl } from '../utils/constantes';
import {
  IconCrown, IconPencil, IconMapPin, IconClock, IconUser, IconLock,
  IconStadium, IconBall, IconChat,
} from '../components/Icons';
import CodigoAcesso from '../components/CodigoAcesso';
import PagamentoJogo from '../components/PagamentoJogo';
import MVPVoting from '../components/MVPVoting';
import SorteioEquipas from '../components/SorteioEquipas';
import AvaliarJogadores from '../components/AvaliarJogadores';
import Chat from '../components/Chat';
import DatePickerFB from '../components/DatePickerFB';
import Avatar from '../components/Avatar';
import './Jogos.css';

export default function JogoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { utilizador, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const [jogo, setJogo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mostrarSorteio, setMostrarSorteio] = useState(false);
  const [inscrito, setInscrito] = useState(false);
  const [emEspera, setEmEspera] = useState(false);
  const [inscricaoLoading, setInscricaoLoading] = useState(false);
  const [equipaEscolhida, setEquipaEscolhida] = useState(null); // null = auto
  const [codigoAcesso, setCodigoAcesso] = useState('');
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [minhaEquipa, setMinhaEquipa] = useState(null);
  const [inscEquipaLoading, setInscEquipaLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [mostrarAvaliacao, setMostrarAvaliacao] = useState(false);
  const carregarJogo = () => {
    api.get(`/jogos/${id}`)
      .then(res => {
        setJogo(res.data.jogo);
        const estaInscrito = res.data.jogo.inscritos?.some(i => i.utilizador_id === utilizador?.id);
        setInscrito(estaInscrito);
        setEmEspera(!!res.data.jogo.minha_posicao_espera);
      })
      .catch(() => navigate('/jogos'))
      .finally(() => setLoading(false));
  };

  const carregarResultado = () => {
    api.get(`/jogos/${id}/resultado`)
      .then(res => setResultado(res.data.resultado))
      .catch(() => {});
  };

  useEffect(() => {
    carregarJogo();
    carregarResultado();
    if (isAuthenticated) {
      api.get('/utilizadores/me/equipa').then(res => setMinhaEquipa(res.data.equipa)).catch(() => {});
    }
  }, [id, isAuthenticated]);

  const handleInscrever = async () => {
    if (!isAuthenticated) return navigate('/login');
    setInscricaoLoading(true);
    try {
      const body = { ...(equipaEscolhida ? { equipa: equipaEscolhida } : {}), ...(codigoAcesso ? { codigoAcesso } : {}) };
      const res = await api.post(`/jogos/${id}/inscrever`, body);
      carregarJogo();
      setEquipaEscolhida(null);
      if (res.data.espera) {
        setEmEspera(true);
        addToast(res.data.mensagem || 'Lista de espera.', 'info', 5000);
      } else {
        setInscrito(true);
        addToast(`Inscrito na Equipa ${res.data.equipa}! ⚽`, 'success');
      }
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro ao inscrever.', 'error');
    } finally {
      setInscricaoLoading(false);
    }
  };

  const handleCancelar = async () => {
    setInscricaoLoading(true);
    try {
      await api.delete(`/jogos/${id}/inscrever`);
      carregarJogo();
      setInscrito(false);
      addToast('Inscrição cancelada.', 'info');
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro ao cancelar.', 'error');
    } finally {
      setInscricaoLoading(false);
    }
  };

  const handleAbrirEdicao = () => {
    setEditForm({
      titulo: jogo.titulo || '',
      descricao: jogo.descricao || '',
      dataJogo: jogo.data_jogo ? new Date(jogo.data_jogo).toISOString().slice(0, 16) : '',
      local: jogo.local || '',
      regiao: jogo.regiao || '',
      tipoJogo: jogo.tipo_jogo || '5x5',
      maxJogadores: jogo.max_jogadores || 10,
      nivel: jogo.nivel || 'Descontraído',
    });
    setEditando(true);
  };

  const handleGuardarEdicao = async (e) => {
    e.preventDefault();
    if (!editForm.titulo.trim()) return addToast('O título é obrigatório.', 'error');
    setEditLoading(true);
    try {
      await api.put(`/jogos/${id}`, editForm);
      addToast('Jogo atualizado com sucesso!', 'success');
      setEditando(false);
      carregarJogo();
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro ao atualizar jogo.', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  const handleInscreverEquipa = async () => {
    if (!minhaEquipa) return addToast('Nao tens equipa.', 'error');
    setInscEquipaLoading(true);
    try {
      const body = { equipaId: minhaEquipa.id, ...(codigoAcesso ? { codigoAcesso } : {}) };
      const res = await api.post(`/jogos/${id}/inscrever-equipa`, body);
      addToast(`Equipa inscrita no lado ${res.data.lado}!`, 'success');
      carregarJogo();
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro ao inscrever equipa.', 'error');
    } finally {
      setInscEquipaLoading(false);
    }
  };

  const handleCancelarEquipa = async () => {
    if (!minhaEquipa) return;
    setInscEquipaLoading(true);
    try {
      await api.delete(`/jogos/${id}/inscrever-equipa`, { data: { equipaId: minhaEquipa.id } });
      addToast('Inscricao da equipa cancelada.', 'info');
      carregarJogo();
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro.', 'error');
    } finally {
      setInscEquipaLoading(false);
    }
  };

  const getInitials = (nome) => nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
  const formatarHora = (data) => data ? new Date(data).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '';
  const formatarData = (data) => data ? new Date(data).toLocaleDateString('pt-PT', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : 'Data a definir';

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem' }}><div className="spinner" /></div>;
  if (!jogo) return null;

  const equipaA = jogo.inscritos?.filter(i => i.equipa === 'A') || [];
  const equipaB = jogo.inscritos?.filter(i => i.equipa === 'B') || [];
  const isCriador = utilizador?.id === jogo.criador_id;
  const pct = Math.min(100, ((jogo.total_inscritos || 0) / (jogo.max_jogadores || 10)) * 100);
  const maxPorEquipa = Math.floor((jogo.max_jogadores || 10) / 2);
  const vagasA = maxPorEquipa - equipaA.length;
  const vagasB = maxPorEquipa - equipaB.length;

  // Compute dynamic game state
  const now = Date.now();
  const gameTime = jogo.data_jogo ? new Date(jogo.data_jogo).getTime() : null;
  const aDecorrer = gameTime && now >= gameTime && now < gameTime + 60 * 60 * 1000;
  const encerrado = gameTime && now >= gameTime + 60 * 60 * 1000;

  const isTeamGame = jogo.modo_jogo === 'equipa';
  const equipasInscritas = jogo.equipas_inscritas || [];
  const minhaEquipaInscrita = isTeamGame && minhaEquipa && equipasInscritas.some(e => e.equipa_id === minhaEquipa.id);
  const isCapitaoEquipa = minhaEquipa && minhaEquipa.papel === 'capitao';

  const podeEscolherEquipa = !isTeamGame && !inscrito && isAuthenticated && !isCriador && jogo.estado === 'aberto' && !aDecorrer && !encerrado;

  return (
    <div className="jogo-detalhe">
      <div className="container">
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          <Link to="/jogos" style={{ color: 'var(--primary)' }}>← Voltar aos Jogos</Link>
        </p>

        {/* Header */}
        <div className="jogo-detalhe-header">
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span className="jogo-tipo">{jogo.tipo_jogo || '5x5'}</span>
              {encerrado ? (
                <span className="badge badge-gray">Encerrado</span>
              ) : aDecorrer ? (
                <span className="badge badge-amber">A decorrer</span>
              ) : (
                <span className={`badge ${jogo.estado === 'aberto' ? 'badge-green' : 'badge-gray'}`}>
                  {jogo.estado?.charAt(0).toUpperCase() + jogo.estado?.slice(1)}
                </span>
              )}
              {isCriador && <span className="badge badge-green"><IconCrown size="0.8em" /> Criador</span>}
              {isCriador && !encerrado && (
                <button className="btn btn-ghost btn-sm" onClick={handleAbrirEdicao} style={{ fontSize: '0.75rem' }}>
                  <IconPencil size="0.8em" /> Editar
                </button>
              )}
              {isCriador && encerrado && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => navigate(`/jogos/criar?fromId=${jogo.id}`)}
                  title="Criar um novo jogo igual, com os mesmos dados"
                >
                  🔁 Repetir Jogo
                </button>
              )}
              {isCriador && !encerrado && !isTeamGame && jogo.estado === 'aberto' && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => setMostrarSorteio(true)}
                  title="Sortear equipas balanceadas"
                >
                  🎲 Sortear Equipas
                </button>
              )}
            </div>
            <h1 className="jogo-detalhe-titulo">{jogo.titulo}</h1>
            <div className="jogo-detalhe-meta">
              {jogo.local ? (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(jogo.local + (jogo.regiao ? ', ' + jogo.regiao : '') + ', Portugal')}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', fontSize: '0.875rem' }}>
                  <IconMapPin size="0.85em" /> {jogo.local} ↗
                </a>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  <IconMapPin size="0.85em" /> {jogo.regiao || '—'}
                  {!jogo.regiao && null}
                </span>
              )}
              {/* Região em separado só quando já há morada específica */}
              {jogo.local && jogo.regiao && <span style={{ fontSize: '0.875rem' }}><IconMapPin size="0.85em" /> {jogo.regiao}</span>}
              <span><IconClock size="0.85em" /> {formatarData(jogo.data_jogo)}</span>
              <Link to={`/jogadores/${jogo.criador_id}`} style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                <IconUser size="0.85em" /> {jogo.criador_nome}
              </Link>
            </div>

            {/* Código de acesso para o criador (jogo privado) */}
            {isCriador && jogo.visibilidade === 'privado' && jogo.codigo_acesso && (
              <CodigoAcesso codigo={jogo.codigo_acesso} label="Código de Acesso" />
            )}

            {/* Pagamento (campo parceiro) */}
            {isAuthenticated && jogo.modelo_pagamento && (
              <div style={{ marginTop: '1rem' }}>
                <PagamentoJogo jogo={jogo} utilizador={utilizador} onAtualizar={carregarJogo} />
              </div>
            )}
          </div>

          {/* Botões de inscrição */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end' }}>
            {jogo.visibilidade === 'privado' && !inscrito && isAuthenticated && !isCriador && (
              <div style={{ marginBottom: '0.5rem' }}>
                <input type="text" placeholder="Código de acesso" value={codigoAcesso}
                  onChange={e => setCodigoAcesso(e.target.value.toUpperCase())}
                  maxLength={10} style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '3px', maxWidth: 200, textAlign: 'center' }} />
              </div>
            )}
            {podeEscolherEquipa && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                {/* Seletor de equipa */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className={`btn btn-sm ${equipaEscolhida === null ? 'btn-ghost' : ''}`}
                    onClick={() => setEquipaEscolhida(null)}
                    style={equipaEscolhida === null ? { border: '1.5px solid var(--primary)', color: 'var(--primary)', background: 'var(--primary-glow)' } : {}}
                    title="O sistema escolhe a equipa automaticamente"
                  >
                    Auto
                  </button>
                  <button
                    className={`btn btn-sm ${vagasA <= 0 ? 'btn-ghost' : ''}`}
                    onClick={() => vagasA > 0 && setEquipaEscolhida('A')}
                    disabled={vagasA <= 0}
                    style={equipaEscolhida === 'A' ? { border: '1.5px solid var(--primary)', color: 'var(--primary)', background: 'var(--primary-glow)' } : {}}
                  >
                    <IconBall size="0.85em" /> Equipa A {vagasA > 0 ? `(${vagasA} vagas)` : '(cheia)'}
                  </button>
                  <button
                    className={`btn btn-sm ${vagasB <= 0 ? 'btn-ghost' : ''}`}
                    onClick={() => vagasB > 0 && setEquipaEscolhida('B')}
                    disabled={vagasB <= 0}
                    style={equipaEscolhida === 'B' ? { border: '1.5px solid var(--info)', color: 'var(--info)', background: 'rgba(59,130,246,0.1)' } : {}}
                  >
                    <IconBall size="0.85em" /> Equipa B {vagasB > 0 ? `(${vagasB} vagas)` : '(cheia)'}
                  </button>
                </div>
                <button className="btn btn-primary" onClick={handleInscrever} disabled={inscricaoLoading}>
                  {inscricaoLoading ? 'A inscrever...' : equipaEscolhida ? `Inscrever na Equipa ${equipaEscolhida}` : '+ Inscrever-me (auto)'}
                </button>
              </div>
            )}
            {inscrito && !isCriador && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <CheckinButton jogo={jogo} onFeito={carregarJogo} />
                <button className="btn btn-danger" onClick={handleCancelar} disabled={inscricaoLoading}>
                  {inscricaoLoading ? 'A cancelar...' : '✗ Cancelar Inscrição'}
                </button>
              </div>
            )}
            {emEspera && !inscrito && !isCriador && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end' }}>
                <span className="badge badge-amber" style={{ fontSize: '0.75rem' }}>
                  ⏳ Em lista de espera · posição {jogo.minha_posicao_espera}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={handleCancelar} disabled={inscricaoLoading}>
                  {inscricaoLoading ? 'A cancelar...' : 'Sair da lista de espera'}
                </button>
              </div>
            )}
            {!isAuthenticated && (
              <Link to="/login" className="btn btn-primary">Entra para te inscrever</Link>
            )}
            {isCriador && jogo.estado === 'aberto' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Criador do jogo</span>
            )}
            {/* Team game inscription */}
            {isTeamGame && isAuthenticated && !isCriador && jogo.estado === 'aberto' && !aDecorrer && !encerrado && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                {!minhaEquipa ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Precisas de ter equipa para te inscrever.</p>
                ) : !isCapitaoEquipa ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>So o capitao pode inscrever a equipa.</p>
                ) : minhaEquipaInscrita ? (
                  <button className="btn btn-danger btn-sm" onClick={handleCancelarEquipa} disabled={inscEquipaLoading}>
                    {inscEquipaLoading ? 'A cancelar...' : 'Cancelar Inscricao da Equipa'}
                  </button>
                ) : equipasInscritas.length >= 2 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Jogo ja tem 2 equipas.</p>
                ) : (
                  <button className="btn btn-primary" onClick={handleInscreverEquipa} disabled={inscEquipaLoading}>
                    {inscEquipaLoading ? 'A inscrever...' : `Inscrever ${minhaEquipa.nome}`}
                  </button>
                )}
              </div>
            )}
            {isTeamGame && (
              <span className="badge badge-amber" style={{ fontSize: '0.75rem' }}><IconStadium size="0.8em" /> Jogo de Equipa</span>
            )}
          </div>
        </div>

        {/* ── Placard pós-jogo (Fase C) ── */}
        {encerrado && (
          <div className="card jogo-placard-card" style={{ marginBottom: '1.5rem' }}>
            {resultado ? (
              <>
                <div className="jogo-placard-row">
                  <div className="jogo-placard-lado">
                    <div className="jogo-placard-label">Equipa A</div>
                    <div className={`jogo-placard-golos ${resultado.golos_equipa_a > resultado.golos_equipa_b ? 'vencedor' : ''}`}>
                      {resultado.golos_equipa_a}
                    </div>
                  </div>
                  <div className="jogo-placard-vs">×</div>
                  <div className="jogo-placard-lado">
                    <div className="jogo-placard-label">Equipa B</div>
                    <div className={`jogo-placard-golos ${resultado.golos_equipa_b > resultado.golos_equipa_a ? 'vencedor' : ''}`}>
                      {resultado.golos_equipa_b}
                    </div>
                  </div>
                </div>
                <div className="jogo-placard-footer">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Reportado por <strong>{resultado.reportado_por_nome}</strong>
                  </span>
                  {isAuthenticated && (
                    <Link to={`/jogos/${id}/reportar`} className="btn btn-ghost btn-sm">
                      📝 Ver / editar stats
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <div className="jogo-placard-vazio">
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  ⏱️ Jogo encerrado. O resultado ainda não foi registado.
                </p>
                {isAuthenticated && (
                  <Link to={`/jogos/${id}/reportar`} className="btn btn-primary btn-sm">
                    📋 Reportar resultado
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* MVP Voting + Avaliações — visível após o jogo encerrar, a participantes */}
        {encerrado && isAuthenticated && (inscrito || isCriador || (isTeamGame && minhaEquipaInscrita)) && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <MVPVoting jogoId={id} utilizadorId={utilizador?.id} />
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setMostrarAvaliacao(true)}
              style={{ alignSelf: 'flex-start', gap: '0.4rem', display: 'inline-flex', alignItems: 'center' }}
            >
              ⭐ Avaliar Jogadores
            </button>
          </div>
        )}

        {mostrarSorteio && (
          <SorteioEquipas jogoId={id} onClose={() => setMostrarSorteio(false)} />
        )}

        {mostrarAvaliacao && (
          <AvaliarJogadores jogoId={id} onFechar={() => setMostrarAvaliacao(false)} />
        )}

        {/* Progresso */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600 }}>Jogadores inscritos</span>
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{jogo.total_inscritos || 0} / {jogo.max_jogadores || 10}</span>
          </div>
          <div className="progress-bar" style={{ height: 8 }}>
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          {jogo.vagas_disponiveis > 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '0.5rem', fontWeight: 600 }}>
              {jogo.vagas_disponiveis} vaga{jogo.vagas_disponiveis !== 1 ? 's' : ''} disponível
            </p>
          )}
        </div>

        {/* Grid principal */}
        <div className="jogo-detalhe-grid">
          <div>
            {jogo.descricao && (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <p className="jogo-section-title">Descrição</p>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{jogo.descricao}</p>
              </div>
            )}
            {isTeamGame ? (
              /* Team game: show teams */
              <div className="card">
                <p className="jogo-section-title"><IconStadium size="1em" /> Equipas</p>
                {/* VS display */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '2rem 1rem' }}>
                  {/* Team A (first) */}
                  {(() => {
                    const eqA = equipasInscritas.find(e => e.lado === 'A');
                    return eqA ? (
                      <Link to={`/equipas/${eqA.equipa_id}`} style={{ textDecoration: 'none', color: 'inherit', textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                          {eqA.emblema && (eqA.emblema.startsWith('http') || eqA.emblema.startsWith('/uploads'))
                            ? <img src={resolverImgUrl(eqA.emblema)} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />
                            : <span>{eqA.emblema || '⚽'}</span>}
                        </div>
                        <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)' }}>{eqA.nome}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{eqA.total_membros} membros</p>
                      </Link>
                    ) : (
                      <div style={{ textAlign: 'center', flex: 1, opacity: 0.4 }}>
                        <p style={{ fontSize: '3rem' }}>⚽</p>
                        <p style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.9rem' }}>A aguardar...</p>
                      </div>
                    );
                  })()}

                  {/* VS */}
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-muted)', flexShrink: 0, letterSpacing: '2px' }}>VS</div>

                  {/* Team B (second) */}
                  {(() => {
                    const eqB = equipasInscritas.find(e => e.lado === 'B');
                    return eqB ? (
                      <Link to={`/equipas/${eqB.equipa_id}`} style={{ textDecoration: 'none', color: 'inherit', textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                          {eqB.emblema && (eqB.emblema.startsWith('http') || eqB.emblema.startsWith('/uploads'))
                            ? <img src={resolverImgUrl(eqB.emblema)} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />
                            : <span>{eqB.emblema || '⚽'}</span>}
                        </div>
                        <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--info)' }}>{eqB.nome}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{eqB.total_membros} membros</p>
                      </Link>
                    ) : (
                      <div style={{ textAlign: 'center', flex: 1, opacity: 0.4 }}>
                        <p style={{ fontSize: '3rem' }}>❓</p>
                        <p style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.9rem' }}>A aguardar equipa...</p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              /* Individual game: show players */
              <div className="card">
                <p className="jogo-section-title">Equipas</p>
                <div className="equipas-grid">
                  {[{ nome: 'A', cor: 'var(--primary)', jogadores: equipaA }, { nome: 'B', cor: 'var(--info)', jogadores: equipaB }].map(eq => (
                    <div key={eq.nome} className="equipa-box" style={{ borderColor: equipaEscolhida === eq.nome ? eq.cor : undefined }}>
                      <div className="equipa-header">
                        <span className="equipa-nome" style={{ color: eq.cor }}><IconBall size="0.9em" /> Equipa {eq.nome}</span>
                        <span className="equipa-count">{eq.jogadores.length}/{maxPorEquipa}</span>
                      </div>
                      {eq.jogadores.length === 0 ? (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Sem jogadores</p>
                      ) : eq.jogadores.map(j => (
                        <Link key={j.id} to={`/jogadores/${j.utilizador_id}`} className="equipa-jogador" style={{ textDecoration: 'none', color: 'inherit' }}>
                          <Avatar nome={j.nome} fotoUrl={j.foto_url} perfilPublico={j.perfil_publico} size={28} />
                          <div>
                            <p className="equipa-jogador-nome">{j.nickname || j.nome}</p>
                            {j.posicao && <p className="equipa-jogador-posicao">{j.posicao}</p>}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chat */}
          {isAuthenticated ? (
            <Chat
              jogoId={parseInt(id)}
              utilizadorId={utilizador?.id}
              podeEnviar={inscrito || isCriador || (jogo.modo_jogo === 'equipa' && minhaEquipaInscrita)}
              participantes={[
                ...(jogo.inscritos || []).map(i => ({ id: i.utilizador_id, nome: i.nome, nickname: i.nickname, foto_url: i.foto_url })),
                { id: jogo.criador_id, nome: jogo.criador_nome, nickname: null, foto_url: null },
              ].filter((p, idx, arr) => arr.findIndex(x => x.id === p.id) === idx)}
            />
          ) : (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <p><IconChat size="1em" /> Faz <Link to="/login" style={{ color: 'var(--primary)' }}>login</Link> para ver o chat do jogo</p>
            </div>
          )}
        </div>

        {/* Modal de Edição */}
        {editando && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
            onClick={(e) => e.target === e.currentTarget && setEditando(false)}>
            <div className="card" style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.15rem', margin: 0 }}><IconPencil size="1em" /> Editar Jogo</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditando(false)}>✕</button>
              </div>
              <form onSubmit={handleGuardarEdicao} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div className="form-field">
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Título *</label>
                  <input type="text" value={editForm.titulo} onChange={e => setEditForm({ ...editForm, titulo: e.target.value })} required />
                </div>
                <div className="form-field">
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Descrição</label>
                  <textarea value={editForm.descricao} onChange={e => setEditForm({ ...editForm, descricao: e.target.value })} rows={3} style={{ resize: 'vertical' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-field">
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Data e Hora</label>
                    <DatePickerFB mode="datetime" value={editForm.dataJogo} onChange={(v) => setEditForm({ ...editForm, dataJogo: v })} placeholder="Data e hora" />
                  </div>
                  <div className="form-field">
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Região</label>
                    <select value={editForm.regiao} onChange={e => setEditForm({ ...editForm, regiao: e.target.value })}>
                      <option value="">Seleciona</option>
                      {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-field">
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Local</label>
                  <input type="text" value={editForm.local} onChange={e => setEditForm({ ...editForm, local: e.target.value })} placeholder="Morada / Campo" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-field">
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Tipo de Jogo</label>
                    <select value={editForm.tipoJogo} onChange={e => {
                      const v = e.target.value;
                      const maxMap = { '5x5': 10, '7x7': 14, '11x11': 22 };
                      setEditForm(f => ({ ...f, tipoJogo: v, ...(maxMap[v] ? { maxJogadores: maxMap[v] } : {}) }));
                    }}>
                      <option value="5x5">5x5</option>
                      <option value="7x7">7x7</option>
                      <option value="11x11">11x11</option>
                      <option value="personalizado">Personalizado</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Máx. Jogadores</label>
                    <input type="number" min={2} max={50} value={editForm.maxJogadores} onChange={e => setEditForm({ ...editForm, maxJogadores: parseInt(e.target.value) || 10 })} />
                  </div>
                </div>
                <div className="form-field">
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Nível</label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {NIVEIS.map(n => {
                      const nc = NIVEL_COR[n];
                      return (
                        <button key={n} type="button" onClick={() => setEditForm(f => ({ ...f, nivel: n }))}
                          style={{ flex: 1, padding: '0.5rem', borderRadius: 'var(--radius)', border: `1.5px solid ${editForm.nivel === n ? nc.borda : 'var(--border)'}`,
                            background: editForm.nivel === n ? nc.bg : 'transparent', color: editForm.nivel === n ? nc.cor : 'var(--text-muted)',
                            fontWeight: editForm.nivel === n ? 700 : 500, cursor: 'pointer', fontSize: '0.8rem' }}>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={editLoading}>
                    {editLoading ? 'A guardar...' : 'Guardar Alterações'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Botão de Check-in ─────────────────────────────────────
function CheckinButton({ jogo, onFeito }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  if (!jogo?.data_jogo) return null;
  const dt = new Date(jogo.data_jogo).getTime();
  const aberto = now >= dt - 60 * 60 * 1000 && now <= dt + 30 * 60 * 1000;

  if (jogo.meu_checkin) {
    return (
      <span className="badge badge-green" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
        ✓ Check-in feito
      </span>
    );
  }
  if (!aberto) return null;

  const fazer = async () => {
    setLoading(true);
    try {
      await api.post(`/jogos/${jogo.id}/checkin`);
      addToast('Check-in feito! Bom jogo ⚽', 'success');
      onFeito?.();
    } catch (e) {
      addToast(e?.response?.data?.mensagem || 'Erro no check-in.', 'error');
    } finally { setLoading(false); }
  };

  return (
    <button className="btn btn-primary btn-sm" onClick={fazer} disabled={loading}>
      {loading ? 'A confirmar...' : '📍 Fazer Check-in'}
    </button>
  );
}
