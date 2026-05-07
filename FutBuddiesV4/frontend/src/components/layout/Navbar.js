// ============================================================
//  FutBuddies - Navbar v3 (com dropdowns inteligentes)
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { resolverImgUrl } from '../../utils/constantes';
import api from '../../utils/api';
import {
  IconUser, IconUsers, IconTrophy, IconBall, IconShield, IconLogout,
  IconSun, IconMoon, IconPlus, IconInfo, IconSearch, IconCrown,
  IconStadium, IconChat,
} from '../Icons';
import NotificacoesBell from '../NotificacoesBell';
import './Navbar.css';

export default function Navbar() {
  const { utilizador, isAuthenticated, logout } = useAuth();
  const { tema, toggleTema } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [menuAberto, setMenuAberto] = useState(false);
  const [dropdownAberto, setDropdownAberto] = useState(null); // 'jogos' | 'equipas' | 'user' | null

  const [minhaEquipa, setMinhaEquipa] = useState(null);
  const [temJogos, setTemJogos] = useState(false);

  const navRef = useRef(null);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickFora = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setDropdownAberto(null);
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  // Fechar dropdowns ao mudar de página
  useEffect(() => {
    setDropdownAberto(null);
    setMenuAberto(false);
  }, [location.pathname]);

  // Bloquear scroll do body enquanto o menu mobile está aberto
  useEffect(() => {
    if (menuAberto) {
      document.body.classList.add('no-scroll');
      return () => {
        document.body.classList.remove('no-scroll');
      };
    }
  }, [menuAberto]);

  // Fechar menu mobile com tecla Escape
  useEffect(() => {
    if (!menuAberto) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuAberto(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuAberto]);

  // Navbar shrink on scroll
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Buscar dados do utilizador (equipa + jogos)
  useEffect(() => {
    if (!isAuthenticated) {
      setMinhaEquipa(null);
      setTemJogos(false);
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const [eq, perf] = await Promise.allSettled([
          api.get('/utilizadores/me/equipa'),
          api.get('/utilizadores/perfil'),
        ]);
        if (cancelado) return;
        if (eq.status === 'fulfilled') setMinhaEquipa(eq.value.data?.equipa || null);
        if (perf.status === 'fulfilled') {
          const jogos = perf.value.data?.jogos || perf.value.data?.utilizador?.jogos || [];
          setTemJogos(Array.isArray(jogos) && jogos.length > 0);
        }
      } catch {}
    })();
    return () => { cancelado = true; };
  }, [isAuthenticated, utilizador?.id]);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setDropdownAberto(null);
  };

  const getInitials = (nome) => {
    if (!nome) return '?';
    return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const displayName = utilizador?.nickname || utilizador?.nome;

  const toggleDropdown = (nome) => {
    setDropdownAberto(prev => prev === nome ? null : nome);
  };

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`} ref={navRef}>
      <div className="navbar-inner container">
        <Link to="/" className="navbar-logo" onClick={() => setMenuAberto(false)}>
          <img src='/FbVerde.png' alt="FutBuddies" className="navbar-logo-img" />
          <span className="navbar-logo-text">FutBuddies</span>
        </Link>

        <div className="navbar-links">
          <Link to="/" className={`navbar-link ${location.pathname === '/' ? 'active' : ''}`}>Início</Link>

          {/* Dropdown Jogos */}
          <div className={`navbar-dropdown-wrap ${dropdownAberto === 'jogos' ? 'open' : ''}`}>
            <button
              type="button"
              className={`navbar-link navbar-link-btn ${isActive('/jogos') ? 'active' : ''}`}
              onClick={() => toggleDropdown('jogos')}
              aria-expanded={dropdownAberto === 'jogos'}
            >
              <IconBall size="0.95rem" /> Jogos <span className="navbar-chevron-mini">▾</span>
            </button>
            {dropdownAberto === 'jogos' && (
              <div className="navbar-menu">
                {isAuthenticated && (
                  <Link to="/jogos/meus" className="navbar-menu-item">
                    <IconCrown size="0.95rem" /> Os Meus Jogos
                  </Link>
                )}
                <Link to="/jogos" className="navbar-menu-item">
                  <IconSearch size="0.95rem" /> Procurar Jogo
                </Link>
                {isAuthenticated && (
                  <Link to="/jogos/criar" className="navbar-menu-item highlight">
                    <IconPlus size="0.95rem" /> Criar Jogo
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Dropdown Equipas */}
          <div className={`navbar-dropdown-wrap ${dropdownAberto === 'equipas' ? 'open' : ''}`}>
            <button
              type="button"
              className={`navbar-link navbar-link-btn ${isActive('/equipas') ? 'active' : ''}`}
              onClick={() => toggleDropdown('equipas')}
              aria-expanded={dropdownAberto === 'equipas'}
            >
              <IconTrophy size="0.95rem" /> Equipas <span className="navbar-chevron-mini">▾</span>
            </button>
            {dropdownAberto === 'equipas' && (
              <div className="navbar-menu">
                {isAuthenticated && minhaEquipa && (
                  <Link to={`/equipas/${minhaEquipa.id}`} className="navbar-menu-item">
                    <IconCrown size="0.95rem" /> A Minha Equipa
                    <span className="navbar-menu-tag">{minhaEquipa.nome}</span>
                  </Link>
                )}
                <Link to="/equipas" className="navbar-menu-item">
                  <IconSearch size="0.95rem" /> Procurar Equipa
                </Link>
                {isAuthenticated && (
                  <Link to="/equipas/criar" className="navbar-menu-item highlight">
                    <IconPlus size="0.95rem" /> Criar Equipa
                  </Link>
                )}
              </div>
            )}
          </div>

          <Link to="/campos" className={`navbar-link ${isActive('/campos') ? 'active' : ''}`}>
            <IconStadium size="0.95rem" /> Campos
          </Link>

          <Link to="/sobre" className={`navbar-link ${isActive('/sobre') ? 'active' : ''}`}>
            <IconInfo size="0.95rem" /> Sobre
          </Link>
          <Link to="/suporte" className={`navbar-link ${isActive('/suporte') ? 'active' : ''}`}>
            <IconChat size="0.95rem" /> Suporte
          </Link>
        </div>

        <div className="navbar-actions">
          <button
            className="navbar-search-btn"
            onClick={() => {
              const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true });
              window.dispatchEvent(ev);
            }}
            title="Pesquisar (Ctrl+K)"
          >
            <span>⌕</span>
            <span>Pesquisar...</span>
            <span className="kbd">⌘K</span>
          </button>

          <button className="navbar-theme-btn" onClick={toggleTema}
            title={tema === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            aria-label={tema === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}>
            {tema === 'dark' ? <IconSun size="1.1rem" /> : <IconMoon size="1.1rem" />}
          </button>

          {isAuthenticated && <NotificacoesBell />}

          {isAuthenticated ? (
            <div className={`navbar-user ${dropdownAberto === 'user' ? 'open' : ''}`} onClick={() => toggleDropdown('user')}>
              {utilizador?.foto_url ? (
                <img src={resolverImgUrl(utilizador.foto_url)} alt="" className="navbar-user-foto" />
              ) : (
                <div className="avatar">{getInitials(displayName)}</div>
              )}
              <span className="navbar-user-nome">{displayName?.split(' ')[0]}</span>
              <span className="navbar-chevron">▾</span>

              {dropdownAberto === 'user' && (
                <div className="navbar-dropdown">
                  <div className="navbar-dropdown-header">
                    <p className="navbar-dropdown-nome">{displayName}</p>
                    <p className="navbar-dropdown-email">{utilizador?.email}</p>
                  </div>
                  <div className="navbar-dropdown-divider" />
                  <Link to="/perfil" className="navbar-dropdown-item"><IconUser size="0.95rem" /> O Meu Perfil</Link>
                  <Link to="/amigos" className="navbar-dropdown-item"><IconUsers size="0.95rem" /> Amigos</Link>
                  <Link to="/dono-campo" className="navbar-dropdown-item"><IconTrophy size="0.95rem" /> Dono de Campo</Link>
                  {utilizador?.role === 'admin' && (
                    <>
                      <div className="navbar-dropdown-divider" />
                      <Link to="/admin" className="navbar-dropdown-item"><IconShield size="0.95rem" /> Administração</Link>
                    </>
                  )}
                  <div className="navbar-dropdown-divider" />
                  <button className="navbar-dropdown-item danger" onClick={handleLogout}><IconLogout size="0.95rem" color="var(--danger)" /> Sair</button>
                </div>
              )}
            </div>
          ) : (
            <div className="navbar-auth-btns">
              <Link to="/login" className="btn btn-ghost btn-sm">Entrar</Link>
              <Link to="/registar" className="btn btn-primary btn-sm">Criar Conta</Link>
            </div>
          )}

          <button
            className={`navbar-hamburger${menuAberto ? ' open' : ''}`}
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuAberto}
            onClick={() => setMenuAberto(!menuAberto)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {menuAberto && (
        <>
          <div className="navbar-mobile-backdrop" onClick={() => setMenuAberto(false)} aria-hidden="true" />
        <div className="navbar-mobile" onClick={(e) => e.stopPropagation()}>
          <Link to="/" className="navbar-mobile-link">Início</Link>

          <div className="navbar-mobile-section">Jogos</div>
          {isAuthenticated && (
            <Link to="/jogos/meus" className="navbar-mobile-link sub">Os Meus Jogos</Link>
          )}
          <Link to="/jogos" className="navbar-mobile-link sub">Procurar Jogo</Link>
          {isAuthenticated && <Link to="/jogos/criar" className="navbar-mobile-link sub">+ Criar Jogo</Link>}

          <div className="navbar-mobile-section">Equipas</div>
          {isAuthenticated && minhaEquipa && (
            <Link to={`/equipas/${minhaEquipa.id}`} className="navbar-mobile-link sub">A Minha Equipa</Link>
          )}
          <Link to="/equipas" className="navbar-mobile-link sub">Procurar Equipa</Link>
          {isAuthenticated && <Link to="/equipas/criar" className="navbar-mobile-link sub">+ Criar Equipa</Link>}

          <Link to="/campos" className="navbar-mobile-link">Campos</Link>
          <Link to="/sobre" className="navbar-mobile-link">Sobre</Link>
          <Link to="/suporte" className="navbar-mobile-link">Suporte</Link>

          {isAuthenticated && (
            <>
              <div className="navbar-mobile-section">Conta</div>
              <Link to="/perfil" className="navbar-mobile-link sub">O Meu Perfil</Link>
              <Link to="/amigos" className="navbar-mobile-link sub">Amigos</Link>
              <Link to="/dono-campo" className="navbar-mobile-link sub">Dono de Campo</Link>
              {utilizador?.role === 'admin' && <Link to="/admin" className="navbar-mobile-link sub">Admin</Link>}
              <button className="navbar-mobile-link danger" onClick={handleLogout}>Sair</button>
            </>
          )}
          {!isAuthenticated && (
            <>
              <div className="navbar-mobile-section">Conta</div>
              <Link to="/login" className="navbar-mobile-link sub">Entrar</Link>
              <Link to="/registar" className="navbar-mobile-link sub">Criar Conta</Link>
            </>
          )}
        </div>
        </>
      )}
    </nav>
  );
}
