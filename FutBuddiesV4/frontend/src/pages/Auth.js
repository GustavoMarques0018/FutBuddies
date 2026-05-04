// ============================================================
//  FutBuddies - Páginas de Login e Registo
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './Auth.css';

// Photo backdrop — theme-aware. Dropped into /public.
function AuthBgVideo() {
  const { tema } = useTheme();
  const ref = useRef(null);
  // Vídeo em loop como fundo. A imagem serve como poster enquanto o vídeo carrega
  // e como fallback se o browser bloquear autoplay (iOS Low Power Mode, etc.).
  const cfg = tema === 'dark'
    ? { video: 'auth-bg-dark.mp4',  poster: 'hero-night-2.jpg' }
    : { video: 'auth-bg-light.mp4', poster: 'hero-day-2.jpg'   };

  // iOS/Android Safari: garantir que muted é definido ANTES do play,
  // e chamar play() explicitamente — o atributo autoPlay do React por vezes
  // não é suficiente em mobile (especialmente depois de trocar a source).
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;              // obrigatório para autoplay em mobile
    v.setAttribute('muted', ''); // belt-and-suspenders para Safari
    v.playsInline = true;
    v.load();                    // re-carrega quando a source muda (tema)
    const tentarPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => { /* bloqueado por Low Power — fica o poster */ });
    };
    tentarPlay();
    // Alguns browsers móveis só permitem play depois do primeiro toque —
    // tentamos novamente no primeiro gesto.
    const retry = () => { tentarPlay(); document.removeEventListener('touchstart', retry); document.removeEventListener('click', retry); };
    document.addEventListener('touchstart', retry, { once: true, passive: true });
    document.addEventListener('click', retry, { once: true });
    return () => {
      document.removeEventListener('touchstart', retry);
      document.removeEventListener('click', retry);
    };
  }, [cfg.video]);

  return (
    <video
      ref={ref}
      key={cfg.video}       /* força remount quando o tema muda */
      className="auth-bg-video"
      autoPlay
      loop
      muted
      defaultMuted
      playsInline
      webkit-playsinline="true"
      x5-playsinline="true"
      preload="auto"
      disableRemotePlayback
      poster={`${process.env.PUBLIC_URL}/${cfg.poster}`}
    >
      <source src={`${process.env.PUBLIC_URL}/${cfg.video}`} type="video/mp4" />
    </video>
  );
}

// ── Login ────────────────────────────────────────────────────
export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: localStorage.getItem('fb_remember_email') || '',
    password: ''
  });
  const [lembrar, setLembrar] = useState(!!localStorage.getItem('fb_remember_email'));
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      await login(form.email, form.password, lembrar);
      if (lembrar) localStorage.setItem('fb_remember_email', form.email);
      else localStorage.removeItem('fb_remember_email');
      navigate('/jogos');
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao fazer login. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ── Atalhos de DEV (login rápido) ──────────────────────────
  // - Admin    → conta administradora oficial (criada pelo schema)
  // - Dono     → dono de campo de testes
  // - User     → utilizador normal de testes
  // Contas "elevadas" (Admin, Dono) exigem PIN A CADA CLIQUE em produção.
  // O atalho User entra direto.
  const DEV_LOGINS = [
    { rotulo: 'Admin',          email: 'admin@futbuddies.pt',    password: 'FutBuddies2026!', cor: 'admin', protegido: true  },
    { rotulo: 'Dono · Cadera',  email: 'cadera@futbuddies.com',  password: '123456',          cor: 'dono',  protegido: true  },
    { rotulo: 'User · Gustavo', email: 'gustavo@futbuddies.com', password: '123456',          cor: 'user',  protegido: false },
  ];
  // Mostra os atalhos sempre que NODE_ENV !== 'production', ou quando
  // REACT_APP_SHOW_DEV_LOGINS=1 (útil para demo/PAP em produção).
  const isDev = process.env.NODE_ENV !== 'production'
    || process.env.REACT_APP_SHOW_DEV_LOGINS === '1';

  // Em produção, contas "protegidas" pedem PIN a cada clique (sem cache)
  // para evitar que um estranho com o ecrã desbloqueado entre como Admin.
  const DEV_PIN = '1598';
  const requerPin = process.env.NODE_ENV === 'production';
  const [pinModal, setPinModal] = useState(null); // { preset } | null
  const [pinInput, setPinInput] = useState('');
  const [pinErro, setPinErro] = useState('');

  const onClickDevBtn = (preset) => {
    // User normal: entra direto, mesmo em produção.
    if (!requerPin || !preset.protegido) {
      devLogin(preset);
      return;
    }
    // Admin / Dono: SEMPRE pede PIN, sem caching de sessão.
    setPinErro('');
    setPinInput('');
    setPinModal({ preset });
  };

  const submeterPin = (e) => {
    e?.preventDefault?.();
    if (pinInput === DEV_PIN) {
      const preset = pinModal.preset;
      setPinModal(null);
      setPinInput('');
      devLogin(preset);
    } else {
      setPinErro('PIN incorreto.');
      setPinInput('');
    }
  };

  const devLogin = async (preset) => {
    setErro('');
    setForm({ email: preset.email, password: preset.password });
    setLoading(true);
    try {
      await login(preset.email, preset.password, true);
      localStorage.setItem('fb_remember_email', preset.email);
      navigate('/jogos');
    } catch (err) {
      setErro(err.response?.data?.mensagem || `Falha no login rápido (${preset.rotulo}). Verifica se a conta existe na BD.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthBgVideo />
      <div className="auth-container">
        <div className="auth-logo">
          <img src="/FbVerde.png" alt="FutBuddies" />
          <span>FutBuddies</span>
        </div>
        <h1 className="auth-title">Bem-vindo de volta</h1>
        <p className="auth-subtitle">Entra na tua conta para continuar</p>

        {erro && <div className="auth-error">{erro}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              placeholder="o.teu@email.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              placeholder="A tua password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <label className="auth-remember">
            <input
              type="checkbox"
              checked={lembrar}
              onChange={e => setLembrar(e.target.checked)}
            />
            <span>Lembrar de mim</span>
          </label>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> A entrar...</> : 'Entrar'}
          </button>
        </form>

        {isDev && (
          <div className="auth-dev-shortcuts" aria-label="Atalhos de desenvolvimento">
            <div className="auth-dev-label">
              <span className="auth-dev-dot" /> DEV · login rápido
            </div>
            <div className="auth-dev-btns">
              {DEV_LOGINS.map(p => (
                <button
                  key={p.rotulo}
                  type="button"
                  className={`auth-dev-btn auth-dev-${p.cor}`}
                  disabled={loading}
                  onClick={() => onClickDevBtn(p)}
                  title={requerPin && p.protegido ? `${p.email} (requer PIN)` : p.email}
                >
                  {requerPin && p.protegido && <span className="auth-dev-lock" aria-hidden="true">🔒</span>}
                  {p.rotulo}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="auth-switch">
          Ainda não tens conta? <Link to="/registar">Criar conta gratuita</Link>
        </p>
      </div>

      {/* Modal de PIN para atalhos DEV em produção */}
      {pinModal && (
        <div className="pin-modal-backdrop" onClick={() => setPinModal(null)} role="dialog" aria-modal="true">
          <form className="pin-modal" onClick={e => e.stopPropagation()} onSubmit={submeterPin}>
            <div className="pin-modal-header">
              <span className="pin-modal-icon">🔒</span>
              <h3>Acesso restrito</h3>
            </div>
            <p className="pin-modal-text">
              Os atalhos de demonstração exigem um PIN.
              Pede ao desenvolvedor se não tiveres acesso.
            </p>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              className="pin-modal-input"
              placeholder="• • • •"
              value={pinInput}
              onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '')); setPinErro(''); }}
            />
            {pinErro && <div className="pin-modal-erro">{pinErro}</div>}
            <div className="pin-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPinModal(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={pinInput.length < 4}>
                Entrar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Registo ──────────────────────────────────────────────────
export function Registar() {
  const { registar } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: '', email: '', password: '', confirmar: '' });
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');

    if (form.password !== form.confirmar) {
      return setErro('As passwords não coincidem.');
    }
    if (form.password.length < 6) {
      return setErro('A password deve ter pelo menos 6 caracteres.');
    }

    setLoading(true);
    try {
      await registar(form.nome, form.email, form.password);
      // Marca como "primeira sessão" — o /perfil pode mostrar onboarding.
      sessionStorage.setItem('fb_first_login', '1');
      // Conta nova → vai direto ao perfil para personalizar (foto, posição, região, etc.)
      navigate('/perfil?welcome=1');
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao criar conta. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthBgVideo />
      <div className="auth-container">
        <div className="auth-logo">
          <img src="/FbVerde.png" alt="FutBuddies" />
          <span>FutBuddies</span>
        </div>
        <h1 className="auth-title">Criar conta</h1>
        <p className="auth-subtitle">Junta-te à comunidade FutBuddies</p>

        {erro && <div className="auth-error">{erro}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>Nome completo</label>
            <input
              type="text"
              placeholder="O teu nome"
              value={form.nome}
              onChange={e => setForm({ ...form, nome: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              placeholder="o.teu@email.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div className="auth-field">
            <label>Confirmar Password</label>
            <input
              type="password"
              placeholder="Repete a password"
              value={form.confirmar}
              onChange={e => setForm({ ...form, confirmar: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> A criar conta...</> : 'Criar Conta'}
          </button>
        </form>

        <p className="auth-switch">
          Já tens conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
