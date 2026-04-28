// ============================================================
//  FutBuddies - Sobre (About)
// ============================================================

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Sobre.css';

export default function Sobre() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="sobre-page">
      <div className="container">

        {/* Header */}
        <section className="sobre-hero">
          <img src="/FbVerde.png" alt="FutBuddies" className="sobre-hero-logo" />
          <h1>Sobre o FutBuddies</h1>
          <p className="sobre-hero-desc">
            Uma plataforma digital que une jogadores de futebol, simplifica a organiza&ccedil;&atilde;o
            de jogos recreativos e fortalece comunidades locais atrav&eacute;s do desporto.
          </p>
        </section>

        {/* O Desafio */}
        <section className="sobre-section">
          <div className="sobre-section-header">
            <span className="sobre-section-num">01</span>
            <h2>O Desafio</h2>
          </div>
          <div className="sobre-cards-row">
            <div className="sobre-card">
              <div className="sobre-card-icon">&#9917;</div>
              <h3>Problema Identificado</h3>
              <p>
                A dificuldade em organizar jogos de futebol recreativo &eacute; uma barreira
                &agrave; pr&aacute;tica desportiva. Muitas pessoas gostam de jogar futebol, mas nem
                sempre t&ecirc;m um grupo fixo ou o n&uacute;mero de jogadores necess&aacute;rio para formar equipas.
              </p>
            </div>
            <div className="sobre-card">
              <div className="sobre-card-icon">&#128679;</div>
              <h3>Barreiras</h3>
              <p>
                Dificuldade em encontrar campos dispon&iacute;veis, gerir a disponibilidade dos
                participantes e equilibrar as equipas de forma justa e organizada.
              </p>
            </div>
            <div className="sobre-card">
              <div className="sobre-card-icon">&#128161;</div>
              <h3>Vis&atilde;o</h3>
              <p>
                Criar uma solu&ccedil;&atilde;o digital que simplifique toda a log&iacute;stica envolvida
                e promova a participa&ccedil;&atilde;o desportiva de forma acess&iacute;vel a todos.
              </p>
            </div>
          </div>
        </section>

        {/* A Solu&ccedil;&atilde;o */}
        <section className="sobre-section">
          <div className="sobre-section-header">
            <span className="sobre-section-num">02</span>
            <h2>A Solu&ccedil;&atilde;o</h2>
          </div>
          <p className="sobre-section-intro">
            O FutBuddies &eacute; uma plataforma web que atua como um ponto de encontro digital
            para amantes do futebol, simplificando a organiza&ccedil;&atilde;o e promovendo a
            participa&ccedil;&atilde;o desportiva.
          </p>
          <div className="sobre-features-grid">
            {[
              { num: '1', titulo: 'Cria\u00e7\u00e3o de Jogos', desc: 'Definir data, hora, local e n\u00famero de vagas para jogos p\u00fablicos ou privados.' },
              { num: '2', titulo: 'Inscri\u00e7\u00e3o Autom\u00e1tica', desc: 'Preenchimento de vagas at\u00e9 formar duas equipas completas de forma autom\u00e1tica.' },
              { num: '3', titulo: 'Comunica\u00e7\u00e3o', desc: 'Sistema de chat em tempo real entre os jogadores do mesmo jogo.' },
              { num: '4', titulo: 'Gest\u00e3o de Perfil', desc: 'Cria\u00e7\u00e3o de conta, autentica\u00e7\u00e3o e estat\u00edsticas b\u00e1sicas de cada jogador.' },
            ].map((f, i) => (
              <div key={i} className="sobre-feature-item">
                <span className="sobre-feature-num">{f.num}</span>
                <div>
                  <h4>{f.titulo}</h4>
                  <p>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Objetivos e Impacto */}
        <section className="sobre-section">
          <div className="sobre-section-header">
            <span className="sobre-section-num">03</span>
            <h2>Objetivos e Impacto</h2>
          </div>
          <div className="sobre-objetivos-grid">
            <div className="sobre-objetivos-card">
              <h3>Objetivos Principais</h3>
              <ul className="sobre-lista">
                <li>Promover a atividade f&iacute;sica regular e estilos de vida saud&aacute;veis</li>
                <li>Facilitar a organiza&ccedil;&atilde;o de jogos e a gest&atilde;o de equipas</li>
                <li>Fomentar a socializa&ccedil;&atilde;o entre pessoas com o mesmo interesse</li>
              </ul>
            </div>
            <div className="sobre-objetivos-card">
              <h3>Alinhamento com ODS</h3>
              <div className="sobre-ods-grid">
                <div className="sobre-ods">
                  <span className="sobre-ods-badge">ODS 3</span>
                  <div>
                    <strong>Sa&uacute;de e Bem-Estar</strong>
                    <p>Incentivo &agrave; pr&aacute;tica desportiva regular e estilos de vida ativos.</p>
                  </div>
                </div>
                <div className="sobre-ods">
                  <span className="sobre-ods-badge">ODS 11</span>
                  <div>
                    <strong>Comunidades Sustent&aacute;veis</strong>
                    <p>Fortalecimento das comunidades locais atrav&eacute;s do desporto.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* P&uacute;blico-Alvo */}
        <section className="sobre-section">
          <div className="sobre-section-header">
            <span className="sobre-section-num">04</span>
            <h2>P&uacute;blico-Alvo</h2>
          </div>
          <div className="sobre-publico">
            <div className="sobre-publico-card">
              <div className="sobre-publico-range">13 — 60</div>
              <p>
                Jovens e adultos que procuram uma forma pr&aacute;tica e acess&iacute;vel de jogar
                futebol recreativo, independentemente do n&iacute;vel de experi&ecirc;ncia.
              </p>
            </div>
          </div>
        </section>

        {/* Projeto PAP */}
        <section className="sobre-section">
          <div className="sobre-section-header">
            <span className="sobre-section-num">05</span>
            <h2>Projeto PAP</h2>
          </div>
          <div className="sobre-pap-card">
            <p>
              O FutBuddies &eacute; um projeto desenvolvido no &acirc;mbito da <strong>Prova de Aptid&atilde;o
              Profissional (PAP)</strong>, demonstrando a aplica&ccedil;&atilde;o pr&aacute;tica dos
              conhecimentos adquiridos ao longo do curso. O projeto responde a uma necessidade
              real da comunidade, promovendo sa&uacute;de e bem-estar enquanto fortalece as
              comunidades locais.
            </p>
            <div className="sobre-pap-meta">
              <div className="sobre-pap-item">
                <span className="sobre-pap-label">Autor</span>
                <span>Gustavo Alves Alexandre Fernandes Marques</span>
              </div>
              <div className="sobre-pap-item">
                <span className="sobre-pap-label">Orientador</span>
                <span>Gabriel Souza</span>
              </div>
              <div className="sobre-pap-item">
                <span className="sobre-pap-label">Ano Letivo</span>
                <span>2025 / 2026</span>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        {!isAuthenticated && (
          <section className="sobre-cta">
            <h2>Pronto para come&ccedil;ar?</h2>
            <p>Junta-te &agrave; comunidade FutBuddies e organiza os teus jogos.</p>
            <div className="sobre-cta-btns">
              <Link to="/registar" className="btn btn-primary btn-lg">Criar Conta</Link>
              <Link to="/jogos" className="btn btn-outline btn-lg">Explorar Jogos</Link>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
