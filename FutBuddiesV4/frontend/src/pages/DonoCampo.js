// ============================================================
//  FutBuddies - Dono de Campo (Stripe Connect + CRUD + Wallet)
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { resolverImgUrl } from '../utils/constantes';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import DonoDashboard from '../components/DonoDashboard';
import DatePickerFB from '../components/DatePickerFB';
import './DonoCampo.css';

const fmt = (c) => (c == null ? '—' : `€${(c / 100).toFixed(2)}`);
const fmtData = (d) => d ? new Date(d).toLocaleString('pt-PT') : '—';

export default function DonoCampo() {
  const [tab, setTab] = useState('onboarding');
  const [conta, setConta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const { addToast } = useToast();

  const loadConta = useCallback(async () => {
    try {
      const { data } = await api.get('/stripe/connect/status');
      setConta(data.conta);
    } catch (e) {
      setConta(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const { data } = await api.get('/utilizadores/perfil');
      setMe(data.utilizador || data);
    } catch {}
  }, []);

  useEffect(() => { loadConta(); loadMe(); }, [loadConta, loadMe]);

  const isFieldOwner = me?.user_role === 'FIELD_OWNER';

  // Se o utilizador ainda não é FIELD_OWNER, só existe a aba "Candidatura"
  const tabs = isFieldOwner ? [
    ['onboarding', '💳 Pagamentos'],
    ['campos',     '🏟️ Campos'],
    ['dashboard',  '📊 Dashboard'],
    ['agenda',     '📅 Calendário'],
    ['wallet',     '💰 Wallet'],
  ] : [
    ['onboarding', '📝 Candidatura'],
  ];

  // Se estava numa aba que já não existe, volta ao onboarding
  useEffect(() => {
    if (!isFieldOwner && tab !== 'onboarding') setTab('onboarding');
  }, [isFieldOwner, tab]);

  return (
    <div className="dono-page">
      <header className="dono-header">
        <h1>🏟️ Dono de Campo</h1>
        <p>{isFieldOwner
          ? 'Gere os teus campos, pagamentos e calendário de reservas.'
          : 'Candidata-te para começares a disponibilizar os teus campos.'}</p>
      </header>

      <nav className="dono-tabs">
        {tabs.map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>

      <main className="dono-main">
        {tab === 'onboarding' && <TabOnboarding conta={conta} loading={loading} reload={loadConta} reloadMe={loadMe} me={me} addToast={addToast} />}
        {tab === 'campos'     && isFieldOwner && <TabCampos addToast={addToast} />}
        {tab === 'dashboard'  && isFieldOwner && <section className="dono-card"><DonoDashboard /></section>}
        {tab === 'agenda'     && isFieldOwner && <TabAgenda addToast={addToast} />}
        {tab === 'wallet'     && isFieldOwner && <TabWallet addToast={addToast} />}
      </main>
    </div>
  );
}

// ── TAB 1: Candidatura + Onboarding Stripe ─────────────────
function TabOnboarding({ conta, loading, reload, reloadMe, me, addToast }) {
  const [working, setWorking] = useState(false);
  const [candidaturas, setCandidaturas] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const cand = await api.get('/candidaturas/minhas');
      setCandidaturas(cand.data.candidaturas || []);
      reloadMe && reloadMe();
    } catch {}
  }, [reloadMe]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const iniciar = async () => {
    setWorking(true);
    try {
      const { data } = await api.post('/stripe/connect/onboarding');
      window.location.href = data.url;
    } catch (e) {
      addToast(e.response?.data?.mensagem || 'Erro a iniciar onboarding.', 'error');
      setWorking(false);
    }
  };

  const abrirDashboard = async () => {
    try {
      const { data } = await api.post('/stripe/connect/dashboard-link');
      window.open(data.url, '_blank');
    } catch (e) {
      addToast(e.response?.data?.mensagem || 'Erro.', 'error');
    }
  };

  if (loading) return <div className="spinner" />;

  const isFieldOwner = me?.user_role === 'FIELD_OWNER';
  const pendente = candidaturas.find(c => c.estado === 'pendente' || c.estado === 'info_requerida');
  const rejeitada = candidaturas.find(c => c.estado === 'rejeitada');

  // ── Estado A: Ainda não é FIELD_OWNER → candidatura ──
  if (!isFieldOwner) {
    return (
      <section className="dono-card">
        <h2>Candidatar-se a Dono de Campo</h2>
        <p>Para começares a receber reservas pagas no FutBuddies, precisas de submeter uma candidatura.
           A equipa vai verificar os dados do campo e a tua titularidade, e depois ficarás habilitado a configurar pagamentos via Stripe.</p>

        {pendente && (
          <div className="alert warn">
            <strong>⏳ Candidatura em análise</strong>
            <p className="tiny">Submetida em {fmtData(pendente.created_at)} — estado: <b>{pendente.estado}</b></p>
            {pendente.estado === 'info_requerida' && pendente.nota_admin && (
              <p>📝 <b>Nota do admin:</b> {pendente.nota_admin}</p>
            )}
          </div>
        )}

        {rejeitada && !pendente && (
          <div className="alert bad">
            <strong>❌ Candidatura anterior rejeitada</strong>
            {rejeitada.nota_admin && <p>Motivo: {rejeitada.nota_admin}</p>}
          </div>
        )}

        {!pendente && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            📝 {rejeitada ? 'Submeter Nova Candidatura' : 'Candidatar-me'}
          </button>
        )}

        {showForm && (
          <CandidaturaModal
            onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); loadAll(); addToast('Candidatura submetida!', 'success'); }}
            addToast={addToast}
          />
        )}
      </section>
    );
  }

  // ── Estado B: FIELD_OWNER aprovado → Stripe Onboarding ──
  const ativoConta = conta?.status === 'ativo' && conta?.charges_enabled;
  const badge = {
    ativo:             { cls: 'ok',   txt: '✅ Ativo'             },
    pendente:          { cls: 'warn', txt: '⏳ Em análise'         },
    acao_necessaria:   { cls: 'bad',  txt: '⚠ Ação necessária'    },
  }[conta?.status] || { cls: 'warn', txt: '—' };

  return (
    <section className="dono-card">
      <h2>Configurar Pagamentos</h2>
      <p>Para receberes pagamentos dos jogos no teu campo, liga a tua conta Stripe.
         É o Stripe que trata de tudo (cartões, transferências, impostos).</p>

      {!conta && (
        <button className="btn-primary" onClick={iniciar} disabled={working}>
          {working ? 'A abrir…' : '💳 Configurar Pagamentos'}
        </button>
      )}

      {conta && (
        <div className="conta-box">
          <div className="conta-status">
            <span className={`badge ${badge.cls}`}>{badge.txt}</span>
            <div className="tiny">Conta: <code>{conta.stripe_account_id}</code></div>
          </div>
          <ul className="check-list">
            <li className={conta.details_submitted ? 'ok' : 'bad'}>
              {conta.details_submitted ? '✅' : '⬜'} Dados submetidos
            </li>
            <li className={conta.charges_enabled ? 'ok' : 'bad'}>
              {conta.charges_enabled ? '✅' : '⬜'} Pagamentos ativos
            </li>
            <li className={conta.payouts_enabled ? 'ok' : 'bad'}>
              {conta.payouts_enabled ? '✅' : '⬜'} Transferências ativas
            </li>
          </ul>
          {!ativoConta && (
            <button className="btn-primary" onClick={iniciar} disabled={working}>
              {working ? 'A abrir…' : 'Continuar configuração'}
            </button>
          )}
          {ativoConta && (
            <button className="btn-secondary" onClick={abrirDashboard}>
              Abrir Stripe Dashboard ↗
            </button>
          )}
          <button className="btn-ghost" onClick={reload}>Atualizar estado</button>
        </div>
      )}
    </section>
  );
}

// ── Formulário de Candidatura ──────────────────────────────
function CandidaturaModal({ onClose, onSaved, addToast }) {
  const [form, setForm] = useState({
    nome: '', tipoPiso: '', morada: '', regiao: '', telefone: '',
    precoHoraCents: 0, duracaoMin: 60, nota: '',
    horaAbertura: 480, horaFecho: 1380, slotMin: 60,
    diasSemana: [1,2,3,4,5,6,7], lotacoes: [5,7],
  });
  const [fotos, setFotos] = useState([]);
  const [provaUrl, setProvaUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleArr = (key, val) => setForm(f => {
    const has = f[key].includes(val);
    return { ...f, [key]: has ? f[key].filter(x => x !== val) : [...f[key], val].sort((a,b)=>a-b) };
  });
  const opcoesHora = Array.from({ length: 48 }, (_, i) => i * 30);
  const hhmm = (m) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  const DIAS = [[1,'Seg'],[2,'Ter'],[3,'Qua'],[4,'Qui'],[5,'Sex'],[6,'Sáb'],[7,'Dom']];
  const LOTACOES = [5,6,7,8,11];

  const upload = async (file) => {
    const fd = new FormData(); fd.append('imagem', file);
    const { data } = await api.post('/upload/imagem', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return data.url;
  };

  const addFoto = async (file) => {
    try {
      const url = await upload(file);
      setFotos(f => [...f, url]);
    } catch { addToast('Erro no upload da foto.', 'error'); }
  };

  const uploadProva = async (file) => {
    try {
      const url = await upload(file);
      setProvaUrl(url);
    } catch { addToast('Erro no upload da prova.', 'error'); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!provaUrl) { addToast('Tens de submeter uma prova de titularidade.', 'error'); return; }
    if (fotos.length < 5) { addToast('Submete pelo menos 5 fotos do campo.', 'error'); return; }
    if (form.horaFecho <= form.horaAbertura) { addToast('Hora de fecho tem de ser depois da abertura.', 'error'); return; }
    if (form.diasSemana.length === 0) { addToast('Escolhe pelo menos um dia da semana.', 'error'); return; }
    if (form.lotacoes.length === 0) { addToast('Escolhe pelo menos uma lotação.', 'error'); return; }
    setSaving(true);
    try {
      await api.post('/candidaturas/dono-campo', { ...form, fotos, provaUrl });
      onSaved();
    } catch (err) {
      addToast(err.response?.data?.mensagem || 'Erro a submeter.', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <header>
          <h3>Candidatura a Dono de Campo</h3>
          <button className="close" onClick={onClose}>×</button>
        </header>
        <form onSubmit={submit}>
          <label>Nome do Campo *
            <input required value={form.nome} onChange={e => set('nome', e.target.value)} />
          </label>
          <div className="row">
            <label>Tipo de piso
              <select value={form.tipoPiso} onChange={e => set('tipoPiso', e.target.value)}>
                <option value="">—</option>
                <option value="relva_natural">Relva Natural</option>
                <option value="relva_sintetica">Relva Sintética</option>
                <option value="pelado">Pelado</option>
                <option value="pavilhao">Pavilhão</option>
              </select>
            </label>
            <label>Duração (min)
              <input type="number" min="15" step="15" value={form.duracaoMin}
                     onChange={e => set('duracaoMin', parseInt(e.target.value))} />
            </label>
          </div>
          <label>Morada *
            <input required value={form.morada} onChange={e => set('morada', e.target.value)} />
          </label>
          <label>Região *
            <input required value={form.regiao} onChange={e => set('regiao', e.target.value)} />
          </label>
          <label>Telefone de contacto *
            <input required type="tel" value={form.telefone} onChange={e => set('telefone', e.target.value)} />
          </label>
          <label>Preço por hora (€)
            <input type="number" min="0" step="0.50" value={(form.precoHoraCents || 0) / 100}
                   onChange={e => set('precoHoraCents', Math.round(parseFloat(e.target.value || 0) * 100))} />
          </label>

          <fieldset className="cfg-fieldset">
            <legend>⚙️ Configuração de Reservas</legend>
            <div className="row">
              <label>Hora de abertura
                <select value={form.horaAbertura} onChange={e => set('horaAbertura', parseInt(e.target.value))}>
                  {opcoesHora.map(m => <option key={m} value={m}>{hhmm(m)}</option>)}
                </select>
              </label>
              <label>Hora de fecho
                <select value={form.horaFecho} onChange={e => set('horaFecho', parseInt(e.target.value))}>
                  {opcoesHora.map(m => <option key={m} value={m}>{hhmm(m)}</option>)}
                  <option value={1440}>24:00</option>
                </select>
              </label>
            </div>
            <label>Duração de cada slot (min)
              <select value={form.slotMin} onChange={e => set('slotMin', parseInt(e.target.value))}>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </label>
            <label>Dias da semana disponíveis
              <div className="chip-row">
                {DIAS.map(([v, l]) => (
                  <button key={v} type="button"
                    className={`chip ${form.diasSemana.includes(v) ? 'on' : ''}`}
                    onClick={() => toggleArr('diasSemana', v)}>{l}</button>
                ))}
              </div>
            </label>
            <label>Lotações suportadas (x vs x)
              <div className="chip-row">
                {LOTACOES.map(l => (
                  <button key={l} type="button"
                    className={`chip ${form.lotacoes.includes(l) ? 'on' : ''}`}
                    onClick={() => toggleArr('lotacoes', l)}>{l}x{l}</button>
                ))}
              </div>
            </label>
          </fieldset>

          <label>Fotos do campo (mínimo 5) — <span className={fotos.length >= 5 ? 'ok' : 'tiny'}>{fotos.length}/5</span>
            <input type="file" accept="image/*" multiple
                   onChange={e => Array.from(e.target.files).forEach(addFoto)} />
            {fotos.length > 0 && (
              <div className="foto-previews">
                {fotos.map((url, i) => (
                  <div key={i} className="foto-preview">
                    <img src={resolverImgUrl(url)} alt="" />
                    <button type="button" className="foto-rm" onClick={() => setFotos(f => f.filter((_, idx) => idx !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}
          </label>

          <label className="prova-field">
            Prova de Titularidade *
            <span className="tiny">Fatura de serviços, licença, ou foto do local com o próprio. O admin vai verificar antes de aprovar.</span>
            <input type="file" accept="image/*,application/pdf"
                   onChange={e => e.target.files[0] && uploadProva(e.target.files[0])} required={!provaUrl} />
            {provaUrl && <div className="tiny ok">✅ Ficheiro enviado ({provaUrl.split('/').pop()})</div>}
          </label>

          <label>Nota (opcional)
            <textarea rows="3" value={form.nota} onChange={e => set('nota', e.target.value)}
                      placeholder="Algo que queiras acrescentar..." />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={saving}>{saving ? 'A submeter…' : 'Submeter Candidatura'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── TAB 2: Campos CRUD ─────────────────────────────────────
function TabCampos({ addToast }) {
  const confirmar = useConfirm();
  const [campos, setCampos] = useState([]);
  const [editing, setEditing] = useState(null); // objecto ou 'novo'

  const loadCampos = useCallback(async () => {
    try {
      const me = await api.get('/utilizadores/perfil');
      const { data } = await api.get(`/campos?donoId=${me.data.utilizador.id}`);
      setCampos(data.campos || []);
    } catch (e) {
      addToast('Erro a carregar campos.', 'error');
    }
  }, [addToast]);

  useEffect(() => { loadCampos(); }, [loadCampos]);

  const eliminar = async (id) => {
    const ok = await confirmar({
      titulo: 'Desativar campo?',
      mensagem: 'O campo deixa de aparecer nas pesquisas. Os jogos já criados não são afetados.',
      confirmarLabel: 'Desativar',
      variante: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/campos/${id}`);
      addToast('Campo desativado.', 'success');
      loadCampos();
    } catch (e) { addToast('Erro.', 'error'); }
  };

  return (
    <section className="dono-card">
      <div className="row-between">
        <h2>Os Teus Campos</h2>
        <button className="btn-primary" onClick={() => setEditing('novo')}>+ Novo Campo</button>
      </div>

      {campos.length === 0 && <p className="empty">Ainda não tens campos. Adiciona o primeiro!</p>}

      <div className="campo-grid">
        {campos.map(c => (
          <div key={c.id} className="campo-card">
            {c.foto_url && (
              <img
                src={resolverImgUrl(c.foto_url)}
                alt={c.nome}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <div className="campo-body">
              <h3>{c.nome}</h3>
              <div className="tiny">{c.morada || '—'} · {c.regiao || '—'}</div>
              <div className="tiny">{c.tipo_piso || 'Piso —'} · {c.duracao_min}min</div>
              <div className="preco">{fmt(c.preco_hora_cents)} /h</div>
              <div className="campo-actions">
                <button onClick={() => setEditing(c)}>Editar</button>
                <button className="danger" onClick={() => eliminar(c.id)}>Desativar</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <CampoModal
          campo={editing === 'novo' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadCampos(); }}
          addToast={addToast}
        />
      )}
    </section>
  );
}

function CampoModal({ campo, onClose, onSaved, addToast }) {
  const parseJson = (v, fallback) => {
    if (Array.isArray(v)) return v;
    if (!v) return fallback;
    try { return JSON.parse(v); } catch { return fallback; }
  };
  const [form, setForm] = useState({
    nome: campo?.nome || '',
    fotoUrl: campo?.foto_url || '',
    tipoPiso: campo?.tipo_piso || '',
    morada: campo?.morada || '',
    regiao: campo?.regiao || '',
    latitude: campo?.latitude || '',
    longitude: campo?.longitude || '',
    precoHoraCents: campo?.preco_hora_cents || 0,
    duracaoMin: campo?.duracao_min || 60,
    horaAbertura: campo?.hora_abertura ?? 480,   // 08:00
    horaFecho:    campo?.hora_fecho ?? 1380,     // 23:00
    slotMin:      campo?.slot_min ?? 60,
    diasSemana:   parseJson(campo?.dias_semana_json, [1,2,3,4,5,6,7]),
    lotacoes:     parseJson(campo?.lotacoes_json, [5,7]),
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleArr = (key, v) => setForm(f => {
    const arr = f[key].includes(v) ? f[key].filter(x => x !== v) : [...f[key], v].sort((a,b) => a-b);
    return { ...f, [key]: arr };
  });

  // 00:00 → 23:30 em passos de 30 min
  const opcoesHora = [];
  for (let m = 0; m <= 1440; m += 30) {
    const h = Math.floor(m / 60), mm = m % 60;
    opcoesHora.push({ v: m, label: `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}` });
  }
  const DIAS = [
    { v: 1, l: 'Seg' }, { v: 2, l: 'Ter' }, { v: 3, l: 'Qua' },
    { v: 4, l: 'Qui' }, { v: 5, l: 'Sex' }, { v: 6, l: 'Sáb' }, { v: 7, l: 'Dom' },
  ];
  const LOTACOES = [5, 6, 7, 8, 11];

  const submit = async (e) => {
    e.preventDefault();
    if (form.horaFecho <= form.horaAbertura) {
      addToast('A hora de fecho deve ser depois da abertura.', 'error');
      return;
    }
    if (!form.diasSemana.length) {
      addToast('Escolhe pelo menos um dia da semana.', 'error');
      return;
    }
    if (!form.lotacoes.length) {
      addToast('Escolhe pelo menos uma lotação (5x5, 7x7…).', 'error');
      return;
    }
    setSaving(true);
    try {
      if (campo) {
        await api.put(`/campos/${campo.id}`, form);
        addToast('Campo actualizado.', 'success');
      } else {
        await api.post('/campos', form);
        addToast('Campo criado.', 'success');
      }
      onSaved();
    } catch (e) {
      addToast(e.response?.data?.mensagem || 'Erro.', 'error');
    } finally { setSaving(false); }
  };

  const upload = async (file) => {
    const fd = new FormData(); fd.append('imagem', file);
    try {
      const { data } = await api.post('/upload/imagem', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      set('fotoUrl', data.url);
    } catch { addToast('Erro no upload.', 'error'); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <header>
          <h3>{campo ? 'Editar Campo' : 'Novo Campo'}</h3>
          <button className="close" onClick={onClose}>×</button>
        </header>
        <form onSubmit={submit}>
          <label>Nome
            <input required value={form.nome} onChange={e => set('nome', e.target.value)} />
          </label>
          <label>Foto do campo
            <input type="file" accept="image/*" onChange={e => e.target.files[0] && upload(e.target.files[0])} />
            {form.fotoUrl && <img src={form.fotoUrl} alt="" className="preview" />}
          </label>
          <div className="row">
            <label>Tipo de piso
              <select value={form.tipoPiso} onChange={e => set('tipoPiso', e.target.value)}>
                <option value="">—</option>
                <option value="relva_natural">Relva Natural</option>
                <option value="relva_sintetica">Relva Sintética</option>
                <option value="pelado">Pelado</option>
                <option value="pavilhao">Pavilhão</option>
              </select>
            </label>
            <label>Duração (min)
              <input type="number" min="15" step="15" value={form.duracaoMin} onChange={e => set('duracaoMin', parseInt(e.target.value))} />
            </label>
          </div>
          <label>Morada
            <input value={form.morada} onChange={e => set('morada', e.target.value)} />
          </label>
          <label>Região
            <input value={form.regiao} onChange={e => set('regiao', e.target.value)} />
          </label>
          <div className="row">
            <label title="Para aparecer no mapa de jogos. Usa Google Maps → clica com o botão direito → 'O que existe aqui?' para obter as coordenadas.">
              Latitude (GPS) <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>para o mapa</span>
              <input type="number" step="0.000001" min="-90" max="90" placeholder="Ex: 38.716773"
                     value={form.latitude} onChange={e => set('latitude', e.target.value)} />
            </label>
            <label>
              Longitude (GPS)
              <input type="number" step="0.000001" min="-180" max="180" placeholder="Ex: -9.142661"
                     value={form.longitude} onChange={e => set('longitude', e.target.value)} />
            </label>
          </div>
          <label>Preço por hora (€)
            <input type="number" min="0" step="0.50"
                   value={(form.precoHoraCents || 0) / 100}
                   onChange={e => set('precoHoraCents', Math.round(parseFloat(e.target.value || 0) * 100))} />
          </label>

          {/* ── Configuração de Reservas ─────────────────────── */}
          <div style={{ borderTop: '1px dashed var(--border)', margin: '1rem 0 0.5rem', paddingTop: '1rem' }}>
            <p style={{ fontWeight: 700, fontSize: '0.85rem', letterSpacing: '.5px', color: 'var(--text-secondary, var(--text-muted))', marginBottom: '0.75rem' }}>
              ⚙️ CONFIGURAÇÃO DE RESERVAS
            </p>

            <div className="row">
              <label>Abertura
                <select value={form.horaAbertura}
                        onChange={e => set('horaAbertura', parseInt(e.target.value))}>
                  {opcoesHora.slice(0, -1).map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </label>
              <label>Fecho
                <select value={form.horaFecho}
                        onChange={e => set('horaFecho', parseInt(e.target.value))}>
                  {opcoesHora.slice(1).map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </label>
            </div>

            <label>Duração do slot (min)
              <select value={form.slotMin} onChange={e => set('slotMin', parseInt(e.target.value))}>
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </label>

            <div style={{ margin: '0.75rem 0' }}>
              <label style={{ marginBottom: '0.4rem' }}>Dias da Semana</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {DIAS.map(d => {
                  const on = form.diasSemana.includes(d.v);
                  return (
                    <button key={d.v} type="button"
                      onClick={() => toggleArr('diasSemana', d.v)}
                      style={{
                        padding: '0.4rem 0.75rem', borderRadius: '999px',
                        border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                        background: on ? 'var(--primary-soft, rgba(34,197,94,.12))' : 'transparent',
                        color: on ? 'var(--primary)' : 'var(--text-muted)',
                        fontWeight: on ? 700 : 500, cursor: 'pointer', fontSize: '.82rem',
                      }}>
                      {d.l}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ margin: '0.75rem 0' }}>
              <label style={{ marginBottom: '0.4rem' }}>Lotações permitidas</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {LOTACOES.map(l => {
                  const on = form.lotacoes.includes(l);
                  return (
                    <button key={l} type="button"
                      onClick={() => toggleArr('lotacoes', l)}
                      style={{
                        padding: '0.4rem 0.75rem', borderRadius: '6px',
                        border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                        background: on ? 'var(--primary-soft, rgba(34,197,94,.12))' : 'transparent',
                        color: on ? 'var(--primary)' : 'var(--text-muted)',
                        fontWeight: on ? 700 : 500, cursor: 'pointer', fontSize: '.82rem',
                      }}>
                      {l}x{l}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.25rem' }}>
                Estas são as opções de formato que os jogadores poderão escolher ao reservar.
              </p>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={saving}>{saving ? 'A guardar…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── TAB 3: Agenda / Calendário ─────────────────────────────
function TabAgenda({ addToast }) {
  const confirmar = useConfirm();
  const [jogos, setJogos] = useState([]);
  const [bloqueios, setBloqueios] = useState([]);
  const [addBloqueio, setAddBloqueio] = useState(false);
  const [campos, setCampos] = useState([]);

  const load = useCallback(async () => {
    try {
      const [{ data }, me] = await Promise.all([
        api.get('/dono/agenda'),
        api.get('/utilizadores/perfil'),
      ]);
      setJogos(data.jogos || []);
      setBloqueios(data.bloqueios || []);
      const cR = await api.get(`/campos?donoId=${me.data.utilizador.id}`);
      setCampos(cR.data.campos || []);
    } catch (e) { addToast('Erro a carregar agenda.', 'error'); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const estadoBadge = (j) => {
    if (j.reserva_estado === 'confirmada') return <span className="badge ok">✅ Confirmada</span>;
    if (j.reserva_estado === 'pendente')   return <span className="badge warn">⏳ Pendente</span>;
    if (j.reserva_estado === 'expirada')   return <span className="badge bad">❌ Expirada</span>;
    return <span className="badge">—</span>;
  };

  const removerBloqueio = async (campoId, id) => {
    const ok = await confirmar({
      titulo: 'Remover bloqueio?',
      mensagem: 'O período voltará a ficar disponível para reservas.',
      confirmarLabel: 'Remover',
      variante: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/campos/${campoId}/bloqueios/${id}`);
      load();
    } catch { addToast('Erro.', 'error'); }
  };

  return (
    <section className="dono-card">
      <div className="row-between">
        <h2>Calendário</h2>
        <button className="btn-primary" onClick={() => setAddBloqueio(true)}>+ Bloquear Horário</button>
      </div>

      <h3>Jogos Agendados</h3>
      {jogos.length === 0 && <p className="empty">Sem jogos agendados.</p>}
      <ul className="agenda-list">
        {jogos.map(j => (
          <li key={j.id} className={`agenda-item ${j.reserva_estado}`}>
            <div>
              <strong>{j.titulo}</strong> · {j.campo_nome}
              <div className="tiny">{fmtData(j.data_jogo)}</div>
            </div>
            <div className="right">
              {estadoBadge(j)}
              <div className="tiny">{fmt(j.pago_cents)} / {fmt(j.preco_total_cents)}</div>
              {j.deadline_pagamento && j.reserva_estado === 'pendente' && (
                <div className="tiny warn">⏰ {fmtData(j.deadline_pagamento)}</div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <h3>Bloqueios Manuais</h3>
      {bloqueios.length === 0 && <p className="empty">Sem bloqueios.</p>}
      <ul className="agenda-list">
        {bloqueios.map(b => (
          <li key={b.id} className="agenda-item bloqueio">
            <div>
              <strong>🚫 {b.campo_nome}</strong>
              <div className="tiny">{b.motivo || 'Sem motivo'}</div>
            </div>
            <div className="right">
              <div className="tiny">{fmtData(b.inicio)} → {fmtData(b.fim)}</div>
              <button className="btn-ghost small" onClick={() => removerBloqueio(b.campo_id, b.id)}>Remover</button>
            </div>
          </li>
        ))}
      </ul>

      {addBloqueio && (
        <BloqueioModal campos={campos} onClose={() => setAddBloqueio(false)}
                       onSaved={() => { setAddBloqueio(false); load(); }} addToast={addToast} />
      )}
    </section>
  );
}

function BloqueioModal({ campos, onClose, onSaved, addToast }) {
  const [form, setForm] = useState({ campoId: campos[0]?.id || '', inicio: '', fim: '', motivo: '' });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.campoId) return addToast('Escolhe um campo.', 'error');
    setSaving(true);
    try {
      await api.post(`/campos/${form.campoId}/bloqueios`, {
        inicio: form.inicio, fim: form.fim, motivo: form.motivo,
      });
      addToast('Bloqueio adicionado.', 'success');
      onSaved();
    } catch { addToast('Erro.', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <header>
          <h3>Novo Bloqueio</h3>
          <button className="close" onClick={onClose}>×</button>
        </header>
        <form onSubmit={submit}>
          <label>Campo
            <select required value={form.campoId} onChange={e => set('campoId', e.target.value)}>
              {campos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label>Início
            <DatePickerFB mode="datetime" value={form.inicio} onChange={(v) => set('inicio', v)} placeholder="Início" />
          </label>
          <label>Fim
            <DatePickerFB mode="datetime" value={form.fim} onChange={(v) => set('fim', v)} placeholder="Fim" />
          </label>
          <label>Motivo
            <input value={form.motivo} onChange={e => set('motivo', e.target.value)} placeholder="Manutenção, evento privado..." />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={saving}>{saving ? 'A guardar…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── TAB 4: Wallet ──────────────────────────────────────────
function TabWallet({ addToast }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/dono/wallet');
        setData(data);
      } catch { addToast('Erro a carregar wallet.', 'error'); }
    })();
  }, [addToast]);

  const abrirDashboard = async () => {
    try {
      const { data } = await api.post('/stripe/connect/dashboard-link');
      window.open(data.url, '_blank');
    } catch (e) { addToast(e.response?.data?.mensagem || 'Erro.', 'error'); }
  };

  if (!data) return <div className="spinner" />;
  const s = data.saldo || {};

  return (
    <section className="dono-card">
      <div className="row-between">
        <h2>Wallet</h2>
        <button className="btn-primary" onClick={abrirDashboard}>Abrir Stripe ↗</button>
      </div>

      <div className="wallet-cards">
        <div className="wcard ok">
          <div className="tiny">Saldo Líquido (Confirmado)</div>
          <div className="big">{fmt(s.liquido_total_cents)}</div>
          <div className="tiny">{s.jogos_confirmados || 0} jogo(s) confirmado(s)</div>
        </div>
        <div className="wcard warn">
          <div className="tiny">Pendente (Reserva não confirmada)</div>
          <div className="big">{fmt(s.pendente_total_cents)}</div>
          <div className="tiny">{s.jogos_pendentes || 0} jogo(s) pendente(s)</div>
        </div>
      </div>

      <h3>Histórico</h3>
      {data.historico.length === 0 && <p className="empty">Sem movimentos.</p>}
      <div className="hist-table">
        <div className="hist-row head">
          <div>Data</div><div>Jogo</div><div>Jogador</div><div>Valor</div><div>Líquido</div><div>Estado</div>
        </div>
        {data.historico.map(h => (
          <div key={h.id} className={`hist-row ${h.status}`}>
            <div>{fmtData(h.created_at)}</div>
            <div>{h.titulo}<div className="tiny">{h.campo_nome}</div></div>
            <div>{h.pagador_nome}</div>
            <div>{fmt(h.valor_cents)}</div>
            <div>{fmt((h.valor_cents || 0) - (h.application_fee_cents || 0))}</div>
            <div><span className={`badge ${h.status === 'succeeded' ? 'ok' : h.status === 'refunded' ? 'bad' : 'warn'}`}>{h.status}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}
