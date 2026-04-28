// ============================================================
//  FutBuddies - Componente de Upload de Imagem
// ============================================================

import React, { useRef, useState } from 'react';
import api from '../utils/api';
import { resolverImgUrl } from '../utils/constantes';
import './ImageUpload.css';

export default function ImageUpload({ valor, onChange, placeholder = '📷', forma = 'circulo', tamanho = 80 }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState('');

  const handleFicheiro = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validação local
    if (file.size > 5 * 1024 * 1024) {
      setErro('Ficheiro demasiado grande. Máximo 5MB.');
      return;
    }

    setErro('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('imagem', file);

      const res = await api.post('/upload/imagem', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Guardar apenas o path relativo (/uploads/...) para funcionar em qualquer dispositivo
      onChange(res.data.url);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao carregar imagem.');
    } finally {
      setUploading(false);
      // Reset input so same file can be selected again
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const isCirculo = forma === 'circulo';
  const borderRadius = isCirculo ? '50%' : '12px';

  return (
    <div className="img-upload-wrapper">
      <div
        className={`img-upload-preview ${uploading ? 'img-upload-loading' : ''}`}
        style={{ width: tamanho, height: tamanho, borderRadius, cursor: 'pointer' }}
        onClick={() => !uploading && inputRef.current?.click()}
        title="Clica para alterar imagem"
      >
        {valor ? (
          <img
            src={resolverImgUrl(valor)}
            alt="preview"
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius, display: 'block' }}
          />
        ) : (
          <div className="img-upload-placeholder" style={{ borderRadius }}>
            {uploading ? (
              <div className="spinner" style={{ width: 20, height: 20 }} />
            ) : (
              <span style={{ fontSize: tamanho > 60 ? '1.5rem' : '1rem' }}>{placeholder}</span>
            )}
          </div>
        )}

        {/* Overlay de hover */}
        {!uploading && (
          <div className="img-upload-overlay" style={{ borderRadius }}>
            <span style={{ fontSize: '1rem' }}>📷</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>Alterar</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleFicheiro}
        style={{ display: 'none' }}
      />

      {erro && <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.25rem', maxWidth: tamanho + 40 }}>{erro}</p>}
    </div>
  );
}
