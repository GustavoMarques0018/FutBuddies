// ============================================================
//  FutBuddies - Gráfico de Forma do Jogador (12 meses)
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import api from '../utils/api';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function FormaChart({ utilizadorId }) {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!utilizadorId) return;
    api.get(`/jogadores/${utilizadorId}/forma`)
      .then(r => {
        const d = r.data.forma || [];
        // Preencher meses em falta com zeros
        const agora = new Date();
        const mapa = {};
        d.forEach(x => { mapa[`${x.ano}-${x.mes}`] = x; });

        const resultado = [];
        for (let i = 11; i >= 0; i--) {
          const dt = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
          const chave = `${dt.getFullYear()}-${dt.getMonth() + 1}`;
          resultado.push({
            label: MESES[dt.getMonth()],
            jogos:        mapa[chave]?.jogos || 0,
            golos:        mapa[chave]?.golos || 0,
            assistencias: mapa[chave]?.assistencias || 0,
          });
        }
        setDados(resultado);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [utilizadorId]);

  if (loading) return <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;
  if (dados.every(d => d.jogos === 0 && d.golos === 0)) return (
    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
      Ainda sem dados suficientes para mostrar a forma.
    </p>
  );

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={dados} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8rem' }}
          labelStyle={{ color: 'var(--text)' }}
        />
        <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
        <Line type="monotone" dataKey="jogos"        name="Jogos"        stroke="var(--text-muted)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="golos"        name="Golos"        stroke="var(--success)"    strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="assistencias" name="Assistências" stroke="var(--info)"       strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
