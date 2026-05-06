// ============================================================
//  FutBuddies - Criar Jogo (v2 — público/privado + região)
// ============================================================

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../utils/api';
import { REGIOES, NIVEIS, NIVEL_COR } from '../utils/constantes';
import {
  IconLock, IconBall, IconUser, IconStadium, IconGlobe,
  IconMapPin, IconClock,
} from '../components/Icons';
import TimeSlotPicker from '../components/TimeSlotPicker';
import DatePickerFB from '../components/DatePickerFB';
import './CriarJogo.css';

// Importado lazily — Leaflet só carrega quando o utilizador abre o picker
const MapaPinPicker = lazy(() => import('../components/MapaPinPicker'));

function parseArr(raw, fallback) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

export default function CriarJogo() {
  const { isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // ?campoId= pré-selecciona campo parceiro (vindo da página /campos)
  // ?fromId=  pré-preenche a partir de um jogo existente (repetir jogo)
  const queryCampoId = new URLSearchParams(location.search).get('campoId') || '';
  const queryFromId  = new URLSearchParams(location.search).get('fromId')  || '';

  const [form, setForm] = useState({
    titulo: '', descricao: '', dataJogo: '', local: '', regiao: '',
    tipoJogo: '5x5', maxJogadores: 10, visibilidade: 'publico', nivel: 'Descontraído',
    modoJogo: 'individual',
    tipoLocal: queryCampoId ? 'parceiro' : 'publico',
    campoId: queryCampoId,
    formatoLotacao: null,
    modeloPagamento: '', precoTotalCents: 0,
    recorrencia: null, recorrenciaOcorrencias: 0,
    latitude: null, longitude: null,
  });
  const [mostrarMapaPicker, setMostrarMapaPicker] = useState(false);
  const [campos, setCampos] = useState([]);

  // Se chegou via ?campoId= sem região, carrega esse campo directamente
  useEffect(() => {
    if (queryCampoId && !form.regiao) {
      api.get(`/campos/${queryCampoId}`)
        .then(r => {
          const c = r.data?.campo;
          if (c) {
            setCampos([c]);
            setForm(f => ({ ...f, regiao: c.regiao || f.regiao }));
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line
  }, [queryCampoId]);

  // ?fromId= — repetir jogo: copia tudo do jogo anterior, limpa data
  useEffect(() => {
    if (!queryFromId) return;
    api.get(`/jogos/${queryFromId}`)
      .then(r => {
        const j = r.data?.jogo;
        if (!j) return;
        const proxSemana = new Date(j.data_jogo);
        proxSemana.setDate(proxSemana.getDate() + 7);
        // Formato datetime-local: YYYY-MM-DDTHH:mm
        const pad = (n) => String(n).padStart(2, '0');
        const dataLocal = `${proxSemana.getFullYear()}-${pad(proxSemana.getMonth()+1)}-${pad(proxSemana.getDate())}T${pad(proxSemana.getHours())}:${pad(proxSemana.getMinutes())}`;
        setForm(f => ({
          ...f,
          titulo: j.titulo || f.titulo,
          descricao: j.descricao || '',
          dataJogo: dataLocal,
          local: j.local || '',
          regiao: j.regiao || '',
          tipoJogo: j.tipo_jogo || f.tipoJogo,
          maxJogadores: j.max_jogadores || f.maxJogadores,
          visibilidade: j.visibilidade || f.visibilidade,
          nivel: j.nivel || f.nivel,
          modoJogo: j.modo_jogo || f.modoJogo,
          tipoLocal: j.tipo_local || f.tipoLocal,
          campoId: j.campo_id ? String(j.campo_id) : '',
          formatoLotacao: j.tipo_jogo ? parseInt(String(j.tipo_jogo).split('x')[0]) : null,
        }));
        addToast(`Dados copiados de "${j.titulo}". Ajusta a data e confirma!`, 'info', 4500);
      })
      .catch(() => addToast('Não foi possível carregar o jogo anterior.', 'error'));
    // eslint-disable-next-line
  }, [queryFromId]);

  useEffect(() => {
    if (form.tipoLocal !== 'parceiro' || !form.regiao) { setCampos([]); return; }
    api.get(`/campos?regiao=${encodeURIComponent(form.regiao)}`)
      .then(r => setCampos(r.data.campos || []))
      .catch(() => setCampos([]));
  }, [form.tipoLocal, form.regiao]);

  // Auto-calcular preço total a partir do campo seleccionado
  useEffect(() => {
    if (form.tipoLocal === 'parceiro' && form.campoId) {
      const c = campos.find(x => String(x.id) === String(form.campoId));
      if (c) {
        const horas = (c.duracao_min || 60) / 60;
        setForm(f => ({ ...f, precoTotalCents: Math.round((c.preco_hora_cents || 0) * horas) }));
      }
    }
  }, [form.campoId, form.tipoLocal, campos]);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [codigoCriado, setCodigoCriado] = useState(null);

  if (!isAuthenticated) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', flexDirection: 'column', gap: '1rem' }}>
      <h2>Precisas de estar autenticado</h2>
      <Link to="/login" className="btn btn-primary">Fazer Login</Link>
    </div>
  );

  const tiposJogo = [
    { value: '5x5', label: '5x5', sub: '10 jogadores', max: 10 },
    { value: '7x7', label: '7x7', sub: '14 jogadores', max: 14 },
    { value: '11x11', label: '11x11', sub: '22 jogadores', max: 22 },
    { value: 'personalizado', label: 'Custom', sub: 'Tu defines', max: null },
  ];

  const handleTipoChange = (tipo) => {
    const t = tiposJogo.find(t => t.value === tipo);
    setForm(f => ({ ...f, tipoJogo: tipo, maxJogadores: t?.max || f.maxJogadores }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    if (!form.titulo.trim()) return setErro('O título é obrigatório.');
    if (!form.dataJogo) return setErro('A data e hora são obrigatórias.');
    if (new Date(form.dataJogo) < new Date()) return setErro('A data tem de ser no futuro.');
    if (!form.regiao) return setErro('Escolhe a região do jogo.');
    if (form.tipoLocal === 'parceiro') {
      if (!form.campoId) return setErro('Escolhe um campo parceiro.');
      if (!form.formatoLotacao) return setErro('Escolhe o formato do jogo (5x5, 6x6, 7x7…).');
      if (!form.modeloPagamento) return setErro('Escolhe o modelo de pagamento.');
      if (!form.precoTotalCents || form.precoTotalCents <= 0)
        return setErro('Preço total inválido.');
    }

    setLoading(true);
    try {
      const res = await api.post('/jogos', form);
      if (res.data.recorrenciaCriados > 0) {
        addToast(`Jogo criado + ${res.data.recorrenciaCriados} ocorrência(s) adicional(is) agendada(s).`, 'success', 4500);
      }
      if (res.data.codigoAcesso) setCodigoCriado(res.data.codigoAcesso);
      else navigate(`/jogos/${res.data.jogoId}`);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao criar jogo.');
    } finally {
      setLoading(false);
    }
  };

  // Mostrar código de acesso após criar jogo privado
  if (codigoCriado) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '2rem' }}>
      <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '2.5rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><IconLock size="3rem" /></div>
        <h2 style={{ marginBottom: '0.5rem' }}>Jogo Privado Criado!</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Partilha este código com os teus amigos para que se possam inscrever.
        </p>
        <div style={{ background: 'var(--bg-input)', border: '2px dashed var(--primary)', borderRadius: 'var(--radius-lg)',
          padding: '1.5rem', marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '1px' }}>CÓDIGO DE ACESSO</p>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '6px' }}>
            {codigoCriado}
          </p>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Guarda bem este código — não é possível recuperá-lo depois.
        </p>
        <button className="btn btn-primary btn-lg w-full" onClick={() => navigate('/jogos')}>
          Ir para os Jogos →
        </button>
      </div>
    </div>
  );

  const nivelCor = NIVEL_COR[form.nivel] || NIVEL_COR['Descontraído'];

  return (
    <div className="criar-jogo-page">
      <div className="container">
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          <Link to="/jogos" style={{ color: 'var(--primary)' }}>← Voltar aos Jogos</Link>
        </p>
        <div className="criar-jogo-container">
          <div className="criar-jogo-header">
            <h1><IconBall size="1em" /> Criar Novo Jogo</h1>
            <p>Preenche os detalhes do teu jogo</p>
          </div>

          {erro && <div className="auth-error">{erro}</div>}

          <form onSubmit={handleSubmit} className="criar-jogo-form">

            {/* Modo de Jogo */}
            <div className="form-field">
              <label>Modo de Jogo</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { v: 'individual', icon: <IconUser size="1.5rem" />, titulo: 'Individual', desc: 'Jogadores inscrevem-se individualmente.' },
                  { v: 'equipa', icon: <IconStadium size="1.5rem" />, titulo: 'Equipa vs Equipa', desc: 'Apenas equipas podem inscrever-se.' },
                ].map(opt => (
                  <button key={opt.v} type="button" onClick={() => setForm(f => ({ ...f, modoJogo: opt.v }))}
                    className={`tipo-jogo-btn ${form.modoJogo === opt.v ? 'active' : ''}`}
                    style={{ flexDirection: 'column', gap: '0.25rem', padding: '1rem', textAlign: 'left' }}>
                    <span style={{ fontSize: '1.5rem' }}>{opt.icon}</span>
                    <span className="tipo-jogo-value">{opt.titulo}</span>
                    <span className="tipo-jogo-label" style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Visibilidade */}
            <div className="form-field">
              <label>Tipo de Partida</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { v: 'publico', icon: <IconGlobe size="1.5rem" />, titulo: 'Pública', desc: 'Aberta à comunidade. Morada visível.' },
                  { v: 'privado', icon: <IconLock size="1.5rem" />, titulo: 'Privada', desc: 'Só com código de acesso. Morada oculta.' },
                ].map(opt => (
                  <button key={opt.v} type="button" onClick={() => setForm(f => ({ ...f, visibilidade: opt.v }))}
                    className={`tipo-jogo-btn ${form.visibilidade === opt.v ? 'active' : ''}`}
                    style={{ flexDirection: 'column', gap: '0.25rem', padding: '1rem', textAlign: 'left' }}>
                    <span style={{ fontSize: '1.5rem' }}>{opt.icon}</span>
                    <span className="tipo-jogo-value">{opt.titulo}</span>
                    <span className="tipo-jogo-label" style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-field">
              <label>Título do Jogo *</label>
              <input type="text" placeholder="Ex: Jogo de Quinta-feira" value={form.titulo}
                onChange={e => setForm({ ...form, titulo: e.target.value })} required autoFocus />
            </div>

            <div className="form-field">
              <label>Descrição</label>
              <textarea placeholder="Descreve o jogo, regras especiais, etc." value={form.descricao}
                onChange={e => setForm({ ...form, descricao: e.target.value })} rows={3} style={{ resize: 'vertical' }} />
            </div>

            <div className="form-row">
              {form.tipoLocal !== 'parceiro' && (
                <div className="form-field">
                  <label>Data e Hora *</label>
                  <DatePickerFB
                    mode="datetime"
                    value={form.dataJogo}
                    onChange={(v) => setForm({ ...form, dataJogo: v })}
                    min={new Date()}
                    placeholder="Escolhe data e hora"
                  />
                </div>
              )}
              <div className="form-field">
                <label>Região * <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem' }}>(visível a todos)</span></label>
                <select value={form.regiao} onChange={e => setForm({ ...form, regiao: e.target.value })} required>
                  <option value="">Seleciona a região</option>
                  {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {/* Tipo de Local */}
            <div className="form-field">
              <label>Onde vai ser o jogo?</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { v: 'publico',  icon: '🌳', titulo: 'Local Público',  desc: 'Jardim, pelado, escola... (grátis)' },
                  { v: 'parceiro', icon: '🏟️', titulo: 'Campo Parceiro', desc: 'Campo pago via Stripe, reserva com reembolso automático.' },
                ].map(opt => (
                  <button key={opt.v} type="button"
                    onClick={() => setForm(f => ({ ...f, tipoLocal: opt.v,
                      campoId: '', modeloPagamento: '', precoTotalCents: 0 }))}
                    className={`tipo-jogo-btn ${form.tipoLocal === opt.v ? 'active' : ''}`}
                    style={{ flexDirection: 'column', gap: '0.25rem', padding: '1rem', textAlign: 'left' }}>
                    <span style={{ fontSize: '1.5rem' }}>{opt.icon}</span>
                    <span className="tipo-jogo-value">{opt.titulo}</span>
                    <span className="tipo-jogo-label" style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Seleção de campo parceiro */}
            {form.tipoLocal === 'parceiro' && (
              <>
                <div className="form-field">
                  <label>Campo Parceiro *</label>
                  {campos.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {form.regiao
                        ? 'Ainda não há campos parceiros nesta região.'
                        : 'Escolhe primeiro a região para veres os campos disponíveis.'}
                    </p>
                  ) : (
                    <select value={form.campoId} onChange={e => setForm({ ...form, campoId: e.target.value })} required>
                      <option value="">Seleciona o campo</option>
                      {campos.map(c => (
                        <option key={c.id} value={c.id}
                                disabled={!c.dono_charges_enabled}>
                          {c.nome} · {c.tipo_piso || '—'} · €{(c.preco_hora_cents / 100).toFixed(2)}/h
                          {!c.dono_charges_enabled ? ' (indisponível)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {form.campoId && (() => {
                  const campoSel = campos.find(c => String(c.id) === String(form.campoId));
                  const lotacoes = parseArr(campoSel?.lotacoes_json, [5, 7]);
                  return (
                  <>
                    {/* Lotação do jogo (limitada pelo que o dono permite) */}
                    <div className="form-field">
                      <label>Formato do Jogo * <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem' }}>(definido pelo dono do campo)</span></label>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${lotacoes.length}, 1fr)`, gap: '0.75rem' }}>
                        {lotacoes.map(l => (
                          <button key={l} type="button"
                            onClick={() => setForm(f => ({
                              ...f,
                              formatoLotacao: l,
                              tipoJogo: `${l}x${l}`,
                              maxJogadores: l * 2,
                            }))}
                            className={`tipo-jogo-btn ${form.formatoLotacao === l ? 'active' : ''}`}
                            style={{ flexDirection: 'column', gap: '0.2rem', padding: '1rem', textAlign: 'center' }}>
                            <span className="tipo-jogo-value">{l}x{l}</span>
                            <span className="tipo-jogo-label">{l * 2} jogadores</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Seletor de horários livres/reservados */}
                    <div className="form-field">
                      <label>Horário Disponível *</label>
                      <TimeSlotPicker
                        campoId={form.campoId}
                        value={form.dataJogo}
                        onChange={(val) => setForm(f => ({ ...f, dataJogo: val }))}
                      />
                    </div>

                    <div className="form-field">
                      <label>Modelo de Pagamento *</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        {[
                          { v: 'total',    titulo: '💳 Paga Tudo',     desc: 'O criador paga o valor total.' },
                          { v: 'dividido', titulo: '👥 Dividido (Racha)', desc: 'Cada jogador paga a sua parte.' },
                        ].map(opt => (
                          <button key={opt.v} type="button"
                            onClick={() => setForm(f => ({ ...f, modeloPagamento: opt.v }))}
                            className={`tipo-jogo-btn ${form.modeloPagamento === opt.v ? 'active' : ''}`}
                            style={{ flexDirection: 'column', gap: '0.25rem', padding: '1rem', textAlign: 'left' }}>
                            <span className="tipo-jogo-value">{opt.titulo}</span>
                            <span className="tipo-jogo-label" style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="form-field">
                      <label>Preço Total (€) *</label>
                      <input type="number" min="1" step="0.50"
                        value={(form.precoTotalCents || 0) / 100}
                        onChange={e => setForm({ ...form, precoTotalCents: Math.round(parseFloat(e.target.value || 0) * 100) })} />
                      {form.modeloPagamento === 'dividido' && form.maxJogadores > 0 && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '.3rem' }}>
                          ≈ €{(Math.ceil(form.precoTotalCents / form.maxJogadores) / 100).toFixed(2)} por jogador
                        </p>
                      )}
                      <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '.3rem' }}>
                        ⏰ O valor deve ser pago até 30 min antes do jogo. Se não for atingido, os pagamentos são reembolsados automaticamente.
                      </p>
                    </div>
                  </>
                  );
                })()}
              </>
            )}

            {/* Local — só relevante para públicos */}
            {form.tipoLocal !== 'parceiro' && (
            <div className="form-field">
              <label>
                {form.visibilidade === 'publico' ? 'Morada / Local' : 'Morada / Local (privada)'}
                {form.visibilidade === 'privado' && (
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 600 }}>
                    <IconLock size="0.75em" /> Só visível para inscritos
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                <input
                  type="text"
                  placeholder="Ex: Campo do Bairro, Rua das Flores 10"
                  value={form.local}
                  onChange={e => setForm({ ...form, local: e.target.value })}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setMostrarMapaPicker(true)}
                  title="Marcar localização exacta no mapa"
                  style={{ flexShrink: 0, padding: '0 0.85rem', fontSize: '1.1rem' }}
                >
                  📍
                </button>
              </div>
              {/* Indicador quando há pin colocado */}
              {form.latitude && (
                <p style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>📌</span>
                  <span>Pin exacto: {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}</span>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, latitude: null, longitude: null }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', textDecoration: 'underline', padding: 0 }}
                  >
                    remover
                  </button>
                </p>
              )}
            </div>
            )}

            {/* Modal do picker de pin — lazy loaded */}
            {mostrarMapaPicker && (
              <Suspense fallback={<div style={{ display:'flex', justifyContent:'center', padding:'2rem' }}><div className="spinner" /></div>}>
                <MapaPinPicker
                  regiao={form.regiao}
                  posInicial={form.latitude ? [form.latitude, form.longitude] : null}
                  onCancelar={() => setMostrarMapaPicker(false)}
                  onConfirmar={(coords) => {
                    setForm(f => ({
                      ...f,
                      latitude:  coords?.lat ?? null,
                      longitude: coords?.lng ?? null,
                    }));
                    setMostrarMapaPicker(false);
                  }}
                />
              </Suspense>
            )}

            {/* Nível */}
            <div className="form-field">
              <label>Nível de Competitividade</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {NIVEIS.map(n => {
                  const nc = NIVEL_COR[n];
                  return (
                    <button key={n} type="button" onClick={() => setForm(f => ({ ...f, nivel: n }))}
                      style={{ flex: 1, padding: '0.625rem', borderRadius: 'var(--radius)', border: `1.5px solid ${form.nivel === n ? nc.borda : 'var(--border)'}`,
                        background: form.nivel === n ? nc.bg : 'transparent', color: form.nivel === n ? nc.cor : 'var(--text-muted)',
                        fontWeight: form.nivel === n ? 700 : 500, cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.2s' }}>
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tipo de jogo (apenas para locais públicos) */}
            {form.tipoLocal !== 'parceiro' && (
              <div className="form-field">
                <label>Tipo de Jogo</label>
                <div className="tipo-jogo-grid">
                  {tiposJogo.map(t => (
                    <button key={t.value} type="button"
                      className={`tipo-jogo-btn ${form.tipoJogo === t.value ? 'active' : ''}`}
                      onClick={() => handleTipoChange(t.value)}>
                      <span className="tipo-jogo-value">{t.label}</span>
                      <span className="tipo-jogo-label">{t.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.tipoLocal !== 'parceiro' && form.tipoJogo === 'personalizado' && (
              <div className="form-field">
                <label>Número máximo de jogadores</label>
                <input type="number" min={2} max={50} value={form.maxJogadores}
                  onChange={e => setForm({ ...form, maxJogadores: parseInt(e.target.value) })} />
              </div>
            )}

            {/* Recorrência (apenas para jogos não-parceiro) */}
            {form.tipoLocal !== 'parceiro' && (
              <div className="form-field">
                <label>Repetir jogo automaticamente</label>
                <div className="tipo-jogo-buttons">
                  {[['', 'Não repetir'], ['semanal', 'Semanal'], ['quinzenal', 'Quinzenal'], ['mensal', 'Mensal']].map(([v, l]) => (
                    <button
                      key={v || 'none'}
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        recorrencia: v || null,
                        recorrenciaOcorrencias: v ? (f.recorrenciaOcorrencias || 4) : 0,
                      }))}
                      className={`tipo-jogo-btn ${(form.recorrencia || '') === v ? 'active' : ''}`}
                    >{l}</button>
                  ))}
                </div>
                {form.recorrencia && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <label style={{ margin: 0, fontSize: '0.9rem' }}>Quantas ocorrências extra?</label>
                    <input
                      type="number" min={1} max={8}
                      value={form.recorrenciaOcorrencias}
                      onChange={e => setForm({ ...form, recorrenciaOcorrencias: Math.max(1, Math.min(8, parseInt(e.target.value) || 1)) })}
                      style={{ width: 80 }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      (até 8, criados já com data calculada)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Preview */}
            <div className="criar-jogo-preview card">
              <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>RESUMO</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{form.titulo || 'Título do Jogo'}</span>
                {form.visibilidade === 'privado' && <span><IconLock size="0.9em" /></span>}
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                <IconMapPin size="0.85em" /> {form.regiao || 'Região'}{form.visibilidade === 'publico' && form.local ? ` — ${form.local}` : ''} &nbsp;·&nbsp;
                <IconClock size="0.85em" /> {form.dataJogo ? new Date(form.dataJogo).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Data a definir'}
              </p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                  {form.modoJogo === 'equipa' ? <><IconStadium size="0.85em" /> Equipa vs Equipa</> : `${form.tipoJogo} · ${form.maxJogadores} jogadores`}
                </span>
                &nbsp;·&nbsp;
                <span style={{ color: nivelCor.cor, fontWeight: 600 }}>{form.nivel}</span>
              </p>
            </div>

            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
              {loading ? 'A criar jogo...' : form.visibilidade === 'privado' ? <><IconLock size="1em" /> Criar Jogo Privado</> : <><IconBall size="1em" /> Criar Jogo Público</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
