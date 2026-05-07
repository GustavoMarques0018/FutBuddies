// ============================================================
//  FutBuddies - Galeria de Fotos do Jogo
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { resolverImgUrl } from '../utils/constantes';

export default function GaleriaFotos({ jogoId, podeAdicionar, isCriador, utilizadorId }) {
  const [fotos, setFotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fotoExpandida, setFotoExpandida] = useState(null);
  const fileRef = useRef();

  const carregarFotos = () => {
    api.get(`/jogos/${jogoId}/fotos`)
      .then(res => setFotos(res.data.fotos || []))
      .catch(() => setFotos([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregarFotos();
    // eslint-disable-next-line
  }, [jogoId]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('Ficheiro demasiado grande. Máximo 15 MB.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('imagem', file);
      // No Content-Type header — axios detects FormData automatically
      const upRes = await api.post('/upload/imagem', fd);
      if (!upRes.data?.sucesso) throw new Error(upRes.data?.mensagem || 'Upload falhou.');
      const url = upRes.data.url;
      await api.post(`/jogos/${jogoId}/fotos`, { url });
      carregarFotos();
    } catch (err) {
      const msg = err?.response?.data?.mensagem || err?.message || 'Erro ao carregar foto.';
      alert(msg);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleEliminar = async (fotoId) => {
    if (!window.confirm('Eliminar esta foto?')) return;
    try {
      await api.delete(`/jogos/${jogoId}/fotos/${fotoId}`);
      setFotos(fs => fs.filter(f => f.id !== fotoId));
    } catch (err) {
      alert(err?.response?.data?.mensagem || 'Erro ao eliminar foto.');
    }
  };

  if (loading) return null;

  return (
    <div className="card" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>📷 Galeria do Jogo</h3>
        {podeAdicionar && (
          <div>
            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              style={{ display: 'none' }}
              onChange={handleUpload}
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? '⏳ A carregar...' : '+ Adicionar Foto'}
            </button>
          </div>
        )}
      </div>

      {fotos.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
          Ainda não há fotos. {podeAdicionar ? 'Sê o primeiro a partilhar!' : ''}
        </p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.5rem',
        }}>
          {fotos.map(foto => (
            <div key={foto.id} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', borderRadius: 'var(--radius-sm)' }}>
              <img
                src={resolverImgUrl(foto.url)}
                alt=""
                loading="lazy"
                onClick={() => setFotoExpandida(foto)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.03)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement.style.background = 'var(--bg-elev-2)';
                  e.currentTarget.parentElement.style.display = 'flex';
                  e.currentTarget.parentElement.style.alignItems = 'center';
                  e.currentTarget.parentElement.style.justifyContent = 'center';
                  e.currentTarget.parentElement.innerHTML = '<span style="font-size:1.5rem">📷</span>';
                }}
              />
              {(foto.utilizador_id === utilizadorId || isCriador) && (
                <button
                  onClick={() => handleEliminar(foto.id)}
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    border: 'none', borderRadius: '50%',
                    width: 24, height: 24, cursor: 'pointer',
                    fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title="Eliminar foto"
                >
                  ✕
                </button>
              )}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'rgba(0,0,0,0.5)',
                color: '#fff', fontSize: '0.65rem',
                padding: '2px 5px',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {foto.nickname || foto.nome}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {fotoExpandida && (
        <div
          onClick={() => setFotoExpandida(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.9)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <img
            src={resolverImgUrl(fotoExpandida.url)}
            alt=""
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setFotoExpandida(null)}
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              background: 'rgba(255,255,255,0.2)', color: '#fff',
              border: 'none', borderRadius: '50%',
              width: 36, height: 36, fontSize: '1rem', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
