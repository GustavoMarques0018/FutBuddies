// ============================================================
//  FutBuddies - QR Code Check-in
// ============================================================

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../utils/api';

export default function QRCheckin({ jogo, isCriador, jaFezCheckin, onCheckin }) {
  const [loading, setLoading] = useState(false);
  const qrUrl = `${window.location.origin}/jogos/${jogo.id}?qr_checkin=1`;

  const handleScan = async () => {
    setLoading(true);
    try {
      await api.post(`/jogos/${jogo.id}/checkin-qr`);
      onCheckin?.();
    } catch (err) {
      alert(err?.response?.data?.mensagem || 'Erro ao fazer check-in');
    } finally {
      setLoading(false);
    }
  };

  if (isCriador) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '1.5rem', marginTop: '1rem' }}>
        <h4 style={{ marginBottom: '1rem' }}>📱 QR Code de Check-in</h4>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Mostra este código aos jogadores para fazerem check-in
        </p>
        <div style={{ display: 'inline-block', padding: '1rem', background: 'white', borderRadius: 8 }}>
          <QRCodeSVG value={qrUrl} size={200} />
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          {qrUrl}
        </p>
      </div>
    );
  }

  if (jaFezCheckin) {
    return (
      <div style={{ color: 'var(--primary)', fontWeight: 700 }}>✅ Check-in feito!</div>
    );
  }

  return (
    <button className="btn btn-primary" onClick={handleScan} disabled={loading}>
      {loading ? '⏳ A confirmar...' : '📱 Fazer Check-in por QR'}
    </button>
  );
}
