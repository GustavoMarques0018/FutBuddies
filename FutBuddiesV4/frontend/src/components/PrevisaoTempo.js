// ============================================================
//  FutBuddies - Previsão do Tempo (Open-Meteo, sem API key)
// ============================================================

import React, { useState, useEffect } from 'react';

// WMO weather codes: https://open-meteo.com/en/docs
const WMO = {
  0:'☀️ Céu limpo', 1:'🌤️ Pouco nublado', 2:'⛅ Nublado', 3:'☁️ Muito nublado',
  45:'🌫️ Nevoeiro', 48:'🌫️ Nevoeiro', 51:'🌦️ Chuvisco', 53:'🌦️ Chuvisco', 55:'🌦️ Chuvisco',
  61:'🌧️ Chuva', 63:'🌧️ Chuva', 65:'🌧️ Chuva forte', 71:'🌨️ Neve', 80:'🌧️ Aguaceiros',
  81:'🌧️ Aguaceiros', 82:'⛈️ Aguaceiros fortes', 95:'⛈️ Trovoada', 99:'⛈️ Trovoada com granizo',
};

const MAU_TEMPO_CODES = [61, 63, 65, 80, 81, 82, 95, 99];

export default function PrevisaoTempo({ lat, lng, dataJogo, regiao }) {
  const [tempo, setTempo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lat || !lng || !dataJogo) return;
    const gameDate = new Date(dataJogo);
    const today = new Date();
    const diffDays = Math.ceil((gameDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays > 7) return;

    setLoading(true);
    const dateStr = gameDate.toISOString().slice(0, 10);
    const hour = gameDate.getHours();

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,precipitation_probability,weathercode&timezone=Europe%2FLisbon&start_date=${dateStr}&end_date=${dateStr}`
    )
      .then(r => r.json())
      .then(d => {
        if (!d.hourly) return;
        const idx = Math.min(hour, d.hourly.time.length - 1);
        setTempo({
          temp: Math.round(d.hourly.temperature_2m[idx]),
          precip: d.hourly.precipitation_probability[idx],
          code: d.hourly.weathercode[idx],
          desc: WMO[d.hourly.weathercode[idx]] || '🌡️',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lat, lng, dataJogo]);

  if (!lat || !lng || !dataJogo) return null;
  const diffDays = Math.ceil((new Date(dataJogo) - new Date()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0 || diffDays > 7) return null;

  if (loading) return (
    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>🌤️ A carregar previsão...</div>
  );
  if (!tempo) return null;

  const mauTempo = tempo.precip > 60 || MAU_TEMPO_CODES.includes(tempo.code);

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-sm)',
      background: mauTempo ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
      border: `1px solid ${mauTempo ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
      fontSize: '0.82rem', marginTop: '0.5rem',
    }}>
      <span>{tempo.desc}</span>
      <span>{tempo.temp}°C</span>
      {tempo.precip > 20 && <span>💧 {tempo.precip}% chuva</span>}
      {mauTempo && <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠️ Mau tempo previsto</span>}
    </div>
  );
}
