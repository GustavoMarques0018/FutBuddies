// ============================================================
//  FutBuddies - Landing Page v2
// ============================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';
import { NIVEL_COR, resolverImgUrl } from '../utils/constantes';
import {
  IconTrophy, IconGlobe, IconLock, IconMapPin, IconCalendar,
  IconPencil, IconSearch, IconBall, IconChat, IconChart,
  IconClock, IconUsers,
} from '../components/Icons';
import AnimatedCounter from '../components/AnimatedCounter';
import Reveal from '../components/Reveal';
import './Home.css';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { tema } = useTheme();
  const [jogos, setJogos] = useState([]);
  const [equipas, setEquipas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Ajusta enquadramento para o jogador/equipa ficar visível (fotos verticais → fundo wide)
  const heroPhoto = tema === 'dark'
    ? { file: 'hero-night-1.jpg', position: 'center 65%' }  // equipa vermelha — um pouco abaixo do centro
    : { file: 'hero-day-1.jpg',   position: 'center 55%' }; // equipa a celebrar — cêntrico-baixo

  useEffect(() => {
    Promise.all([
      api.get('/jogos?estado=aberto&limite=3&futuro=true').catch(() => ({ data: { jogos: [] } })),
      api.get('/equipas?recrutar=true').catch(() => ({ data: { equipas: [] } })),
    ]).then(([jogosRes, equipasRes]) => {
      setJogos(jogosRes.data.jogos?.slice(0, 3) || []);
      setEquipas(equipasRes.data.equipas?.slice(0, 2) || []);
    }).finally(() => setLoading(false));
  }, []);

  const formatarData = (data) => {
    if (!data) return '';
    return new Date(data).toLocaleDateString('pt-PT', {
      weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="home">

      {/* ── HERO ── */}
      <section className="hero">
        <div
          className="hero-bg-photo"
          style={{
            backgroundImage: `url(${process.env.PUBLIC_URL}/${heroPhoto.file})`,
            backgroundPosition: heroPhoto.position,
          }}
        />
        <div className="hero-bg-grid" />
        <div className="container">
          <div className="hero-content">
            <div className="hero-left">
              <div className="hero-eyebrow"><span className="live-dot" /> Plataforma ativa</div>
              <h1 className="hero-title">
                Organiza o teu<br />
                <span className="hero-title-green">jogo</span> com os teus<br />
                <span className="hero-title-green">buddies</span>
              </h1>
              <p className="hero-desc">
                A plataforma que une jogadores de futebol, organiza jogos públicos e privados,
                forma equipas e conecta a comunidade — tudo num só lugar.
              </p>
              <div className="hero-actions">
                {isAuthenticated ? (
                  <>
                    <Link to="/jogos" className="btn btn-primary btn-lg">Ver Jogos →</Link>
                    <Link to="/equipas" className="btn btn-outline btn-lg"><IconTrophy size="1em" /> Equipas</Link>
                  </>
                ) : (
                  <>
                    <Link to="/registar" className="btn btn-primary btn-lg">Começar Agora →</Link>
                    <Link to="/login" className="btn btn-outline btn-lg">Já tenho conta</Link>
                  </>
                )}
              </div>
              {/* Pill de funcionalidades novas */}
              <div className="hero-pills">
                <span className="hero-pill"><IconGlobe size="0.85em" /> Jogos Públicos</span>
                <span className="hero-pill"><IconLock size="0.85em" /> Jogos Privados</span>
                <span className="hero-pill"><IconTrophy size="0.85em" /> Equipas</span>
                <span className="hero-pill"><IconMapPin size="0.85em" /> Por Região</span>
              </div>
            </div>

            {/* Painel direito — jogos em destaque */}
            <div className="hero-right">
              <div className="hero-card-panel">
                <p className="hero-card-label">JOGOS EM DESTAQUE</p>
                {loading ? (
                  <div className="hero-loading"><div className="spinner" /></div>
                ) : jogos.length === 0 ? (
                  <div className="hero-empty">
                    <span className="hero-empty-icon"><IconCalendar size="2rem" /></span>
                    <p>Ainda não há jogos abertos.</p>
                    {isAuthenticated && (
                      <Link to="/jogos/criar" className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }}>
                        Criar o primeiro jogo
                      </Link>
                    )}
                  </div>
                ) : (
                  jogos.map(jogo => {
                    const isPrivado = jogo.visibilidade === 'privado';
                    const nc = NIVEL_COR[jogo.nivel] || NIVEL_COR['Descontraído'];
                    return (
                      <Link to={`/jogos/${jogo.id}`} key={jogo.id} className="hero-jogo-card">
                        <div className="hero-jogo-top">
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <span className="hero-jogo-tipo">{jogo.tipo_jogo || '5x5'}</span>
                            {isPrivado && <span style={{ fontSize: '0.8rem' }} title="Privado"><IconLock size="0.8rem" /></span>}
                          </div>
                          <span className="badge badge-green">Aberto</span>
                        </div>
                        <p className="hero-jogo-titulo">{jogo.titulo}</p>
                        {jogo.regiao && <p className="hero-jogo-info"><IconMapPin size="0.85em" /> {jogo.regiao}</p>}
                        <p className="hero-jogo-info"><IconClock size="0.85em" /> {formatarData(jogo.data_jogo)}</p>
                        {jogo.nivel && (
                          <p style={{ marginBottom: '0.4rem' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                              background: nc.bg, color: nc.cor, border: `1px solid ${nc.borda}` }}>
                              {jogo.nivel}
                            </span>
                          </p>
                        )}
                        <div className="hero-jogo-vagas">
                          <div className="progress-bar" style={{ flex: 1 }}>
                            <div className="progress-bar-fill" style={{
                              width: `${Math.min(100, ((jogo.total_inscritos || 0) / (jogo.max_jogadores || 10)) * 100)}%`
                            }} />
                          </div>
                          <span className="hero-jogo-vagas-txt">
                            {jogo.total_inscritos || 0}/{jogo.max_jogadores || 10}
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
                <Link to="/jogos" className="hero-ver-todos">Ver todos os jogos →</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section className="stats-strip">
        <div className="container">
          <div className="stats-strip-grid">
            <div className="stat-item">
              <div className="stat-value"><AnimatedCounter value={1200} suffix="+" /></div>
              <div className="stat-label">Jogadores</div>
            </div>
            <div className="stat-item">
              <div className="stat-value"><AnimatedCounter value={350} suffix="+" /></div>
              <div className="stat-label">Jogos organizados</div>
            </div>
            <div className="stat-item">
              <div className="stat-value"><AnimatedCounter value={85} suffix="+" /></div>
              <div className="stat-label">Equipas ativas</div>
            </div>
            <div className="stat-item">
              <div className="stat-value"><AnimatedCounter value={18} /></div>
              <div className="stat-label">Distritos cobertos</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section className="como-funciona">
        <div className="container">
          <div className="features-header">
            <h2>Como funciona</h2>
            <p>Em três passos tens o teu jogo organizado</p>
          </div>
          <div className="passos-grid">
            {[
              { num: '01', icon: <IconPencil size="1.5rem" />, titulo: 'Cria a tua conta', desc: 'Define o teu perfil, posição, pé preferido e região. Fica tudo guardado para poupar tempo.' },
              { num: '02', icon: <IconSearch size="1.5rem" />, titulo: 'Encontra ou cria um jogo', desc: 'Filtra por região, nível e tipo. Cria jogos públicos para conhecer pessoal ou privados com código de acesso.' },
              { num: '03', icon: <IconBall size="1.5rem" />, titulo: 'Joga com os teus buddies', desc: 'Inscreve-te, escolhe a equipa, usa o chat em tempo real e gere o teu historial de jogos.' },
            ].map((p, i) => (
              <Reveal key={i} delay={i} className="passo-card card hover-lift">
                <div className="passo-num">{p.num}</div>
                <div className="passo-icon">{p.icon}</div>
                <h3>{p.titulo}</h3>
                <p>{p.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES ── */}
      <section className="features">
        <div className="container">
          <div className="features-header">
            <h2>Tudo o que precisas para jogar</h2>
            <p>Funcionalidades pensadas para tornar os teus jogos mais fáceis de organizar</p>
          </div>
          <div className="features-grid">
            {[
              { icon: <IconGlobe size="1.5rem" />, titulo: 'Jogos Públicos', desc: 'Partidas abertas à comunidade para conheceres pessoal novo e preencher vagas na equipa.' },
              { icon: <IconLock size="1.5rem" />, titulo: 'Jogos Privados', desc: 'Jogo fechado com código de acesso. Morada oculta — só os convidados vêem o local.' },
              { icon: <IconTrophy size="1.5rem" />, titulo: 'Equipas', desc: 'Cria a tua equipa, define o plantel, o nível e ativa o modo de recrutamento para atrair jogadores.' },
              { icon: <IconMapPin size="1.5rem" />, titulo: 'Por Região', desc: 'Filtra jogos e equipas pela tua zona. A app memoriza a tua região e pré-preenche a pesquisa.' },
              { icon: <IconChat size="1.5rem" />, titulo: 'Chat em Tempo Real', desc: 'Fala com os colegas de jogo via WebSocket. Funciona mesmo com ligações lentas (fallback automático).' },
              { icon: <IconChart size="1.5rem" />, titulo: 'Perfil & Estatísticas', desc: 'Golos, assistências, jogos, posição, pé preferido e foto de perfil — tudo num só sítio.' },
            ].map((f, i) => (
              <Reveal key={i} delay={(i % 3) + 1} className="feature-card card hover-lift">
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.titulo}</h3>
                <p>{f.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── EQUIPAS A RECRUTAR ── */}
      {equipas.length > 0 && (
        <section className="section-equipas-destaque">
          <div className="container">
            <div className="features-header">
              <h2><IconSearch size="1em" /> Equipas à procura de jogadores</h2>
              <p>Estas equipas estão abertas a novos membros — junta-te!</p>
            </div>
            <div className="equipas-destaque-grid">
              {equipas.map(eq => {
                const nc = NIVEL_COR[eq.nivel] || NIVEL_COR['Descontraído'];
                return (
                  <Link key={eq.id} to={`/equipas/${eq.id}`} className="equipa-destaque-card card card-clickable">
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      {eq.emblema?.startsWith('http') || eq.emblema?.startsWith('/uploads')
                      ? <img src={resolverImgUrl(eq.emblema)} alt="emblema" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                      : <span style={{ fontSize: '2.5rem' }}>{eq.emblema || <IconBall size="2.5rem" />}</span>}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-heading)' }}>{eq.nome}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                            background: nc.bg, color: nc.cor, border: `1px solid ${nc.borda}` }}>{eq.nivel}</span>
                        </div>
                        {eq.regiao && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}><IconMapPin size="0.8em" /> {eq.regiao}</p>}
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}><IconUsers size="0.8em" /> {eq.total_membros} membros</p>
                      </div>
                      <span className="badge badge-green" style={{ fontSize: '0.7rem', flexShrink: 0 }}>Recrutar</span>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <Link to="/equipas" className="btn btn-outline">Ver todas as equipas →</Link>
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      {!isAuthenticated && (
        <section className="cta-section">
          <div className="container">
            <div className="cta-box">
              <img src="/FbVerde.png" alt="FutBuddies" style={{ width: 56, height: 56, marginBottom: '0.75rem', objectFit: 'contain' }} />
              <h2>Pronto para jogar?</h2>
              <p>Junta-te à comunidade FutBuddies e começa a organizar os teus jogos hoje.</p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/registar" className="btn btn-primary btn-lg">Criar Conta Gratuita →</Link>
                <Link to="/jogos" className="btn btn-outline btn-lg">Explorar Jogos</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-logo">
              <img src="/FbVerde.png" alt="FutBuddies" width={28} height={28} style={{ objectFit: 'contain' }} />
              <span>FutBuddies</span>
            </div>
            <p className="footer-copy">© 2026 FutBuddies — Projeto PAP · Gustavo Marques</p>
            <p className="footer-stack">Projeto PAP 2025/2026</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
