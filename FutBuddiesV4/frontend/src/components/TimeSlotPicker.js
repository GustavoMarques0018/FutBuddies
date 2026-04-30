// ============================================================
//  FutBuddies - Seletor de horários de um campo (Livre/Reservado)
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import DatePickerFB from './DatePickerFB';
import './TimeSlotPicker.css';

const hojeISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Constroi uma string local "YYYY-MM-DDTHH:MM" a partir de data + minutos
const toLocalInputValue = (dataISO, minutos) => {
  const hh = String(Math.floor(minutos / 60)).padStart(2, '0');
  const mm = String(minutos % 60).padStart(2, '0');
  return `${dataISO}T${hh}:${mm}`;
};

export default function TimeSlotPicker({ campoId, value, onChange }) {
  const [data, setData] = useState(() => {
    if (value) return value.slice(0, 10);
    return hojeISO();
  });
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechado, setFechado] = useState(false);
  const [erro, setErro] = useState('');

  const selectedMin = useMemo(() => {
    if (!value || !value.startsWith(data)) return null;
    const t = value.slice(11, 16);
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }, [value, data]);

  useEffect(() => {
    if (!campoId || !data) { setSlots([]); return; }
    let cancel = false;
    setLoading(true); setErro(''); setFechado(false);
    api.get(`/campos/${campoId}/disponibilidade?data=${data}`)
      .then(r => {
        if (cancel) return;
        if (r.data?.fechado) { setFechado(true); setSlots([]); }
        else setSlots(r.data?.slots || []);
      })
      .catch(e => {
        if (cancel) return;
        const status = e.response?.status;
        const msg = e.response?.data?.mensagem;
        if (status === 500) {
          setErro('Backend falhou a ler a configuração do campo. Confirma que a migração v11 foi corrida (colunas hora_abertura, hora_fecho, slot_min, dias_semana_json, lotacoes_json).');
        } else {
          setErro(msg || 'Erro a carregar disponibilidade.');
        }
      })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [campoId, data]);

  const handleSlot = (slot) => {
    if (slot.estado !== 'livre') return;
    onChange?.(toLocalInputValue(data, slot.inicio));
  };

  if (!campoId) return null;

  return (
    <div className="tsp-wrap">
      <div className="tsp-header">
        <label className="tsp-date-label">Data</label>
        <DatePickerFB
          mode="date"
          value={data}
          min={hojeISO()}
          onChange={(v) => setData(v)}
          placeholder="Escolhe data"
          className="tsp-date"
        />
      </div>

      {loading && <p className="tsp-info">A carregar horários…</p>}
      {erro && <p className="tsp-erro">{erro}</p>}
      {fechado && <p className="tsp-info">Campo fechado neste dia.</p>}

      {!loading && !fechado && slots.length > 0 && (
        <>
          <div className="tsp-legend">
            <span className="tsp-dot livre" /> Livre
            <span className="tsp-dot reservado" /> Reservado
            <span className="tsp-dot bloqueado" /> Bloqueado
          </div>
          <div className="tsp-grid">
            {slots.map((s) => (
              <button
                key={s.inicio}
                type="button"
                disabled={s.estado !== 'livre'}
                onClick={() => handleSlot(s)}
                className={`tsp-slot ${s.estado} ${selectedMin === s.inicio ? 'sel' : ''}`}
                title={s.motivo || s.estado}
              >
                <span className="tsp-hora">{s.inicioHHMM}</span>
                <span className="tsp-fim">até {s.fimHHMM}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {!loading && !fechado && slots.length === 0 && !erro && (
        <p className="tsp-info">Sem horários para mostrar.</p>
      )}
    </div>
  );
}
