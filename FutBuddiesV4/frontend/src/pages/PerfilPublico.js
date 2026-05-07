// ============================================================
//  FutBuddies - Perfil Público do Jogador (v2)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../utils/api';
import { resolverImgUrl } from '../utils/constantes';
import Emblema from '../components/Emblema';
import Conquistas from '../components/Conquistas';
import './PerfilPublico.css';

export default function PerfilPublico() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { utilizador: euProprio, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [estadoAmizade, setEstadoAmizade] = useState(null); // null, 'pendente', 'aceite'
  const [amizadeLoading, setAmizadeLoading] = useState(false);

  useEffect(() => {
    if (euProprio && parseInt(id) === euProprio.id) {
      navigate('/perfil', { replace: true });
      return;
    }
    api.get(`/jogadores/${id}`)
      .then(res => setPerfil(res.data))
      .catch(() => navigate('/jogos', { replace: true }))
      .finally(() => setLoading(false));
    // Check friendship status
    if (isAuthenticated) {
      api.get(`/amigos/pesquisar?q=_CHECKID_${id}`)
        .catch(() => {});
      // Use the friends list to check
      api.get('/amigos').then(res => {
        const amigos = res.data.amigos || [];
        if (amigos.some(a => a.amigo_id === parseInt(id))) setEstadoAmizade('aceite');
      }).catch(() => {});
      api.get('/amigos/pedidos').then(res => {
        const pedidos = res.data.pedidos || [];
        if (pedidos.some(p => p.remetente_id === parseInt(id))) setEstadoAmizade('pendente_recebido');
      }).catch(() => {});
    }
  }, [id, isAuthenticated]);

  const handleAdicionarAmigo = async () => {
    setAmizadeLoading(true);
    try {
      await api.post('/amigos/enviar', { destinatarioId: parseInt(id) });
      addToast('Pedido de amizade enviado!', 'success');
      setEstadoAmizade('pendente');
    } catch (err) {
      const msg = err?.response?.data?.mensagem || '';
      if (msg.includes('amigos')) setEstadoAmizade('aceite');
      else if (msg.includes('enviado')) setEstadoAmizade('pendente');
      else addToast(msg || 'Erro ao enviar pedido.', 'error');
    } finally {
      setAmizadeLoading(false);
    }
  };

  const getInitials = (nome) => nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
  const formatarData = (data) => data ? new Date(data).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  const formatarDataJogo = (data) => data ? new Date(data).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Data a definir';

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem' }}><div className="spinner" /></div>;
  if (!perfil) return null;

  const { utilizador, jogosRecentes, equipa, privado } = perfil;

  // Visualização mínima quando o perfil é privado
  if (privado) {
    return (
      <div className="perfil-pub-page">
        <div className="container" style={{ maxWidth: 600 }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            <Link to="/jogos" style={{ color: 'var(--primary)' }}>← Voltar aos Jogos</Link>
          </p>
          <div className="perfil-pub-header card">
            <div className="perfil-pub-avatar">
              {utilizador.foto_url
                ? <img src={resolverImgUrl(utilizador.foto_url)} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.parentElement.textContent = getInitials(utilizador.nome); }} />
                : getInitials(utilizador.nome)}
            </div>
            <div className="perfil-pub-info">
              <h1>{utilizador.nickname || utilizador.nome}</h1>
              {equipa && (
                <Link to={`/equipas/${equipa.id}`} style={{ textDecoration: 'none', marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.9rem', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-sm)', padding: '4px 12px' }}>
                  <Emblema valor={equipa.emblema} tamanho={20} inline /> {equipa.nome}
                </Link>
              )}
              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--bg-elev-2)', border: '1px dashed var(--border)',
                borderRadius: 'var(--radius)', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🔒</span>
                <span>Este jogador tem o perfil privado. Adiciona-o como amigo para ver mais detalhes.</span>
              </div>
              {isAuthenticated && estadoAmizade !== 'aceite' && estadoAmizade !== 'pendente' && estadoAmizade !== 'pendente_recebido' && (
                <div style={{ marginTop: '0.75rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={handleAdicionarAmigo} disabled={amizadeLoading}>
                    {amizadeLoading ? 'A enviar...' : '+ Adicionar Amigo'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="perfil-pub-page">
      <div className="container" style={{ maxWidth: 800 }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          <Link to="/jogos" style={{ color: 'var(--primary)' }}>← Voltar aos Jogos</Link>
        </p>

        {/* Header */}
        <div className="perfil-pub-header card">
          <div className="perfil-pub-avatar">
            {utilizador.foto_url
              ? <img src={resolverImgUrl(utilizador.foto_url)} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.parentElement.textContent = getInitials(utilizador.nome); }} />
              : getInitials(utilizador.nome)}
          </div>
          <div className="perfil-pub-info">
            <h1>{utilizador.nickname || utilizador.nome}</h1>
            {utilizador.nickname && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{utilizador.nome}</p>}
            <div className="perfil-pub-meta">
              {utilizador.posicao && <span className="badge badge-green">⚽ {utilizador.posicao}</span>}
              {utilizador.pe_preferido && <span className="badge badge-gray">🦶 {utilizador.pe_preferido}</span>}
              {utilizador.regiao && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>📍 {utilizador.regiao}</span>}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Membro desde {formatarData(utilizador.created_at)}</span>
            </div>
            {utilizador.bio && <p className="perfil-pub-bio">{utilizador.bio}</p>}
            {equipa && (
              <Link to={`/equipas/${equipa.id}`} style={{ textDecoration: 'none', marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                fontSize: '0.85rem', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-sm)', padding: '3px 10px' }}>
                <Emblema valor={equipa.emblema} tamanho={18} inline /> {equipa.nome} · {equipa.papel === 'capitao' ? '👑 Capitão' : 'Membro'}
              </Link>
            )}
            {isAuthenticated && (
              <div style={{ marginTop: '0.75rem' }}>
                {estadoAmizade === 'aceite' ? (
                  <span className="badge badge-green" style={{ fontSize: '0.8rem' }}>✓ Amigos</span>
                ) : estadoAmizade === 'pendente' || estadoAmizade === 'pendente_recebido' ? (
                  <span className="badge badge-gray" style={{ fontSize: '0.8rem' }}>⏳ Pedido pendente</span>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={handleAdicionarAmigo} disabled={amizadeLoading}>
                    {amizadeLoading ? 'A enviar...' : '+ Adicionar Amigo'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="perfil-pub-stats">
          {[
            { num: utilizador.total_jogos||0, label: 'Jogos', cor: 'var(--primary)' },
            { num: utilizador.total_golos||0, label: 'Golos', cor: 'var(--success)' },
            { num: utilizador.total_assistencias||0, label: 'Assistências', cor: 'var(--info)' },
            { num: utilizador.total_golos > 0 && utilizador.total_jogos > 0
                ? (utilizador.total_golos / utilizador.total_jogos).toFixed(1) : '—',
              label: 'Golos/Jogo', cor: 'var(--warning)' },
          ].map((s, i) => (
            <div key={i} className="perfil-pub-stat card">
              <span className="perfil-pub-stat-num" style={{ color: s.cor }}>{s.num}</span>
              <span className="perfil-pub-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Jogos recentes */}
        {jogosRecentes?.length > 0 ? (
          <div className="card">
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem' }}>
              Jogos Recentes
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {jogosRecentes.map(jogo => (
                <Link key={jogo.id} to={`/jogos/${jogo.id}`} className="perfil-pub-jogo">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{jogo.titulo}</span>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <span className="jogo-tipo">{jogo.tipo_jogo}</span>
                      <span className="badge" style={{
                        background: jogo.equipa === 'A' ? 'var(--primary-glow)' : 'rgba(59,130,246,0.15)',
                        color: jogo.equipa === 'A' ? 'var(--primary)' : 'var(--info)',
                        border: `1px solid ${jogo.equipa === 'A' ? 'var(--primary)' : 'var(--info)'}`,
                        fontSize: '0.7rem' }}>Equipa {jogo.equipa}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {jogo.regiao && <span>📍 {jogo.regiao}</span>}
                    <span>🕐 {formatarDataJogo(jogo.data_jogo)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="card empty-state">
            <div className="icon">⚽</div>
            <p>Este jogador ainda não participou em nenhum jogo.</p>
          </div>
        )}

        <div className="card" style={{ padding: '1.5rem', marginTop: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontFamily: 'var(--font-display)' }}>🏅 Conquistas</h3>
          <Conquistas utilizadorId={id} />
        </div>
      </div>
    </div>
  );
}
