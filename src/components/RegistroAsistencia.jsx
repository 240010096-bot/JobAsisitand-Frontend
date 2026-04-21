import React, { useState, useEffect } from 'react';
import { db } from '../db';

const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const validarRegistro = ({ nombre, apellido, email, pass, confirm }) => {
  if (!nombre.trim())        return 'El nombre es obligatorio.';
  if (!apellido.trim())      return 'El apellido es obligatorio.';
  if (!email.trim())         return 'El correo es obligatorio.';
  if (!validarEmail(email))  return 'Ingresa un correo electrónico válido.';
  if (!pass)                 return 'La contraseña es obligatoria.';
  if (pass.length < 6)       return 'La contraseña debe tener al menos 6 caracteres.';
  if (pass !== confirm)      return 'Las contraseñas no coinciden.';
  return null;
};

const validarLogin = ({ email, pass }) => {
  if (!email.trim())         return 'El correo es obligatorio.';
  if (!validarEmail(email))  return 'Ingresa un correo electrónico válido.';
  if (!pass)                 return 'La contraseña es obligatoria.';
  return null;
};

const ErrorMsg = ({ msg }) =>
  msg ? (
    <div style={errorBannerStyle}>
      <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: 8 }} />
      {msg}
    </div>
  ) : null;

function Jobassistand() {
  const [usuario,       setUsuario]       = useState(() => {
    try {
      const guardado = localStorage.getItem('session_usuario');
      return guardado ? JSON.parse(guardado) : null;
    } catch { return null; }
  });
  const [authMode,      setAuthMode]      = useState('login');
  const [vista,         setVista]         = useState('welcome');
  const [status,        setStatus]        = useState('Listo');
  const [trabajadores,  setTrabajadores]  = useState([]);
  const [seleccionados, setSeleccionados] = useState({});
  const [faltantes,     setFaltantes]     = useState([]);
  const [errorMsg,      setErrorMsg]      = useState('');
  const [loading,       setLoading]       = useState(false);
  const [lugarResumen,  setLugarResumen]  = useState('');
  const [coordsResumen, setCoordsResumen] = useState(null);

  const [formData, setFormData] = useState({
    nombre: '', apellido: '', email: '', pass: '', confirm: ''
  });
  const [formTrabajador, setFormTrabajador] = useState({
    nombre: '', apellido: '', area: ''
  });

  const limpiarError = () => setErrorMsg('');

  const toggleAuthMode = () => {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
    setFormData({ nombre: '', apellido: '', email: '', pass: '', confirm: '' });
    limpiarError();
  };

  useEffect(() => {
    if (usuario) {
      const load = async () => setTrabajadores(await db.trabajadores.toArray());
      load();
    }
  }, [vista, usuario]);

  const cerrarSesion = () => {
    localStorage.removeItem('session_usuario');
    setUsuario(null);
    setVista('welcome');
    setStatus('Sesión cerrada');
    limpiarError();
  };

  const confirmarAsistencia = async () => {
    const presentes = trabajadores.filter(t => seleccionados[t.id]);
    if (presentes.length === 0) {
      setErrorMsg('Selecciona al menos un trabajador presente.');
      return;
    }

    setLoading(true);
    setStatus('Procesando...');
    setErrorMsg('');

    try {
      let lat = null;
      let lng = null;
      let nombreLugar = 'Ubicación desconocida (Sin GPS)';

      const gpsPromise = new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => reject(err),
          { timeout: 5000, enableHighAccuracy: true, maximumAge: 0 }
        );
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('GPS timeout')), 5000)
      );

      try {
        const coords = await Promise.race([gpsPromise, timeoutPromise]);
        lat = coords.lat;
        lng = coords.lng;

        if (navigator.onLine) {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
            );
            if (response.ok) {
              const data = await response.json();
              nombreLugar = data.display_name;
            }
          } catch {
            nombreLugar = `Coords: ${lat.toFixed(5)}, ${lng.toFixed(5)} (sin conexión para traducir)`;
          }
        } else {
          nombreLugar = `Coords: ${lat.toFixed(5)}, ${lng.toFixed(5)} (sin internet)`;
        }
      } catch {
        console.warn('GPS no disponible o tardó demasiado.');
      }

      const registros = presentes.map(t => ({
        trabajadorId: `${t.nombre} ${t.apellido}`,
        fecha:        new Date().toISOString(),
        lat,
        lng,
        lugar:        nombreLugar,
        sincronizado: 0
      }));

      await db.asistencias.bulkAdd(registros);

      if (navigator.onLine) {
        try {
          await fetch('https://jobasisitand-backend.onrender.com/api/asistencia', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(registros)
          });
        } catch {
          console.warn('Servidor inalcanzable, se enviará después.');
        }
      }

      setLugarResumen(nombreLugar);
      setCoordsResumen(lat && lng ? { lat, lng } : null);
      setFaltantes(trabajadores.filter(t => !seleccionados[t.id]));
      setSeleccionados({});
      setVista('resumen');
      setStatus('Guardado localmente');
    } catch (err) {
      console.error('Error crítico:', err);
      setErrorMsg('Ocurrió un error al procesar la asistencia. Intenta de nuevo.');
      setStatus('Error');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    limpiarError();

    if (authMode === 'register') {
      const err = validarRegistro(formData);
      if (err) { setErrorMsg(err); return; }

      const existente = await db.supervisores
        .where('email')
        .equalsIgnoreCase(formData.email.trim())
        .first();
      if (existente) {
        setErrorMsg('Ya existe una cuenta con ese correo electrónico.');
        return;
      }

      await db.supervisores.add({
        nombre:   formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        email:    formData.email.trim().toLowerCase(),
        password: formData.pass
      });

      setStatus('Cuenta creada ✓');
      toggleAuthMode();
    } else {
      const err = validarLogin(formData);
      if (err) { setErrorMsg(err); return; }

      const user = await db.supervisores
        .where('email')
        .equalsIgnoreCase(formData.email.trim())
        .first();

      if (user && user.password === formData.pass) {
        localStorage.setItem('session_usuario', JSON.stringify(user));
        setUsuario(user);
        setStatus('Conectado');
        limpiarError();
      } else {
        setErrorMsg('Correo o contraseña incorrectos.');
      }
    }
  };

  const handleAgregarTrabajador = async () => {
    limpiarError();
    if (!formTrabajador.nombre.trim())   { setErrorMsg('El nombre es obligatorio.');  return; }
    if (!formTrabajador.apellido.trim()) { setErrorMsg('El apellido es obligatorio.'); return; }
    if (!formTrabajador.area.trim())     { setErrorMsg('El área es obligatoria.');     return; }

    await db.trabajadores.add({ ...formTrabajador });
    setFormTrabajador({ nombre: '', apellido: '', area: '' });
    setVista('welcome');
  };

  const obtenerFechaActual = () =>
    new Date().toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

  return (
    <div style={containerStyle}>
      {usuario && (
        <header style={headerStyle}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '20px', margin: 0 }}>AgriSync PWA</h1>
            <span style={{ color: '#9ca3af', fontSize: '12px' }}>
              {usuario.nombre} {usuario.apellido}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#10b981', textTransform: 'uppercase', fontWeight: 'bold' }}>
              <i className="bi bi-circle-fill" style={{ fontSize: '8px', marginRight: '4px' }} />
              {status}
            </div>
          </div>
        </header>
      )}

      <main style={mainStyle}>
        {!usuario ? (
          <div style={cardStyle}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <i className="bi bi-person-badge" style={{ fontSize: '48px', color: '#3b82f6' }} />
              <h2 style={{ color: '#fff', marginTop: '10px' }}>
                {authMode === 'login' ? 'Ingresar' : 'Nueva Cuenta'}
              </h2>
            </div>

            <ErrorMsg msg={errorMsg} />

            {authMode === 'register' && (
              <>
                <input placeholder="Nombre" style={inputStyle} value={formData.nombre}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })} onFocus={limpiarError} />
                <input placeholder="Apellido" style={inputStyle} value={formData.apellido}
                  onChange={e => setFormData({ ...formData, apellido: e.target.value })} onFocus={limpiarError} />
              </>
            )}

            <input type="email" placeholder="Correo electrónico" style={inputStyle} value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })} onFocus={limpiarError} />
            <input type="password" placeholder="Contraseña" style={inputStyle} value={formData.pass}
              onChange={e => setFormData({ ...formData, pass: e.target.value })} onFocus={limpiarError} />

            {authMode === 'register' && (
              <input type="password" placeholder="Confirmar contraseña" style={inputStyle} value={formData.confirm}
                onChange={e => setFormData({ ...formData, confirm: e.target.value })} onFocus={limpiarError} />
            )}

            <button onClick={handleAuth} style={btnPrimary}>
              {authMode === 'login' ? 'Entrar' : 'Crear Cuenta'}
            </button>
            <p onClick={toggleAuthMode}
              style={{ textAlign: 'center', color: '#3b82f6', cursor: 'pointer', marginTop: '20px' }}>
              {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Entra'}
            </p>
          </div>
        ) : (
          <>
            {vista === 'welcome' && (
              <div style={{ padding: '0 10px' }}>
                <h2 style={{ color: '#fff', fontSize: '24px', margin: '0 0 5px 0' }}>Dashboard</h2>
                <p style={{ color: '#9ca3af', marginBottom: '20px', textTransform: 'capitalize' }}>
                  {obtenerFechaActual()}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div style={statCardStyle}>
                    <i className="bi bi-people" style={{ fontSize: '28px', color: '#3b82f6' }} />
                    <h3 style={{ color: '#fff', margin: '10px 0 0 0' }}>{trabajadores.length}</h3>
                    <p style={{ color: '#9ca3af', fontSize: '12px' }}>Total Personal</p>
                  </div>
                  <div style={statCardStyle}>
                    <i className="bi bi-geo-alt" style={{ fontSize: '28px', color: '#10b981' }} />
                    <h3 style={{ color: '#fff', margin: '10px 0 0 0' }}>GPS</h3>
                    <p style={{ color: '#9ca3af', fontSize: '12px' }}>Activo</p>
                  </div>
                </div>
                <div style={cardStyle}>
                  <h3 style={{ color: '#fff', marginTop: 0 }}>Acciones Rápidas</h3>
                  <button onClick={() => { setVista('registro'); limpiarError(); }}
                    style={{ ...btnPrimary, marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Pasar Asistencia</span><i className="bi bi-chevron-right" />
                  </button>
                  <button onClick={() => { setVista('agregar'); limpiarError(); }}
                    style={{ ...btnPrimary, backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Nuevo Colaborador</span><i className="bi bi-plus-lg" />
                  </button>
                </div>
              </div>
            )}

            {vista === 'configuracion' && (
              <div style={{ padding: '0 10px' }}>
                <h2 style={{ color: '#fff', marginBottom: '20px' }}>Configuración</h2>
                <div style={cardStyle}>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={avatarStyle}>
                      {usuario.nombre ? usuario.nombre.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <h3 style={{ color: '#fff', margin: 0 }}>{usuario.nombre} {usuario.apellido}</h3>
                    <p style={{ color: '#9ca3af', fontSize: '14px' }}>{usuario.email}</p>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid #1f2937', margin: '20px 0' }} />
                  <button onClick={cerrarSesion} style={{ ...btnPrimary, backgroundColor: '#ef4444' }}>
                    <i className="bi bi-box-arrow-left" style={{ marginRight: '10px' }} />
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            )}

            {vista === 'agregar' && (
              <div style={cardStyle}>
                <h3 style={{ color: '#fff' }}>Nuevo Colaborador</h3>
                <ErrorMsg msg={errorMsg} />
                <input placeholder="Nombre" style={inputStyle} value={formTrabajador.nombre}
                  onChange={e => setFormTrabajador({ ...formTrabajador, nombre: e.target.value })} onFocus={limpiarError} />
                <input placeholder="Apellido" style={inputStyle} value={formTrabajador.apellido}
                  onChange={e => setFormTrabajador({ ...formTrabajador, apellido: e.target.value })} onFocus={limpiarError} />
                <input placeholder="Área" style={inputStyle} value={formTrabajador.area}
                  onChange={e => setFormTrabajador({ ...formTrabajador, area: e.target.value })} onFocus={limpiarError} />
                <button onClick={handleAgregarTrabajador} style={btnPrimary}>Registrar</button>
              </div>
            )}

            {vista === 'registro' && (
              <div>
                <h3 style={{ color: '#fff', paddingLeft: '20px' }}>Pase de Lista</h3>
                <ErrorMsg msg={errorMsg} />
                {trabajadores.length === 0 ? (
                  <div style={{ ...cardStyle, textAlign: 'center', color: '#9ca3af' }}>
                    <i className="bi bi-people" style={{ fontSize: '36px', marginBottom: '10px' }} />
                    <p>No hay colaboradores registrados.</p>
                  </div>
                ) : (
                  trabajadores.map(t => (
                    <div key={t.id} style={itemStyle}>
                      <span style={{ color: '#fff' }}>{t.nombre} {t.apellido}</span>
                      <input type="checkbox" checked={!!seleccionados[t.id]}
                        onChange={() => setSeleccionados({ ...seleccionados, [t.id]: !seleccionados[t.id] })}
                        style={{ width: '22px', height: '22px', accentColor: '#10b981' }} />
                    </div>
                  ))
                )}
                <button style={{ ...btnConfirm, opacity: loading ? 0.6 : 1 }}
                  onClick={confirmarAsistencia} disabled={loading}>
                  {loading ? 'Registrando...' : 'Confirmar Asistencia'}
                </button>
              </div>
            )}

            {vista === 'resumen' && (
              <div style={{ padding: '20px' }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <i className="bi bi-check-circle" style={{ fontSize: '50px', color: '#10b981' }} />
                  <h3 style={{ color: '#fff' }}>Reporte de Hoy</h3>
                </div>

                {/* UBICACIÓN — NUEVO BLOQUE */}
                <div style={locationCardStyle}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <i className="bi bi-geo-alt-fill" style={{ color: '#10b981', fontSize: '20px', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <p style={{ color: '#9ca3af', fontSize: '11px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Ubicación del registro
                      </p>
                      <p style={{ color: '#fff', fontSize: '13px', margin: 0, lineHeight: '1.4' }}>
                        {lugarResumen || 'Sin ubicación registrada'}
                      </p>
                      {coordsResumen && (
                        <p style={{ color: '#6b7280', fontSize: '11px', margin: '4px 0 0 0' }}>
                          {coordsResumen.lat.toFixed(6)}, {coordsResumen.lng.toFixed(6)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {faltantes.length > 0 ? (
                  <>
                    <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '20px', marginBottom: '8px' }}>AUSENTES</p>
                    {faltantes.map(f => (
                      <div key={f.id} style={{ ...itemStyle, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)' }}>
                        <span style={{ color: '#ef4444' }}>
                          <i className="bi bi-x-circle" style={{ marginRight: 6 }} />
                          {f.nombre} {f.apellido}
                        </span>
                      </div>
                    ))}
                  </>
                ) : (
                  <p style={{ color: '#10b981', textAlign: 'center', marginTop: '10px' }}>✓ Asistencia completa</p>
                )}

                <button style={{ ...btnPrimary, marginTop: '20px' }} onClick={() => setVista('welcome')}>
                  Volver al inicio
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {usuario && (
        <nav style={navStyle}>
          <div style={navItem} onClick={() => setVista('registro')}>
            <i className="bi bi-clipboard-check" style={{ color: vista === 'registro' ? '#3b82f6' : '#fff' }} />
          </div>
          <div style={navItem} onClick={() => setVista('welcome')}>
            <i className="bi bi-house-door" style={{ color: vista === 'welcome' ? '#3b82f6' : '#fff' }} />
          </div>
          <div style={navItem} onClick={() => setVista('configuracion')}>
            <i className="bi bi-gear" style={{ color: vista === 'configuracion' ? '#3b82f6' : '#fff' }} />
          </div>
        </nav>
      )}
    </div>
  );
}

const containerStyle   = { backgroundColor: '#0B0E14', minHeight: '100vh', paddingBottom: '90px', fontFamily: 'system-ui, sans-serif' };
const cardStyle        = { backgroundColor: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)', padding: '25px', borderRadius: '24px', margin: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' };
const inputStyle       = { width: '100%', padding: '15px', marginBottom: '15px', borderRadius: '12px', border: '1px solid #374151', backgroundColor: '#111827', color: 'white', boxSizing: 'border-box' };
const btnPrimary       = { width: '100%', padding: '15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' };
const btnConfirm       = { width: '90%', margin: '0 5% 20px 5%', padding: '18px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' };
const navStyle         = { position: 'fixed', bottom: 0, width: '100%', height: '70px', backgroundColor: 'rgba(17,24,39,0.8)', backdropFilter: 'blur(10px)', display: 'flex', borderTop: '1px solid #1f2937', justifyContent: 'space-around', alignItems: 'center', zIndex: 100 };
const navItem          = { cursor: 'pointer', fontSize: '24px', color: '#fff' };
const itemStyle        = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', backgroundColor: 'rgba(255,255,255,0.03)', margin: '0 20px 10px 20px', borderRadius: '15px', border: '1px solid #1f2937' };
const mainStyle        = { padding: '10px' };
const headerStyle      = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 25px', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, backgroundColor: '#0B0E14', zIndex: 10 };
const statCardStyle    = { backgroundColor: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '20px', textAlign: 'center', border: '1px solid #1f2937' };
const avatarStyle      = { width: '60px', height: '60px', backgroundColor: '#3b82f6', borderRadius: '50%', margin: '0 auto 10px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#fff', fontWeight: 'bold' };
const errorBannerStyle = { backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5', borderRadius: '10px', padding: '12px 15px', marginBottom: '15px', fontSize: '14px', display: 'flex', alignItems: 'center' };
const locationCardStyle= { backgroundColor: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '15px', padding: '16px 18px', margin: '0 0 10px 0' };

export default Jobassistand;
