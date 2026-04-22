import React, { useState } from 'react'
import AdminApp from './components/AdminApp'
import EncargadoApp from './components/EncargadoApp'

export default function App() {
  const [modo, setModo] = useState(() => localStorage.getItem('app_modo') || null);

  const elegir = (m) => {
    localStorage.setItem('app_modo', m);
    setModo(m);
  };

  if (modo === 'admin')     return <AdminApp />;
  if (modo === 'encargado') return <EncargadoApp />;

  // Pantalla de selección de modo
  return (
    <div style={{ backgroundColor: '#0B0E14', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 800, marginBottom: 6 }}>
          JOB<span style={{ color: '#3b82f6' }}>ASSISTAND</span>
        </h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 40 }}>
          Sistema de control de asistencia laboral
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button onClick={() => elegir('admin')}
            style={{ padding: '20px 24px', backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 20, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.15)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.08)'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-shield-lock" style={{ fontSize: 22, color: '#3b82f6' }} />
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Administrador</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>Gestionar encargados, áreas y reportes PDF</div>
              </div>
              <i className="bi bi-chevron-right" style={{ color: '#4b5563', marginLeft: 'auto' }} />
            </div>
          </button>

          <button onClick={() => elegir('encargado')}
            style={{ padding: '20px 24px', backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(16,185,129,0.15)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(16,185,129,0.08)'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-person-badge" style={{ fontSize: 22, color: '#10b981' }} />
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Encargado</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>Pasar lista, ver calendario y ganancias</div>
              </div>
              <i className="bi bi-chevron-right" style={{ color: '#4b5563', marginLeft: 'auto' }} />
            </div>
          </button>
        </div>

        <p style={{ color: '#374151', fontSize: 12, marginTop: 30 }}>
          JobAssistand PWA v2.0
        </p>
      </div>
    </div>
  );
}
