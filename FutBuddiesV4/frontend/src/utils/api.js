// ============================================================
//  FutBuddies - Cliente API (Axios + JWT Refresh)
// ============================================================

import axios from 'axios';

// Em localhost usa localhost:5000, noutro dispositivo (ex: telefone) usa o IP do servidor
const API_URL = process.env.REACT_APP_API_URL ||
  (window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : `http://${window.location.hostname}:5000/api`);

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Helpers de token (suporta localStorage OU sessionStorage)
const getToken = (key) => localStorage.getItem(key) || sessionStorage.getItem(key);
const setStoredToken = (key, value) => {
  // Mantém no mesmo storage que já existia
  if (sessionStorage.getItem(key) !== null) sessionStorage.setItem(key, value);
  else localStorage.setItem(key, value);
};
const removeAllTokens = () => {
  localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken');
  sessionStorage.removeItem('accessToken'); sessionStorage.removeItem('refreshToken');
};

// Interceptor de request — adicionar token
api.interceptors.request.use(config => {
  const token = getToken('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor de response — refresh automático do token
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => error ? prom.reject(error) : prom.resolve(token));
  failedQueue = [];
};

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;

    if (err.response?.status === 401 && err.response?.data?.expirado && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      const refreshToken = getToken('refreshToken');
      if (!refreshToken) {
        removeAllTokens();
        window.location.href = '/login';
        return Promise.reject(err);
      }

      try {
        const res = await axios.post(
          `${API_URL}/auth/refresh`,
          { refreshToken }
        );
        const { accessToken } = res.data;
        setStoredToken('accessToken', accessToken);
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        removeAllTokens();
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
