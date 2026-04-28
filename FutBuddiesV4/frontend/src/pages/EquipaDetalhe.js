// ============================================================
//  FutBuddies - Detalhe da Equipa (v4 — chat, admin, calendario)
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import api from '../utils/api';
import { NIVEIS, NIVEL_COR, REGIOES, EMBLEMAS, resolverImgUrl } from '../utils/constantes';
import ImageUpload from '../components/ImageUpload';
import CodigoAcesso from '../components/CodigoAcesso';
import {
  IconUsers, IconChat, IconCalendar, IconMail, IconLock, IconGlobe,
  IconSearch, IconMapPin, IconCrown, IconPencil, IconTrash, IconBall,
} from '../components/Icons';
import io from 'socket.io-client';
import './Equipas.css';

const sizeParaPx = (size) => {
  if (typeof size === 'number') return size;
  const s = String(size).trim();
  const n = parseFloat(s) || 1;
  if (s.endsWith('rem') || s.endsWith('em')) return Math.round(n * 16);
  if (s.endsWith('px')) return Math.round(n);
  return Math.round(n * 16);
};
const renderEmblema = (emblema, size = '4rem') => {
  if (!emblema) return <span style={{ fontSize: size }}>⚽</span>;
  if (emblema.startsWith('http') || emblema.startsWith('/uploads')) {
    const px = sizeParaPx(size);
    return <img src={resolverImgUrl(emblema)} alt="emblema" style={{ width: px, height: px, borderRadius: 12, objectFit: 'cover' }} />;
  }
  return <span style={{ fontSize: size }}>{emblema}</span>;
};

export default function EquipaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { utilizador, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const confirmar = useConfirm();
  const [equipa, setEquipa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [formEdit, setFormEdit] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [codigoAcesso, setCodigoAcesso] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('plantel');

  // Chat state
  const [mensagens, setMensagens] = useState([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);

  // Calendario state
  const [calendario, setCalendario] = useState([]);
  const [calLoading, setCalLoading] = useState(false);

  const carregar = () => {
    api.get(`/equipas/${id}`)
      .then(res => {
        setEquipa(res.data.equipa);
        setFormEdit({
          nome: res.data.equipa.nome, emblema: res.data.equipa.emblema, emblemaUrl: null,
          descricao: res.data.equipa.descricao || '', nivel: res.data.equipa.nivel,
          regiao: res.data.equipa.regiao || '', aRecrutar: res.data.equipa.a_recrutar,
          visibilidade: res.data.equipa.visibilidade || 'publica',
          aceitarPedidos: res.data.equipa.aceitar_pedidos || false,
        });
      })
      .catch(() => navigate('/equipas'))
      .finally(() => setLoading(false));
  };

  const carregarPedidos = () => {
    api.get(`/equipas/${id}/pedidos`)
      .then(res => setPedidos(res.data.pedidos || []))
      .catch(() => {});
  };

  const carregarChat = () => {
    setChatLoading(true);
    api.get(`/equipas/${id}/chat`)
      .then(res => setMensagens(res.data.mensagens || []))
      .catch(() => {})
      .finally(() => setChatLoading(false));
  };

  const carregarCalendario = () => {
    setCalLoading(true);
    api.get(`/equipas/${id}/calendario`)
      .then(res => setCalendario(res.data.jogos || []))
      .catch(() => {})
      .finally(() => setCalLoading(false));
  };

  useEffect(() => { carregar(); }, [id]);

  const isCapitao = utilizador && equipa && utilizador.id === equipa.capitao_id;
  const isMembro = utilizador && equipa?.membros?.some(m => m.utilizador_id === utilizador.id);

  // Load requests when captain views
  useEffect(() => {
    if (isCapitao && equipa?.aceitar_pedidos) carregarPedidos();
  }, [isCapitao, equipa?.aceitar_pedidos]);

  // Socket.IO for team chat
  useEffect(() => {
    if (!isMembro || abaAtiva !== 'chat') return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = io(process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000', {
      auth: { token },
    });

    socket.on('connect', () => {
      socket.emit('entrar_equipa', id);
    });

    socket.on('nova_mensagem_equipa', (msg) => {
      setMensagens(prev => [...prev, msg]);
    });

    socketRef.current = socket;

    return () => {
      socket.emit('sair_equipa', id);
      socket.disconnect();
    };
  }, [isMembro, abaAtiva, id]);

  // Load chat when tab changes
  useEffect(() => {
    if (abaAtiva === 'chat' && isMembro) carregarChat();
    if (abaAtiva === 'calendario' && isMembro) carregarCalendario();
  }, [abaAtiva, isMembro]);

  // Auto-scroll chat — só se estiver perto do fundo
  useEffect(() => {
    const end = chatEndRef.current;
    if (!end) return;
    const scroller = end.parentElement;
    if (!scroller) return;
    const dist = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    if (dist < 150) end.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const handleEnviarMensagem = async (e) => {
    e.preventDefault();
    if (!novaMensagem.trim()) return;

    // Send via Socket.IO for real-time
    if (socketRef.current) {
      socketRef.current.emit('chat_equipa_mensagem', { equipaId: id, mensagem: novaMensagem.trim() });
    }

    // Persist via API
    try {
      await api.post(`/equipas/${id}/chat`, { mensagem: novaMensagem.trim() });
    } catch {}

    setNovaMensagem('');
  };

  const handleSalvar = async () => {
    setGuardando(true);
    try {
      const dados = { ...formEdit, emblema: formEdit.emblemaUrl || formEdit.emblema };
      const res = await api.put(`/equipas/${id}`, dados);
      addToast('Equipa atualizada!', 'success');
      setEditando(false);
      if (res.data.codigoAcesso) {
        setEquipa(prev => ({ ...prev, codigo_acesso: res.data.codigoAcesso }));
      }
      carregar();
    } catch (err) { addToast(err.response?.data?.mensagem || 'Erro.', 'error'); }
    finally { setGuardando(false); }
  };

  const handleEliminar = async () => {
    const ok = await confirmar({
      titulo: 'Eliminar equipa?',
      mensagem: 'Esta ação é permanente. Todos os membros, pedidos e mensagens serão perdidos.',
      confirmarLabel: 'Eliminar',
      variante: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/equipas/${id}`);
      addToast('Equipa eliminada.', 'info');
      navigate('/equipas');
    } catch (err) { addToast(err.response?.data?.mensagem || 'Erro.', 'error'); }
  };

  const handleEntrar = async () => {
    try {
      await api.post(`/equipas/${id}/entrar`, {});
      addToast('Entraste na equipa!', 'success');
      carregar();
    } catch (err) { addToast(err.response?.data?.mensagem || 'Erro.', 'error'); }
  };

  const handleEntrarComCodigo = async (e) => {
    e.preventDefault();
    if (!codigoAcesso.trim()) return;
    try {
      await api.post(`/equipas/${id}/entrar`, { codigoAcesso: codigoAcesso.toUpperCase() });
      addToast('Entraste na equipa!', 'success');
      setCodigoAcesso('');
      carregar();
    } catch (err) { addToast(err.response?.data?.mensagem || 'Código inválido.', 'error'); }
  };

  const handlePedirEntrada = async () => {
    try {
      await api.post(`/equipas/${id}/pedir`);
      addToast('Pedido de entrada enviado!', 'success');
    } catch (err) { addToast(err.response?.data?.mensagem || 'Erro.', 'error'); }
  };

  const handleAceitarPedido = async (pedidoId) => {
    try {
      await api.put(`/equipas/${id}/pedidos/${pedidoId}/aceitar`);
      addToast('Pedido aceite!', 'success');
      carregarPedidos();
      carregar();
    } catch (err) { addToast(err.response?.data?.mensagem || 'Erro.', 'error'); }
  };

  const handleRejeitarPedido = async (pedidoId) => {
    try {
      await api.put(`/equipas/${id}/pedidos/${pedidoId}/rejeitar`);
      setPedidos(prev => prev.filter(p => p.id !== pedidoId));
    } catch (err) { addToast(err.response?.data?.mensagem || 'Erro.', 'error'); }
  };

  const handleRemoverMembro = async (uid) => {
    if (uid !== utilizador?.id) {
      const ok = await confirmar({
        titulo: 'Expulsar membro?',
        mensagem: 'O jogador será removido da equipa imediatamente.',
        confirmarLabel: 'Expulsar',
        variante: 'danger',
      });
      if (!ok) return;
    }
    try {
      await api.delete(`/equipas/${id}/membros/${uid}`);
      addToast(uid === utilizador?.id ? 'Saiste da equipa.' : 'Membro expulso.', 'info');
      if (uid === utilizador?.id) navigate('/equipas');
      else carregar();
    } catch (err) { addToast(err.response?.data?.mensagem || 'Erro.', 'error'); }
  };

  const handlePromover = async (uid, nome) => {
    const ok = await confirmar({
      titulo: 'Transferir capitania?',
      mensagem: `${nome} torna-se o novo capitão. Vais perder o cargo.`,
      confirmarLabel: 'Promover',
    });
    if (!ok) return;
    try {
      await api.put(`/equipas/${id}/membros/${uid}/promover`);
      addToast(`${nome} e agora o capitao!`, 'success');
      carregar();
    } catch (err) { addToast(err.response?.data?.mensagem || 'Erro.', 'error'); }
  };

  const getInitials = (nome) => nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem' }}><div className="spinner" /></div>;
  if (!equipa) return null;

  const nc = NIVEL_COR[equipa.nivel] || NIVEL_COR['Descontraido'];
  const isPrivada = equipa.visibilidade === 'privada';

  // Build tabs
  const abaIcons = { plantel: <IconUsers size="0.9em" />, chat: <IconChat size="0.9em" />, calendario: <IconCalendar size="0.9em" />, pedidos: <IconMail size="0.9em" /> };
  const abas = [['plantel', 'Plantel']];
  if (isMembro) {
    abas.push(['chat', 'Chat']);
    abas.push(['calendario', 'Calendario']);
  }
  if (isCapitao && equipa.aceitar_pedidos) {
    abas.push(['pedidos', `Pedidos${pedidos.length > 0 ? ` (${pedidos.length})` : ''}`]);
  }

  return (
    <div className="equipa-detalhe-page">
      <div className="container" style={{ maxWidth: 900 }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          <Link to="/equipas" style={{ color: 'var(--primary)' }}>← Voltar as Equipas</Link>
        </p>

        {/* Header */}
        {!editando ? (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
              <div style={{ lineHeight: 1, flexShrink: 0 }}>{renderEmblema(equipa.emblema, '4rem')}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: '1.75rem' }}>{equipa.nome}</h1>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 4,
                    background: nc.bg, color: nc.cor, border: `1px solid ${nc.borda}` }}>{equipa.nivel}</span>
                  {isPrivada && <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}><IconLock size="0.8em" /> Privada</span>}
                  {!isPrivada && <span className="badge badge-green" style={{ fontSize: '0.7rem' }}><IconGlobe size="0.8em" /> Publica</span>}
                  {equipa.a_recrutar && <span className="badge badge-green" style={{ fontSize: '0.75rem' }}><IconSearch size="0.8em" /> A Recrutar</span>}
                </div>
                {equipa.regiao && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem' }}><IconMapPin size="0.85em" /> {equipa.regiao}</p>}
                {equipa.descricao && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>{equipa.descricao}</p>}
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  <IconCrown size="0.85em" /> Capitao: <Link to={`/jogadores/${equipa.capitao_id}`} style={{ color: 'var(--primary)' }}>{equipa.capitao_nome}</Link>
                </p>
              </div>
              {isCapitao && (
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditando(true)}><IconPencil size="0.85em" /> Editar</button>
                  <button className="btn btn-danger btn-sm" onClick={handleEliminar}><IconTrash size="0.85em" /></button>
                </div>
              )}
            </div>

            {/* Access code for captain */}
            {isCapitao && isPrivada && equipa.codigo_acesso && (
              <CodigoAcesso codigo={equipa.codigo_acesso} label="Código de Acesso" />
            )}

            {/* Join buttons for non-members */}
            {isAuthenticated && !isMembro && (
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {!isPrivada ? (
                  <button className="btn btn-primary btn-sm" onClick={handleEntrar}>+ Entrar na Equipa</button>
                ) : (
                  <>
                    <form onSubmit={handleEntrarComCodigo} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input type="text" placeholder="Codigo de acesso" value={codigoAcesso}
                        onChange={e => setCodigoAcesso(e.target.value.toUpperCase())}
                        maxLength={10} style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px', maxWidth: 160, textAlign: 'center' }} />
                      <button type="submit" className="btn btn-primary btn-sm">Entrar</button>
                    </form>
                    {equipa.aceitar_pedidos && (
                      <button className="btn btn-outline btn-sm" onClick={handlePedirEntrada}><IconMail size="0.85em" /> Pedir para Entrar</button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Edit form */
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}><IconPencil size="1em" /> Editar Equipa</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-field">
                <label>Tipo de Equipa</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {[
                    { v: 'publica', icon: <IconGlobe size="1.2rem" />, titulo: 'Publica' },
                    { v: 'privada', icon: <IconLock size="1.2rem" />, titulo: 'Privada' },
                  ].map(opt => (
                    <button key={opt.v} type="button" onClick={() => setFormEdit(f => ({ ...f, visibilidade: opt.v }))}
                      className={`tipo-jogo-btn ${formEdit.visibilidade === opt.v ? 'active' : ''}`}
                      style={{ padding: '0.6rem', gap: '0.25rem' }}>
                      <span>{opt.icon}</span>
                      <span className="tipo-jogo-value">{opt.titulo}</span>
                    </button>
                  ))}
                </div>
              </div>

              {formEdit.visibilidade === 'privada' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input type="checkbox" id="editAceitarPedidos" checked={formEdit.aceitarPedidos}
                    onChange={e => setFormEdit(f => ({ ...f, aceitarPedidos: e.target.checked }))} style={{ width: 16, height: 16 }} />
                  <label htmlFor="editAceitarPedidos" style={{ cursor: 'pointer', fontSize: '0.85rem' }}><IconMail size="0.85em" /> Permitir pedidos de entrada</label>
                </div>
              )}

              <div className="form-field">
                <label>Emblema da Equipa</label>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', alignItems: 'center' }}>
                    <ImageUpload
                      valor={formEdit.emblemaUrl || null}
                      onChange={url => setFormEdit(f => ({ ...f, emblemaUrl: url, emblema: null }))}
                      placeholder={formEdit.emblema || '🏆'}
                      forma="quadrado"
                      tamanho={72}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Imagem</span>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Ou emoji:</p>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', maxWidth: 300 }}>
                      {EMBLEMAS.map(e => (
                        <button key={e} type="button" onClick={() => setFormEdit(f => ({ ...f, emblema: e, emblemaUrl: null }))}
                          style={{ width: 38, height: 38, fontSize: '1.2rem', borderRadius: 'var(--radius)',
                            border: `2px solid ${formEdit.emblema === e && !formEdit.emblemaUrl ? 'var(--primary)' : 'var(--border)'}`,
                            background: formEdit.emblema === e && !formEdit.emblemaUrl ? 'var(--primary-glow)' : 'transparent',
                            cursor: 'pointer' }}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-field">
                  <label>Nome</label>
                  <input type="text" value={formEdit.nome} onChange={e => setFormEdit(f => ({ ...f, nome: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Regiao</label>
                  <select value={formEdit.regiao} onChange={e => setFormEdit(f => ({ ...f, regiao: e.target.value }))}>
                    <option value="">Sem regiao</option>
                    {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label>Nivel</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {NIVEIS.map(n => {
                    const nc2 = NIVEL_COR[n];
                    return (
                      <button key={n} type="button" onClick={() => setFormEdit(f => ({ ...f, nivel: n }))}
                        style={{ flex: 1, padding: '0.5rem', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.875rem',
                          border: `1.5px solid ${formEdit.nivel === n ? nc2.borda : 'var(--border)'}`,
                          background: formEdit.nivel === n ? nc2.bg : 'transparent',
                          color: formEdit.nivel === n ? nc2.cor : 'var(--text-muted)', fontWeight: formEdit.nivel === n ? 700 : 400 }}>
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="form-field">
                <label>Descricao</label>
                <textarea value={formEdit.descricao} onChange={e => setFormEdit(f => ({ ...f, descricao: e.target.value }))} rows={3} style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input type="checkbox" id="recrutar" checked={formEdit.aRecrutar}
                  onChange={e => setFormEdit(f => ({ ...f, aRecrutar: e.target.checked }))} style={{ width: 16, height: 16 }} />
                <label htmlFor="recrutar" style={{ cursor: 'pointer', fontSize: '0.875rem' }}><IconSearch size="0.85em" /> A procura de jogadores</label>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-primary" onClick={handleSalvar} disabled={guardando}>
                  {guardando ? 'A guardar...' : 'Guardar'}
                </button>
                <button className="btn btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { num: equipa.membros?.length || 0, label: 'Membros' },
            { num: equipa.total_jogos, label: 'Jogos' },
            { num: equipa.vitorias, label: 'Vitorias', cor: 'var(--success)' },
            { num: equipa.derrotas, label: 'Derrotas', cor: 'var(--danger)' },
          ].map((s, i) => (
            <div key={i} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 700, color: s.cor || 'var(--primary)' }}>{s.num}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '2px solid var(--border)', marginBottom: '1rem' }}>
          {abas.map(([key, label]) => (
            <button key={key} onClick={() => setAbaAtiva(key)}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, background: 'transparent', border: 'none',
                borderBottom: `2px solid ${abaAtiva === key ? 'var(--primary)' : 'transparent'}`, marginBottom: -2,
                color: abaAtiva === key ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {abaIcons[key]} {label}
            </button>
          ))}
        </div>

        {/* ── ABA PLANTEL ── */}
        {abaAtiva === 'plantel' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem' }}><IconUsers size="1em" /> Plantel</h3>
              {isMembro && !isCapitao && (
                <button className="btn btn-ghost btn-sm" onClick={() => handleRemoverMembro(utilizador.id)}>Sair da equipa</button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {(equipa.membros || []).map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.625rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }}>
                  <div className="avatar" style={{ width: 36, height: 36, fontSize: '0.8rem', flexShrink: 0 }}>
                    {m.foto_url
                      ? <img src={resolverImgUrl(m.foto_url)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      : getInitials(m.nome)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <Link to={`/jogadores/${m.utilizador_id}`} style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)', textDecoration: 'none' }}>
                      {m.nickname || m.nome}
                    </Link>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {m.papel === 'capitao' ? <><IconCrown size="0.8em" /> Capitao</> : <><IconBall size="0.8em" /> Membro</>}
                      {m.posicao && ` · ${m.posicao}`}
                      {m.regiao && ` · ${m.regiao}`}
                    </p>
                  </div>
                  {/* Admin controls */}
                  {isCapitao && m.papel !== 'capitao' && (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button className="btn btn-outline btn-xs" title="Promover a capitao"
                        onClick={() => handlePromover(m.utilizador_id, m.nickname || m.nome)}>
                        <IconCrown size="0.85em" />
                      </button>
                      <button className="btn btn-danger btn-xs" title="Expulsar"
                        onClick={() => handleRemoverMembro(m.utilizador_id)}>
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ABA CHAT ── */}
        {abaAtiva === 'chat' && isMembro && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 500, maxHeight: '70vh', minHeight: 0 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', flexShrink: 0 }}><IconChat size="1em" /> Chat da Equipa</h3>

            {/* Messages area */}
            <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
              padding: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--radius)', marginBottom: '0.75rem', border: '1px solid var(--border)' }}>
              {chatLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
              ) : mensagens.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', fontSize: '0.85rem' }}>
                  Sem mensagens ainda. Começa a conversa!
                </p>
              ) : (
                mensagens.map((msg, i) => {
                  const isMine = msg.utilizador_id === utilizador?.id;
                  return (
                    <div key={msg.id || i} style={{ display: 'flex', flexDirection: 'column',
                      alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '75%', alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
                      {!isMine && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2, fontWeight: 600 }}>
                          {msg.nickname || msg.utilizador_nome || msg.nome}
                        </span>
                      )}
                      <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)',
                        background: isMine ? 'var(--primary)' : 'var(--card-bg)',
                        color: isMine ? '#fff' : 'var(--text)',
                        border: isMine ? 'none' : '1px solid var(--border)',
                        fontSize: '0.875rem', lineHeight: 1.4, wordBreak: 'break-word' }}>
                        {msg.mensagem}
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {new Date(msg.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Send message */}
            <form onSubmit={handleEnviarMensagem} style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" placeholder="Escreve uma mensagem..." value={novaMensagem}
                onChange={e => setNovaMensagem(e.target.value)} maxLength={500}
                style={{ flex: 1, fontSize: '0.875rem' }} />
              <button type="submit" className="btn btn-primary" disabled={!novaMensagem.trim()}>Enviar</button>
            </form>
          </div>
        )}

        {/* ── ABA CALENDARIO ── */}
        {abaAtiva === 'calendario' && isMembro && (
          <div className="card">
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}><IconCalendar size="1em" /> Calendario · Últimos 30 dias + Próximos</h3>
            {calLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
            ) : calendario.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}><IconCalendar size="2rem" /></p>
                <p style={{ fontSize: '0.9rem' }}>Sem jogos agendados.</p>
                <Link to="/jogos/criar" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>+ Criar Jogo de Equipa</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {calendario.map((jogo, i) => {
                  const data = new Date(jogo.data_jogo);
                  const ncJ = NIVEL_COR[jogo.nivel] || NIVEL_COR['Descontraido'];
                  const passado = data.getTime() + 60 * 60 * 1000 < Date.now();
                  const temResultado = jogo.golos_equipa_a != null && jogo.golos_equipa_b != null;
                  // Perspetiva da equipa (lado A ou B)
                  const meusGolos = jogo.lado === 'A' ? jogo.golos_equipa_a : jogo.golos_equipa_b;
                  const golosOponente = jogo.lado === 'A' ? jogo.golos_equipa_b : jogo.golos_equipa_a;
                  const resultadoStr = temResultado
                    ? (meusGolos > golosOponente ? 'V' : meusGolos < golosOponente ? 'D' : 'E')
                    : null;
                  const resultadoCor = resultadoStr === 'V' ? 'var(--success)'
                                     : resultadoStr === 'D' ? 'var(--danger)'
                                     : resultadoStr === 'E' ? 'var(--text-muted)' : null;
                  return (
                    <Link key={i} to={`/jogos/${jogo.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem',
                        padding: '0.875rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                        background: 'var(--bg)', transition: 'border-color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                        {/* Date block */}
                        <div style={{ textAlign: 'center', minWidth: 50, flexShrink: 0 }}>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                            {data.toLocaleDateString('pt-PT', { month: 'short' })}
                          </p>
                          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>
                            {data.getDate()}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {data.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {/* Game info */}
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem' }}>{jogo.titulo}</p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <IconMapPin size="0.8em" /> {jogo.regiao || 'Sem regiao'} · {jogo.tipo_jogo}
                          </p>
                          {jogo.adversario_nome && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                              vs {jogo.adversario_emblema ? renderEmblema(jogo.adversario_emblema, '1em') : '⚽'} {jogo.adversario_nome}
                            </p>
                          )}
                        </div>
                        {/* Placard / resultado */}
                        {temResultado ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0, minWidth: 58 }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)' }}>
                              {meusGolos}–{golosOponente}
                            </span>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: resultadoCor, letterSpacing: '0.08em' }}>
                              {resultadoStr === 'V' ? 'VITÓRIA' : resultadoStr === 'D' ? 'DERROTA' : 'EMPATE'}
                            </span>
                          </div>
                        ) : passado ? (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                            background: 'rgba(255,176,32,0.12)', color: '#ffb020', border: '1px solid rgba(255,176,32,0.3)', flexShrink: 0 }}>
                            Sem resultado
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                            background: ncJ.bg, color: ncJ.cor, border: `1px solid ${ncJ.borda}`, flexShrink: 0 }}>
                            {jogo.nivel}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ABA PEDIDOS ── */}
        {abaAtiva === 'pedidos' && isCapitao && (
          <div className="card">
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}><IconMail size="1em" /> Pedidos de Entrada</h3>
            {pedidos.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>Sem pedidos pendentes.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {pedidos.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.625rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)' }}>
                    <div className="avatar" style={{ width: 36, height: 36, fontSize: '0.8rem', flexShrink: 0 }}>
                      {p.foto_url
                        ? <img src={resolverImgUrl(p.foto_url)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        : getInitials(p.nome)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Link to={`/jogadores/${p.utilizador_id}`} style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)', textDecoration: 'none' }}>
                        {p.nickname || p.nome}
                      </Link>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {[p.posicao, p.regiao].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAceitarPedido(p.id)}>Aceitar</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleRejeitarPedido(p.id)}>Rejeitar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
