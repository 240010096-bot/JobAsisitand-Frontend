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
  const [modalPersonal, setModalPersonal] = useState(false);

  // ── Calendario ──
  const hoy = new Date();
  const [calMes,        setCalMes]        = useState(hoy.getMonth());
  const [calAnio,       setCalAnio]       = useState(hoy.getFullYear());
  const [diaSelec,      setDiaSelec]      = useState(null);   // { anio, mes, dia }
  const [asistDia,      setAsistDia]      = useState({ presentes: [], ausentes: [], sinRegistro: true });
  const [diasConDatos,  setDiasConDatos]  = useState({});     // { 'YYYY-MM-DD': true }

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

  // Cargar qué días del mes tienen registros — se ejecuta al cambiar mes/año SIN importar la vista
  useEffect(() => {
    if (!usuario) return;
    const cargar = async () => {
      const inicio = new Date(calAnio, calMes, 1).toISOString();
      const fin    = new Date(calAnio, calMes + 1, 0, 23, 59, 59).toISOString();
      const regs   = await db.asistencias
        .where('fecha').between(inicio, fin, true, true).toArray();
      const mapa = {};
      regs.forEach(r => {
        const clave = r.fecha.slice(0, 10);
        mapa[clave] = true;
      });
      setDiasConDatos(mapa);
    };
    cargar();
  }, [calMes, calAnio, usuario]);

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
    setStatus('Guardando...');
    setErrorMsg('');

    try {
      const fecha = new Date().toISOString();

      // ── 1. GUARDAR INMEDIATAMENTE sin esperar GPS ──
      const registros = presentes.map(t => ({
        trabajadorId: `${t.nombre} ${t.apellido}`,
        fecha,
        lat:          null,
        lng:          null,
        lugar:        'Obteniendo ubicación...',
        sincronizado: 0
      }));

      const ids = await db.asistencias.bulkAdd(registros, { allKeys: true });

      // Actualizar UI al instante
      setFaltantes(trabajadores.filter(t => !seleccionados[t.id]));
      setSeleccionados({});
      setLugarResumen('Obteniendo ubicación...');
      setCoordsResumen(null);

      // Refrescar calendario
      const inicioHoy = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const finHoy    = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString();
      const regsHoy   = await db.asistencias.where('fecha').between(inicioHoy, finHoy, true, true).toArray();
      const mapaHoy   = {};
      regsHoy.forEach(r => { mapaHoy[r.fecha.slice(0, 10)] = true; });
      setDiasConDatos(mapaHoy);

      setVista('resumen');
      setStatus('Guardado');
      setLoading(false);

      // ── 2. GPS + geocodificación EN SEGUNDO PLANO ──
      const actualizarUbicacion = async () => {
        try {
          const coords = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              err => reject(err),
              { timeout: 8000, enableHighAccuracy: true, maximumAge: 30000 }
            );
          });

          let nombreLugar = `Coords: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;

          if (navigator.onLine) {
            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}`
              );
              if (res.ok) {
                const data = await res.json();
                nombreLugar = data.display_name;
              }
            } catch { /* sin internet, usamos coords */ }
          }

          // Actualizar registros guardados con la ubicación real
          await Promise.all(ids.map(id =>
            db.asistencias.update(id, { lat: coords.lat, lng: coords.lng, lugar: nombreLugar })
          ));

          // Sincronizar con backend
          if (navigator.onLine) {
            const registrosActualizados = registros.map((r, i) => ({
              ...r, id: ids[i], lat: coords.lat, lng: coords.lng, lugar: nombreLugar
            }));
            fetch('https://jobasisitand-backend.onrender.com/api/asistencia', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify(registrosActualizados)
            }).catch(() => console.warn('Servidor inalcanzable, se enviará después.'));
          }

          // Actualizar resumen si el usuario sigue en esa pantalla
          setLugarResumen(nombreLugar);
          setCoordsResumen({ lat: coords.lat, lng: coords.lng });
          setStatus('Guardado ✓');

        } catch {
          setLugarResumen('Sin ubicación (GPS no disponible)');
          setStatus('Guardado sin GPS');
        }
      };

      actualizarUbicacion();

    } catch (err) {
      console.error('Error crítico:', err);
      setErrorMsg('Ocurrió un error al procesar la asistencia. Intenta de nuevo.');
      setStatus('Error');
      setLoading(false);
    } finally {
      // loading ya se apaga arriba antes de ir a resumen
      if (loading) setLoading(false);
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

  const abrirDia = async (anio, mes, dia) => {
    const inicio    = new Date(anio, mes, dia, 0, 0, 0).toISOString();
    const fin       = new Date(anio, mes, dia, 23, 59, 59).toISOString();
    const registros = await db.asistencias
      .where('fecha').between(inicio, fin, true, true).toArray();
    const todosTrabajadores = await db.trabajadores.toArray();
    // Mapa nombre completo -> { area }
    const mapaArea = {};
    todosTrabajadores.forEach(t => { mapaArea[`${t.nombre} ${t.apellido}`] = t.area || ''; });
    // Mapa nombre completo -> lugar del registro de ese día
    const mapaLugar = {};
    registros.forEach(r => {
      const lugar = r.lugar && r.lugar !== 'Obteniendo ubicación...' ? r.lugar : null;
      mapaLugar[r.trabajadorId] = lugar;
    });
    const presentesNom = registros.map(r => r.trabajadorId);
    const presentesObj = presentesNom.map(nombre => ({
      nombre,
      area:  mapaArea[nombre] || '',
      lugar: mapaLugar[nombre] || null,
    }));
    const ausentesObj  = todosTrabajadores
      .filter(t => !presentesNom.includes(`${t.nombre} ${t.apellido}`))
      .map(t => ({ nombre: `${t.nombre} ${t.apellido}`, area: t.area || '' }));
    setAsistDia({
      presentes:   presentesObj,
      ausentes:    ausentesObj,
      sinRegistro: registros.length === 0,
    });
    setDiaSelec({ anio, mes, dia });
  };

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
                  <div style={{ ...statCardStyle, cursor: 'pointer' }} onClick={() => setModalPersonal(true)}>
                    <i className="bi bi-people" style={{ fontSize: '28px', color: '#3b82f6' }} />
                    <h3 style={{ color: '#fff', margin: '10px 0 0 0' }}>{trabajadores.length}</h3>
                    <p style={{ color: '#9ca3af', fontSize: '12px' }}>Total Personal</p>
                    <p style={{ color: '#3b82f6', fontSize: '10px', margin: '4px 0 0 0' }}>Ver lista</p>
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
                      <div>
                        <span style={{ color: '#fff', display: 'block' }}>{t.nombre} {t.apellido}</span>
                        <span style={{ color: '#6b7280', fontSize: '12px' }}>{t.area}</span>
                      </div>
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

            {vista === 'calendario' && (() => {
              const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
              const dias  = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
              const primerDia    = new Date(calAnio, calMes, 1).getDay();
              const totalDias    = new Date(calAnio, calMes + 1, 0).getDate();
              const celdas       = Array(primerDia).fill(null).concat(
                Array.from({ length: totalDias }, (_, i) => i + 1)
              );
              while (celdas.length % 7 !== 0) celdas.push(null);

              return (
                <div style={{ padding: '0 10px' }}>
                  <h2 style={{ color: '#fff', fontSize: '22px', margin: '0 0 16px 0' }}>Calendario</h2>

                  {/* Navegación mes y año */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '10px 16px', border: '1px solid #1f2937' }}>
                    <button onClick={() => {
                      if (calMes === 0) { setCalMes(11); setCalAnio(calAnio - 1); }
                      else setCalMes(calMes - 1);
                      setDiaSelec(null);
                    }} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '20px', cursor: 'pointer', padding: '4px 8px' }}>
                      <i className="bi bi-chevron-left" />
                    </button>
                    <span style={{ color: '#fff', fontWeight: '600', fontSize: '16px' }}>
                      {meses[calMes]} {calAnio}
                    </span>
                    <button onClick={() => {
                      if (calMes === 11) { setCalMes(0); setCalAnio(calAnio + 1); }
                      else setCalMes(calMes + 1);
                      setDiaSelec(null);
                    }} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '20px', cursor: 'pointer', padding: '4px 8px' }}>
                      <i className="bi bi-chevron-right" />
                    </button>
                  </div>

                  {/* Navegación año rápida */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '14px' }}>
                    <button onClick={() => { setCalAnio(calAnio - 1); setDiaSelec(null); }}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #374151', color: '#9ca3af', borderRadius: '8px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px' }}>
                      ← {calAnio - 1}
                    </button>
                    <span style={{ color: '#6b7280', fontSize: '12px', alignSelf: 'center' }}>{calAnio}</span>
                    <button onClick={() => { setCalAnio(calAnio + 1); setDiaSelec(null); }}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #374151', color: '#9ca3af', borderRadius: '8px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px' }}>
                      {calAnio + 1} →
                    </button>
                  </div>

                  {/* Cabecera días */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '6px' }}>
                    {dias.map(d => (
                      <div key={d} style={{ textAlign: 'center', color: '#6b7280', fontSize: '11px', fontWeight: '600', padding: '4px 0' }}>{d}</div>
                    ))}
                  </div>

                  {/* Celdas del mes */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                    {celdas.map((dia, i) => {
                      if (!dia) return <div key={`v-${i}`} />;
                      const clave    = `${calAnio}-${String(calMes + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
                      const tieneDatos = diasConDatos[clave];
                      const esHoy    = dia === hoy.getDate() && calMes === hoy.getMonth() && calAnio === hoy.getFullYear();
                      const selec    = diaSelec && diaSelec.dia === dia && diaSelec.mes === calMes && diaSelec.anio === calAnio;
                      return (
                        <div key={dia} onClick={() => abrirDia(calAnio, calMes, dia)}
                          style={{
                            textAlign: 'center', padding: '10px 0', borderRadius: '10px', cursor: 'pointer', position: 'relative',
                            backgroundColor: selec ? '#3b82f6' : esHoy ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)',
                            border: esHoy && !selec ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
                            color: selec ? '#fff' : '#e5e7eb',
                            fontWeight: esHoy || selec ? '700' : '400',
                            fontSize: '14px'
                          }}>
                          {dia}
                          {tieneDatos && (
                            <div style={{
                              width: '5px', height: '5px', borderRadius: '50%',
                              backgroundColor: selec ? '#fff' : '#10b981',
                              margin: '2px auto 0 auto'
                            }} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Detalle del día seleccionado */}
                  {diaSelec && (
                    <div style={{ marginTop: '20px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', borderRadius: '20px', padding: '20px' }}>
                      <h4 style={{ color: '#fff', margin: '0 0 14px 0', fontSize: '15px' }}>
                        <i className="bi bi-calendar-event" style={{ color: '#3b82f6', marginRight: '8px' }} />
                        {String(diaSelec.dia).padStart(2,'0')}/{String(diaSelec.mes+1).padStart(2,'0')}/{diaSelec.anio}
                      </h4>

                      {asistDia.sinRegistro ? (
                        <p style={{ color: '#6b7280', textAlign: 'center', fontSize: '13px' }}>Sin registros para este día.</p>
                      ) : (
                        <>
                          {asistDia.presentes?.length > 0 && (
                            <>
                              <p style={{ color: '#10b981', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 0' }}>
                                <i className="bi bi-check-circle" style={{ marginRight: '5px' }} />
                                Presentes ({asistDia.presentes.length})
                              </p>
                              {asistDia.presentes.map((t, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: '11px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>
                                    {t.nombre.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <span style={{ color: '#d1d5db', fontSize: '13px', display: 'block' }}>{t.nombre}</span>
                                    {t.area && <span style={{ color: '#3b82f6', fontSize: '11px', display: 'block', marginTop: '1px' }}><i className="bi bi-briefcase" style={{ marginRight: '3px' }} />{t.area}</span>}
                                    {t.lugar && <span style={{ color: '#6b7280', fontSize: '10px', display: 'block', marginTop: '2px', lineHeight: '1.3' }}><i className="bi bi-geo-alt" style={{ marginRight: '3px', color: '#10b981' }} />{t.lugar}</span>}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}

                          {asistDia.ausentes?.length > 0 && (
                            <>
                              <p style={{ color: '#ef4444', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '14px 0 8px 0' }}>
                                <i className="bi bi-x-circle" style={{ marginRight: '5px' }} />
                                Ausentes ({asistDia.ausentes.length})
                              </p>
                              {asistDia.ausentes.map((t, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '11px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>
                                    {t.nombre.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <span style={{ color: '#9ca3af', fontSize: '13px', display: 'block' }}>{t.nombre}</span>
                                    {t.area && <span style={{ color: '#374151', fontSize: '11px', display: 'block', marginTop: '1px' }}><i className="bi bi-briefcase" style={{ marginRight: '3px' }} />{t.area}</span>}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

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
                        <div>
                          <span style={{ color: '#ef4444', display: 'block' }}>
                            <i className="bi bi-x-circle" style={{ marginRight: 6 }} />
                            {f.nombre} {f.apellido}
                          </span>
                          <span style={{ color: '#9ca3af', fontSize: '12px' }}>{f.area}</span>
                        </div>
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
            <i className="bi bi-clipboard-check" style={{ color: vista === 'registro' ? '#3b82f6' : '#9ca3af' }} />
          </div>
          <div style={navItem} onClick={() => setVista('welcome')}>
            <i className="bi bi-house-door" style={{ color: vista === 'welcome' ? '#3b82f6' : '#9ca3af' }} />
          </div>
          <div style={navItem} onClick={() => { setVista('calendario'); setDiaSelec(null); }}>
            <i className="bi bi-calendar3" style={{ color: vista === 'calendario' ? '#3b82f6' : '#9ca3af' }} />
          </div>
          <div style={navItem} onClick={() => setVista('configuracion')}>
            <i className="bi bi-gear" style={{ color: vista === 'configuracion' ? '#3b82f6' : '#9ca3af' }} />
          </div>
        </nav>
      )}

      {/* ── MODAL LISTA DE PERSONAL ── */}
      {modalPersonal && (
        <div style={modalOverlayStyle} onClick={() => setModalPersonal(false)}>
          <div style={modalBoxStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: '#fff', margin: 0 }}>
                <i className="bi bi-people" style={{ color: '#3b82f6', marginRight: '8px' }} />
                Personal ({trabajadores.length})
              </h3>
              <button onClick={() => setModalPersonal(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '20px', cursor: 'pointer' }}>
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {trabajadores.length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center' }}>No hay colaboradores registrados.</p>
            ) : (
              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {trabajadores.map(t => (
                  <div key={t.id} style={modalItemStyle}>
                    <div style={modalAvatarStyle}>
                      {t.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ color: '#fff', margin: 0, fontWeight: '500' }}>
                        {t.nombre} {t.apellido}
                      </p>
                      <p style={{ color: '#3b82f6', fontSize: '12px', margin: '2px 0 0 0' }}>
                        <i className="bi bi-briefcase" style={{ marginRight: '4px' }} />
                        {t.area}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
const modalOverlayStyle= { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
const modalBoxStyle    = { backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '24px 24px 0 0', padding: '25px', width: '100%', maxWidth: '500px' };
const modalItemStyle   = { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #1f2937' };
const modalAvatarStyle = { width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontWeight: 'bold', flexShrink: 0 };

export default Jobassistand;
