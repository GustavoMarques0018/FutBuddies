// ============================================================
//  FutBuddies - Mapa Interativo de Jogos (Leaflet + OpenStreetMap)
//  Requer: npm install leaflet react-leaflet  (já em package.json)
// ============================================================

import React, { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './JogosMapa.css';

// ── Fix dos ícones Leaflet no Webpack / CRA ───────────────
// Webpack renomeia os assets, quebrando os URLs internos do Leaflet.
// Importamos manualmente e redefinimos o ícone padrão.
import markerIcon2x  from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon    from 'leaflet/dist/images/marker-icon.png';
import markerShadow  from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl:       markerIcon,
  shadowUrl:     markerShadow,
});

// Ícone verde customizado para jogos abertos
const ICON_ABERTO = new L.Icon({
  iconUrl:       'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 26 14 26S28 23.333 28 14C28 6.268 21.732 0 14 0z"
            fill="#39d353" stroke="#1a8c2a" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="7" fill="white" opacity="0.9"/>
      <text x="14" y="18" text-anchor="middle" font-size="10" font-family="sans-serif">⚽</text>
    </svg>`),
  iconSize:     [28, 40],
  iconAnchor:   [14, 40],
  popupAnchor:  [0, -40],
  shadowUrl:    markerShadow,
  shadowSize:   [41, 41],
  shadowAnchor: [12, 40],
});

const ICON_CHEIO = new L.Icon({
  iconUrl:       'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 26 14 26S28 23.333 28 14C28 6.268 21.732 0 14 0z"
            fill="#e05c00" stroke="#993f00" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="7" fill="white" opacity="0.9"/>
      <text x="14" y="18" text-anchor="middle" font-size="10" font-family="sans-serif">⚽</text>
    </svg>`),
  iconSize:     [28, 40],
  iconAnchor:   [14, 40],
  popupAnchor:  [0, -40],
  shadowUrl:    markerShadow,
  shadowSize:   [41, 41],
  shadowAnchor: [12, 40],
});

function getIcon(jogo) {
  return jogo.estado === 'aberto' ? ICON_ABERTO : ICON_CHEIO;
}

// Centra o mapa nos jogos quando a lista muda
function MapBounds({ jogos }) {
  const map = useMap();
  useEffect(() => {
    const comCoords = jogos.filter(j => j.lat && j.lng);
    if (comCoords.length === 0) return;
    if (comCoords.length === 1) {
      map.setView([comCoords[0].lat, comCoords[0].lng], 13);
      return;
    }
    const bounds = L.latLngBounds(comCoords.map(j => [j.lat, j.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [jogos, map]);
  return null;
}

function formatarData(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-PT', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ── Coordenadas aproximadas por região (fallback sem GPS) ──
const COORDS_REGIAO = {
  'Lisboa':            [38.7167, -9.1333],
  'Porto':             [41.1496, -8.6109],
  'Braga':             [41.5454, -8.4265],
  'Coimbra':           [40.2111, -8.4291],
  'Aveiro':            [40.6405, -8.6538],
  'Leiria':            [39.7436, -8.8071],
  'Setúbal':           [38.5244, -8.8882],
  'Faro':              [37.0194, -7.9322],
  'Évora':             [38.5711, -7.9076],
  'Viseu':             [40.6566, -7.9122],
  'Viana do Castelo':  [41.6932, -8.8334],
  'Bragança':          [41.8061, -6.7589],
  'Guarda':            [40.5364, -7.2683],
  'Castelo Branco':    [39.8222, -7.4910],
  'Santarém':          [39.2365, -8.6877],
  'Portalegre':        [39.2967, -7.4285],
  'Beja':              [38.0154, -7.8633],
  'Odivelas':          [38.7955, -9.1852],
  'Sintra':            [38.8029, -9.3817],
  'Amadora':           [38.7566, -9.2244],
  'Almada':            [38.6761, -9.1594],
  'Cascais':           [38.6979, -9.4215],
  'Oeiras':            [38.6940, -9.3054],
  'Loures':            [38.8312, -9.1683],
  'Vila Nova de Gaia': [41.1239, -8.6118],
  'Matosinhos':        [41.1785, -8.6901],
  'Gondomar':          [41.1467, -8.5363],
  'Maia':              [41.2297, -8.6204],
  'Valongo':           [41.1945, -8.4948],
};

export default function JogosMapa({ jogos = [] }) {
  // Usa coordenadas do jogo → campo → fallback por região
  const jogosComCoords = useMemo(() => {
    return jogos
      .filter(j => j.estado !== 'cancelado' && j.estado !== 'concluido')
      .map(j => {
        const lat = j.latitude  || j.campo_lat  || COORDS_REGIAO[j.regiao]?.[0];
        const lng = j.longitude || j.campo_lng  || COORDS_REGIAO[j.regiao]?.[1];
        return { ...j, lat, lng, coordFallback: !j.latitude && !j.campo_lat };
      })
      .filter(j => j.lat && j.lng);
  }, [jogos]);

  // Centro padrão: Portugal continental
  const centro = [39.5, -8.0];
  const zoom   = 7;

  if (jogosComCoords.length === 0) {
    return (
      <div className="jogos-mapa-vazio">
        <span style={{ fontSize: '2.5rem' }}>🗺️</span>
        <p>Nenhum jogo com localização disponível.</p>
        <small>Os jogos aparecem no mapa quando o campo tem coordenadas GPS.</small>
      </div>
    );
  }

  return (
    <div className="jogos-mapa-wrap">
      <MapContainer
        center={centro}
        zoom={zoom}
        scrollWheelZoom
        className="jogos-mapa-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBounds jogos={jogosComCoords} />

        {jogosComCoords.map(jogo => (
          <Marker
            key={jogo.id}
            position={[jogo.lat, jogo.lng]}
            icon={getIcon(jogo)}
          >
            <Popup className="jogos-mapa-popup">
              <div className="jmp-header">
                <span className={`jmp-badge ${jogo.estado === 'aberto' ? 'aberto' : 'cheio'}`}>
                  {jogo.estado === 'aberto' ? '✅ Aberto' : '🔴 Cheio'}
                </span>
                <span className="jmp-tipo">{jogo.tipo_jogo || '—'}</span>
              </div>
              <h4 className="jmp-titulo">{jogo.titulo}</h4>
              <p className="jmp-detalhe">📍 {jogo.local || jogo.regiao}
                {jogo.coordFallback && <span className="jmp-fallback"> (aprox.)</span>}
              </p>
              <p className="jmp-detalhe">🕐 {formatarData(jogo.data_jogo)}</p>
              {jogo.max_jogadores && (
                <p className="jmp-detalhe">
                  👥 {jogo.total_inscritos || 0}/{jogo.max_jogadores} jogadores
                </p>
              )}
              <Link to={`/jogos/${jogo.id}`} className="jmp-btn">
                Ver jogo →
              </Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="jogos-mapa-legenda">
        <span><span className="leg-dot aberto" />Aberto ({jogosComCoords.filter(j => j.estado === 'aberto').length})</span>
        <span><span className="leg-dot cheio" />Cheio ({jogosComCoords.filter(j => j.estado !== 'aberto').length})</span>
        {jogosComCoords.some(j => j.coordFallback) && (
          <span className="leg-info" title="Coordenadas aproximadas por região">📌 Posição aproximada</span>
        )}
      </div>
    </div>
  );
}
