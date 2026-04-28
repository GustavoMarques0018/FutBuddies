// ============================================================
//  FutBuddies - Sino de Notificações (navbar)
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import Emblema from './Emblema';
import { useAuth } from '../context/AuthContext';
import './NotificacoesBell.css';

// Ícones inline (leves — não precisamos duplicar em Icons.js)
const IconBell = ({ size = '1.15rem' }) => (
  <svg style={{ width: size, height: size }} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const IconCheck = ({ size = '0.85rem' }) => (
  <svg style={{ width: size, height: size }} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconX = ({ size = '0.85rem' }) => (
  <svg style={{ width: size, height: size }} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const TIPO_COR = {
  nota_admin:        { cor: '#ffb020', label: '📢 Aviso' },
  resultado_jogo:    { cor: '#4dd0ff', label: '⚽ Jogo' },
  resultado_pessoal: { cor: '#39ff14', label: '🎯 Pessoal' },
  suporte_admin:     { cor: '#ff4d6d', label: '💬 Suporte' },
  suporte_resposta:  { cor: '#39ff14', label: '💬 Resposta' },
  candidatura_admin: { cor: '#ff4d6d', label: '📝 Candidatura' },
  candidatura:       { cor: '#4dd0ff', label: '📝 Candidatura' },
  sistema:           { cor: '#b3b3ba', label: '⚙️ Sistema' },
};

// Filtros disponíveis (o filtro "admin" só aparece para admins)
const FILTROS_BASE = [
  { id: 'todas',  label: 'Todas',    title: 'Todas as notificações' },
  { id: 'jogo',   label: '⚽ Jogos', title: 'Jogos e resultados',   tipos: ['resultado_jogo', 'resultado_pessoal'] },
  { id: 'aviso',  label: '📢 Avisos',title: 'Avisos e sistema',     tipos: ['nota_admin', 'sistema'] },
  { id: 'suporte',label: '💬 Suporte',title: 'Mensagens de suporte',tipos: ['suporte_admin', 'suporte_resposta'] },
];
const FILTRO_ADMIN = {
  id: 'admin', label: '🛡️ Admin', title: 'Apenas para administradores',
  tipos: ['suporte_admin', 'candidatura_admin'],
};

function formatarTempo(data) {
  const diff = Date.now() - new Date(data).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(data).toLocaleDateString('pt-PT');
}

export default function NotificacoesBell() {
  const { utilizador } = useAuth();
  const isAdmin = utilizador?.role === 'admin';
  const [aberto, setAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [contador, setContador] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('todas');
  const painelRef = useRef(null);
  const btnRef = useRef(null);

  const FILTROS = isAdmin ? [...FILTROS_BASE, FILTRO_ADMIN] : FILTROS_BASE;
  const filtroActivo = FILTROS.find(f => f.id === filtro);
  const notificacoesFiltradas = (filtro === 'todas' || !filtroActivo?.tipos)
    ? notificacoes
    : notificacoes.filter(n => filtroActivo.tipos.includes(n.tipo));

  // Polling leve do contador (a cada 60s)
  const atualizarContador = useCallback(async () => {
    try {
      const r = await api.get('/notificacoes/nao-lidas-count');
      setContador(r.data.total || 0);
    } catch {}
  }, []);

  useEffect(() => {
    atualizarContador();
    const id = setInterval(atualizarContador, 60 * 1000);
    return () => clearInterval(id);
  }, [atualizarContador]);

  // Carregar lista ao abrir
  const abrir = async () => {
    setAberto(v => !v);
    if (!aberto) {
      setLoading(true);
      try {
        const r = await api.get('/notificacoes');
        setNotificacoes(r.data.notificacoes || []);
      } catch {}
      finally { setLoading(false); }
    }
  };

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (
        painelRef.current && !painelRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) setAberto(false);
    };
    if (aberto) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aberto]);

  const marcarLida = async (id) => {
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    setContador(c => Math.max(0, c - 1));
    try { await api.put(`/notificacoes/${id}/lida`); } catch {}
  };

  const marcarTodas = async () => {
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
    setContador(0);
    try { await api.put('/notificacoes/lidas'); } catch {}
  };

  const eliminar = async (id) => {
    const n = notificacoes.find(x => x.id === id);
    setNotificacoes(prev => prev.filter(x => x.id !== id));
    if (n && !n.lida) setContador(c => Math.max(0, c - 1));
    try { await api.delete(`/notificacoes/${id}`); } catch {}
  };

  return (
    <div className="notif-wrap">
      <button
        ref={btnRef}
        className={`notif-btn ${contador > 0 ? 'has-unread' : ''}`}
        onClick={abrir}
        aria-label="Notificações"
        title="Notificações"
      >
        <IconBell />
        {contador > 0 && (
          <span className="notif-badge">{contador > 99 ? '99+' : contador}</span>
        )}
      </button>

      {aberto && (
        <div ref={painelRef} className="notif-painel">
          <div className="notif-painel-header">
            <span>Notificações</span>
            {contador > 0 && (
              <button className="notif-btn-link" onClick={marcarTodas}>
                <IconCheck /> Marcar todas lidas
              </button>
            )}
          </div>

          <div className="notif-filtros">
            {FILTROS.map(f => (
              <button
                key={f.id}
                className={`notif-chip ${filtro === f.id ? 'active' : ''}`}
                onClick={() => setFiltro(f.id)}
                title={f.title}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="notif-lista">
            {loading && (
              <div className="notif-estado">
                <div className="spinner" style={{ width: 20, height: 20 }} />
              </div>
            )}

            {!loading && notificacoesFiltradas.length === 0 && (
              <div className="notif-estado notif-vazio">
                <IconBell size="2rem" />
                <p>{filtro === 'todas' ? 'Sem notificações por agora.' : 'Nenhuma notificação neste filtro.'}</p>
                {filtro === 'todas' && <small>Quando jogares ou recebermos novidades, aparecem aqui.</small>}
              </div>
            )}

            {!loading && notificacoesFiltradas.map(n => {
              const t = TIPO_COR[n.tipo] || TIPO_COR.sistema;
              const Wrapper = n.acao_url ? Link : 'div';
              const wrapperProps = n.acao_url
                ? { to: n.acao_url, onClick: () => { marcarLida(n.id); setAberto(false); } }
                : { onClick: () => marcarLida(n.id) };
              return (
                <Wrapper
                  key={n.id}
                  className={`notif-item ${n.lida ? 'lida' : ''}`}
                  {...wrapperProps}
                >
                  <span
                    className="notif-item-dot"
                    style={{ background: t.cor, boxShadow: `0 0 8px ${t.cor}55` }}
                  />
                  <div className="notif-item-body">
                    <div className="notif-item-top">
                      <span className="notif-item-tipo" style={{ color: t.cor }}>
                        {t.label}
                      </span>
                      <span className="notif-item-tempo">{formatarTempo(n.created_at)}</span>
                    </div>
                    <p className="notif-item-titulo">{n.titulo}</p>
                    {n.mensagem && <p className="notif-item-msg">{n.mensagem}</p>}
                    {(n.jogo_titulo || n.equipa_nome) && (
                      <p className="notif-item-meta">
                        {n.jogo_titulo && <>⚽ {n.jogo_titulo}</>}
                        {n.equipa_nome && <> <Emblema valor={n.equipa_emblema} tamanho={14} inline /> {n.equipa_nome}</>}
                      </p>
                    )}
                  </div>
                  <button
                    className="notif-item-close"
                    aria-label="Eliminar"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); eliminar(n.id); }}
                  >
                    <IconX />
                  </button>
                </Wrapper>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
