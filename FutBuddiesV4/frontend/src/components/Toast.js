// ============================================================
//  FutBuddies - Sistema de Toasts
// ============================================================

import React, { createContext, useContext, useState, useCallback } from 'react';
import './Toast.css';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((mensagem, tipo = 'success', duracao = 3500) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, mensagem, tipo }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duracao);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.tipo}`}>
            <span className="toast-icon">
              {toast.tipo === 'success' && '✓'}
              {toast.tipo === 'error' && '✕'}
              {toast.tipo === 'info' && 'ℹ'}
            </span>
            <span className="toast-msg">{toast.mensagem}</span>
            <button
              className="toast-close"
              onClick={() => removeToast(toast.id)}
              aria-label="Fechar notificação"
            >×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
}
