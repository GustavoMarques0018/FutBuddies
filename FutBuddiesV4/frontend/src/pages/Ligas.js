// ============================================================
//  FutBuddies - Liga entre Amigos
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import Avatar from '../components/Avatar';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import './Ligas.css';

const TIPOS = { semanal: 'Semanal', mensal: 'Mensal', epoca: 'Época' };

// ── Modal: criar liga ────────────────────────────────────────
function ModalCriar({ onFechar, onCriada }) {
  const [nome, setNome]     = useState('');
  const [tipo, setTipo]     = useState('mensal');
  const [regras, setRegras] = useState('');
  const [premio, setPremio] = useState('');
  const [equipa, setEquipa] = useState(null);    // { id, nome }
  const [equipaLoad, setEquipaLoad] = useState(true);
  const [loading, setLoad]  = useState(false);
  const { addToast }        = useToast();

  // Buscar equipa do utilizador ao abrir
  useEffect(() => {
    api.get('/utilizadores/me/equipa')
      .then(r => setEquipa(r.data?.equipa || null))
      .catch(() => setEquipa(null))
      .finally(() => setEquipaLoad(false));
  }, []);

  const criar = async () => {
    if (!nome.trim()) return addToast('Nome obrigatório.', 'error');
    if (!equipa) return addToast('Precisas de pertencer a uma equipa para criar uma liga.', 'error');
    setLoad(true);
    try {
      const r = await api.post('/ligas', { nome, tipo, regras: regras || null, premio: premio || null });
      addToast(`Liga criada! Código: ${r.data.codigo}`, 'success', 6000);
      onCriada();
      onFechar();
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro.', 'error');
    } finally { setLoad(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
      onClick={e => e.target===e.currentTarget && onFechar()}>
      <div className="card" style={{ maxWidth:440, width:'100%', padding:'1.5rem', maxHeight:'90vh', overflowY:'auto' }}>
        <h3 style={{ margin:'0 0 1.25rem', fontFamily:'var(--font-display)' }}>⚽ Nova Liga</h3>

        {/* Equipa (obrigatória) */}
        <label className="form-label">Equipa</label>
        {equipaLoad ? (
          <p style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>A carregar…</p>
        ) : equipa ? (
          <div style={{ padding:'0.5rem 0.75rem', background:'var(--bg-elev-2)', borderRadius:'var(--radius-sm)',
            border:'1px solid var(--border)', fontSize:'0.875rem', marginBottom:'0.25rem', display:'flex', alignItems:'center', gap:'0.4rem' }}>
            🛡️ <strong>{equipa.nome}</strong>
            <span style={{ color:'var(--text-muted)', fontSize:'0.78rem', marginLeft:'auto' }}>equipa associada à liga</span>
          </div>
        ) : (
          <div style={{ padding:'0.6rem 0.75rem', background:'rgba(239,68,68,0.08)', border:'1px solid var(--danger,#ef4444)',
            borderRadius:'var(--radius-sm)', fontSize:'0.82rem', color:'var(--danger,#ef4444)' }}>
            ⚠️ Não pertences a nenhuma equipa. Cria ou junta-te a uma equipa primeiro.
          </div>
        )}

        <label className="form-label" style={{ marginTop:'1rem' }}>Nome da Liga</label>
        <input className="form-input" placeholder="Ex: Liga dos Amigos do João" value={nome}
          onChange={e=>setNome(e.target.value)} maxLength={100} />

        <label className="form-label" style={{ marginTop:'1rem' }}>Tipo</label>
        <div style={{ display:'flex', gap:'0.5rem' }}>
          {Object.entries(TIPOS).map(([k,v]) => (
            <button key={k} type="button"
              className={`btn btn-sm ${tipo===k ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTipo(k)}>{v}</button>
          ))}
        </div>

        <label className="form-label" style={{ marginTop:'1rem' }}>Regras <span style={{ color:'var(--text-muted)', fontWeight:400 }}>(opcional)</span></label>
        <textarea className="form-input" placeholder="Ex: 3 pontos por vitória, empate vale 1. Descida para os últimos 2…"
          value={regras} onChange={e=>setRegras(e.target.value)} maxLength={1000}
          style={{ minHeight:80, resize:'vertical' }} />

        <label className="form-label" style={{ marginTop:'1rem' }}>🏅 Prémio do Campeão <span style={{ color:'var(--text-muted)', fontWeight:400 }}>(opcional)</span></label>
        <input className="form-input" placeholder="Ex: Jantar pago pelos outros, troféu personalizado…"
          value={premio} onChange={e=>setPremio(e.target.value)} maxLength={500} />

        <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end', marginTop:'1.25rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={criar} disabled={loading || !equipa}>
            {loading ? '⏳' : 'Criar Liga'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: entrar com código ─────────────────────────────────
function ModalEntrar({ onFechar, onEntrou }) {
  const [codigo, setCodigo] = useState('');
  const [loading, setLoad]  = useState(false);
  const { addToast }        = useToast();

  const entrar = async () => {
    if (!codigo.trim()) return;
    setLoad(true);
    try {
      await api.post('/ligas/entrar', { codigo });
      addToast('Entraste na liga! ⚽', 'success');
      onEntrou();
      onFechar();
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Código inválido.', 'error');
    } finally { setLoad(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
      onClick={e => e.target===e.currentTarget && onFechar()}>
      <div className="card" style={{ maxWidth:360, width:'100%', padding:'1.5rem' }}>
        <h3 style={{ margin:'0 0 1.25rem', fontFamily:'var(--font-display)' }}>🔑 Entrar numa Liga</h3>
        <label className="form-label">Código da Liga</label>
        <input className="form-input" placeholder="Ex: AB1C2D" value={codigo}
          onChange={e => setCodigo(e.target.value.toUpperCase())} maxLength={10}
          style={{ textTransform:'uppercase', letterSpacing:'3px', textAlign:'center', fontSize:'1.1rem' }} />
        <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end', marginTop:'1.25rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={entrar} disabled={loading || !codigo.trim()}>
            {loading ? '⏳' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detalhe da Liga (tabela + jogos) ─────────────────────────
function Detalheliga({ ligaId, meuId, onVoltar }) {
  const [dados, setDados]     = useState(null);
  const [loading, setLoad]    = useState(true);
  const [jogoId, setJogoId]   = useState('');
  const [addLoad, setAddLoad] = useState(false);
  const { addToast }          = useToast();

  const carregar = useCallback(() => {
    setLoad(true);
    api.get(`/ligas/${ligaId}`)
      .then(r => setDados(r.data))
      .catch(() => {})
      .finally(() => setLoad(false));
  }, [ligaId]);

  useEffect(() => { carregar(); }, [carregar]);

  const adicionarJogo = async () => {
    if (!jogoId) return;
    setAddLoad(true);
    try {
      await api.post(`/ligas/${ligaId}/jogos`, { jogoId: parseInt(jogoId) });
      addToast('Jogo adicionado!', 'success');
      setJogoId('');
      carregar();
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro.', 'error');
    } finally { setAddLoad(false); }
  };

  const encerrar = async () => {
    if (!window.confirm('Tens a certeza que queres encerrar esta liga?')) return;
    try {
      await api.delete(`/ligas/${ligaId}`);
      addToast('Liga encerrada.', 'info');
      onVoltar();
    } catch {}
  };

  if (loading) return <div style={{ padding:'3rem', display:'flex', justifyContent:'center' }}><div className="spinner" /></div>;
  if (!dados) return null;

  const { liga, tabela, jogos } = dados;
  const isCriador = liga.criador_id === meuId;

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onVoltar} style={{ marginBottom:'1rem' }}>← Voltar</button>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem', flexWrap:'wrap', gap:'0.5rem' }}>
        <div>
          <h2 style={{ margin:0, fontFamily:'var(--font-display)' }}>⚽ {liga.nome}</h2>
          <p style={{ margin:'0.25rem 0 0', fontSize:'0.8rem', color:'var(--text-muted)' }}>
            {TIPOS[liga.tipo]}
            {liga.equipa_nome && <> · 🛡️ {liga.equipa_nome}</>}
            {' · '}Código: <strong style={{ letterSpacing:'2px' }}>{liga.codigo}</strong>
            {liga.estado === 'encerrada' && <span className="badge badge-gray" style={{ marginLeft:'0.5rem', fontSize:'0.7rem' }}>Encerrada</span>}
          </p>
        </div>
        {isCriador && liga.estado === 'ativa' && (
          <button className="btn btn-ghost btn-sm" style={{ color:'var(--danger,#ef4444)', fontSize:'0.75rem' }} onClick={encerrar}>
            🔒 Encerrar Liga
          </button>
        )}
      </div>

      {/* Regras e Prémio */}
      {(liga.regras || liga.premio) && (
        <div className="card" style={{ marginBottom:'1.25rem', padding:'1.25rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          {liga.regras && (
            <div>
              <p style={{ margin:'0 0 0.3rem', fontSize:'0.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', color:'var(--text-muted)' }}>
                📋 Regras
              </p>
              <p style={{ margin:0, fontSize:'0.875rem', whiteSpace:'pre-wrap', lineHeight:1.5 }}>{liga.regras}</p>
            </div>
          )}
          {liga.premio && (
            <div>
              <p style={{ margin:'0 0 0.3rem', fontSize:'0.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', color:'var(--text-muted)' }}>
                🏅 Prémio do Campeão
              </p>
              <p style={{ margin:0, fontSize:'0.875rem', color:'var(--warning)', fontWeight:600 }}>{liga.premio}</p>
            </div>
          )}
        </div>
      )}

      {/* Tabela classificativa */}
      <div className="card" style={{ marginBottom:'1.25rem', padding:'1.25rem' }}>
        <h4 style={{ margin:'0 0 1rem', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px', color:'var(--text-muted)' }}>
          Classificação
        </h4>
        <div className="liga-tabela">
          <div className="liga-tabela-header">
            <span>#</span><span>Jogador</span>
            <span title="Jogos">J</span><span title="Vitórias">V</span>
            <span title="Empates">E</span><span title="Derrotas">D</span>
            <span title="Golos Marcados">GM</span><span title="Golos Sofridos">GS</span>
            <span title="Diferença de Golos">DG</span><span title="Pontos" style={{ color:'var(--primary)', fontWeight:700 }}>Pts</span>
          </div>
          {tabela.map((m, i) => (
            <div key={m.utilizador_id} className={`liga-tabela-row ${m.utilizador_id === meuId ? 'eu' : ''}`}>
              <span style={{ color:'var(--text-muted)', fontWeight:600 }}>{i+1}</span>
              <span style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                <Avatar nome={m.nome} fotoUrl={m.foto_url} size="xs" />
                <span style={{ fontSize:'0.85rem', fontWeight:600 }}>{m.nickname||m.nome}</span>
              </span>
              <span>{m.vitorias+m.empates+m.derrotas}</span>
              <span style={{ color:'var(--success)' }}>{m.vitorias}</span>
              <span>{m.empates}</span>
              <span style={{ color:'var(--danger,#ef4444)' }}>{m.derrotas}</span>
              <span>{m.golos_marcados}</span>
              <span>{m.golos_sofridos}</span>
              <span style={{ color: m.dif_golos>0?'var(--success)':m.dif_golos<0?'var(--danger,#ef4444)':'inherit' }}>
                {m.dif_golos>0?'+':''}{m.dif_golos}
              </span>
              <span style={{ fontWeight:800, fontSize:'1rem', color:'var(--primary)' }}>{m.pontos}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Adicionar jogo (só criador) */}
      {isCriador && liga.estado === 'ativa' && (
        <div className="card" style={{ marginBottom:'1.25rem', padding:'1.25rem' }}>
          <h4 style={{ margin:'0 0 0.75rem', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px', color:'var(--text-muted)' }}>
            Adicionar Jogo à Liga
          </h4>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <input className="form-input" placeholder="ID do Jogo" type="number" value={jogoId}
              onChange={e => setJogoId(e.target.value)} style={{ flex:1, maxWidth:160 }} />
            <button className="btn btn-primary btn-sm" onClick={adicionarJogo} disabled={addLoad||!jogoId}>
              {addLoad ? '⏳' : '+ Adicionar'}
            </button>
          </div>
          <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'0.4rem' }}>
            O jogo tem de ter resultado registado. O ID aparece na URL do jogo (/jogos/123).
          </p>
        </div>
      )}

      {/* Jogos da liga */}
      {jogos.length > 0 && (
        <div className="card" style={{ padding:'1.25rem' }}>
          <h4 style={{ margin:'0 0 0.75rem', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px', color:'var(--text-muted)' }}>
            Jogos ({jogos.length})
          </h4>
          {jogos.map(j => (
            <div key={j.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'0.5rem 0', borderBottom:'1px solid var(--border)', fontSize:'0.85rem' }}>
              <span>{j.titulo}</span>
              {j.golos_equipa_a !== null && j.golos_equipa_b !== null ? (
                <span style={{ fontWeight:700 }}>{j.golos_equipa_a} × {j.golos_equipa_b}</span>
              ) : (
                <span style={{ color:'var(--text-muted)', fontSize:'0.75rem' }}>Sem resultado</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────
export default function Ligas() {
  const [ligas, setLigas]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalCriar, setModalCriar] = useState(false);
  const [modalEntrar, setModalEntrar] = useState(false);
  const [ligaSelecionada, setLigaSelecionada] = useState(null);
  const { utilizador } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Abrir modal de criar quando chega via ?criar=1 (link da navbar)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('criar') === '1') {
      setModalCriar(true);
      navigate('/ligas', { replace: true });
    }
  }, [location.search]);

  const carregar = useCallback(() => {
    setLoading(true);
    api.get('/ligas')
      .then(r => setLigas(r.data.ligas || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (ligaSelecionada) {
    return (
      <div className="ligas-page">
        <div className="container" style={{ maxWidth:700 }}>
          <Detalheliga ligaId={ligaSelecionada} meuId={utilizador?.id} onVoltar={() => { setLigaSelecionada(null); carregar(); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="ligas-page">
      <div className="container" style={{ maxWidth:700 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'0.5rem' }}>
          <h2 style={{ fontFamily:'var(--font-display)', margin:0 }}>🏆 Ligas</h2>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setModalEntrar(true)}>🔑 Entrar com código</button>
            <button className="btn btn-primary btn-sm" onClick={() => setModalCriar(true)}>+ Nova Liga</button>
          </div>
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}><div className="spinner" /></div>
        ) : ligas.length === 0 ? (
          <div className="card empty-state">
            <div className="icon">🏆</div>
            <p>Ainda não pertences a nenhuma liga.</p>
            <p style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>Cria uma ou entra com o código de um amigo!</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
            {ligas.map(l => (
              <div key={l.id} className={`liga-card ${l.estado}`} onClick={() => setLigaSelecionada(l.id)}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontWeight:700, fontSize:'1rem' }}>⚽ {l.nome}</p>
                    <p style={{ margin:'0.2rem 0 0', fontSize:'0.78rem', color:'var(--text-muted)' }}>
                      {TIPOS[l.tipo]}
                      {l.equipa_nome && <> · 🛡️ {l.equipa_nome}</>}
                      {' · '}{l.total_membros} membro{l.total_membros!==1?'s':''} · {l.total_jogos} jogo{l.total_jogos!==1?'s':''}
                    </p>
                    {l.premio && (
                      <p style={{ margin:'0.3rem 0 0', fontSize:'0.75rem', color:'var(--warning)', fontWeight:600 }}>
                        🏅 {l.premio}
                      </p>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:'0.4rem', alignItems:'center', flexShrink:0, marginLeft:'0.5rem' }}>
                    {l.criador_id === utilizador?.id && <span className="badge badge-green" style={{ fontSize:'0.7rem' }}>👑 Criador</span>}
                    <span className={`badge ${l.estado==='ativa'?'badge-green':'badge-gray'}`} style={{ fontSize:'0.7rem' }}>
                      {l.estado==='ativa'?'Ativa':'Encerrada'}
                    </span>
                    <span style={{ color:'var(--text-muted)', fontSize:'1.1rem' }}>›</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalCriar  && <ModalCriar  onFechar={() => setModalCriar(false)}  onCriada={carregar} />}
      {modalEntrar && <ModalEntrar onFechar={() => setModalEntrar(false)} onEntrou={carregar} />}
    </div>
  );
}
