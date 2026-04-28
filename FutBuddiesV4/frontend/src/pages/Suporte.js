// ============================================================
//  FutBuddies - Suporte / Contacto
// ============================================================
import React, { useState } from 'react';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import './Suporte.css';

const EMAIL = 'support.futbuddies@gmail.com';

const FAQS = [
  {
    q: 'Como me torno Dono de Campo?',
    a: 'Entra no menu "Dono de Campo", preenche a candidatura com os dados e a prova de titularidade (fatura, licença ou foto do local com o próprio). Depois de aprovada, podes configurar pagamentos via Stripe.',
  },
  {
    q: 'Como funcionam os pagamentos?',
    a: 'Os pagamentos são processados pelo Stripe. Em jogos pagos, o criador pode escolher entre pagar tudo ou dividir o valor pelos jogadores. Se a reserva não for totalmente paga até 30 min antes do jogo, os pagamentos são reembolsados automaticamente.',
  },
  {
    q: 'Posso recuperar um código de jogo privado?',
    a: 'Não. Por segurança, só o criador vê o código no momento da criação. Partilha-o diretamente com os jogadores convidados.',
  },
  {
    q: 'Como alterar o meu nickname / foto?',
    a: 'No teu perfil (menu do utilizador → O Meu Perfil) podes editar todos os teus dados, incluindo foto, posição, clube e perfil público/privado.',
  },
  {
    q: 'Posso cancelar uma inscrição?',
    a: 'Sim. Na página do jogo, clica em "Cancelar Inscrição". Se já tiveres pago, o reembolso é feito automaticamente quando aplicável.',
  },
];

export default function Suporte() {
  const { isAuthenticated, utilizador } = useAuth();
  const { addToast } = useToast();
  const [openIdx, setOpenIdx] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [form, setForm] = useState({
    assunto: '',
    mensagem: '',
    nome: utilizador?.nome || '',
    email: utilizador?.email || '',
  });

  const copiarEmail = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {}
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (!form.assunto.trim() || !form.mensagem.trim()) return;
    setEnviando(true);
    try {
      await api.post('/suporte/mensagens', {
        assunto: form.assunto,
        mensagem: form.mensagem,
        nome: form.nome || undefined,
        email: form.email || undefined,
      });
      setEnviada(true);
      setForm(f => ({ ...f, assunto: '', mensagem: '' }));
      addToast('Mensagem enviada! A equipa vai responder em breve.', 'success');
    } catch (err) {
      addToast(err.response?.data?.mensagem || 'Erro a enviar. Tenta novamente.', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="suporte-page">
      <div className="container">
        <header className="suporte-header">
          <h1>💬 Suporte</h1>
          <p>Estamos aqui para ajudar. Vê as perguntas frequentes ou envia-nos uma mensagem.</p>
        </header>

        {/* Card de contacto */}
        <section className="suporte-card suporte-contacto">
          <div className="suporte-contacto-texto">
            <h2>📧 Contacto por email</h2>
            <p>Prefires email? Podes escrever-nos diretamente para:</p>
            <a href={`mailto:${EMAIL}`} className="suporte-email">{EMAIL}</a>
            <div className="suporte-contacto-acoes">
              <button className="btn btn-primary" onClick={copiarEmail}>
                {copiado ? '✓ Copiado!' : '📋 Copiar email'}
              </button>
              <a href={`mailto:${EMAIL}`} className="btn btn-ghost">✉️ Abrir no cliente de mail</a>
            </div>
          </div>
          <div className="suporte-icon">🎧</div>
        </section>

        {/* Formulário rápido */}
        <section className="suporte-card">
          <h2>Enviar mensagem rápida</h2>
          <p className="tiny">
            A mensagem chega diretamente à equipa de suporte do FutBuddies no painel de administração.
            {isAuthenticated
              ? ' Responderemos na sua caixa de notificações.'
              : ' Deixa o teu email para podermos responder-te.'}
          </p>

          {enviada && (
            <div className="suporte-sucesso">
              ✅ <strong>Mensagem recebida!</strong> A equipa vai responder assim que possível.
              {isAuthenticated && ' Vais receber uma notificação quando tivermos novidades.'}
            </div>
          )}

          <form onSubmit={enviar} className="suporte-form">
            {!isAuthenticated && (
              <div className="row-2">
                <label>
                  Nome
                  <input type="text" value={form.nome}
                         onChange={e => setForm({ ...form, nome: e.target.value })}
                         placeholder="O teu nome" />
                </label>
                <label>
                  Email *
                  <input type="email" value={form.email}
                         onChange={e => setForm({ ...form, email: e.target.value })}
                         placeholder="email@exemplo.com" required />
                </label>
              </div>
            )}
            <label>
              Assunto *
              <input type="text" value={form.assunto}
                     onChange={e => setForm({ ...form, assunto: e.target.value })}
                     placeholder="Ex: Problema no pagamento" required />
            </label>
            <label>
              Mensagem *
              <textarea rows={6} value={form.mensagem}
                        onChange={e => setForm({ ...form, mensagem: e.target.value })}
                        placeholder="Descreve o teu problema ou dúvida…" required />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={enviando}>
                {enviando ? 'A enviar…' : '📨 Enviar Mensagem'}
              </button>
            </div>
          </form>
        </section>

        {/* FAQ */}
        <section className="suporte-card">
          <h2>Perguntas Frequentes</h2>
          <div className="faq-list">
            {FAQS.map((f, i) => (
              <div key={i} className={`faq-item ${openIdx === i ? 'open' : ''}`}>
                <button type="button" className="faq-q" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                  <span>{f.q}</span>
                  <span className="faq-chevron">{openIdx === i ? '−' : '+'}</span>
                </button>
                {openIdx === i && <div className="faq-a">{f.a}</div>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
