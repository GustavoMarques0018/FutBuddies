// ============================================================
//  FutBuddies - ConfirmDialog (substitui window.confirm/window.prompt)
//
//  Uso:
//    const confirmar = useConfirm();
//    const ok = await confirmar({
//      titulo: 'Eliminar jogo?',
//      mensagem: 'Esta acção é irreversível.',
//      confirmarLabel: 'Eliminar',
//      variante: 'danger',
//    });
//    if (ok) { ... }
//
//    const perguntar = usePrompt();
//    const motivo = await perguntar({
//      titulo: 'Motivo da rejeição',
//      placeholder: 'Opcional',
//      multiline: true,
//    });
//    // motivo === null  →  cancelado
// ============================================================

import React, { createContext, useCallback, useContext, useRef, useState, useEffect } from 'react';
import './ConfirmDialog.css';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [estado, setEstado] = useState(null); // { tipo, titulo, mensagem, ... }
  const [valor, setValor] = useState('');
  const resolverRef = useRef(null);
  const inputRef = useRef(null);

  const confirmar = useCallback((opcoes) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setEstado({
        tipo: 'confirm',
        titulo: opcoes?.titulo || 'Confirmar',
        mensagem: opcoes?.mensagem || 'Tens a certeza?',
        confirmarLabel: opcoes?.confirmarLabel || 'Confirmar',
        cancelarLabel: opcoes?.cancelarLabel || 'Cancelar',
        variante: opcoes?.variante || 'primary',
      });
    });
  }, []);

  const perguntar = useCallback((opcoes) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setValor(opcoes?.valorInicial || '');
      setEstado({
        tipo: 'prompt',
        titulo: opcoes?.titulo || 'Indica um valor',
        mensagem: opcoes?.mensagem || '',
        placeholder: opcoes?.placeholder || '',
        multiline: !!opcoes?.multiline,
        obrigatorio: !!opcoes?.obrigatorio,
        confirmarLabel: opcoes?.confirmarLabel || 'Confirmar',
        cancelarLabel: opcoes?.cancelarLabel || 'Cancelar',
        variante: opcoes?.variante || 'primary',
      });
    });
  }, []);

  const fechar = useCallback((resultado) => {
    if (resolverRef.current) resolverRef.current(resultado);
    resolverRef.current = null;
    setEstado(null);
    setValor('');
  }, []);

  // Foco automático no input do prompt
  useEffect(() => {
    if (estado?.tipo === 'prompt') {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [estado]);

  // Atalhos de teclado
  useEffect(() => {
    if (!estado) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        fechar(estado.tipo === 'prompt' ? null : false);
      } else if (e.key === 'Enter') {
        // Em textarea o Enter quebra linha; só confirma com Ctrl/Cmd+Enter
        if (estado.tipo === 'prompt' && estado.multiline && !(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        if (estado.tipo === 'prompt') {
          if (estado.obrigatorio && !valor.trim()) return;
          fechar(valor);
        } else {
          fechar(true);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [estado, valor, fechar]);

  const onClickFundo = () => fechar(estado?.tipo === 'prompt' ? null : false);
  const onCancelar  = () => fechar(estado?.tipo === 'prompt' ? null : false);
  const onConfirmar = () => {
    if (estado?.tipo === 'prompt') {
      if (estado.obrigatorio && !valor.trim()) return;
      fechar(valor);
    } else {
      fechar(true);
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirmar, perguntar }}>
      {children}
      {estado && (
        <div className="confirm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClickFundo(); }}>
          <div
            className={`confirm-dialog confirm-${estado.variante}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-titulo"
          >
            <h3 id="confirm-titulo" className="confirm-title">{estado.titulo}</h3>
            {estado.mensagem && <p className="confirm-message">{estado.mensagem}</p>}

            {estado.tipo === 'prompt' && (
              estado.multiline ? (
                <textarea
                  ref={inputRef}
                  className="confirm-input confirm-textarea"
                  rows={4}
                  placeholder={estado.placeholder}
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                />
              ) : (
                <input
                  ref={inputRef}
                  className="confirm-input"
                  placeholder={estado.placeholder}
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                />
              )
            )}

            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={onCancelar}>
                {estado.cancelarLabel}
              </button>
              <button
                className={`btn btn-${estado.variante === 'danger' ? 'danger' : 'primary'}`}
                onClick={onConfirmar}
                autoFocus={estado.tipo !== 'prompt'}
                disabled={estado.tipo === 'prompt' && estado.obrigatorio && !valor.trim()}
              >
                {estado.confirmarLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm tem de ser usado dentro de <ConfirmProvider>');
  return ctx.confirmar;
}

export function usePrompt() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('usePrompt tem de ser usado dentro de <ConfirmProvider>');
  return ctx.perguntar;
}
