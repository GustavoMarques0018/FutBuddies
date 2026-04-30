// ============================================================
//  FutBuddies - DatePickerFB
//  Calendário/hora moderno temático (verde + dark) com react-datepicker.
//  Substitui inputs nativos type="date" / "datetime-local" / "time".
// ============================================================

import React, { forwardRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { pt } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import './DatePickerFB.css';

registerLocale('pt', pt);

// Botão custom para abrir o picker (matches input style)
const TriggerInput = forwardRef(({ value, onClick, placeholder, disabled, className }, ref) => (
  <button
    type="button"
    className={`fbdp-trigger ${className || ''} ${!value ? 'fbdp-trigger-empty' : ''}`}
    onClick={onClick}
    ref={ref}
    disabled={disabled}
  >
    <span className="fbdp-trigger-text">{value || placeholder || 'Escolher…'}</span>
    <svg className="fbdp-trigger-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M7 10h5v5H7v-5zm12-7h-1V1h-2v2H8V1H6v2H5C3.89 3 3 3.9 3 5l.01 14c0 1.1.89 2 1.99 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" />
    </svg>
  </button>
));
TriggerInput.displayName = 'FbdpTriggerInput';

/**
 * Props:
 *  - value: string ISO (YYYY-MM-DD) | datetime-local (YYYY-MM-DDTHH:mm) | time (HH:mm) | Date
 *  - onChange: (string) => void  // devolve no MESMO formato que value
 *  - mode: 'date' | 'datetime' | 'time'      (default: 'datetime')
 *  - min, max: string ISO ou Date (opcional)
 *  - placeholder, disabled, className
 *  - minTime/maxTime: para mode='time' ou 'datetime' restringir slot do dia
 */
export default function DatePickerFB({
  value,
  onChange,
  mode = 'datetime',
  min,
  max,
  placeholder,
  disabled,
  className,
}) {
  const parsed = parseValue(value, mode);
  const minDate = min ? parseValue(min, mode) : undefined;
  const maxDate = max ? parseValue(max, mode) : undefined;

  const handleChange = (date) => {
    if (!date) { onChange(''); return; }
    onChange(formatValue(date, mode));
  };

  const showTime = mode !== 'date';
  const showOnlyTime = mode === 'time';

  return (
    <DatePicker
      selected={parsed}
      onChange={handleChange}
      locale="pt"
      dateFormat={mode === 'time' ? 'HH:mm' : (mode === 'date' ? 'dd/MM/yyyy' : 'dd/MM/yyyy HH:mm')}
      showTimeSelect={showTime}
      showTimeSelectOnly={showOnlyTime}
      timeIntervals={15}
      timeCaption="Hora"
      minDate={minDate}
      maxDate={maxDate}
      placeholderText={placeholder}
      disabled={disabled}
      customInput={<TriggerInput placeholder={placeholder} className={className} />}
      popperClassName="fbdp-popper"
      calendarClassName="fbdp-calendar"
      todayButton="Hoje"
      shouldCloseOnSelect={mode !== 'datetime'}
      withPortal /* abre em portal para evitar clipping em modais */
      portalId="fbdp-portal-root"
    />
  );
}

// ── Helpers de parse/format ──────────────────────────────────
function parseValue(v, mode) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  // Strings: 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm', 'HH:mm'
  if (mode === 'time' && /^\d{2}:\d{2}/.test(v)) {
    const [h, m] = v.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function pad(n) { return String(n).padStart(2, '0'); }

function formatValue(d, mode) {
  if (mode === 'date') {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (mode === 'time') {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  // datetime-local style (sem timezone)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
