// ============================================================
//  FutBuddies - Criar Equipa
// ============================================================

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../utils/api';
import { REGIOES, NIVEIS, NIVEL_COR, EMBLEMAS, resolverImgUrl } from '../utils/constantes';
import ImageUpload from '../components/ImageUpload';
import './Equipas.css';

export default function CriarEquipa() {
  const { isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: '', emblema: '⚽', emblemaUrl: null, descricao: '', nivel: 'Descontraído', regiao: '', aRecrutar: false, visibilidade: 'publica', aceitarPedidos: false });
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [codigoCriado, setCodigoCriado] = useState(null);

  if (!isAuthenticated) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', flexDirection: 'column', gap: '1rem' }}>
      <h2>Precisas de estar autenticado</h2>
      <Link to="/login" className="btn btn-primary">Fazer Login</Link>
    </div>
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    if (!form.nome.trim()) return setErro('O nome da equipa é obrigatório.');
    if (!form.regiao) return setErro('Escolhe a região base da equipa.');
    setLoading(true);
    try {
      const dadosEquipa = { ...form, emblema: form.emblemaUrl || form.emblema };
      const res = await api.post('/equipas', dadosEquipa);
      addToast('Equipa criada!', 'success');
      if (res.data.codigoAcesso) setCodigoCriado({ codigo: res.data.codigoAcesso, equipaId: res.data.equipaId });
      else navigate(`/equipas/${res.data.equipaId}`);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao criar equipa.');
    } finally { setLoading(false); }
  };

  const nc = NIVEL_COR[form.nivel] || NIVEL_COR['Descontraído'];

  // Mostrar código de acesso após criar equipa privada
  if (codigoCriado) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '2rem' }}>
      <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '2.5rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ marginBottom: '0.5rem' }}>Equipa Privada Criada!</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Partilha este código com os jogadores para que possam entrar na equipa.
        </p>
        <div style={{ background: 'var(--bg-input)', border: '2px dashed var(--primary)', borderRadius: 'var(--radius-lg)',
          padding: '1.5rem', marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '1px' }}>CODIGO DE ACESSO</p>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '6px' }}>
            {codigoCriado.codigo}
          </p>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          O código fica sempre visível na página da equipa para o capitão.
        </p>
        <button className="btn btn-primary btn-lg w-full" onClick={() => navigate(`/equipas/${codigoCriado.equipaId}`)}>
          Ver a Minha Equipa →
        </button>
      </div>
    </div>
  );

  return (
    <div className="criar-jogo-page">
      <div className="container">
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          <Link to="/equipas" style={{ color: 'var(--primary)' }}>← Voltar às Equipas</Link>
        </p>
        <div className="criar-jogo-container">
          <div className="criar-jogo-header">
            <h1>🏆 Criar Nova Equipa</h1>
            <p>Define o perfil da tua equipa</p>
          </div>
          {erro && <div className="auth-error">{erro}</div>}
          <form onSubmit={handleSubmit} className="criar-jogo-form">

            {/* Visibilidade */}
            <div className="form-field">
              <label>Tipo de Equipa</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { v: 'publica', icon: '🌐', titulo: 'Pública', desc: 'Qualquer jogador pode entrar livremente.' },
                  { v: 'privada', icon: '🔒', titulo: 'Privada', desc: 'Entrada só com código de acesso.' },
                ].map(opt => (
                  <button key={opt.v} type="button" onClick={() => setForm(f => ({ ...f, visibilidade: opt.v }))}
                    className={`tipo-jogo-btn ${form.visibilidade === opt.v ? 'active' : ''}`}
                    style={{ flexDirection: 'column', gap: '0.25rem', padding: '1rem', textAlign: 'left' }}>
                    <span style={{ fontSize: '1.5rem' }}>{opt.icon}</span>
                    <span className="tipo-jogo-value">{opt.titulo}</span>
                    <span className="tipo-jogo-label" style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {form.visibilidade === 'privada' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input type="checkbox" id="aceitarPedidos" checked={form.aceitarPedidos}
                  onChange={e => setForm({ ...form, aceitarPedidos: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="aceitarPedidos" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                  📩 Permitir pedidos de entrada (jogadores podem pedir para entrar sem código)
                </label>
              </div>
            )}

            {/* Emblema */}
            <div className="form-field">
              <label>Emblema da Equipa</label>
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Upload de imagem */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', alignItems: 'center' }}>
                  <ImageUpload
                    valor={form.emblemaUrl || null}
                    onChange={url => setForm(f => ({ ...f, emblemaUrl: url, emblema: null }))}
                    placeholder={form.emblema || '🏆'}
                    forma="quadrado"
                    tamanho={80}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Imagem (PNG/JPG)</span>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Ou escolhe um emoji:</p>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', maxWidth: 340 }}>
                    {EMBLEMAS.map(e => (
                      <button key={e} type="button"
                        onClick={() => setForm(f => ({ ...f, emblema: e, emblemaUrl: null }))}
                        style={{ width: 40, height: 40, fontSize: '1.3rem', borderRadius: 'var(--radius)',
                          border: `2px solid ${form.emblema === e && !form.emblemaUrl ? 'var(--primary)' : 'var(--border)'}`,
                          background: form.emblema === e && !form.emblemaUrl ? 'var(--primary-glow)' : 'transparent',
                          cursor: 'pointer', transition: 'all 0.15s' }}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Nome da Equipa *</label>
                <input type="text" placeholder="Ex: Leões do Bairro" value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })} required autoFocus maxLength={100} />
              </div>
              <div className="form-field">
                <label>Região Base *</label>
                <select value={form.regiao} onChange={e => setForm({ ...form, regiao: e.target.value })} required>
                  <option value="">Seleciona a região</option>
                  {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="form-field">
              <label>Nível / Estilo de Jogo</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {NIVEIS.map(n => {
                  const nc2 = NIVEL_COR[n];
                  return (
                    <button key={n} type="button" onClick={() => setForm(f => ({ ...f, nivel: n }))}
                      style={{ flex: 1, padding: '0.625rem', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.875rem',
                        border: `1.5px solid ${form.nivel === n ? nc2.borda : 'var(--border)'}`,
                        background: form.nivel === n ? nc2.bg : 'transparent',
                        color: form.nivel === n ? nc2.cor : 'var(--text-muted)', fontWeight: form.nivel === n ? 700 : 400, transition: 'all 0.15s' }}>
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-field">
              <label>Descrição</label>
              <textarea placeholder="Descreve a equipa, o estilo de jogo, quando treina..." value={form.descricao}
                onChange={e => setForm({ ...form, descricao: e.target.value })} rows={3} style={{ resize: 'vertical' }} maxLength={500} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input type="checkbox" id="recrutar" checked={form.aRecrutar}
                onChange={e => setForm({ ...form, aRecrutar: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="recrutar" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                🔍 Marcar como <strong>"À procura de jogadores"</strong>
              </label>
            </div>

            {/* Preview */}
            <div className="criar-jogo-preview card">
              <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>RESUMO</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                {form.emblemaUrl
                  ? <img src={resolverImgUrl(form.emblemaUrl)} alt="emblema" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                  : <span style={{ fontSize: '2rem' }}>{form.emblema}</span>}
                <div>
                  <p style={{ fontWeight: 700, fontSize: '1.05rem' }}>{form.nome || 'Nome da Equipa'}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    📍 {form.regiao || 'Região'} &nbsp;·&nbsp;
                    <span style={{ color: nc.cor, fontWeight: 600 }}>{form.nivel}</span>
                    {form.aRecrutar && ' · 🔍 Recrutar'}
                  </p>
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
              {loading ? 'A criar equipa...' : '🏆 Criar Equipa'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
