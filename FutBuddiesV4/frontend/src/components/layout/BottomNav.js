// ============================================================
//  FutBuddies - Bottom Navigation (mobile only)
// ============================================================

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { IconHome, IconBall, IconPlus, IconUsers, IconUser, IconStadium } from '../Icons';
import './BottomNav.css';

export default function BottomNav() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Ocultar em páginas de autenticação
  if (['/login', '/registar'].includes(location.pathname)) return null;

  const items = [
    { to: '/',        label: 'Início',  Icon: IconHome },
    { to: '/jogos',   label: 'Jogos',   Icon: IconBall },
    isAuthenticated
      ? { to: '/jogos/criar', label: 'Criar', Icon: IconPlus, highlight: true }
      : { to: '/campos',      label: 'Campos', Icon: IconStadium },
    { to: '/equipas', label: 'Equipas', Icon: IconUsers },
    { to: isAuthenticated ? '/perfil' : '/login', label: isAuthenticated ? 'Perfil' : 'Entrar', Icon: IconUser },
  ];

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {items.map(({ to, label, Icon, highlight }) => (
        <NavLink
          key={to + label}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''} ${highlight ? 'highlight' : ''}`}
        >
          <span className="bottom-nav-icon"><Icon size="1.3rem" /></span>
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
