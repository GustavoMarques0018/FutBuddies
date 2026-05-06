// ============================================================
//  FutBuddies - Seletor de Pin no Mapa
//  Modal com Leaflet para o utilizador marcar a localização exacta.
//  Importado lazily em CriarJogo para não aumentar o bundle principal.
// ============================================================

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapaPinPicker.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl:       markerIcon,
  shadowUrl:     markerShadow,
});

// Coordenadas aproximadas por região para centrar o mapa
const CENTRO_REGIAO = {
  'Lisboa': [38.7167, -9.1333], 'Porto': [41.1496, -8.6109],
  'Braga': [41.5454, -8.4265], 'Coimbra': [40.2111, -8.4291],
  'Aveiro': [40.6405, -8.6538], 'Leiria': [39.7436, -8.8071],
  'Setúbal': [38.5244, -8.8882], 'Faro': [37.0194, -7.9322],
  'Évora': [38.5711, -7.9076], 'Viseu': [40.6566, -7.9122],
  'Viana do Castelo': [41.6932, -8.8334], 'Bragança': [41.8061, -6.7589],
  'Guarda': [40.5364, -7.2683], 'Castelo Branco': [39.8222, -7.4910],
  'Santarém': [39.2365, -8.6877], 'Portalegre': [39.2967, -7.4285],
  'Beja': [38.0154, -7.8633], 'Odivelas': [38.7955, -9.1852],
  'Sintra': [38.8029, -9.3817], 'Amadora': [38.7566, -9.2244],
  'Almada': [38.6761, -9.1594], 'Cascais': [38.6979, -9.4215],
  'Oeiras': [38.6940, -9.3054], 'Loures': [38.8312, -9.1683],
  'Vila Nova de Gaia': [41.1239, -8.6118], 'Matosinhos': [41.1785, -8.6901],
  'Gondomar': [41.1467, -8.5363], 'Maia': [41.2297, -8.6204],
  'Valongo': [41.1945, -8.4948],
};

// Regista um click no mapa e devolve a posição
function ClickHandler({ onPos }) {
  useMapEvents({
    click(e) { onPos([e.latlng.lat, e.latlng.lng]); },
  });
  return null;
}

/**
 * Props:
 *   regiao      — região do jogo (para centrar o mapa)
 *   posInicial  — [lat, lng] se já havia pin guardado
 *   onConfirmar — callback({ lat, lng })
 *   onCancelar  — callback()
 */
export default function MapaPinPicker({ regiao, posInicial, onConfirmar, onCancelar }) {
  const [pos, setPos] = useState(posInicial || null);

  const centro = posInicial || CENTRO_REGIAO[regiao] || [39.5, -8.0];
  const zoom   = posInicial ? 16 : (CENTRO_REGIAO[regiao] ? 13 : 7);

  // Fechar com Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancelar(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancelar]);

  // Bloquear scroll do body enquanto o modal está aberto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="mpp-backdrop" onClick={onCancelar}>
      <div className="mpp-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="mpp-header">
          <div>
            <h3>📍 Localização exacta</h3>
            <p>Clica no mapa para colocar o pin na rua exacta. Podes clicar de novo para mover.</p>
          </div>
          <button className="mpp-close" onClick={onCancelar} aria-label="Fechar">✕</button>
        </div>

        {/* Mapa */}
        <div className="mpp-map-wrap">
          <MapContainer center={centro} zoom={zoom} className="mpp-map" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onPos={setPos} />
            {pos && <Marker position={pos} />}
          </MapContainer>
          {!pos && (
            <div className="mpp-hint">👆 Clica no mapa para colocar o pin</div>
          )}
        </div>

        {/* Coordenadas seleccionadas */}
        {pos ? (
          <div className="mpp-coords">
            <span>📌</span>
            <code>{pos[0].toFixed(6)}, {pos[1].toFixed(6)}</code>
            <button className="mpp-reset" onClick={() => setPos(null)} title="Remover pin">
              ✕ Remover
            </button>
          </div>
        ) : (
          <div className="mpp-coords mpp-coords-empty">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Nenhum pin colocado — o sistema usará geocodificação automática pela morada.
            </span>
          </div>
        )}

        {/* Botões */}
        <div className="mpp-actions">
          <button className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={() => onConfirmar(pos ? { lat: pos[0], lng: pos[1] } : null)}
          >
            {pos ? '✓ Confirmar localização' : 'Usar geocodificação automática'}
          </button>
        </div>
      </div>
    </div>
  );
}
