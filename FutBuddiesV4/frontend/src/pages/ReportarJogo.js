// ============================================================
//  FutBuddies - Reportar Jogo (Fase C)
//  Formulário pós-jogo: resultado oficial (criador) + stats pessoais.
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import './ReportarJogo.css';

export default function ReportarJogo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { utilizador, isAuthenticated } = useAuth();
  const { addToast } = useToast();

  const [jogo, setJogo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [pessoais, setPessoais] = useState([]);
  const [aviso, setAviso] = useState(null);
  const [loading, setLoading] = useState(true);

  const [formResultado, setFormResultado] = useState({ golos_equipa_a: 0, golos_equipa_b: 0 });
  const [formPessoal, setFormPessoal] = useState({ golos: 0, assistencias: 0 });
  const [submittingJogo, setSubmittingJogo] = useState(false);
  const [submittingPessoal, setSubmittingPessoal] = useState(false);
  const [msg, setMsg] = useState('');

  const carregar = useCallback(async () => {
    try {
      const [j, r] = await Promise.all([
        api.get(`/jogos/${id}`),
        api.get(`/jogos/${id}/resultado`),
      ]);
      setJogo(j.data.jogo);
      setResultado(r.data.resultado);
      setPessoais(r.data.pessoais || []);
      setAviso(r.data.aviso);
      if (r.data.resultado) {
        setFormResultado({
          golos_equipa_a: r.data.resultado.golos_equipa_a,
          golos_equipa_b: r.data.resultado.golos_equipa_b,
        });
      }
      const meu = (r.data.pessoais || []).find(p => p.utilizador_id === utilizador?.id);
      if (meu) setFormPessoal({ golos: meu.golos, assistencias: meu.assistencias });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, utilizador?.id]);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    carregar();
  }, [isAuthenticated, navigate, carregar]);

  const mostrarMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const submeterResultado = async (e) => {
    e.preventDefault();
    setSubmittingJogo(true);
    try {
      await api.post(`/jogos/${id}/resultado`, {
        golos_equipa_a: parseInt(formResultado.golos_equipa_a),
        golos_equipa_b: parseInt(formResultado.golos_equipa_b),
      });
      mostrarMsg('Resultado oficial registado!');
      carregar();
    } catch (err) {
      addToast(err.response?.data?.mensagem || 'Erro ao guardar resultado.', 'error');
    } finally { setSubmittingJogo(false); }
  };

  const submeterPessoal = async (e) => {
    e.preventDefault();
    setSubmittingPessoal(true);
    try {
      await api.post(`/jogos/${id}/resultado-pessoal`, {
        golos: parseInt(formPessoal.golos),
        assistencias: parseInt(formPessoal.assistencias),
      });
      mostrarMsg('Stats pessoais registadas!');
      carregar();
    } catch (err) {
      addToast(err.response?.data?.mensagem || 'Erro ao guardar stats pessoais.', 'error');
    } finally { setSubmittingPessoal(false); }
  };

  if (loading) {
    return <div className="reportar-page"><div className="container" style={{ padding: '6rem', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div></div>;
  }

  if (!jogo) {
    return <div className="reportar-page"><div className="container"><p>Jogo não encontrado.</p></div></div>;
  }

  const eCriador = jogo.criador_id === utilizador?.id;
  const vencedor = resultado
    ? resultado.golos_equipa_a > resultado.golos_equipa_b ? 'A'
      : resultado.golos_equipa_b > resultado.golos_equipa_a ? 'B'
      : 'empate'
    : null;

  return (
    <div className="reportar-page">
      <div className="container">
        <div className="reportar-header">
          <Link to={`/jogos/${id}`} className="btn btn-ghost btn-sm">← Voltar ao jogo</Link>
          <h1 className="reportar-titulo">📋 Reportar resultado</h1>
          <p className="reportar-subtitulo">{jogo.titulo}</p>
        </div>

        {msg && <div className="admin-alerta">{msg}</div>}
        {aviso && <div className="reportar-aviso">⚠️ {aviso}</div>}

        {/* ── Placard (se já houver resultado) ── */}
        {resultado && (
          <div className="card reportar-placard">
            <div className="reportar-placard-lado">
              <div className="reportar-lado-label">Equipa A</div>
              <div className={`reportar-lado-golos ${vencedor === 'A' ? 'vencedor' : ''}`}>
                {resultado.golos_equipa_a}
              </div>
            </div>
            <div className="reportar-placard-vs">×</div>
            <div className="reportar-placard-lado">
              <div className="reportar-lado-label">Equipa B</div>
              <div className={`reportar-lado-golos ${vencedor === 'B' ? 'vencedor' : ''}`}>
                {resultado.golos_equipa_b}
              </div>
            </div>
            <p className="reportar-placard-meta">
              Reportado por <strong>{resultado.reportado_por_nome}</strong>
            </p>
          </div>
        )}

        <div className="reportar-grid">
          {/* ── Form do criador ── */}
          {eCriador && (
            <div className="card">
              <h3 className="reportar-seccao">🏁 Resultado oficial</h3>
              <p className="reportar-ajuda">És o criador deste jogo. Regista o placard final.</p>
              <form onSubmit={submeterResultado} className="reportar-form">
                <div className="reportar-golos-row">
                  <div className="reportar-golos-input">
                    <label>Equipa A</label>
                    <input type="number" min="0" max="99" className="input"
                      value={formResultado.golos_equipa_a}
                      onChange={(e) => setFormResultado({ ...formResultado, golos_equipa_a: e.target.value })} />
                  </div>
                  <span className="reportar-golos-vs">×</span>
                  <div className="reportar-golos-input">
                    <label>Equipa B</label>
                    <input type="number" min="0" max="99" className="input"
                      value={formResultado.golos_equipa_b}
                      onChange={(e) => setFormResultado({ ...formResultado, golos_equipa_b: e.target.value })} />
                  </div>
                </div>
                <button className="btn btn-primary" disabled={submittingJogo}>
                  {submittingJogo ? 'A guardar...' : resultado ? '↻ Atualizar resultado' : '✓ Registar resultado'}
                </button>
              </form>
            </div>
          )}

          {/* ── Form pessoal ── */}
          <div className="card">
            <h3 className="reportar-seccao">⚽ Os teus números</h3>
            <p className="reportar-ajuda">Quantos golos e assistências fizeste neste jogo?</p>
            <form onSubmit={submeterPessoal} className="reportar-form">
              <div className="reportar-golos-row">
                <div className="reportar-golos-input">
                  <label>Golos</label>
                  <input type="number" min="0" max="50" className="input"
                    value={formPessoal.golos}
                    onChange={(e) => setFormPessoal({ ...formPessoal, golos: e.target.value })} />
                </div>
                <div className="reportar-golos-input">
                  <label>Assistências</label>
                  <input type="number" min="0" max="50" className="input"
                    value={formPessoal.assistencias}
                    onChange={(e) => setFormPessoal({ ...formPessoal, assistencias: e.target.value })} />
                </div>
              </div>
              <button className="btn btn-primary" disabled={submittingPessoal}>
                {submittingPessoal ? 'A guardar...' : '✓ Registar'}
              </button>
            </form>
          </div>
        </div>

        {/* ── Tabela de contributos pessoais ── */}
        {pessoais.length > 0 && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3 className="reportar-seccao">📊 Contributos dos jogadores</h3>
            <div className="admin-tabela-wrapper">
              <table className="admin-tabela">
                <thead><tr><th>Jogador</th><th>Lado</th><th>Golos</th><th>Assists</th></tr></thead>
                <tbody>
                  {pessoais.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, fontSize: '0.825rem' }}>{p.nickname || p.nome}</td>
                      <td>{p.lado ? <span className={`badge ${p.lado === 'A' ? 'badge-green' : 'badge-amber'}`}>Equipa {p.lado}</span> : '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>{p.golos}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{p.assistencias}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
