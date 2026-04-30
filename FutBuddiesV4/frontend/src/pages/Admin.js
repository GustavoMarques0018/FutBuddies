// ============================================================
//  FutBuddies - Painel de Administração v2
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { NIVEL_COR } from '../utils/constantes';
import {
  IconChart, IconUsers, IconBall, IconTrophy, IconStadium, IconChat,
  IconTrash, IconInfo, IconMail,
} from '../components/Icons';
import { useConfirm, usePrompt } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import DatePickerFB from '../components/DatePickerFB';

// Helper: detecta se um valor de "emblema" é uma URL (http(s)://, /caminho, data:)
// — se for, renderiza como <img>; caso contrário usa o texto/emoji.
function EmblemaEquipa({ emblema, alt = '', tamanho = '1.5rem' }) {
  const isUrl = typeof emblema === 'string' &&
    /^(https?:\/\/|\/|data:image\/)/i.test(emblema.trim());
  if (isUrl) {
    return (
      <img
        src={emblema}
        alt={alt}
        style={{
          width: tamanho, height: tamanho, objectFit: 'cover',
          borderRadius: '50%', border: '1px solid var(--border)', flex: '0 0 auto',
          background: 'var(--bg-elev-2)',
        }}
        onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('span'), { textContent: '⚽', style: `font-size:${tamanho}` })); }}
      />
    );
  }
  return <span style={{ fontSize: tamanho, lineHeight: 1 }}>{emblema || '⚽'}</span>;
}
import './Admin.css';
import './DonoCampo.css'; // reutiliza modal + badges

export default function Admin() {
  const { utilizador, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const confirmar = useConfirm();
  const { addToast } = useToast();

  const queryTab = new URLSearchParams(location.search).get('tab');
  const [abaAtiva, setAbaAtiva] = useState(queryTab || 'dashboard');

  useEffect(() => {
    if (queryTab) setAbaAtiva(queryTab);
  }, [queryTab]);
  const [stats, setStats] = useState(null);
  const [jogosRecentes, setJogosRecentes] = useState([]);
  const [todosJogos, setTodosJogos] = useState([]);
  const [utilizadores, setUtilizadores] = useState([]);
  const [equipas, setEquipas] = useState([]);
  const [notas, setNotas] = useState([]);
  const [notaForm, setNotaForm] = useState({ titulo: '', mensagem: '', expira_em: '' });
  const [notaEnviando, setNotaEnviando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mensagemAcao, setMensagemAcao] = useState('');

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (utilizador && utilizador.role !== 'admin') navigate('/');
  }, [isAuthenticated, utilizador, navigate]);

  useEffect(() => {
    if (utilizador?.role !== 'admin') return;
    carregarDashboard();
    carregarUtilizadores();
    carregarTodosJogos();
    carregarEquipas();
    carregarNotas();
  }, [utilizador]);

  const carregarNotas = async () => {
    try { const res = await api.get('/admin/notas'); setNotas(res.data.notas || []); }
    catch (err) { console.error(err); }
  };

  const handleCriarNota = async (e) => {
    e.preventDefault();
    if (!notaForm.titulo.trim() || !notaForm.mensagem.trim()) {
      addToast('Título e mensagem são obrigatórios.', 'error'); return;
    }
    setNotaEnviando(true);
    try {
      const payload = {
        titulo: notaForm.titulo.trim(),
        mensagem: notaForm.mensagem.trim(),
        expira_em: notaForm.expira_em || null,
      };
      const res = await api.post('/admin/notas', payload);
      mostrarMensagem(res.data.mensagem || 'Nota publicada e enviada a todos os utilizadores.');
      setNotaForm({ titulo: '', mensagem: '', expira_em: '' });
      carregarNotas();
    } catch (err) {
      addToast(err.response?.data?.mensagem || 'Erro ao publicar nota.', 'error');
    } finally { setNotaEnviando(false); }
  };

  const handleEliminarNota = async (nota) => {
    const ok = await confirmar({
      titulo: 'Eliminar nota?',
      mensagem: `"${nota.titulo}" será removida. As notificações já entregues permanecem.`,
      confirmarLabel: 'Eliminar',
      variante: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/notas/${nota.id}`);
      mostrarMensagem('Nota eliminada.');
      carregarNotas();
    } catch (err) { addToast(err.response?.data?.mensagem || 'Erro.', 'error'); }
  };

  const carregarDashboard = async () => {
    try {
      const res = await api.get('/admin/dashboard');
      setStats(res.data.stats);
      setJogosRecentes(res.data.jogosRecentes || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const carregarUtilizadores = async () => {
    try { const res = await api.get('/admin/utilizadores'); setUtilizadores(res.data.utilizadores || []); }
    catch (err) { console.error(err); }
  };

  const carregarTodosJogos = async () => {
    try { const res = await api.get('/admin/jogos'); setTodosJogos(res.data.jogos || []); }
    catch (err) { console.error(err); }
  };

  const carregarEquipas = async () => {
    try { const res = await api.get('/equipas'); setEquipas(res.data.equipas || []); }
    catch (err) { console.error(err); }
  };

  const mostrarMensagem = (msg) => { setMensagemAcao(msg); setTimeout(() => setMensagemAcao(''), 3000); };

  const handleToggleAtivo = async (id, nome) => {
    const u = utilizadores.find(u => u.id === id);
    const ok = await confirmar({
      titulo: u?.ativo ? 'Desativar conta?' : 'Ativar conta?',
      mensagem: `${u?.ativo ? 'Desativar' : 'Ativar'} a conta de ${nome}?`,
      confirmarLabel: u?.ativo ? 'Desativar' : 'Ativar',
      variante: u?.ativo ? 'danger' : 'primary',
    });
    if (!ok) return;
    try {
      const res = await api.put(`/admin/utilizadores/${id}/ativo`);
      mostrarMensagem(res.data.mensagem);
      carregarUtilizadores();
    } catch (err) { addToast(err.response?.data?.mensagem || 'Erro.', 'error'); }
  };

  const handleAlterarRole = async (id, nome, roleAtual) => {
    const novoRole = roleAtual === 'admin' ? 'user' : 'admin';
    const ok = await confirmar({
      titulo: 'Alterar permissões?',
      mensagem: `Tornar ${nome} ${novoRole === 'admin' ? 'administrador' : 'utilizador normal'}?`,
      confirmarLabel: 'Alterar',
    });
    if (!ok) return;
    try {
      const res = await api.put(`/admin/utilizadores/${id}/role`, { role: novoRole });
      mostrarMensagem(res.data.mensagem);
      carregarUtilizadores();
    } catch (err) { addToast(err.response?.data?.mensagem || 'Erro.', 'error'); }
  };

  const handleEliminarJogo = async (jogo) => {
    const ok = await confirmar({
      titulo: 'Eliminar jogo?',
      mensagem: `"${jogo.titulo}" será removido. Esta ação é irreversível.`,
      confirmarLabel: 'Eliminar',
      variante: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/jogos/${jogo.id}`);
      mostrarMensagem(`Jogo "${jogo.titulo}" eliminado.`);
      carregarTodosJogos();
      carregarDashboard();
    } catch (err) { addToast(err.response?.data?.mensagem || 'Erro ao eliminar jogo.', 'error'); }
  };

  const handleEliminarEquipa = async (eq) => {
    const ok = await confirmar({
      titulo: 'Eliminar equipa?',
      mensagem: `"${eq.nome}" será removida. Esta ação é irreversível.`,
      confirmarLabel: 'Eliminar',
      variante: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/equipas/${eq.id}`);
      mostrarMensagem(`Equipa "${eq.nome}" eliminada.`);
      carregarEquipas();
      carregarDashboard();
    } catch (err) { addToast(err.response?.data?.mensagem || 'Erro ao eliminar equipa.', 'error'); }
  };

  const formatarData = (data) => {
    if (!data) return '—';
    return new Date(data).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getEstadoJogo = (jogo) => {
    const agora = Date.now();
    const dataJogo = new Date(jogo.data_jogo).getTime();
    const fim = dataJogo + 60 * 60 * 1000;
    if (agora >= fim) return { cls: 'badge-gray', label: 'Encerrado' };
    if (agora >= dataJogo) return { cls: 'badge-amber', label: 'A decorrer' };
    if (jogo.estado === 'cheio') return { cls: 'badge-red', label: 'Cheio' };
    if (jogo.estado === 'cancelado') return { cls: 'badge-gray', label: 'Cancelado' };
    return { cls: 'badge-green', label: 'Aberto' };
  };

  const getInitials = (nome) => nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';

  if (loading) return <div className="admin-page"><div className="container" style={{ display: 'flex', justifyContent: 'center', padding: '6rem' }}><div className="spinner" /></div></div>;

  return (
    <div className="admin-page">
      <div className="container">
        <div className="admin-header">
          <div>
            <h1 className="admin-titulo">Painel de Administração</h1>
            <p className="admin-subtitulo">Gestão completa da plataforma FutBuddies</p>
          </div>
          <div className="admin-badge">
            <span className="badge badge-green">Admin</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{utilizador?.nome}</span>
          </div>
        </div>

        {mensagemAcao && <div className="admin-alerta">{mensagemAcao}</div>}

        <div className="admin-abas">
          {[
            ['dashboard',    <><IconChart size="0.95rem" /> Dashboard</>],
            ['utilizadores', <><IconUsers size="0.95rem" /> Utilizadores ({utilizadores.length})</>],
            ['jogos',        <><IconBall size="0.95rem" /> Todos os Jogos ({todosJogos.length})</>],
            ['equipas',      <><IconTrophy size="0.95rem" /> Todas as Equipas ({equipas.length})</>],
            ['notas',        <><IconMail size="0.95rem" /> Notas Globais ({notas.length})</>],
            ['candidaturas', <><IconStadium size="0.95rem" /> Candidaturas</>],
            ['suporte',      <><IconChat size="0.95rem" /> Suporte</>],
          ].map(([key, label]) => (
            <button key={key} className={`admin-aba ${abaAtiva === key ? 'active' : ''}`} onClick={() => setAbaAtiva(key)}>{label}</button>
          ))}
        </div>

        {/* DASHBOARD */}
        {abaAtiva === 'dashboard' && stats && (
          <div className="admin-conteudo">
            <div className="admin-stats-grid">
              {[
                { icon: '👥', valor: stats.total_utilizadores, label: 'Utilizadores' },
                { icon: '⚽', valor: stats.total_jogos, label: 'Total de Jogos' },
                { icon: '🟢', valor: stats.jogos_abertos, label: 'Jogos Abertos' },
                { icon: '🏆', valor: stats.total_equipas, label: 'Equipas' },
                { icon: '📋', valor: stats.total_inscricoes, label: 'Inscrições' },
                { icon: '💬', valor: stats.total_mensagens, label: 'Mensagens' },
              ].map((s, i) => (
                <div key={i} className="admin-stat-card">
                  <div className="admin-stat-icon" style={{ background: 'rgba(57,255,20,0.1)', color: 'var(--primary)' }}>{s.icon}</div>
                  <div>
                    <p className="admin-stat-valor">{s.valor}</p>
                    <p className="admin-stat-label">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* UTILIZADORES */}
        {abaAtiva === 'utilizadores' && (
          <div className="admin-conteudo">
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)' }}>Gestão de Utilizadores</h3>
              </div>
              <div className="admin-tabela-wrapper">
                <table className="admin-tabela">
                  <thead><tr><th>Utilizador</th><th>Email</th><th>Role</th><th>Jogos</th><th>Registado</th><th>Estado</th><th>Ações</th></tr></thead>
                  <tbody>
                    {utilizadores.map(u => (
                      <tr key={u.id} style={{ opacity: u.ativo ? 1 : 0.5 }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div className="avatar" style={{ width: 26, height: 26, fontSize: '0.6rem' }}>{getInitials(u.nome)}</div>
                            <span style={{ fontWeight: 600, fontSize: '0.825rem' }}>{u.nome}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</td>
                        <td><span className={`badge ${u.role === 'admin' ? 'badge-green' : 'badge-gray'}`}>{u.role === 'admin' ? 'Admin' : 'User'}</span></td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--primary)' }}>{u.total_jogos || 0}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatarData(u.created_at)}</td>
                        <td><span className={`badge ${u.ativo ? 'badge-green' : 'badge-gray'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                        <td>
                          {u.id !== utilizador?.id ? (
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button className="btn btn-ghost btn-xs" onClick={() => handleAlterarRole(u.id, u.nome, u.role)}>{u.role === 'admin' ? '⬇️' : '⬆️'}</button>
                              <button className={`btn btn-xs ${u.ativo ? 'btn-danger' : 'btn-ghost'}`} onClick={() => handleToggleAtivo(u.id, u.nome)}>{u.ativo ? '🚫' : '✅'}</button>
                            </div>
                          ) : <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(tu)</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TODOS OS JOGOS */}
        {abaAtiva === 'jogos' && (
          <div className="admin-conteudo">
            <div className="card">
              <h3 style={{ marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>Todos os Jogos</h3>
              <div className="admin-tabela-wrapper">
                <table className="admin-tabela">
                  <thead><tr><th>ID</th><th>Título</th><th>Local</th><th>Data</th><th>Tipo</th><th>Estado</th><th>Jogadores</th><th>Criador</th><th>Ações</th></tr></thead>
                  <tbody>
                    {todosJogos.map(jogo => {
                      const est = getEstadoJogo(jogo);
                      return (
                        <tr key={jogo.id} style={{ opacity: est.label === 'Cancelado' ? 0.5 : 1 }}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>#{jogo.id}</td>
                          <td style={{ fontWeight: 600, fontSize: '0.825rem' }}>{jogo.titulo}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{jogo.local || '—'}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatarData(jogo.data_jogo)}</td>
                          <td><span className="jogo-tipo">{jogo.tipo_jogo || '5x5'}</span></td>
                          <td><span className={`badge ${est.cls}`}>{est.label}</span></td>
                          <td>
                            <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{jogo.total_inscritos}/{jogo.max_jogadores}</span>
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{jogo.criador_nome || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <Link to={`/jogos/${jogo.id}`} className="btn btn-ghost btn-xs">👁️</Link>
                              <button className="btn btn-danger btn-xs" onClick={() => handleEliminarJogo(jogo)}><IconTrash size="0.9rem" color="#fff" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TODAS AS EQUIPAS */}
        {abaAtiva === 'equipas' && (
          <div className="admin-conteudo">
            <div className="card">
              <h3 style={{ marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>Todas as Equipas</h3>
              <div className="admin-tabela-wrapper">
                <table className="admin-tabela">
                  <thead><tr><th>Nome</th><th>Membros</th><th>Fundador</th><th>Região</th><th>Nível</th><th>Ações</th></tr></thead>
                  <tbody>
                    {equipas.map(eq => {
                      const nc = NIVEL_COR[eq.nivel] || NIVEL_COR['Descontraído'];
                      return (
                        <tr key={eq.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <EmblemaEquipa emblema={eq.emblema} alt={eq.nome} tamanho="28px" />
                              <span style={{ fontWeight: 600, fontSize: '0.825rem' }}>{eq.nome}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--primary)' }}>{eq.total_membros}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{eq.capitao_nome}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{eq.regiao || '—'}</td>
                          <td>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: nc.bg, color: nc.cor, border: `1px solid ${nc.borda}` }}>{eq.nivel}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <Link to={`/equipas/${eq.id}`} className="btn btn-ghost btn-xs">👁️</Link>
                              <button className="btn btn-danger btn-xs" onClick={() => handleEliminarEquipa(eq)}><IconTrash size="0.9rem" color="#fff" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* NOTAS GLOBAIS */}
        {abaAtiva === 'notas' && (
          <div className="admin-conteudo">
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ marginBottom: '0.25rem', fontFamily: 'var(--font-heading)' }}>📢 Publicar Nota Global</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Envia uma notificação para todos os utilizadores ativos da plataforma.
              </p>
              <form onSubmit={handleCriarNota} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                    Título *
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: Manutenção agendada para sábado"
                    value={notaForm.titulo}
                    onChange={(e) => setNotaForm({ ...notaForm, titulo: e.target.value })}
                    maxLength={120}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                    Mensagem *
                  </label>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="Detalhes da nota..."
                    value={notaForm.mensagem}
                    onChange={(e) => setNotaForm({ ...notaForm, mensagem: e.target.value })}
                    maxLength={800}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                    Expira em (opcional)
                  </label>
                  <DatePickerFB
                    mode="datetime"
                    value={notaForm.expira_em}
                    onChange={(v) => setNotaForm({ ...notaForm, expira_em: v })}
                    placeholder="Sem expiração"
                  />
                  <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Se definido, as notificações desaparecem automaticamente após esta data.
                  </small>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={notaEnviando}>
                    {notaEnviando ? 'A publicar...' : '📣 Publicar e Notificar Todos'}
                  </button>
                </div>
              </form>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>Histórico de Notas</h3>
              {notas.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
                  Ainda não foram publicadas notas.
                </p>
              ) : (
                <div className="admin-tabela-wrapper">
                  <table className="admin-tabela">
                    <thead>
                      <tr><th>Título</th><th>Mensagem</th><th>Publicado por</th><th>Data</th><th>Expira</th><th>Ações</th></tr>
                    </thead>
                    <tbody>
                      {notas.map(n => (
                        <tr key={n.id}>
                          <td style={{ fontWeight: 600, fontSize: '0.825rem' }}>{n.titulo}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 360 }}>
                            {n.mensagem?.length > 120 ? n.mensagem.slice(0, 120) + '…' : n.mensagem}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{n.admin_nome || '—'}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatarData(n.created_at)}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{n.expira_em ? formatarData(n.expira_em) : '—'}</td>
                          <td>
                            <button className="btn btn-danger btn-xs" onClick={() => handleEliminarNota(n)}><IconTrash size="0.9rem" color="#fff" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {abaAtiva === 'candidaturas' && (
          <AdminCandidaturas mostrarMensagem={mostrarMensagem} />
        )}

        {abaAtiva === 'suporte' && (
          <AdminSuporte mostrarMensagem={mostrarMensagem} />
        )}

      </div>
    </div>
  );
}

// ── ADMIN · Suporte (inbox) ─────────────────────────────────
function AdminSuporte({ mostrarMensagem }) {
  const { addToast } = useToast();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('aberta');
  const [ver, setVer] = useState(null);
  const [resposta, setResposta] = useState('');
  const [stats, setStats] = useState({ aberta: 0, em_analise: 0, resolvida: 0, arquivada: 0 });

  const carregar = async (estado = filtro) => {
    setLoading(true);
    try {
      const q = estado === 'todas' ? '' : `?estado=${estado}`;
      const { data } = await api.get(`/admin/suporte${q}`);
      setLista(data.mensagens || []);
      const st = await api.get('/admin/suporte/stats');
      setStats(st.data.stats || {});
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [filtro]);

  const mudarEstado = async (id, estado) => {
    try {
      await api.put(`/admin/suporte/${id}`, { estado });
      mostrarMensagem(`Estado atualizado: ${estado}.`);
      carregar();
      setVer(v => v && v.id === id ? { ...v, estado } : v);
    } catch { addToast('Erro.', 'error'); }
  };

  const enviarResposta = async () => {
    if (!resposta.trim()) return;
    try {
      await api.put(`/admin/suporte/${ver.id}`, { resposta, estado: 'resolvida' });
      mostrarMensagem('Resposta enviada e caso marcado como resolvido.');
      setVer(null);
      setResposta('');
      carregar();
    } catch { addToast('Erro a enviar resposta.', 'error'); }
  };

  const badge = (estado) => ({
    aberta:      { cls: 'warn', t: '🆕 Aberta' },
    em_analise:  { cls: 'warn', t: '👀 Em análise' },
    resolvida:   { cls: 'ok',   t: '✅ Resolvida' },
    arquivada:   { cls: 'bad',  t: '📁 Arquivada' },
  }[estado] || { cls: '', t: estado });

  return (
    <section className="dono-card" style={{ margin: 0 }}>
      <div className="row-between">
        <h2>Inbox de Suporte</h2>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          {[
            ['aberta', `🆕 Abertas (${stats.aberta || 0})`],
            ['em_analise', `👀 Em análise (${stats.em_analise || 0})`],
            ['resolvida', `✅ Resolvidas (${stats.resolvida || 0})`],
            ['arquivada', `📁 Arquivadas (${stats.arquivada || 0})`],
            ['todas', 'Todas'],
          ].map(([k, l]) => (
            <button key={k} className={filtro === k ? 'btn-primary' : 'btn-ghost'}
                    onClick={() => setFiltro(k)}>{l}</button>
          ))}
        </div>
      </div>

      {loading && <div className="spinner" />}
      {!loading && lista.length === 0 && <p className="empty">Sem mensagens neste estado.</p>}

      <ul className="agenda-list">
        {lista.map(m => (
          <li key={m.id} className="agenda-item" style={{ cursor: 'pointer' }} onClick={() => setVer(m)}>
            <div>
              <strong>{m.assunto}</strong>
              <div className="tiny">
                {m.utilizador_nome || m.nome || 'Anónimo'}
                {(m.utilizador_email || m.email) && ` · ${m.utilizador_email || m.email}`}
              </div>
              <div className="tiny">{new Date(m.created_at).toLocaleString('pt-PT')}</div>
            </div>
            <div className="right">
              <span className={`badge ${badge(m.estado).cls}`}>{badge(m.estado).t}</span>
            </div>
          </li>
        ))}
      </ul>

      {ver && (
        <div className="modal-backdrop" onClick={() => setVer(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <header>
              <h3>{ver.assunto}</h3>
              <button className="close" onClick={() => setVer(null)}>×</button>
            </header>
            <div style={{ padding: '0 1.25rem 1rem' }}>
              <p className="tiny">
                De: <b>{ver.utilizador_nome || ver.nome || 'Anónimo'}</b>
                {(ver.utilizador_email || ver.email) && <> · {ver.utilizador_email || ver.email}</>}
                <br />
                {new Date(ver.created_at).toLocaleString('pt-PT')} · <span className={`badge ${badge(ver.estado).cls}`}>{badge(ver.estado).t}</span>
              </p>
              <div style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', padding: '1rem', whiteSpace: 'pre-wrap',
                            marginBottom: '1rem' }}>
                {ver.mensagem}
              </div>

              {ver.resposta_admin && (
                <>
                  <div className="tiny"><b>Resposta já enviada</b> {ver.respondida_por_nome && `por ${ver.respondida_por_nome}`}:</div>
                  <div style={{ background: 'var(--primary-soft)', border: '1px solid var(--primary)',
                                borderRadius: 'var(--radius-sm)', padding: '1rem', whiteSpace: 'pre-wrap',
                                marginBottom: '1rem' }}>
                    {ver.resposta_admin}
                  </div>
                </>
              )}

              {ver.estado !== 'resolvida' && ver.estado !== 'arquivada' && (
                <label>
                  Responder (envia notificação ao utilizador e marca como resolvida):
                  <textarea rows={5} value={resposta} onChange={e => setResposta(e.target.value)}
                            placeholder="A tua resposta…"
                            style={{ width: '100%', marginTop: '.3rem', padding: '.6rem',
                                     background: 'var(--bg-input)', color: 'var(--text)',
                                     border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }} />
                </label>
              )}
            </div>
            <div className="modal-actions">
              {ver.estado === 'aberta' && (
                <button className="btn-ghost" onClick={() => mudarEstado(ver.id, 'em_analise')}>Marcar em análise</button>
              )}
              {ver.estado !== 'arquivada' && (
                <button className="btn-ghost" onClick={() => mudarEstado(ver.id, 'arquivada')}>Arquivar</button>
              )}
              {ver.estado !== 'resolvida' && resposta.trim() && (
                <button className="btn-primary" onClick={enviarResposta}>📨 Enviar Resposta</button>
              )}
              {ver.estado !== 'resolvida' && !resposta.trim() && (
                <button className="btn-primary" onClick={() => mudarEstado(ver.id, 'resolvida')}>Marcar Resolvida</button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AdminCandidaturas({ mostrarMensagem }) {
  const confirmar = useConfirm();
  const perguntar = usePrompt();
  const { addToast } = useToast();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('pendente');
  const [ver, setVer] = useState(null);

  const carregar = async (estado = filtro) => {
    setLoading(true);
    try {
      const q = estado === 'todas' ? '' : `?estado=${estado}`;
      const { data } = await api.get(`/admin/candidaturas${q}`);
      setLista(data.candidaturas || []);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [filtro]);

  const acao = async (id, tipo) => {
    let nota = '';
    if (tipo === 'rejeitar') {
      const r = await perguntar({
        titulo: 'Rejeitar candidatura',
        mensagem: 'Motivo da rejeição (opcional). O candidato vê esta mensagem.',
        placeholder: 'Ex: Documentação insuficiente…',
        multiline: true,
        confirmarLabel: 'Rejeitar',
        variante: 'danger',
      });
      if (r === null) return;
      nota = r || '';
    } else if (tipo === 'pedir-info') {
      const r = await perguntar({
        titulo: 'Pedir mais informações',
        mensagem: 'O que falta? O candidato vê esta mensagem.',
        placeholder: 'Ex: Falta foto do campo…',
        multiline: true,
        obrigatorio: true,
        confirmarLabel: 'Enviar pedido',
      });
      if (!r) return;
      nota = r;
    }
    if (tipo === 'aprovar') {
      const ok = await confirmar({
        titulo: 'Aprovar candidatura?',
        mensagem: 'Vai criar o campo e promover o utilizador a dono.',
        confirmarLabel: 'Aprovar',
      });
      if (!ok) return;
    }
    try {
      await api.put(`/admin/candidaturas/${id}/${tipo}`, { nota });
      mostrarMensagem(tipo === 'aprovar' ? '✅ Candidatura aprovada.' : tipo === 'rejeitar' ? 'Rejeitada.' : 'Pedido enviado.');
      setVer(null);
      carregar();
    } catch (e) {
      addToast(e.response?.data?.mensagem || 'Erro.', 'error');
    }
  };

  const estadoBadge = (e) => ({
    pendente:        { cls: 'warn', t: '⏳ Pendente' },
    info_requerida:  { cls: 'warn', t: 'ℹ️ Info pedida' },
    aprovada:        { cls: 'ok',   t: '✅ Aprovada' },
    rejeitada:       { cls: 'bad',  t: '❌ Rejeitada' },
  }[e] || { cls: '', t: e });

  return (
    <div className="admin-conteudo">
      <div className="card">
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {['pendente', 'info_requerida', 'aprovada', 'rejeitada', 'todas'].map(e => (
            <button key={e}
              className={`btn btn-sm ${filtro === e ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFiltro(e)}>{e}</button>
          ))}
        </div>

        {loading ? <p>A carregar…</p> : lista.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Nenhuma candidatura nesse estado.</p>
        ) : (
          <div className="admin-tabela-wrapper">
            <table className="admin-tabela">
              <thead>
                <tr><th>Candidato</th><th>Campo</th><th>Região</th><th>Preço/h</th><th>Estado</th><th>Data</th><th>Ação</th></tr>
              </thead>
              <tbody>
                {lista.map(c => {
                  const b = estadoBadge(c.estado);
                  return (
                    <tr key={c.id}>
                      <td>
                        <b>{c.candidato_nome}</b><br/>
                        <span style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>{c.candidato_email}</span>
                      </td>
                      <td>{c.nome}</td>
                      <td>{c.regiao || '—'}</td>
                      <td>{c.preco_hora_cents ? `€${(c.preco_hora_cents/100).toFixed(2)}` : '—'}</td>
                      <td><span className={`badge ${b.cls}`}>{b.t}</span></td>
                      <td style={{ fontSize: '.75rem' }}>{new Date(c.created_at).toLocaleDateString('pt-PT')}</td>
                      <td><button className="btn btn-sm btn-primary" onClick={() => setVer(c)}>Ver</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ver && (
        <div className="modal-backdrop" onClick={() => setVer(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <header>
              <h3>{ver.nome}</h3>
              <button className="close" onClick={() => setVer(null)}>×</button>
            </header>
            <div style={{ padding: '1rem 1.25rem', display: 'grid', gap: '.75rem' }}>
              <div><b>Candidato:</b> {ver.candidato_nome} ({ver.candidato_email})</div>
              <div><b>Telefone:</b> {ver.telefone || '—'}</div>
              <div><b>Morada:</b> {ver.morada || '—'}</div>
              <div><b>Região:</b> {ver.regiao || '—'}</div>
              <div><b>Tipo de piso:</b> {ver.tipo_piso || '—'}</div>
              <div><b>Preço/hora:</b> {ver.preco_hora_cents ? `€${(ver.preco_hora_cents/100).toFixed(2)}` : '—'}</div>
              {ver.nota_candidato && <div><b>Nota do candidato:</b> {ver.nota_candidato}</div>}

              {ver.fotos_json && (() => {
                let fotos = []; try { fotos = JSON.parse(ver.fotos_json); } catch {}
                return fotos.length > 0 ? (
                  <div>
                    <b>Fotos do campo:</b>
                    <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
                      {fotos.map((u, i) => (
                        <a key={i} href={u} target="_blank" rel="noreferrer">
                          <img src={u} alt="" style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 6 }} />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {ver.prova_url && (
                <div>
                  <b>Prova de Titularidade:</b>{' '}
                  <a href={ver.prova_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">📄 Abrir ↗</a>
                </div>
              )}

              {ver.nota_admin && (
                <div style={{ background: 'var(--bg-subtle, #f9f9f9)', padding: '.75rem', borderRadius: 6 }}>
                  <b>Nota do admin:</b> {ver.nota_admin}
                </div>
              )}

              {(ver.estado === 'pendente' || ver.estado === 'info_requerida') && (
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '1rem', borderTop: '1px solid var(--border, #eee)', paddingTop: '1rem' }}>
                  <button className="btn btn-ghost" onClick={() => acao(ver.id, 'pedir-info')}><IconInfo size="0.85em" /> Pedir Info</button>
                  <button className="btn" style={{ background: '#dc2626', color: '#fff' }} onClick={() => acao(ver.id, 'rejeitar')}>Rejeitar</button>
                  <button className="btn btn-primary" onClick={() => acao(ver.id, 'aprovar')}>Aprovar</button>
                </div>
              )}

              {ver.estado === 'aprovada' && ver.campo_id && (
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '1rem', borderTop: '1px solid var(--border, #eee)', paddingTop: '1rem' }}>
                  <button className="btn btn-ghost" onClick={async () => {
                    const msg = await perguntar({
                      titulo: 'Pedir mais informação ao dono',
                      mensagem: 'Que informações precisas? O dono recebe esta mensagem.',
                      placeholder: 'Ex: Atualizar fotos, comprovativo de luz…',
                      multiline: true,
                      obrigatorio: true,
                      confirmarLabel: 'Enviar',
                    });
                    if (!msg) return;
                    try {
                      await api.post(`/admin/campos/${ver.campo_id}/pedir-info`, { mensagem: msg });
                      mostrarMensagem('Pedido de informação enviado ao dono.');
                    } catch (e) { addToast(e.response?.data?.mensagem || 'Erro.', 'error'); }
                  }}><IconMail size="0.85em" /> Pedir Mais Info</button>
                  <button className="btn" style={{ background: '#dc2626', color: '#fff' }} onClick={async () => {
                    const ok = await confirmar({
                      titulo: 'Eliminar campo?',
                      mensagem: `"${ver.nome}" será removido da plataforma. Se tiver registos associados (jogos, reservas), ficará apenas marcado como removido.`,
                      confirmarLabel: 'Eliminar',
                      variante: 'danger',
                    });
                    if (!ok) return;
                    try {
                      const { data } = await api.delete(`/admin/campos/${ver.campo_id}`);
                      // Backend devolve { sucesso, hardDelete, mensagem }
                      mostrarMensagem(data?.mensagem || 'Campo eliminado.');
                      setVer(null); carregar();
                    } catch (e) {
                      addToast(e.response?.data?.mensagem || 'Erro a eliminar campo.', 'error');
                    }
                  }}><IconTrash size="0.85em" color="#fff" /> Eliminar Campo</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
