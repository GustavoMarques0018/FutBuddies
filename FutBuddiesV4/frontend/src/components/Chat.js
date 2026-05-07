// ============================================================
//  FutBuddies - Chat do Jogo (v2 — imagens, GIFs, reações, menções)
// ============================================================

import React, {
  useState, useEffect, useRef, useCallback, lazy, Suspense,
} from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../utils/api';
import Avatar from './Avatar';
import { resolverImgUrl } from '../utils/constantes';
import { IconChat } from './Icons';
import './Chat.css';

const GifPicker = lazy(() => import('./GifPicker'));

const EMOJIS = ['👍', '⚽', '🔥', '😂', '❤️'];
const SOCKET_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api')
  .replace('/api', '');

// Formata texto de mensagem: realça @mencoes e URLs
function formatarTexto(texto, mencoes = []) {
  if (!texto) return null;
  // Highlight @mentions
  const parts = texto.split(/(@\S+)/g);
  return parts.map((p, i) =>
    p.startsWith('@')
      ? <span key={i} className="chat-mencao">{p}</span>
      : p
  );
}

// Componente de uma única mensagem
function Mensagem({ msg, utilizadorId, onReacao }) {
  const isMine = msg.utilizador_id === utilizadorId;
  const [showEmojis, setShowEmojis] = useState(false);

  const mencoes = (() => {
    try { return msg.mencoes_json ? JSON.parse(msg.mencoes_json) : []; }
    catch { return []; }
  })();

  // Fecha a barra de emojis quando se clica fora
  const bubbleRef = useRef(null);
  useEffect(() => {
    if (!showEmojis) return;
    const handle = (e) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target)) {
        setShowEmojis(false);
      }
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, [showEmojis]);

  return (
    <div className={`chat-msg ${isMine ? 'mine' : ''}`}>
      {!isMine && (
        <Avatar
          nome={msg.utilizador_nome}
          fotoUrl={msg.foto_url}
          size="sm"
          className="chat-avatar"
        />
      )}
      <div className="chat-bubble-wrap">
        {!isMine && (
          <span className="chat-autor">
            {msg.nickname || msg.utilizador_nome}
          </span>
        )}

        {/* Wrapper da bubble + emoji bar (position:relative para ancorar a barra) */}
        <div
          ref={bubbleRef}
          className="chat-bubble-anchor"
          onMouseEnter={() => setShowEmojis(true)}
          onMouseLeave={() => setShowEmojis(false)}
        >
          <div className={`chat-bubble ${isMine ? 'mine' : ''}`}>
            {/* Imagem */}
            {msg.tipo === 'imagem' && msg.media_url && (
              <a href={resolverImgUrl(msg.media_url)} target="_blank" rel="noopener noreferrer">
                <img
                  src={resolverImgUrl(msg.media_url)}
                  alt="imagem"
                  className="chat-img"
                  loading="lazy"
                />
              </a>
            )}
            {/* GIF */}
            {msg.tipo === 'gif' && msg.media_url && (
              <img
                src={msg.media_url}
                alt="gif"
                className="chat-img chat-gif"
                loading="lazy"
              />
            )}
            {/* Texto */}
            {(msg.tipo === 'texto' || !msg.tipo) && msg.mensagem && (
              <p className="chat-texto">{formatarTexto(msg.mensagem, mencoes)}</p>
            )}
            {/* Legenda sob imagem/gif */}
            {msg.tipo !== 'texto' && msg.mensagem && (
              <p className="chat-texto chat-legenda">{msg.mensagem}</p>
            )}
          </div>

          {/* Barra de emojis — aparece acima da bubble */}
          {showEmojis && (
            <div className={`chat-emoji-bar ${isMine ? 'right' : 'left'}`}>
              {EMOJIS.map(e => (
                <button
                  key={e}
                  className="chat-emoji-opt"
                  onPointerUp={(ev) => {
                    ev.stopPropagation();
                    onReacao(msg.id, e);
                    setShowEmojis(false);
                  }}
                  title={e}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reações */}
        {msg.reacoes && msg.reacoes.length > 0 && (
          <div className="chat-reacoes">
            {msg.reacoes.map(r => (
              <button
                key={r.emoji}
                className={`chat-reacao-btn ${r.utilizadores?.includes(String(utilizadorId)) || r.utilizadores?.includes(utilizadorId) ? 'minha' : ''}`}
                onClick={() => onReacao(msg.id, r.emoji)}
                title={`${r.total} pessoa(s)`}
              >
                {r.emoji} <span>{r.total}</span>
              </button>
            ))}
          </div>
        )}

        {/* Linha de meta: hora + botão de reagir (visível no mobile) */}
        <div className={`chat-meta-row ${isMine ? 'mine' : ''}`}>
          {!isMine && (
            <button
              className="chat-reacao-trigger"
              onPointerUp={(ev) => { ev.stopPropagation(); setShowEmojis(v => !v); }}
              aria-label="Reagir"
            >
              😊
            </button>
          )}
          <span className="chat-hora">
            {new Date(msg.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isMine && (
            <button
              className="chat-reacao-trigger"
              onPointerUp={(ev) => { ev.stopPropagation(); setShowEmojis(v => !v); }}
              aria-label="Reagir"
            >
              😊
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────
export default function Chat({ jogoId, utilizadorId, podeEnviar, participantes = [] }) {
  const [mensagens, setMensagens]       = useState([]);
  const [input, setInput]               = useState('');
  const [sending, setSending]           = useState(false);
  const [ligado, setLigado]             = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [showGif, setShowGif]           = useState(false);
  // @ mention autocomplete
  const [mencaoQ, setMencaoQ]           = useState('');
  const [mencaoLista, setMencaoLista]   = useState([]);
  const [mencoesSelecionadas, setMencoesSelecionadas] = useState([]); // [{id, nome}]

  const chatRef   = useRef(null);
  const inputRef  = useRef(null);
  const socketRef = useRef(null);
  const fileRef   = useRef(null);

  // ── Socket ──────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (!token) return;

    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setLigado(true);
      socket.emit('entrar_jogo', parseInt(jogoId));
    });
    socket.on('disconnect', () => setLigado(false));
    socket.on('connect_error', () => setLigado(false));

    socket.on('nova_mensagem', (msg) => {
      setMensagens(prev =>
        prev.some(m => m.id === msg.id) ? prev : [...prev, msg]
      );
    });

    // Reação em tempo real: recarregar mensagem via API
    socket.on('reacao_atualizada', ({ mensagemId }) => {
      // Re-fetch só esta mensagem seria complexo; simplesmente marcamos para o próximo carregamento
      // A UI actualiza-se quando o utilizador faz toggle (via REST)
    });

    return () => {
      socket.emit('sair_jogo', parseInt(jogoId));
      socket.disconnect();
    };
  }, [jogoId]);

  // ── Carregar mensagens ──────────────────────────────────
  useEffect(() => {
    api.get(`/jogos/${jogoId}/chat`)
      .then(r => setMensagens(r.data.mensagens || []))
      .catch(() => {});
  }, [jogoId]);

  // ── Auto-scroll ─────────────────────────────────────────
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const perto = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (perto || mensagens.length <= 1) {
      el.scrollTop = el.scrollHeight;
    }
  }, [mensagens]);

  // ── @ mention autocomplete ──────────────────────────────
  const handleInput = (e) => {
    const val = e.target.value;
    setInput(val);
    // Detectar @query no cursor
    const cursor = e.target.selectionStart;
    const antes  = val.slice(0, cursor);
    const match  = antes.match(/@(\w*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      setMencaoQ(q);
      setMencaoLista(
        participantes.filter(p =>
          (p.nome || '').toLowerCase().includes(q) ||
          (p.nickname || '').toLowerCase().includes(q)
        ).slice(0, 6)
      );
    } else {
      setMencaoQ('');
      setMencaoLista([]);
    }
  };

  const selecionarMencao = (p) => {
    // Substituir o @query pelo @nome
    const cursor = inputRef.current.selectionStart;
    const antes  = input.slice(0, cursor);
    const depois = input.slice(cursor);
    const novoAntes = antes.replace(/@\w*$/, `@${p.nickname || p.nome} `);
    setInput(novoAntes + depois);
    setMencaoLista([]);
    setMencoesSelecionadas(prev =>
      prev.some(x => x.id === p.id) ? prev : [...prev, p]
    );
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // ── Enviar texto ────────────────────────────────────────
  const enviar = async (e) => {
    e?.preventDefault();
    if (!input.trim() || sending || !podeEnviar) return;
    setSending(true);
    const texto = input.trim();
    const mencoes = mencoesSelecionadas.map(m => m.id);
    setInput('');
    setMencoesSelecionadas([]);
    try {
      // O servidor faz o broadcast via socket com o ID real do DB.
      // O sender recebe o evento 'nova_mensagem' e o dedup impede duplicação.
      await api.post(`/jogos/${jogoId}/chat`, { mensagem: texto, tipo: 'texto', mencoes });
    } catch {
      setInput(texto);
    } finally {
      setSending(false);
    }
  };

  // ── Upload de imagem ────────────────────────────────────
  const handleImagem = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append('imagem', file);
      // NÃO definir Content-Type manualmente: o axios detecta FormData e
      // gera automaticamente o boundary correcto para o multer parsear.
      const up = await api.post('/upload/imagem', fd);
      if (!up.data.sucesso) throw new Error('Upload falhou');
      const mediaUrl = up.data.url;
      // O servidor faz broadcast do resultado via socket com o ID real do DB
      await api.post(`/jogos/${jogoId}/chat`, { mensagem: '', tipo: 'imagem', mediaUrl });
    } catch {
      alert('Erro ao enviar imagem. Tenta novamente.');
    } finally {
      setUploadingImg(false);
      e.target.value = '';
    }
  };

  // ── Enviar GIF ──────────────────────────────────────────
  const enviarGif = async (gifUrl) => {
    setShowGif(false);
    try {
      // O servidor faz broadcast via socket com o ID real do DB
      await api.post(`/jogos/${jogoId}/chat`, { mensagem: '', tipo: 'gif', mediaUrl: gifUrl });
    } catch {
      alert('Erro ao enviar GIF.');
    }
  };

  // ── Toggle reação ────────────────────────────────────────
  const handleReacao = async (mensagemId, emoji) => {
    try {
      const res = await api.post(`/jogos/${jogoId}/chat/${mensagemId}/reacao`, { emoji });
      if (res.data.sucesso) {
        setMensagens(prev => prev.map(m =>
          m.id === mensagemId ? { ...m, reacoes: res.data.reacoes } : m
        ));
        socketRef.current?.emit('chat_reacao', { jogoId: parseInt(jogoId), mensagemId, emoji });
      }
    } catch {}
  };

  // ── Enter key ───────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (mencaoLista.length > 0) { selecionarMencao(mencaoLista[0]); return; }
      enviar();
    }
    if (e.key === 'Escape') setMencaoLista([]);
  };

  return (
    <div className="chat-wrap">
      {/* Header */}
      <div className="chat-header">
        <span className="chat-header-title"><IconChat size="1em" /> Chat do Jogo</span>
        <span className={`chat-dot ${ligado ? 'on' : ''}`} title={ligado ? 'Ligado' : 'Desligado'} />
      </div>

      {/* Mensagens */}
      <div className="chat-msgs" ref={chatRef}>
        {mensagens.length === 0 ? (
          <div className="chat-empty">Ainda não há mensagens. Sê o primeiro! 💬</div>
        ) : (
          mensagens.map(msg => (
            <Mensagem
              key={msg.id}
              msg={msg}
              utilizadorId={utilizadorId}
              onReacao={handleReacao}
            />
          ))
        )}
      </div>

      {/* Input */}
      {podeEnviar ? (
        <div className="chat-input-area">
          {/* @ mention dropdown */}
          {mencaoLista.length > 0 && (
            <div className="chat-mencao-lista">
              {mencaoLista.map(p => (
                <button key={p.id} className="chat-mencao-opt" onClick={() => selecionarMencao(p)}>
                  <Avatar nome={p.nome} fotoUrl={p.foto_url} size="xs" />
                  <span>{p.nickname || p.nome}</span>
                </button>
              ))}
            </div>
          )}

          <form className="chat-input-row" onSubmit={enviar}>
            {/* Upload imagem */}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImagem} />
            <button
              type="button"
              className="chat-tool-btn"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingImg}
              title="Enviar imagem"
            >
              {uploadingImg ? '⏳' : '📷'}
            </button>

            {/* GIF */}
            <button
              type="button"
              className="chat-tool-btn chat-gif-btn"
              onClick={() => setShowGif(v => !v)}
              title="Enviar GIF"
            >
              GIF
            </button>

            {/* Texto */}
            <textarea
              ref={inputRef}
              className="chat-textarea"
              placeholder="Escreve uma mensagem... (@ para mencionar)"
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={1000}
              disabled={sending}
            />

            <button
              type="submit"
              className="btn btn-primary btn-sm chat-send-btn"
              disabled={!input.trim() || sending}
            >
              {sending ? '⏳' : '↑'}
            </button>
          </form>
        </div>
      ) : (
        <div className="chat-locked">
          <p>Inscreve-te no jogo para participar no chat</p>
        </div>
      )}

      {/* GIF Picker modal */}
      {showGif && (
        <Suspense fallback={null}>
          <GifPicker
            onSelect={(url) => enviarGif(url)}
            onFechar={() => setShowGif(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
