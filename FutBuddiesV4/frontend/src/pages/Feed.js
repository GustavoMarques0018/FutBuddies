// ============================================================
//  FutBuddies - Feed de Atividade dos Amigos
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import Avatar from '../components/Avatar';
import { resolverImgUrl } from '../utils/constantes';
import './Feed.css';

const ICONES = {
  jogo_criado:   { emoji: '⚽', cor: 'var(--primary)',  label: 'criou um jogo' },
  inscricao:     { emoji: '✅', cor: 'var(--success)',  label: 'inscreveu-se num jogo' },
  golo_marcado:  { emoji: '🥅', cor: 'var(--warning)',  label: 'marcou' },
  conquista:     { emoji: '🏅', cor: 'var(--info)',     label: 'desbloqueou conquista' },
  conquista_nova:{ emoji: '🏅', cor: 'var(--info)',     label: 'desbloqueou conquista' },
};

function AtividadeCard({ a }) {
  const meta = ICONES[a.tipo] || { emoji: '📌', cor: 'var(--text-muted)', label: '' };
  const d = a.dados || {};
  const ago = (() => {
    const diff = Date.now() - new Date(a.created_at).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'agora';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  })();

  return (
    <div className="feed-card">
      <div className="feed-avatar-wrap">
        <Avatar nome={a.nome} fotoUrl={a.foto_url} size="sm" />
        <span className="feed-emoji" style={{ background: meta.cor }}>{meta.emoji}</span>
      </div>
      <div className="feed-content">
        <p className="feed-texto">
          <Link to={`/jogador/${a.utilizador_id}`} className="feed-nome">
            {a.nickname || a.nome}
          </Link>
          {' '}{meta.label}
          {a.tipo === 'golo_marcado' && d.golos && ` ${d.golos} golo${d.golos > 1 ? 's' : ''}`}
          {(a.tipo === 'jogo_criado' || a.tipo === 'inscricao') && d.titulo && (
            <> em <Link to={`/jogos/${d.jogoId}`} style={{ color: 'var(--primary)' }}>{d.titulo}</Link></>
          )}
          {(a.tipo === 'conquista' || a.tipo === 'conquista_nova') && d.nome && ` "${d.nome}"`}
        </p>
        <span className="feed-ago">{ago}</span>
      </div>
    </div>
  );
}

export default function Feed() {
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [pagina, setPagina]         = useState(1);
  const [temMais, setTemMais]       = useState(true);

  const carregar = useCallback(async (pag = 1) => {
    setLoading(true);
    try {
      const r = await api.get(`/feed?pagina=${pag}`);
      const novas = r.data.atividades || [];
      setAtividades(prev => pag === 1 ? novas : [...prev, ...novas]);
      setTemMais(novas.length === 30);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(1); }, [carregar]);

  return (
    <div className="feed-page">
      <div className="container" style={{ maxWidth: 600 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.5rem' }}>
          📰 Feed de Atividade
        </h2>

        {loading && pagina === 1 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <div className="spinner" />
          </div>
        ) : atividades.length === 0 ? (
          <div className="card empty-state">
            <div className="icon">📰</div>
            <p>Ainda não há atividade dos teus amigos.</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Adiciona amigos para veres o que estão a fazer!
            </p>
            <Link to="/amigos" className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>
              Encontrar Amigos
            </Link>
          </div>
        ) : (
          <>
            <div className="feed-lista">
              {atividades.map(a => <AtividadeCard key={a.id} a={a} />)}
            </div>
            {temMais && (
              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setPagina(p => p + 1); carregar(pagina + 1); }}
                  disabled={loading}
                >
                  {loading ? '⏳' : 'Carregar mais'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
