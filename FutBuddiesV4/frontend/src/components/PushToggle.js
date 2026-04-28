import React, { useEffect, useState } from 'react';
import { estadoSubscricao, subscreverPush, desinscreverPush, webPushSuportado } from '../utils/webPush';
import { useToast } from './Toast';

export default function PushToggle() {
  const { addToast } = useToast();
  const [estado, setEstado] = useState({ suportado: true, ativa: false, permissao: 'default' });
  const [loading, setLoading] = useState(false);

  const refrescar = async () => {
    try { setEstado(await estadoSubscricao()); } catch {}
  };

  useEffect(() => { refrescar(); }, []);

  if (!webPushSuportado()) {
    return (
      <div className="push-toggle-row" style={{ opacity: 0.6 }}>
        <div>
          <strong>Notificações push</strong>
          <div className="muted" style={{ fontSize: '0.8rem' }}>O teu browser não suporta Web Push.</div>
        </div>
      </div>
    );
  }

  const bloqueado = estado.permissao === 'denied';
  const ativa = estado.ativa && estado.permissao === 'granted';

  const ligar = async () => {
    try {
      setLoading(true);
      await subscreverPush();
      addToast('Notificações ativadas! 🔔', 'success');
      await refrescar();
    } catch (err) {
      addToast(err.message || 'Falha ao ativar notificações.', 'error');
    } finally { setLoading(false); }
  };

  const desligar = async () => {
    try {
      setLoading(true);
      await desinscreverPush();
      addToast('Notificações desativadas.', 'info');
      await refrescar();
    } catch (err) {
      addToast(err.message || 'Falha ao desativar.', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="push-toggle-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
      <div>
        <strong>🔔 Notificações push</strong>
        <div className="muted" style={{ fontSize: '0.8rem' }}>
          {bloqueado
            ? 'Bloqueadas neste browser. Ativa nas definições do site.'
            : ativa
              ? 'Ligadas — recebes alertas mesmo com o FutBuddies fechado.'
              : 'Recebe alertas de jogos, inscrições e conquistas mesmo com o app fechado.'}
        </div>
      </div>
      {!bloqueado && (
        <button
          type="button"
          className={`btn ${ativa ? 'btn-secondary' : 'btn-primary'}`}
          disabled={loading}
          onClick={ativa ? desligar : ligar}
        >
          {loading ? '...' : ativa ? 'Desativar' : 'Ativar'}
        </button>
      )}
    </div>
  );
}
