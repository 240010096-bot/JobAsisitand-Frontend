import React, { useState } from 'react';

/**
 * RegistroAsistencia
 * Componente auxiliar de captura de GPS — integrado dentro de Jobassistand.jsx.
 * Se mantiene aquí como utilidad independiente para uso externo o pruebas.
 */
function RegistroAsistencia({ onUbicacion }) {
  const [ubicacion, setUbicacion] = useState({ lat: null, lng: null });
  const [estado,    setEstado]    = useState('idle'); // idle | loading | ok | error
  const [lugar,     setLugar]     = useState('');

  const obtenerCoordenadas = () => {
    if (!navigator.geolocation) {
      setEstado('error');
      return;
    }
    setEstado('loading');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUbicacion(coords);
        setEstado('ok');

        // Geocodificación inversa
        try {
          if (navigator.onLine) {
            const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}`);
            const data = await res.json();
            setLugar(data.display_name || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
          }
        } catch { setLugar(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`); }

        onUbicacion?.(coords);
      },
      () => setEstado('error'),
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const colorMap = { idle: '#6b7280', loading: '#f59e0b', ok: '#10b981', error: '#ef4444' };
  const iconMap  = { idle: 'bi-geo-alt', loading: 'bi-arrow-repeat', ok: 'bi-geo-alt-fill', error: 'bi-exclamation-triangle-fill' };

  return (
    <div style={{ padding: 16, background: 'rgba(255,255,255,.03)', border: '1px solid #1f2937', borderRadius: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <i className={`bi ${iconMap[estado]}`} style={{ color: colorMap[estado], fontSize: 20 }} />
        <div>
          <div style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 600 }}>Geolocalización GPS</div>
          <div style={{ color: '#6b7280', fontSize: 11 }}>
            {{ idle: 'Sin capturar', loading: 'Obteniendo...', ok: 'Capturado ✓', error: 'No disponible' }[estado]}
          </div>
        </div>
      </div>

      {ubicacion.lat && (
        <div style={{ background: 'rgba(16,185,129,.07)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
          <div style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>
            {ubicacion.lat.toFixed(6)}, {ubicacion.lng.toFixed(6)}
          </div>
          {lugar && <div style={{ color: '#6b7280', fontSize: 10, marginTop: 2, lineHeight: 1.3 }}>{lugar}</div>}
        </div>
      )}

      <button
        onClick={obtenerCoordenadas}
        disabled={estado === 'loading'}
        style={{
          background: estado === 'ok' ? 'rgba(16,185,129,.12)' : 'rgba(59,130,246,.12)',
          border: `1px solid ${estado === 'ok' ? 'rgba(16,185,129,.3)' : 'rgba(59,130,246,.3)'}`,
          color: estado === 'ok' ? '#10b981' : '#3b82f6',
          borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600,
          cursor: estado === 'loading' ? 'wait' : 'pointer', width: '100%',
        }}
      >
        <i className={`bi ${estado === 'ok' ? 'bi-arrow-clockwise' : 'bi-crosshair'} me-2`} />
        {estado === 'ok' ? 'Actualizar ubicación' : 'Capturar Ubicación GPS'}
      </button>
    </div>
  );
}

export default RegistroAsistencia;
