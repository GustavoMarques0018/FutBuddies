// ============================================================
//  FutBuddies - Desafios entre Amigos
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import Avatar from '../components/Avatar';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import './Desafios.css';

const TIPOS = {
  gols_mes:         { label: 'Golos este mês',        emoji: '⚽' },
  assistencias_mes: { label: 'Assistências este mês', emoji: '🎯' },
  jogos_mes:        { label: 'Jogos este mês',         emoji: '🏃' },
};

const MESES = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function BarraProgresso({ v1, v2, cor1, cor2 }) {
  const total = v1 + v2 || 1;
  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', margin: '0.5rem 0' }}>
      <div style={{ width: `${(v1 / total) * 100}%`, background: cor1, transition: 'width 0.4s' }} />
      <div style={{ flex: 1, background: cor2, transition: 'width 0.4s' }} />
    </div>
  );
}

function CartaoDesafio({ d, meuId, onRefresh }) {
  const [lb, setLb]       = useState(null);
  const [aberto, setAberto] = useState(false);
  const { addToast } = useToast();
  const isPendente = d.estado === 'pending' && d.participante_id === meuId;

  const carregarLb = async () => {
    if (!aberto) {
      try { const r = await api.get(`/desafios/${d.id}/leaderboard`); setLb(r.data); } catch {}
    }
    setAberto(v => !v);
  };

  const responder = async (estado) => {
    try {
      await api.put(`/desafios/${d.id}/responder`, { estado });
      addToast(estado === 'aceite' ? 'Desafio aceite! 💪' : 'Desafio recusado.', estado === 'aceite' ? 'success' : 'info');
      onRefresh();
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro.', 'error');
    }
  };

  const tipoInfo = TIPOS[d.tipo] || { label: d.tipo, emoji: '📊' };
  const outroNome = d.criador_id === meuId ? d.part_nick || d.part_nome : d.criador_nick || d.criador_nome;
  const outroFoto = d.criador_id === meuId ? d.part_foto : d.criador_foto;

  return (
    <div className={`desafio-card ${d.estado}`}>
      <div className="desafio-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{tipoInfo.emoji}</span>
          <div>
            <p className="desafio-tipo">{tipoInfo.label}</p>
            <p className="desafio-sub">vs {outroNome} · {MESES[d.mes]} {d.ano}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span className={`badge ${d.estado === 'aceite' ? 'badge-green' : d.estado === 'pending' ? 'badge-gray' : 'badge-gray'}`}
            style={{ fontSize: '0.7rem' }}>
            {d.estado === 'aceite' ? '✓ Ativo' : d.estado === 'pending' ? '⏳ Pendente' : '✗ Recusado'}
          </span>
        </div>
      </div>

      {isPendente && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button className="btn btn-primary btn-sm" onClick={() => responder('aceite')}>Aceitar</button>
          <button className="btn btn-ghost btn-sm" onClick={() => responder('recusado')}>Recusar</button>
        </div>
      )}

      {d.estado === 'aceite' && (
        <button className="btn btn-ghost btn-sm" style={{ marginTop: '0.5rem', fontSize: '0.75rem' }} onClick={carregarLb}>
          {aberto ? 'Fechar' : '📊 Ver placar'}
        </button>
      )}

      {aberto && lb && (
        <div className="desafio-lb">
          {[lb.criador, lb.participante].map((p, i) => (
            <div key={p.id} className="desafio-lb-row">
              <Avatar nome={p.nome} fotoUrl={p.foto} size="xs" />
              <span style={{ flex: 1, fontSize: '0.85rem' }}>{p.nome}</span>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: i === 0 ? 'var(--primary)' : 'var(--info)' }}>
                {p.valor}
              </span>
            </div>
          ))}
          <BarraProgresso v1={lb.criador.valor} v2={lb.participante.valor} cor1="var(--primary)" cor2="var(--info)" />
        </div>
      )}
    </div>
  );
}

function ModalNovoDesafio({ onFechar, onCriado }) {
  const [amigos, setAmigos]             = useState([]);
  const [participanteId, setParticipante] = useState('');
  const [tipo, setTipo]                 = useState('gols_mes');
  const [loading, setLoading]           = useState(false);
  const { addToast } = useToast();
  const agora = new Date();

  useEffect(() => {
    api.get('/amigos').then(r => setAmigos(r.data.amigos || [])).catch(() => {});
  }, []);

  const criar = async () => {
    if (!participanteId) return addToast('Escolhe um amigo.', 'error');
    setLoading(true);
    try {
      await api.post('/desafios', {
        participanteId: parseInt(participanteId),
        tipo,
        mes: agora.getMonth() + 1,
        ano: agora.getFullYear(),
      });
      addToast('Desafio enviado! ⚔️', 'success');
      onCriado();
      onFechar();
    } catch (err) {
      addToast(err?.response?.data?.mensagem || 'Erro.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="card" style={{ maxWidth: 400, width: '100%', padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1.25rem', fontFamily: 'var(--font-display)' }}>⚔️ Novo Desafio</h3>

        <label className="form-label">Amigo</label>
        <select className="form-input" value={participanteId} onChange={e => setParticipante(e.target.value)}>
          <option value="">Seleciona um amigo...</option>
          {amigos.map(a => (
            <option key={a.amigo_id} value={a.amigo_id}>{a.nickname || a.nome}</option>
          ))}
        </select>

        <label className="form-label" style={{ marginTop: '1rem' }}>Tipo de desafio</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {Object.entries(TIPOS).map(([k, v]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: `1px solid ${tipo === k ? 'var(--primary)' : 'var(--border)'}`, background: tipo === k ? 'var(--primary-glow)' : 'transparent' }}>
              <input type="radio" value={k} checked={tipo === k} onChange={() => setTipo(k)} style={{ display: 'none' }} />
              <span>{v.emoji}</span><span style={{ fontSize: '0.875rem' }}>{v.label}</span>
            </label>
          ))}
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.75rem 0' }}>
          Período: {MESES[agora.getMonth() + 1]} {agora.getFullYear()}
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={criar} disabled={loading}>
            {loading ? '⏳' : 'Enviar Desafio'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Desafios() {
  const [desafios, setDesafios] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const { utilizador }          = useAuth();

  const carregar = useCallback(() => {
    setLoading(true);
    api.get('/desafios')
      .then(r => setDesafios(r.data.desafios || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const pendentes   = desafios.filter(d => d.estado === 'pending');
  const ativos      = desafios.filter(d => d.estado === 'aceite');
  const historico   = desafios.filter(d => d.estado === 'recusado');

  return (
    <div className="desafios-page">
      <div className="container" style={{ maxWidth: 600 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>⚔️ Desafios</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ Novo Desafio</button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : desafios.length === 0 ? (
          <div className="card empty-state">
            <div className="icon">⚔️</div>
            <p>Ainda não tens desafios. Desafia um amigo!</p>
          </div>
        ) : (
          <>
            {pendentes.length > 0 && (
              <section>
                <h4 className="secao-titulo">⏳ Pendentes ({pendentes.length})</h4>
                {pendentes.map(d => <CartaoDesafio key={d.id} d={d} meuId={utilizador?.id} onRefresh={carregar} />)}
              </section>
            )}
            {ativos.length > 0 && (
              <section>
                <h4 className="secao-titulo">🔥 Ativos</h4>
                {ativos.map(d => <CartaoDesafio key={d.id} d={d} meuId={utilizador?.id} onRefresh={carregar} />)}
              </section>
            )}
            {historico.length > 0 && (
              <section>
                <h4 className="secao-titulo" style={{ color: 'var(--text-muted)' }}>Recusados</h4>
                {historico.map(d => <CartaoDesafio key={d.id} d={d} meuId={utilizador?.id} onRefresh={carregar} />)}
              </section>
            )}
          </>
        )}
      </div>

      {modal && <ModalNovoDesafio onFechar={() => setModal(false)} onCriado={carregar} />}
    </div>
  );
}
