// ============================================================
//  FutBuddies - App.js v3 (lazy routes + ConfirmProvider)
// ============================================================

import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import Navbar from './components/layout/Navbar';
import BottomNav from './components/layout/BottomNav';
import PageTransition from './components/PageTransition';
import CommandPalette from './components/CommandPalette';
import ScrollToTop from './components/ScrollToTop';
import CookieBanner from './components/CookieBanner';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import Home from './pages/Home';
import { Login, Registar } from './pages/Auth';
import NaoEncontrado from './pages/NaoEncontrado';

// Rotas pesadas em lazy load
const Jogos          = lazy(() => import('./pages/Jogos'));
const MeusJogos      = lazy(() => import('./pages/MeusJogos'));
const JogoDetalhe    = lazy(() => import('./pages/JogoDetalhe'));
const CriarJogo      = lazy(() => import('./pages/CriarJogo'));
const Perfil         = lazy(() => import('./pages/Perfil'));
const Admin          = lazy(() => import('./pages/Admin'));
const PerfilPublico  = lazy(() => import('./pages/PerfilPublico'));
const Equipas        = lazy(() => import('./pages/Equipas'));
const EquipaDetalhe  = lazy(() => import('./pages/EquipaDetalhe'));
const CriarEquipa    = lazy(() => import('./pages/CriarEquipa'));
const Sobre          = lazy(() => import('./pages/Sobre'));
const Amigos         = lazy(() => import('./pages/Amigos'));
const ReportarJogo   = lazy(() => import('./pages/ReportarJogo'));
const DonoCampo      = lazy(() => import('./pages/DonoCampo'));
const Suporte        = lazy(() => import('./pages/Suporte'));
const Campos         = lazy(() => import('./pages/Campos'));
const AvaliarCampo   = lazy(() => import('./pages/AvaliarCampo'));

function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem' }}>
      <div className="spinner" />
    </div>
  );
}

function RotaProtegida({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Loading />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function RotaAdmin({ children }) {
  const { isAuthenticated, utilizador, loading } = useAuth();
  if (loading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (utilizador?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  useEffect(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      setTimeout(() => {
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 400);
      }, 2000);
    }
  }, []);

  return (
    <>
      <Navbar />
      <CommandPalette />
      <ScrollToTop />
      <CookieBanner />
      <PWAInstallPrompt />
      <Suspense fallback={<Loading />}>
       <PageTransition>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registar" element={<Registar />} />
          <Route path="/jogos" element={<Jogos />} />
          <Route path="/jogos/meus" element={<RotaProtegida><MeusJogos /></RotaProtegida>} />
          <Route path="/jogos/:id" element={<JogoDetalhe />} />
          <Route path="/jogos/:id/reportar" element={<RotaProtegida><ReportarJogo /></RotaProtegida>} />
          <Route path="/jogos/:id/avaliar-campo" element={<RotaProtegida><AvaliarCampo /></RotaProtegida>} />
          <Route path="/jogos/criar" element={<RotaProtegida><CriarJogo /></RotaProtegida>} />
          <Route path="/perfil" element={<RotaProtegida><Perfil /></RotaProtegida>} />
          <Route path="/jogadores/:id" element={<PerfilPublico />} />
          <Route path="/equipas" element={<Equipas />} />
          <Route path="/equipas/criar" element={<RotaProtegida><CriarEquipa /></RotaProtegida>} />
          <Route path="/equipas/:id" element={<EquipaDetalhe />} />
          <Route path="/campos" element={<Campos />} />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="/amigos" element={<RotaProtegida><Amigos /></RotaProtegida>} />
          <Route path="/dono-campo" element={<RotaProtegida><DonoCampo /></RotaProtegida>} />
          <Route path="/suporte" element={<Suporte />} />
          <Route path="/admin" element={<RotaAdmin><Admin /></RotaAdmin>} />
          <Route path="*" element={<NaoEncontrado />} />
        </Routes>
       </PageTransition>
      </Suspense>
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <AppRoutes />
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
