// ============================================================
//  FutBuddies - Perfil do Utilizador (v2)
// ============================================================

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../utils/api';
import { REGIOES, POSICOES, PES } from '../utils/constantes';
import ImageUpload from '../components/ImageUpload';
import Emblema from '../components/Emblema';
import HistoricoPerfil from '../components/HistoricoPerfil';
import Conquistas from '../components/Conquistas';
import Carteira from '../components/Carteira';
import PushToggle from '../components/PushToggle';
import './Perfil.css';

export default function Perfil() {
  const { utilizador: authUser, logout, atualizarUtilizador } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showWelcome, setShowWelcome] = useState(searchParams.get('welcome') === '1');
  const dispensarWelcome = () => {
    setShowWelcome(false);
    sessionStorage.removeItem('fb_first_login');
    // remove ?welcome=1 do URL
    const next = new URLSearchParams(searchParams);
    next.delete('welcome');
    setSearchParams(next, { replace: true });
  };
  const [perfil, setPerfil] = useState(null);
  const [equipa, setEquipa] = useState(null);
  const [form, setForm] = useState({ posicao:'', cidade:'', bio:'', nickname:'', pePreferido:'', regiao:'', fotoUrl:'', perfilPublico: true });
  const [passForm, setPassForm] = useState({ passwordAtual:'', novaPassword:'', confirmar:'' });
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('perfil');
  const [eliminarConfirm, setEliminarConfirm] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/utilizadores/perfil'),
      api.get(`/utilizadores/me/equipa`).catch(() => ({ data: { equipa: null } })),
    ]).then(([perfilRes, equipaRes]) => {
      const u = perfilRes.data.utilizador;
      setPerfil(u);
      setEquipa(equipaRes.data.equipa);
      setForm({ posicao: u.posicao||'', cidade: u.cidade||'', bio: u.bio||'',
        nickname: u.nickname||'', pePreferido: u.pe_preferido||'', regiao: u.regiao||'', fotoUrl: u.foto_url||'',
        perfilPublico: u.perfil_publico === undefined ? true : !!u.perfil_publico });
    }).catch(() => addToast('Erro ao carregar perfil.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleSalvar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.put('/utilizadores/perfil', form);
      addToast('Perfil atualizado!', 'success');
      setPerfil(p => ({ ...p, ...form, pe_preferido: form.pePreferido, foto_url: form.fotoUrl, perfil_publico: form.perfilPublico ? 1 : 0 }));
      atualizarUtilizador({ nickname: form.nickname, foto_url: form.fotoUrl });
    } catch { addToast('Erro ao guardar.', 'error'); }
    finally { setGuardando(false); }
  };

  const handleAlterarPass = async (e) => {
    e.preventDefault();
    if (passForm.novaPassword !== passForm.confirmar)
      return addToast('As passwords não coincidem.', 'error');
    if (passForm.novaPassword.length < 6)
      return addToast('A nova password deve ter pelo menos 6 caracteres.', 'error');
    try {
      await api.put('/utilizadores/password', { passwordAtual: passForm.passwordAtual, novaPassword: passForm.novaPassword });
      addToast('Password alterada com sucesso!', 'success');
      setPassForm({ passwordAtual:'', novaPassword:'', confirmar:'' });
    } catch (err) { addToast(err.response?.data?.mensagem || 'Erro ao alterar password.', 'error'); }
  };

  const handleEliminarConta = async () => {
    if (!eliminarConfirm) return addToast('Introduz a tua password para confirmar.', 'error');
    try {
      await api.delete('/utilizadores/conta', { data: { password: eliminarConfirm } });
      addToast('Conta eliminada.', 'info');
      logout();
      navigate('/');
    } catch (err) { addToast(err.response?.data?.mensagem || 'Erro ao eliminar conta.', 'error'); }
  };

  const getInitials = (nome) => nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem' }}><div className="spinner" /></div>;

  return (
    <div className="perfil-page">
      <div className="container" style={{ maxWidth: 860 }}>

        {/* Banner de boas-vindas (primeiro login após registo) */}
        {showWelcome && (
          <div className="perfil-welcome card" role="status">
            <div className="perfil-welcome-icon">⚽</div>
            <div className="perfil-welcome-body">
              <h3>Bem-vindo ao FutBuddies, {authUser?.nome?.split(' ')[0] || 'jogador'}!</h3>
              <p>Para começares, personaliza o teu perfil: foto, posição, região e nickname.
                 Outros jogadores vão ver-te assim quando entrares em jogos e equipas.</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={dispensarWelcome}>
              Mais tarde
            </button>
          </div>
        )}

        {/* Header */}
        <div className="perfil-header card" style={{ marginBottom: '1.5rem' }}>
          <div className="perfil-avatar" style={{ position: 'relative', background: 'transparent', border: 'none', overflow: 'visible' }}>
            <ImageUpload
              valor={perfil?.foto_url || form.fotoUrl}
              onChange={async (url) => {
                setForm(f => ({ ...f, fotoUrl: url }));
                setPerfil(p => ({ ...p, foto_url: url }));
                atualizarUtilizador({ foto_url: url });
                try { await api.put('/utilizadores/perfil', { ...form, fotoUrl: url }); }
                catch {}
              }}
              placeholder={getInitials(perfil?.nome)}
              forma="circulo"
              tamanho={80}
            />
          </div>
          <div className="perfil-info">
            <h1>{perfil?.nickname || perfil?.nome}</h1>
            {perfil?.nickname && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{perfil.nome}</p>}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{perfil?.email}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
              {perfil?.regiao && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📍 {perfil.regiao}</span>}
              {perfil?.posicao && <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>{perfil.posicao}</span>}
              {perfil?.pe_preferido && <span className="badge badge-gray" style={{ fontSize: '0.75rem' }}>🦶 {perfil.pe_preferido}</span>}
              <span className="perfil-role">{perfil?.role === 'admin' ? '🛡️ Admin' : '⚽ Jogador'}</span>
            </div>
            {equipa && (
              <Link to={`/equipas/${equipa.id}`} style={{ textDecoration: 'none', marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                fontSize: '0.8rem', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-sm)', padding: '2px 8px' }}>
                <Emblema valor={equipa.emblema} tamanho={18} inline /> {equipa.nome} · {equipa.papel === 'capitao' ? '👑 Capitão' : 'Membro'}
              </Link>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="perfil-stats" style={{ marginBottom: '1.5rem' }}>
          {[
            { num: perfil?.total_jogos||0, label: 'Jogos' },
            { num: perfil?.total_golos||0, label: 'Golos' },
            { num: perfil?.total_assistencias||0, label: 'Assistências' },
          ].map((s, i) => (
            <div key={i} className="perfil-stat card">
              <span className="perfil-stat-num">{s.num}</span>
              <span className="perfil-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '2px solid var(--border)', marginBottom: '1.5rem' }}>
          {[['perfil','👤 Perfil'], ['historico','📊 Histórico'], ['conquistas','🏅 Conquistas'], ['carteira','💰 Carteira'], ['conta','⚙️ Conta']].map(([id, label]) => (
            <button key={id} onClick={() => setAbaAtiva(id)}
              style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, background: 'transparent', border: 'none',
                borderBottom: `2px solid ${abaAtiva === id ? 'var(--primary)' : 'transparent'}`, marginBottom: -2,
                color: abaAtiva === id ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── ABA PERFIL ── */}
        {abaAtiva === 'perfil' && (
          <div className="card">
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Editar Informação</h2>
            <form onSubmit={handleSalvar} className="perfil-form">
              <div className="grid-2">
                <div className="form-field">
                  <label>Nickname / Nome de Jogador</label>
                  <input type="text" placeholder="Como queres ser conhecido" value={form.nickname}
                    onChange={e => setForm({ ...form, nickname: e.target.value })} maxLength={50} />
                </div>
                <div className="form-field">
                  <label>Região Base</label>
                  <select value={form.regiao} onChange={e => setForm({ ...form, regiao: e.target.value })}>
                    <option value="">Seleciona a tua região</option>
                    {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-field">
                  <label>Posição</label>
                  <select value={form.posicao} onChange={e => setForm({ ...form, posicao: e.target.value })}>
                    <option value="">Seleciona a posição</option>
                    {POSICOES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Pé Preferido</label>
                  <select value={form.pePreferido} onChange={e => setForm({ ...form, pePreferido: e.target.value })}>
                    <option value="">Seleciona</option>
                    {PES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label>Fotografia de Perfil</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <ImageUpload
                    valor={form.fotoUrl}
                    onChange={url => setForm({ ...form, fotoUrl: url })}
                    placeholder="👤"
                    forma="circulo"
                    tamanho={72}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      Clica no círculo para carregar uma foto (PNG, JPG, até 5MB)
                    </p>
                    <input type="text" placeholder="Ou cola um URL de imagem" value={form.fotoUrl}
                      onChange={e => setForm({ ...form, fotoUrl: e.target.value })}
                      style={{ fontSize: '0.8rem' }} />
                  </div>
                </div>
              </div>
              <div className="form-field">
                <label>Cidade</label>
                <input type="text" placeholder="Ex: Lisboa" value={form.cidade}
                  onChange={e => setForm({ ...form, cidade: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Bio</label>
                <textarea placeholder="Conta um pouco sobre ti..." value={form.bio}
                  onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} style={{ resize: 'vertical' }} />
              </div>

              {/* Privacidade ---------------------------------------------- */}
              <div className="form-field" style={{
                background: 'var(--bg-elev-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '0.9rem 1rem',
              }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', cursor: 'pointer', marginBottom: 0 }}>
                  <span>
                    <strong style={{ display: 'block', fontSize: '0.92rem' }}>
                      {form.perfilPublico ? '🌐 Perfil Público' : '🔒 Perfil Privado'}
                    </strong>
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.4, display: 'block', marginTop: 4 }}>
                      {form.perfilPublico
                        ? 'Qualquer utilizador pode ver as tuas estatísticas, bio e jogos recentes.'
                        : 'Só os teus amigos podem ver detalhes. Aos outros aparece apenas o nome e a equipa.'}
                    </small>
                  </span>
                  <span style={{
                    position: 'relative',
                    width: 44, height: 24, flexShrink: 0,
                    background: form.perfilPublico ? 'var(--primary)' : 'var(--bg-elev-3)',
                    borderRadius: 999,
                    transition: 'background 0.2s',
                  }}>
                    <input type="checkbox" checked={form.perfilPublico}
                      onChange={e => setForm({ ...form, perfilPublico: e.target.checked })}
                      style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', margin: 0, cursor: 'pointer' }} />
                    <span style={{
                      position: 'absolute',
                      top: 3, left: form.perfilPublico ? 23 : 3,
                      width: 18, height: 18,
                      background: '#fff', borderRadius: '50%',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }} />
                  </span>
                </label>
              </div>

              <button type="submit" className="btn btn-primary" disabled={guardando}>
                {guardando ? 'A guardar...' : 'Guardar Alterações'}
              </button>
            </form>
          </div>
        )}

        {/* ── ABA CONTA ── */}
        {abaAtiva === 'historico' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <HistoricoPerfil />
          </div>
        )}

        {abaAtiva === 'conquistas' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <Conquistas />
          </div>
        )}

        {abaAtiva === 'carteira' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <Carteira />
          </div>
        )}

        {abaAtiva === 'conta' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Notificações Push */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <PushToggle />
            </div>

            {/* Info da conta */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Informações da Conta</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  ['Email', perfil?.email],
                  ['Membro desde', perfil?.created_at ? new Date(perfil.created_at).toLocaleDateString('pt-PT') : '—'],
                  ['Último login', perfil?.ultimo_login ? new Date(perfil.ultimo_login).toLocaleDateString('pt-PT') : '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alterar password */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>🔑 Alterar Password</h3>
              <form onSubmit={handleAlterarPass} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-field">
                  <label>Password Atual</label>
                  <input type="password" value={passForm.passwordAtual}
                    onChange={e => setPassForm({ ...passForm, passwordAtual: e.target.value })} required />
                </div>
                <div className="grid-2">
                  <div className="form-field">
                    <label>Nova Password</label>
                    <input type="password" placeholder="Mínimo 6 caracteres" value={passForm.novaPassword}
                      onChange={e => setPassForm({ ...passForm, novaPassword: e.target.value })} required />
                  </div>
                  <div className="form-field">
                    <label>Confirmar Nova Password</label>
                    <input type="password" value={passForm.confirmar}
                      onChange={e => setPassForm({ ...passForm, confirmar: e.target.value })} required />
                  </div>
                </div>
                <button type="submit" className="btn btn-outline" style={{ alignSelf: 'flex-start' }}>Alterar Password</button>
              </form>
            </div>

            {/* Sessão e conta */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Gestão de Conta</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={async () => { await logout(); navigate('/'); }}>
                  🚪 Terminar Sessão
                </button>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    ⚠️ Eliminar conta é permanente e irrecuperável. Todos os teus dados serão removidos.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="password" placeholder="Introduz a tua password para confirmar"
                      value={eliminarConfirm} onChange={e => setEliminarConfirm(e.target.value)}
                      style={{ maxWidth: 300 }} />
                    <button className="btn btn-danger btn-sm" onClick={handleEliminarConta}>
                      🗑️ Eliminar Conta
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
