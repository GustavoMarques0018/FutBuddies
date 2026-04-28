// ============================================================
//  FutBuddies - Os Meus Jogos (futuros + passados com stats)
// ============================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './MeusJogos.css';

function formatarData(data) {
  if (!data) return 'Data a definir';
  return new Date(data).toLocaleDateString('pt-PT', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function Placard({ jogo }) {
  if (jogo.golos_equipa_a == null || jogo.golos_equipa_b == null) {
    return <span className="meus-sem-placard">Sem resultado</span>;
  }
  const meuLado = jogo.lado;
  const meus = meuLado === 'A' ? jogo.golos_equipa_a : jogo.golos_equipa_b;
  const deles = meuLado === 'A' ? jogo.golos_equipa_b : jogo.golos_equipa_a;
  const resultado = meus > deles ? 'V' : meus < deles ? 'D' : 'E';
  const cor = resultado === 'V' ? 'var(--success)' : resultado === 'D' ? 'var(--danger)' : 'var(--warning)';
  return (
    <div className="meus-placard">
      <span className="meus-placard-badge" style={{ background: cor }}>{resultado}</span>
      <span className="meus-placard-score">{meus}–{deles}</span>
    </div>
  );
}

export default function MeusJogos() {
  const { isAuthenticated } = useAuth();
  const [futuros, setFuturos] = useState([]);
  const [passados, setPassados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState('proximos');

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    api.get('/utilizadores/me/meus-jogos')
      .then(res => {
        setFuturos(res.data.futuros || []);
        setPassados(res.data.passados || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ padding: '3rem 1rem' }}>
        <p>Faz <Link to="/login">login</Link> para ver os teus jogos.</p>
      </div>
    );
  }

  const totalGolos = passados.reduce((s, j) => s + (j.meus_golos || 0), 0);
  const totalAst   = passados.reduce((s, j) => s + (j.minhas_assistencias || 0), 0);
  const vitorias = passados.filter(j => {
    if (j.golos_equipa_a == null || !j.lado) return false;
    const meus = j.lado === 'A' ? j.golos_equipa_a : j.golos_equipa_b;
    const deles = j.lado === 'A' ? j.golos_equipa_b : j.golos_equipa_a;
    return meus > deles;
  }).length;

  const jogosMostrar = aba === 'proximos' ? futuros : passados;

  return (
    <div className="meus-page">
      <div className="container" style={{ maxWidth: 900 }}>
        <header className="meus-header">
          <h1>Os Meus Jogos</h1>
          <p>Acompanha o que aí vem e revê o que já jogaste.</p>
        </header>

        {/* Stats rápidas */}
        <div className="meus-stats">
          <div className="meus-stat"><span className="n">{futuros.length}</span><span className="l">Próximos</span></div>
          <div className="meus-stat"><span className="n">{passados.length}</span><span className="l">Jogados</span></div>
          <div className="meus-stat"><span className="n" style={{ color: 'var(--success)' }}>{vitorias}</span><span className="l">Vitórias</span></div>
          <div className="meus-stat"><span className="n" style={{ color: 'var(--primary)' }}>{totalGolos}</span><span className="l">Golos</span></div>
          <div className="meus-stat"><span className="n" style={{ color: 'var(--info)' }}>{totalAst}</span><span className="l">Assistências</span></div>
        </div>

        {/* Tabs */}
        <div className="meus-tabs">
          <button className={`meus-tab ${aba === 'proximos' ? 'ativa' : ''}`} onClick={() => setAba('proximos')}>
            ⚽ Próximos <span className="meus-tab-count">{futuros.length}</span>
          </button>
          <button className={`meus-tab ${aba === 'passados' ? 'ativa' : ''}`} onClick={() => setAba('passados')}>
            🏆 Já Jogados <span className="meus-tab-count">{passados.length}</span>
          </button>
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
        )}

        {!loading && jogosMostrar.length === 0 && (
          <div className="card empty-state">
            <div className="icon">⚽</div>
            <p>{aba === 'proximos' ? 'Ainda não te inscreveste em jogos futuros.' : 'Ainda não jogaste nenhum jogo.'}</p>
            <Link to="/jogos" className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }}>Ver Jogos Disponíveis</Link>
          </div>
        )}

        {!loading && jogosMostrar.length > 0 && (
          <div className="meus-lista">
            {jogosMostrar.map(jogo => (
              <Link key={jogo.id} to={`/jogos/${jogo.id}`} className="meus-jogo-card">
                <div className="meus-jogo-top">
                  <span className="meus-jogo-titulo">{jogo.titulo}</span>
                  <span className="meus-jogo-tipo">{jogo.tipo_jogo}</span>
                </div>
                <div className="meus-jogo-info">
                  <span>🕐 {formatarData(jogo.data_jogo)}</span>
                  {jogo.regiao && <span>📍 {jogo.regiao}</span>}
                  {jogo.lado && <span>Equipa {jogo.lado}</span>}
                </div>

                {aba === 'passados' && (
                  <div className="meus-jogo-resultado">
                    <Placard jogo={jogo} />
                    <div className="meus-jogo-stats">
                      <span className="meus-stat-chip">
                        <span className="v">{jogo.meus_golos || 0}</span>
                        <span className="k">⚽ Golos</span>
                      </span>
                      <span className="meus-stat-chip">
                        <span className="v">{jogo.minhas_assistencias || 0}</span>
                        <span className="k">🎯 Ast.</span>
                      </span>
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
