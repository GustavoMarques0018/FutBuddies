// ============================================================
//  FutBuddies - Assistente de Suporte (FAQ bot, sem IA)
//  Responde a perguntas frequentes por correspondência de
//  palavras-chave. Sem custos nem dependências externas.
//  Estrutura pronta para ligar IA no futuro (basta substituir
//  a função `responder` por uma chamada à API).
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import './SuporteBot.css';

const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g');
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(DIACRITICOS, '');

// Base de conhecimento
const KB = [
  {
    id: 'criar-jogo',
    label: '⚽ Criar um jogo',
    keywords: ['criar jogo', 'crio jogo', 'organizar', 'marcar', 'novo jogo', 'fazer jogo', 'pelada', 'racha', 'criar', 'crio'],
    resposta: 'Para criar um jogo: vai a Jogos → "+ Criar Jogo". Define o local, data, hora, tipo (5x5, 7x7, 11x11), número de vagas e se é público ou privado. Depois é só partilhar com os teus buddies!',
  },
  {
    id: 'inscrever',
    label: '✅ Inscrever-me num jogo',
    keywords: ['inscrever', 'inscrevo', 'inscricao', 'inscrição', 'entrar no jogo', 'participar', 'juntar', 'vaga', 'vagas', 'apontar', 'jogar'],
    resposta: 'Abre o jogo na página Jogos e clica em "Inscrever-me". Se as vagas estiverem cheias, entras na lista de espera e és promovido automaticamente se alguém desistir.',
  },
  {
    id: 'pagamentos',
    label: '💳 Pagamentos',
    keywords: ['pagar', 'pago', 'paga', 'paguei', 'pagamento', 'pagamentos', 'stripe', 'dinheiro', 'custo', 'custos', 'dividir', 'reembolso', 'reembolsos', 'preco', 'preço', 'valor'],
    resposta: 'Os pagamentos são processados de forma segura pelo Stripe. Em jogos pagos, o criador pode dividir o valor pelos jogadores. Se a reserva não for totalmente paga até 30 min antes do jogo, os valores são reembolsados automaticamente.',
  },
  {
    id: 'equipas',
    label: '🛡️ Equipas',
    keywords: ['equipa', 'equipas', 'criar equipa', 'membros', 'capitao', 'capitão'],
    resposta: 'Em Equipas podes criar a tua equipa (nome, emblema, região) ou pedir para entrar numa existente. O capitão gere os membros e a equipa pode inscrever-se em jogos e ligas.',
  },
  {
    id: 'ligas',
    label: '🏆 Ligas',
    keywords: ['liga', 'ligas', 'classificacao', 'classificação', 'campeonato', 'premio', 'prémio', 'tabela'],
    resposta: 'As Ligas permitem competir entre amigos com tabela classificativa. Para criar uma liga precisas de pertencer a uma equipa, e podes definir regras e um prémio para o campeão. Junta-te a uma liga com o código de um amigo!',
  },
  {
    id: 'dono-campo',
    label: '🏟️ Ser Dono de Campo',
    keywords: ['dono', 'campo', 'candidatura', 'alugar', 'reservar campo', 'meu campo'],
    resposta: 'Vai ao menu do utilizador → "Dono de Campo" e preenche a candidatura com a prova de titularidade (fatura, licença ou foto do local). Depois de aprovada, configuras os pagamentos via Stripe e podes gerir a agenda do campo.',
  },
  {
    id: 'password',
    label: '🔑 Password / login',
    keywords: ['password', 'palavra passe', 'senha', 'esqueci', 'recuperar', 'login', 'entrar conta', 'nao consigo entrar', 'não consigo entrar'],
    resposta: 'Para alterar a password: O Meu Perfil → tab "Conta" → "Alterar Password". A nova password deve ter pelo menos 8 caracteres. Se não consegues entrar de todo, usa o formulário em baixo para falares connosco.',
  },
  {
    id: 'perfil',
    label: '👤 Editar perfil',
    keywords: ['perfil', 'nickname', 'foto', 'editar', 'dados', 'posicao', 'posição', 'bio', 'privado'],
    resposta: 'No menu do utilizador → "O Meu Perfil" podes editar tudo: foto, nickname, posição, região e se o perfil é público ou privado.',
  },
  {
    id: 'cancelar',
    label: '❌ Cancelar inscrição',
    keywords: ['cancelar', 'cancelo', 'anular', 'desistir', 'sair do jogo', 'cancelamento', 'desinscrever', 'inscricao', 'inscrição'],
    resposta: 'Na página do jogo clica em "Cancelar Inscrição". Se já tinhas pago, o reembolso é feito automaticamente quando aplicável. Tenta avisar com antecedência para não deixar a equipa a faltar gente!',
  },
  {
    id: 'privado',
    label: '🔒 Jogo privado / código',
    keywords: ['privado', 'codigo', 'código', 'acesso', 'convite', 'codigo de jogo'],
    resposta: 'Os jogos privados precisam de um código de acesso. Por segurança, só o criador vê o código no momento da criação — partilha-o diretamente com os jogadores convidados (não é possível recuperá-lo depois).',
  },
  {
    id: 'notificacoes',
    label: '🔔 Notificações',
    keywords: ['notificacao', 'notificações', 'notificacoes', 'lembrete', 'push', 'aviso', 'alerta'],
    resposta: 'Ativa as notificações em O Meu Perfil → tab "Conta". Podes receber avisos push e escolher um lembrete (1h, 2h ou 24h) antes dos jogos em que estás inscrito.',
  },
];

const SAUDACAO = 'Olá! 👋 Sou o assistente do FutBuddies. Em que posso ajudar? Escolhe um tópico ou escreve a tua pergunta.';

export default function SuporteBot({ onContactarHumano }) {
  const [mensagens, setMensagens] = useState([{ de: 'bot', texto: SAUDACAO }]);
  const [input, setInput] = useState('');
  const [aEscrever, setAEscrever] = useState(false);
  const fimRef = useRef(null);
  const timers = useRef([]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [mensagens, aEscrever]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const encontrar = (texto) => {
    const t = norm(texto);
    const palavras = t.split(/[^a-z0-9]+/).filter(Boolean);
    let melhor = null, melhorScore = 0;
    for (const item of KB) {
      let score = 0;
      for (const kw of item.keywords) {
        const k = norm(kw);
        if (k.includes(' ')) { if (t.includes(k)) score += 3; continue; } // frase exata
        for (const w of palavras) {
          if (w === k) score += 2;                                         // palavra igual
          else if (w.length >= 4 && k.length >= 4 && (w.startsWith(k) || k.startsWith(w))) score += 1; // mesma raiz
        }
      }
      if (score > melhorScore) { melhorScore = score; melhor = item; }
    }
    return melhorScore >= 1 ? melhor : null;
  };

  const responderBot = (item) => {
    setAEscrever(true);
    const tmr = setTimeout(() => {
      setAEscrever(false);
      if (item) {
        setMensagens(m => [...m, { de: 'bot', texto: item.resposta, humano: true }]);
      } else {
        setMensagens(m => [...m, {
          de: 'bot',
          texto: 'Hmm, não tenho a certeza sobre isso. 🤔 Tenta reformular com outras palavras, ou fala diretamente com a nossa equipa — respondemos o mais rápido possível.',
          humano: true,
        }]);
      }
    }, 650);
    timers.current.push(tmr);
  };

  const enviarTexto = (texto) => {
    const t = texto.trim();
    if (!t) return;
    setMensagens(m => [...m, { de: 'user', texto: t }]);
    setInput('');
    responderBot(encontrar(t));
  };

  const clicarTopico = (item) => {
    setMensagens(m => [...m, { de: 'user', texto: item.label.replace(/^[^\s]+\s/, '') }]);
    responderBot(item);
  };

  return (
    <div className="sbot">
      <div className="sbot-head">
        <span className="sbot-avatar">🤖</span>
        <div>
          <strong>Assistente FutBuddies</strong>
          <span className="sbot-status"><span className="sbot-dot" /> Online · resposta imediata</span>
        </div>
      </div>

      <div className="sbot-msgs">
        {mensagens.map((m, i) => (
          <div key={i} className={`sbot-msg ${m.de}`}>
            <div className="sbot-bolha">
              {m.texto}
              {m.humano && (
                <button type="button" className="sbot-humano" onClick={onContactarHumano}>
                  Falar com a equipa →
                </button>
              )}
            </div>
          </div>
        ))}
        {aEscrever && (
          <div className="sbot-msg bot">
            <div className="sbot-bolha sbot-typing"><span /><span /><span /></div>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      <div className="sbot-chips">
        {KB.map(item => (
          <button key={item.id} type="button" className="sbot-chip" onClick={() => clicarTopico(item)}>
            {item.label}
          </button>
        ))}
      </div>

      <form className="sbot-input" onSubmit={(e) => { e.preventDefault(); enviarTexto(input); }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Escreve a tua pergunta…"
          aria-label="Escreve a tua pergunta"
        />
        <button type="submit" className="btn btn-primary" disabled={!input.trim()}>Enviar</button>
      </form>
    </div>
  );
}
