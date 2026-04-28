// ============================================================
//  FutBuddies - Avaliar Campo (pós-jogo em campo parceiro)
// ============================================================

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { IconStadium } from '../components/Icons';

export default function AvaliarCampo() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [jogo, setJogo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState('');
  const [reportar, setReportar] = useState(false);
  const [motivoReport, setMotivoReport] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/jogos/${id}`);
        setJogo(r.data.jogo);
      } catch (e) {
        setErro('Não foi possível carregar o jogo.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const submeter = async (e) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) { setErro('Escolhe 1 a 5 estrelas.'); return; }
    setSubmitting(true); setErro(''); setMsg('');
    try {
      await api.post(`/jogos/${id}/avaliar-campo`, {
        rating,
        comentario: comentario.trim() || null,
        reportar,
        motivoReport: reportar ? (motivoReport.trim() || null) : null,
      });
      setMsg('Obrigado pela tua avaliação!');
      setTimeout(() => navigate('/campos'), 1200);
    } catch (e) {
      setErro(e.response?.data?.mensagem || 'Erro ao submeter.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:'4rem' }}><div className="spinner" /></div>;

  return (
    <div className="container" style={{ maxWidth: 720, padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/campos" style={{ color: 'var(--text-secondary)' }}>← Voltar</Link>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginTop: 0 }}>
          <IconStadium size="1.3rem" /> Avaliar campo
        </h2>
        {jogo && (
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
            Como correu a tua experiência no campo após o jogo <strong>{jogo.titulo}</strong>?
          </p>
        )}

        {erro && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{erro}</div>}
        {msg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{msg}</div>}

        <form onSubmit={submeter}>
          <label style={{ display:'block', marginBottom: '0.5rem', fontWeight: 600 }}>Classificação</label>
          <div style={{ display:'flex', gap:'0.35rem', marginBottom: '1.25rem', fontSize: '2rem', cursor: 'pointer' }}>
            {[1,2,3,4,5].map(n => (
              <span
                key={n}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                style={{ color: (hover || rating) >= n ? '#f5b301' : '#444', transition:'color 0.15s', userSelect:'none' }}
                role="button"
                aria-label={`${n} estrelas`}
              >
                ★
              </span>
            ))}
          </div>

          <label style={{ display:'block', marginBottom: '0.5rem', fontWeight: 600 }}>Comentário (opcional)</label>
          <textarea
            className="form-control"
            rows={4}
            maxLength={1000}
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            placeholder="Conta-nos o que achaste do campo..."
            style={{ width: '100%', marginBottom: '1rem' }}
          />

          <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom: '0.75rem', cursor:'pointer' }}>
            <input type="checkbox" checked={reportar} onChange={e => setReportar(e.target.checked)} />
            <span>Reportar este campo (problemas, informação incorrecta, etc.)</span>
          </label>

          {reportar && (
            <textarea
              className="form-control"
              rows={3}
              maxLength={500}
              value={motivoReport}
              onChange={e => setMotivoReport(e.target.value)}
              placeholder="Descreve o motivo do reporte..."
              style={{ width: '100%', marginBottom: '1rem' }}
            />
          )}

          <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/campos')} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || rating < 1}>
              {submitting ? 'A enviar...' : 'Submeter avaliação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
