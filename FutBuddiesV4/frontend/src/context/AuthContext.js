// ============================================================
//  FutBuddies - Contexto de Autenticação
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

// Helpers para tokens (persistente vs sessão)
const getToken = (key) => localStorage.getItem(key) || sessionStorage.getItem(key);
const setToken = (key, value, persistent) => {
  if (persistent) {
    localStorage.setItem(key, value);
    sessionStorage.removeItem(key);
  } else {
    sessionStorage.setItem(key, value);
    localStorage.removeItem(key);
  }
};
const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
};

export function AuthProvider({ children }) {
  const [utilizador, setUtilizador] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carregar utilizador ao iniciar
  useEffect(() => {
    const token = getToken('accessToken');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/auth/me')
        .then(res => setUtilizador(res.data.utilizador))
        .catch(() => clearTokens())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password, lembrar = true) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken, utilizador: user } = res.data;
    setToken('accessToken', accessToken, lembrar);
    setToken('refreshToken', refreshToken, lembrar);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setUtilizador(user);
    return user;
  }, []);

  const registar = useCallback(async (nome, email, password, referralCode = null) => {
    const res = await api.post('/auth/registar', { nome, email, password, referralCode });
    const { accessToken, refreshToken, utilizador: user } = res.data;
    setToken('accessToken', accessToken, true);
    setToken('refreshToken', refreshToken, true);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setUtilizador(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getToken('refreshToken');
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    clearTokens();
    delete api.defaults.headers.common['Authorization'];
    setUtilizador(null);
  }, []);

  const atualizarUtilizador = useCallback((dados) => {
    setUtilizador(prev => prev ? { ...prev, ...dados } : prev);
  }, []);

  return (
    <AuthContext.Provider value={{ utilizador, loading, login, registar, logout, atualizarUtilizador, isAuthenticated: !!utilizador }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
