// ============================================================
//  FutBuddies - Listagem pública de Campos
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useConfirm, usePrompt } from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { SkeletonList } from '../components/Skeleton';
import { REGIOES, resolverImgUrl } from '../utils/constantes';
import { IconMapPin, IconClock, IconSearch, IconBall, IconStadium, IconTrash, IconMail } from '../components/Icons';
import './Campos.css';

const minToHHMM = (m) => {
  if (m == null) return '—';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
};

const DIAS_CURTO = { 1:'Seg', 2:'Ter', 3:'Qua', 4:'Qui', 5:'Sex', 6:'Sáb', 7:'Dom' };

function parseArr(raw, fallback) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

export default function Campos() {
  const [campos, setCampos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [regiao, setRegiao] = useState('');
  const [pesquisa, setPesquisa] = useState('');
  const [selecionado, setSelecionado] = useState(null);
  const [soFavoritos, setSoFavoritos] = useState(false);
  const { utilizador, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const confirmar = useConfirm();
  const navigate = useNavigate();
  const isAdmin = utilizador?.role === 'admin';

  const toggleFavorito = async (campo, e) => {
    e?.stopPropagation();
    if (!isAuthenticated) {
      addToast('Tens de iniciar sessão para favoritar campos.', 'info');
      return;
    }
    const novo = !campo.is_favorito;
    // optimistic update
    setCampos(prev => prev.map(c => c.id === campo.id ? { ...c, is_favorito: novo ? 1 : 0 } : c));
    if (selecionado?.id === campo.id) setSelecionado(s => ({ ...s, is_favorito: novo ? 1 : 0 }));
    try {
      if (novo) await api.post(`/campos/${campo.id}/favorito`);
      else      await api.delete(`/campos/${campo.id}/favorito`);
      addToast(novo ? '⭐ Adicionado aos favoritos' : 'Removido dos favoritos', novo ? 'success' : 'info', 2000);
    } catch {
      // rollback
      setCampos(prev => prev.map(c => c.id === campo.id ? { ...c, is_favorito: !novo ? 1 : 0 } : c));
      addToast('Erro a atualizar favorito.', 'error');
    }
  };

  const reload = () => {
    setCarregando(true);
    const url = regiao ? `/campos?regiao=${encodeURIComponent(regiao)}` : '/campos';
    api.get(url)
      .then(r => setCampos(r.data.campos || []))
      .catch(() => setCampos([]))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    setCarregando(true);
    const url = regiao ? `/campos?regiao=${encodeURIComponent(regiao)}` : '/campos';
    api.get(url)
      .then(r => setCampos(r.data.campos || []))
      .catch(() => setCampos([]))
      .finally(() => setCarregando(false));
  }, [regiao]);

  const filtrados = useMemo(() => {
    const q = pesquisa.trim().toLowerCase();
    let arr = campos;
    if (soFavoritos) arr = arr.filter(c => c.is_favorito);
    if (q) arr = arr.filter(c =>
      c.nome?.toLowerCase().includes(q) ||
      c.morada?.toLowerCase().includes(q) ||
      c.regiao?.toLowerCase().includes(q)
    );
    return arr;
  }, [campos, pesquisa, soFavoritos]);

  return (
    <div className="campos-page">
      <div className="container">
        <header className="campos-header">
          <div>
            <h1><IconBall size="1em" /> Campos Disponíveis</h1>
            <p>Descobre campos parceiros, consulta horários e reserva o teu jogo.</p>
          </div>
        </header>

        <div className="campos-filtros">
          <div className="campos-search">
            <IconSearch size="0.95em" />
            <input
              type="text"
              placeholder="Pesquisar por nome, morada ou região…"
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
            />
          </div>
          <select value={regiao} onChange={(e) => setRegiao(e.target.value)}>
            <option value="">Todas as regiões</option>
            {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {isAuthenticated && (
            <button
              type="button"
              className={`campos-fav-toggle ${soFavoritos ? 'ativo' : ''}`}
              onClick={() => setSoFavoritos(v => !v)}
              aria-pressed={soFavoritos}
              title="Mostrar só favoritos"
            >
              {soFavoritos ? '★' : '☆'} Favoritos
            </button>
          )}
        </div>

        {carregando && <SkeletonList count={6} />}
        {!carregando && filtrados.length === 0 && (
          <EmptyState
            icon={<IconStadium size="2.2rem" />}
            titulo={soFavoritos ? 'Sem favoritos' : 'Nenhum campo encontrado'}
            descricao={soFavoritos
              ? 'Carrega na estrela de um campo para o guardares aqui.'
              : 'Tenta ajustar os filtros ou pesquisar por outra região.'}
          />
        )}

        <div className="campos-grid">
          {filtrados.map(c => {
            const dias = parseArr(c.dias_semana_json, [1,2,3,4,5,6,7]);
            const lotacoes = parseArr(c.lotacoes_json, [5,7]);
            const indisponivel = !c.dono_charges_enabled;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelecionado(c)}
                className={`campo-card ${indisponivel ? 'indisponivel' : ''}`}
              >
                <div className="campo-foto">
                  {c.foto_url
                    ? <img
                        src={resolverImgUrl(c.foto_url)}
                        alt={c.nome}
                        onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.classList.add('no-img'); }}
                      />
                    : <div className="campo-foto-placeholder"><IconStadium size="3rem" /></div>}
                  {indisponivel && <span className="campo-tag warn">Indisponível</span>}
                  {isAuthenticated && (
                    <span
                      role="button"
                      tabIndex={0}
                      className={`campo-fav-btn ${c.is_favorito ? 'on' : ''}`}
                      onClick={(e) => toggleFavorito(c, e)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFavorito(c, e); } }}
                      title={c.is_favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                      aria-label={c.is_favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    >
                      {c.is_favorito ? '★' : '☆'}
                    </span>
                  )}
                </div>
                <div className="campo-body">
                  <h3>{c.nome}</h3>
                  <p className="campo-meta">
                    <IconMapPin size="0.85em" /> {c.regiao || '—'}
                    {c.morada && <> · {c.morada}</>}
                  </p>
                  <p className="campo-horario">
                    <IconClock size="0.85em" /> {minToHHMM(c.hora_abertura)} – {minToHHMM(c.hora_fecho)}
                  </p>
                  <div className="campo-chips">
                    {dias.map(d => (
                      <span key={d} className="campo-chip">{DIAS_CURTO[d] || d}</span>
                    ))}
                  </div>
                  <div className="campo-footer">
                    <div className="campo-lotacoes">
                      {lotacoes.map(l => (
                        <span key={l} className="campo-lotacao">{l}x{l}</span>
                      ))}
                    </div>
                    <div className="campo-preco">
                      €{((c.preco_hora_cents || 0) / 100).toFixed(2)}<span>/h</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selecionado && (
        <CampoDetalheModal
          campo={selecionado}
          onClose={() => setSelecionado(null)}
          onReservar={() => navigate(`/jogos/criar?campoId=${selecionado.id}`)}
          isAdmin={isAdmin}
          isAuthenticated={isAuthenticated}
          onToggleFavorito={() => toggleFavorito(selecionado)}
          onAdminAction={() => { setSelecionado(null); reload(); }}
          addToast={addToast}
          confirmar={confirmar}
        />
      )}
    </div>
  );
}

function CampoDetalheModal({ campo, onClose, onReservar, isAdmin, isAuthenticated, onToggleFavorito, onAdminAction, addToast, confirmar }) {
  const perguntar = usePrompt();
  const fotos = parseArr(campo.fotos_json, []);
  const galeria = fotos.length > 0 ? fotos : (campo.foto_url ? [campo.foto_url] : []);
  const [idx, setIdx] = useState(0);
  const [avaliacoes, setAvaliacoes] = useState({ media: null, total: 0 });
  const dias = parseArr(campo.dias_semana_json, [1,2,3,4,5,6,7]);
  const lotacoes = parseArr(campo.lotacoes_json, [5,7]);
  const indisponivel = !campo.dono_charges_enabled;

  useEffect(() => {
    api.get(`/campos/${campo.id}/avaliacoes`)
      .then(r => setAvaliacoes({ media: r.data.media, total: r.data.total || 0 }))
      .catch(() => {});
  }, [campo.id]);

  const pedirInfo = async () => {
    const msg = await perguntar({
      titulo: 'Pedir informação ao dono',
      mensagem: 'Que informações precisas? O dono recebe esta mensagem.',
      placeholder: 'Ex: Atualizar fotos, comprovativo de luz…',
      multiline: true,
      obrigatorio: true,
      confirmarLabel: 'Enviar',
    });
    if (!msg) return;
    try {
      await api.post(`/admin/campos/${campo.id}/pedir-info`, { mensagem: msg });
      addToast?.('Pedido enviado ao dono.', 'success');
    } catch (e) { addToast?.(e.response?.data?.mensagem || 'Erro.', 'error'); }
  };
  const eliminar = async () => {
    const ok = await confirmar?.({
      titulo: `Eliminar "${campo.nome}"?`,
      mensagem: 'Esta ação é irreversível. Todos os dados do campo serão perdidos.',
      confirmarLabel: 'Eliminar',
      variante: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/campos/${campo.id}`);
      addToast?.('Campo eliminado.', 'success');
      onAdminAction?.();
    } catch (e) { addToast?.(e.response?.data?.mensagem || 'Erro.', 'error'); }
  };

  return (
    <div className="campo-modal-backdrop" onClick={onClose}>
      <div className="campo-modal" onClick={e => e.stopPropagation()}>
        <button className="campo-modal-close" onClick={onClose}>×</button>

        <div className="campo-modal-galeria">
          {galeria.length > 0 ? (
            <>
              <img src={resolverImgUrl(galeria[idx])} alt={campo.nome}
                   onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              {galeria.length > 1 && (
                <>
                  <button className="campo-nav prev" onClick={() => setIdx((idx - 1 + galeria.length) % galeria.length)}>‹</button>
                  <button className="campo-nav next" onClick={() => setIdx((idx + 1) % galeria.length)}>›</button>
                  <div className="campo-dots">
                    {galeria.map((_, i) => (
                      <span key={i} className={`campo-dot ${i === idx ? 'on' : ''}`} onClick={() => setIdx(i)} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="campo-foto-placeholder"><IconStadium size="4rem" /></div>
          )}
        </div>

        <div className="campo-modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <h2 style={{ margin: 0 }}>{campo.nome}</h2>
            {isAuthenticated && (
              <button
                type="button"
                className={`campo-fav-btn in-modal ${campo.is_favorito ? 'on' : ''}`}
                onClick={onToggleFavorito}
                aria-label={campo.is_favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                title={campo.is_favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                {campo.is_favorito ? '★' : '☆'}
              </button>
            )}
          </div>
          <p className="campo-meta">
            <IconMapPin size="0.9em" /> {campo.regiao || '—'}
            {campo.morada && <> · {campo.morada}</>}
          </p>
          {avaliacoes.total > 0 && (
            <p className="campo-rating" style={{ margin: '0.25rem 0 0.75rem', color: 'var(--warning)', fontWeight: 600 }}>
              ★ {avaliacoes.media?.toFixed(1)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({avaliacoes.total} {avaliacoes.total === 1 ? 'avaliação' : 'avaliações'})</span>
            </p>
          )}
          {campo.descricao && <p className="campo-desc">{campo.descricao}</p>}

          <div className="campo-detalhe-grid">
            <div>
              <span className="campo-detalhe-label">Horário</span>
              <strong><IconClock size="0.85em" /> {minToHHMM(campo.hora_abertura)} – {minToHHMM(campo.hora_fecho)}</strong>
            </div>
            <div>
              <span className="campo-detalhe-label">Piso</span>
              <strong>{campo.tipo_piso || '—'}</strong>
            </div>
            <div>
              <span className="campo-detalhe-label">Duração</span>
              <strong>{campo.duracao_min || 60} min</strong>
            </div>
            <div>
              <span className="campo-detalhe-label">Preço</span>
              <strong>€{((campo.preco_hora_cents || 0) / 100).toFixed(2)}/h</strong>
            </div>
          </div>

          <div>
            <span className="campo-detalhe-label">Dias disponíveis</span>
            <div className="campo-chips">
              {dias.map(d => <span key={d} className="campo-chip">{DIAS_CURTO[d] || d}</span>)}
            </div>
          </div>
          <div>
            <span className="campo-detalhe-label">Formatos</span>
            <div className="campo-lotacoes">
              {lotacoes.map(l => <span key={l} className="campo-lotacao">{l}x{l}</span>)}
            </div>
          </div>

          {indisponivel && <p className="campo-aviso">⚠ Campo ainda sem pagamentos ativos. Não é possível reservar.</p>}

          <div className="campo-modal-actions">
            {isAdmin && (
              <>
                <button type="button" className="btn-ghost" onClick={pedirInfo}>
                  <IconMail size="0.9em" /> Pedir informações
                </button>
                <button type="button" className="btn-danger" onClick={eliminar}>
                  <IconTrash size="0.9em" color="#fff" /> Eliminar Campo
                </button>
              </>
            )}
            <button
              type="button"
              className="btn-primary"
              disabled={indisponivel}
              onClick={onReservar}
            >
              Reservar Campo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
