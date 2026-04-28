// ============================================================
//  FutBuddies - Página de Amigos + Chat Privado
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import api from '../utils/api';
import { io } from 'socket.io-client';
import { resolverImgUrl } from '../utils/constantes';
import './Amigos.css';

export default function Amigos() {
  const { utilizador } = useAuth();
  const { addToast } = useToast();
  const confirmar = useConfirm();
  const [tab, setTab] = useState('amigos');
  const [amigos, setAmigos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [pesquisa, setPesquisa] = useState('');
  const [resultados, setResultados] = useState([]);
  const [pesquisaLoading, setPesquisaLoading] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);
  const [sugestoesLoading, setSugestoesLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Chat state
  const [chatAberto, setChatAberto] = useState(null); // amigo selecionado
  const [mensagens, setMensagens] = useState([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatMsgsRef = useRef(null);
  const socketRef = useRef(null);

  const carregarAmigos = useCallback(() => {
    api.get('/amigos').then(r => setAmigos(r.data.amigos || [])).catch(() => {});
  }, []);

  const carregarPedidos = useCallback(() => {
    api.get('/amigos/pedidos').then(r => setPedidos(r.data.pedidos || [])).catch(() => {});
  }, []);

  const carregarSugestoes = useCallback(() => {
    setSugestoesLoading(true);
    api.get('/amigos/sugestoes').then(r => setSugestoes(r.data.sugestoes || [])).catch(() => {}).finally(() => setSugestoesLoading(false));
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/amigos'),
      api.get('/amigos/pedidos'),
      api.get('/amigos/sugestoes')
    ]).then(([a, p, s]) => {
      setAmigos(a.data.amigos || []);
      setPedidos(p.data.pedidos || []);
      setSugestoes(s.data.sugestoes || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Socket.IO para chat privado
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const socketUrl = process.env.REACT_APP_API_URL
      ? process.env.REACT_APP_API_URL.replace('/api', '')
      : 'http://localhost:5000';
    const socket = io(socketUrl, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('nova_mensagem_privada', (msg) => {
      setMensagens(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => { socket.disconnect(); };
  }, []);

  // Scroll chat ao receber mensagem — só se estiver perto do fundo
  useEffect(() => {
    const el = chatMsgsRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (dist < 150) el.scrollTop = el.scrollHeight;
  }, [mensagens]);

  // Pesquisar utilizadores (debounced)
  useEffect(() => {
    if (tab !== 'adicionar' || pesquisa.trim().length < 2) {
      setResultados([]);
      return;
    }
    setPesquisaLoading(true);
    const timeout = setTimeout(() => {
      api.get(`/amigos/pesquisar?q=${encodeURIComponent(pesquisa.trim())}`)
        .then(r => setResultados(r.data.utilizadores || []))
        .catch(() => {})
        .finally(() => setPesquisaLoading(false));
    }, 400);
    return () => clearTimeout(timeout);
  }, [pesquisa, tab]);

  const handleEnviarPedido = async (destId) => {
    try {
      await api.post('/amigos/enviar', { destinatarioId: destId });
      addToast('Pedido de amizade enviado!', 'success');
      setResultados(prev => prev.map(u => u.id === destId ? { ...u, estado_amizade: 'pendente' } : u));
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro ao enviar pedido.', 'error');
    }
  };

  const handleAceitar = async (pedidoId) => {
    try {
      await api.put(`/amigos/${pedidoId}/aceitar`);
      addToast('Amizade aceite!', 'success');
      carregarAmigos();
      carregarPedidos();
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro.', 'error');
    }
  };

  const handleRejeitar = async (pedidoId) => {
    try {
      await api.put(`/amigos/${pedidoId}/rejeitar`);
      setPedidos(prev => prev.filter(p => p.id !== pedidoId));
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro.', 'error');
    }
  };

  const handleRemover = async (amizadeId) => {
    const ok = await confirmar({
      titulo: 'Remover amigo?',
      mensagem: 'Vão deixar de poder trocar mensagens privadas.',
      confirmarLabel: 'Remover',
      variante: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/amigos/${amizadeId}`);
      setAmigos(prev => prev.filter(a => a.amizade_id !== amizadeId));
      if (chatAberto?.amizade_id === amizadeId) setChatAberto(null);
      addToast('Amigo removido.', 'info');
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro.', 'error');
    }
  };

  const abrirChat = async (amigo) => {
    setChatAberto(amigo);
    setTab('chat');
    setChatLoading(true);
    try {
      const res = await api.get(`/amigos/chat/${amigo.amigo_id}`);
      setMensagens(res.data.mensagens || []);
    } catch {
      setMensagens([]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleEnviarMensagem = async (e) => {
    e.preventDefault();
    if (!novaMensagem.trim() || !chatAberto) return;
    const texto = novaMensagem.trim();
    setNovaMensagem('');
    try {
      const res = await api.post(`/amigos/chat/${chatAberto.amigo_id}`, { mensagem: texto });
      const msg = res.data.mensagem;
      setMensagens(prev => [...prev, msg]);
      // Emitir via socket
      if (socketRef.current?.connected) {
        socketRef.current.emit('mensagem_privada', {
          destinatarioId: chatAberto.amigo_id,
          mensagem: texto,
          id: msg.id,
        });
      }
    } catch (err) {
      addToast('Erro ao enviar mensagem.', 'error');
      setNovaMensagem(texto);
    }
  };

  const getInitials = (nome) => nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
  const formatarHora = (data) => data ? new Date(data).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '';

  const AvatarImg = ({ src, nome, size = 40, className = 'amigo-card-foto' }) => (
    src ? <img src={resolverImgUrl(src)} alt="" className={className} style={{ width: size, height: size }} /> :
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.35, flexShrink: 0 }}>{getInitials(nome)}</div>
  );

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem' }}><div className="spinner" /></div>;

  return (
    <div className="amigos-page">
      <div className="container">
        <div className="amigos-header">
          <h1>👥 Amigos</h1>
          <p>Adiciona amigos, aceita pedidos e conversa por chat privado</p>
        </div>

        <div className="amigos-tabs">
          <button className={`amigos-tab ${tab === 'amigos' ? 'active' : ''}`} onClick={() => setTab('amigos')}>
            Amigos ({amigos.length})
          </button>
          <button className={`amigos-tab ${tab === 'pedidos' ? 'active' : ''}`} onClick={() => setTab('pedidos')}>
            Pedidos
            {pedidos.length > 0 && <span className="badge-count">{pedidos.length}</span>}
          </button>
          <button className={`amigos-tab ${tab === 'sugestoes' ? 'active' : ''}`} onClick={() => setTab('sugestoes')}>
            Sugestões
          </button>
          <button className={`amigos-tab ${tab === 'adicionar' ? 'active' : ''}`} onClick={() => setTab('adicionar')}>
            Pesquisar
          </button>
          <button className={`amigos-tab ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>
            Chat
          </button>
        </div>

        {/* Tab: Amigos */}
        {tab === 'amigos' && (
          <div className="amigos-lista">
            {amigos.length === 0 ? (
              <div className="empty-state card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</p>
                <p>Ainda não tens amigos. Usa a aba <strong>Adicionar</strong> para encontrar pessoas!</p>
              </div>
            ) : amigos.map(a => (
              <div key={a.amizade_id} className="amigo-card">
                <AvatarImg src={a.foto_url} nome={a.nome} />
                <div className="amigo-card-info">
                  <Link to={`/jogadores/${a.amigo_id}`} className="amigo-card-nome">{a.nome}</Link>
                  {a.nickname && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>@{a.nickname}</span>}
                  <p className="amigo-card-meta">
                    {[a.posicao, a.regiao].filter(Boolean).join(' · ') || 'Jogador FutBuddies'}
                  </p>
                </div>
                <div className="amigo-card-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => abrirChat(a)}>💬 Chat</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleRemover(a.amizade_id)} style={{ color: 'var(--danger)' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Pedidos */}
        {tab === 'pedidos' && (
          <div className="amigos-lista">
            {pedidos.length === 0 ? (
              <div className="empty-state card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</p>
                <p>Sem pedidos de amizade pendentes.</p>
              </div>
            ) : pedidos.map(p => (
              <div key={p.id} className="amigo-card">
                <AvatarImg src={p.foto_url} nome={p.nome} />
                <div className="amigo-card-info">
                  <Link to={`/jogadores/${p.remetente_id}`} className="amigo-card-nome">{p.nome}</Link>
                  {p.nickname && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>@{p.nickname}</span>}
                  <p className="amigo-card-meta">
                    {[p.posicao, p.regiao].filter(Boolean).join(' · ') || 'Quer ser teu amigo!'}
                  </p>
                </div>
                <div className="amigo-card-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => handleAceitar(p.id)}>Aceitar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleRejeitar(p.id)}>Rejeitar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Sugestões */}
        {tab === 'sugestoes' && (
          <div className="amigos-lista">
            {sugestoesLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
            ) : sugestoes.length === 0 ? (
              <div className="empty-state card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤝</p>
                <p>Sem sugestões de momento. Tenta mais tarde!</p>
              </div>
            ) : sugestoes.map(u => (
              <div key={u.id} className="amigo-card">
                <AvatarImg src={u.foto_url} nome={u.nome} />
                <div className="amigo-card-info">
                  <Link to={`/jogadores/${u.id}`} className="amigo-card-nome">{u.nome}</Link>
                  {u.nickname && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>@{u.nickname}</span>}
                  <p className="amigo-card-meta">
                    {[u.posicao, u.regiao].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="amigo-card-actions">
                  <button className="btn btn-primary btn-sm" onClick={async () => {
                    await handleEnviarPedido(u.id);
                    setSugestoes(prev => prev.filter(s => s.id !== u.id));
                  }}>+ Adicionar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Adicionar */}
        {tab === 'adicionar' && (
          <div>
            <div className="amigos-pesquisa">
              <input type="text" placeholder="Pesquisar por nome ou nickname..." value={pesquisa}
                onChange={e => setPesquisa(e.target.value)} autoFocus />
            </div>
            {pesquisaLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
            ) : pesquisa.trim().length < 2 ? (
              <div className="empty-state card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</p>
                <p>Escreve pelo menos 2 caracteres para pesquisar.</p>
              </div>
            ) : resultados.length === 0 ? (
              <div className="empty-state card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p>Nenhum utilizador encontrado.</p>
              </div>
            ) : (
              <div className="amigos-lista">
                {resultados.map(u => (
                  <div key={u.id} className="amigo-card">
                    <AvatarImg src={u.foto_url} nome={u.nome} />
                    <div className="amigo-card-info">
                      <Link to={`/jogadores/${u.id}`} className="amigo-card-nome">{u.nome}</Link>
                      {u.nickname && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>@{u.nickname}</span>}
                      <p className="amigo-card-meta">
                        {[u.posicao, u.regiao].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="amigo-card-actions">
                      {u.estado_amizade === 'aceite' ? (
                        <span className="badge badge-green">Amigos</span>
                      ) : u.estado_amizade === 'pendente' ? (
                        <span className="badge badge-gray">Pendente</span>
                      ) : (
                        <button className="btn btn-primary btn-sm" onClick={() => handleEnviarPedido(u.id)}>+ Adicionar</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Chat */}
        {tab === 'chat' && (
          <div className="chat-privado-container">
            <div className="chat-privado-sidebar">
              <div className="chat-privado-sidebar-header">Conversas</div>
              {amigos.length === 0 ? (
                <p style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>Sem amigos ainda</p>
              ) : amigos.map(a => (
                <button key={a.amizade_id} className={`chat-contato ${chatAberto?.amigo_id === a.amigo_id ? 'active' : ''}`}
                  onClick={() => abrirChat(a)}>
                  {a.foto_url ? (
                    <img src={resolverImgUrl(a.foto_url)} alt="" className="chat-contato-foto" />
                  ) : (
                    <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.65rem', flexShrink: 0 }}>{getInitials(a.nome)}</div>
                  )}
                  <span className="chat-contato-nome">{a.nome?.split(' ')[0]}</span>
                </button>
              ))}
            </div>
            <div className="chat-privado-main">
              {!chatAberto ? (
                <div className="chat-privado-empty">Seleciona um amigo para conversar</div>
              ) : (
                <>
                  <div className="chat-privado-header">
                    <AvatarImg src={chatAberto.foto_url} nome={chatAberto.nome} size={28} className="chat-contato-foto" />
                    <Link to={`/jogadores/${chatAberto.amigo_id}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                      {chatAberto.nome}
                    </Link>
                  </div>
                  <div className="chat-privado-msgs" ref={chatMsgsRef}>
                    {chatLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
                    ) : mensagens.length === 0 ? (
                      <div className="chat-privado-empty">Ainda sem mensagens. Diz olá!</div>
                    ) : mensagens.map(msg => (
                      <div key={msg.id} className={`chat-privado-msg ${msg.remetente_id === utilizador?.id ? 'enviada' : 'recebida'}`}>
                        {msg.mensagem}
                        <span className="chat-privado-msg-hora">{formatarHora(msg.created_at)}</span>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleEnviarMensagem} className="chat-privado-input">
                    <input type="text" placeholder="Escreve uma mensagem..." value={novaMensagem}
                      onChange={e => setNovaMensagem(e.target.value)} maxLength={1000} />
                    <button type="submit" className="btn btn-primary btn-sm" disabled={!novaMensagem.trim()}>Enviar</button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
