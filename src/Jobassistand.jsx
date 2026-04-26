import React, { useState, useEffect, useCallback } from 'react';
import { db } from './db';

// ─── Utilidades ────────────────────────────────────────────────
const validarEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

const validarLogin = ({ email, pass }) => {
  if (!email.trim())       return 'El correo es obligatorio.';
  if (!validarEmail(email)) return 'Correo electrónico inválido.';
  if (!pass)               return 'La contraseña es obligatoria.';
  return null;
};

const validarRegistro = ({ nombre, apellido, email, pass, confirm }) => {
  if (!nombre.trim())       return 'El nombre es obligatorio.';
  if (!apellido.trim())     return 'El apellido es obligatorio.';
  if (!email.trim())        return 'El correo es obligatorio.';
  if (!validarEmail(email)) return 'Correo electrónico inválido.';
  if (!pass)                return 'La contraseña es obligatoria.';
  if (pass.length < 6)      return 'Mínimo 6 caracteres.';
  if (pass !== confirm)     return 'Las contraseñas no coinciden.';
  return null;
};

// ─── Subcomponentes simples ─────────────────────────────────────
const ErrorMsg = ({ msg }) => msg ? (
  <div style={s.errorBanner}>
    <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: 8 }} />
    {msg}
  </div>
) : null;

const Avatar = ({ nombre = '?', color = '#3b82f6', size = 34 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    background: `${color}22`, border: `1px solid ${color}44`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color, fontWeight: 700, fontSize: size * 0.38,
  }}>
    {nombre.charAt(0).toUpperCase()}
  </div>
);

const RolBadge = ({ rol }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
    padding: '3px 9px', borderRadius: 20,
    background: rol === 'admin' ? 'rgba(59,130,246,.15)' : 'rgba(0,212,200,.1)',
    color: rol === 'admin' ? '#3b82f6' : '#00d4c8',
    border: `1px solid ${rol === 'admin' ? 'rgba(59,130,246,.3)' : 'rgba(0,212,200,.2)'}`,
  }}>
    <i className={`bi ${rol === 'admin' ? 'bi-shield-fill-check' : 'bi-person-badge-fill'}`} />
    {rol === 'admin' ? 'Administrador' : 'Encargado'}
  </span>
);

// ───────────────────────────────────────────────────────────────
//  COMPONENTE PRINCIPAL
// ───────────────────────────────────────────────────────────────
export default function Jobassistand() {

  // ── Sesión ──────────────────────────────────────────────────
  const [usuario, setUsuario] = useState(() => {
    try { return JSON.parse(localStorage.getItem('session_usuario')); }
    catch { return null; }
  });

  // ── Roles: nuevo esquema usa 'admin' | 'encargado' ──────────
  const esAdmin = usuario?.rol === 'admin';

  // ── Navegación ──────────────────────────────────────────────
  const [vista, setVista]       = useState('welcome');
  const [authMode, setAuthMode] = useState('login');

  // ── Datos ───────────────────────────────────────────────────
  const [areas,         setAreas]         = useState([]);
  const [trabajadores,  setTrabajadores]  = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);   // array de ids (nuevo esquema Jobassistand.jsx)
  const [busqueda,      setBusqueda]      = useState('');
  const [faltantes,     setFaltantes]     = useState([]);

  // ── UI / GPS ────────────────────────────────────────────────
  const [status,        setStatus]        = useState('Listo');
  const [errorMsg,      setErrorMsg]      = useState('');
  const [loading,       setLoading]       = useState(false);
  const [lugarResumen,  setLugarResumen]  = useState('');
  const [coordsResumen, setCoordsResumen] = useState(null);
  const [gpsEstado,     setGpsEstado]     = useState('idle'); // idle|loading|ok|error
  const [modalPersonal, setModalPersonal] = useState(false);

  // ── Calendario ──────────────────────────────────────────────
  const hoy = new Date();
  const [calMes,       setCalMes]       = useState(hoy.getMonth());
  const [calAnio,      setCalAnio]      = useState(hoy.getFullYear());
  const [diaSelec,     setDiaSelec]     = useState(null);
  const [asistDia,     setAsistDia]     = useState({ presentes: [], ausentes: [], sinRegistro: true, totalPago: 0 });
  const [diasConDatos, setDiasConDatos] = useState({});

  // ── Formularios ─────────────────────────────────────────────
  const [formData,       setFormData]       = useState({ nombre:'', apellido:'', email:'', pass:'', confirm:'', rol:'encargado', areaId:'' });
  const [formTrabajador, setFormTrabajador] = useState({ nombre:'', apellido:'', areaId:'', telefono:'', curp:'', pagoPorHora:'' });
  const [formArea,       setFormArea]       = useState({ nombre:'', pagoPorHora:'' });

  const limpiarError = () => setErrorMsg('');

  // ── Filtrado dinámico por rol ────────────────────────────────
  // Admin ve todos; Encargado solo su área
  const trabajadoresFiltrados = trabajadores.filter(t => {
    const nombreCompleto = `${t.nombre} ${t.apellido}`.toLowerCase();
    const coincide = nombreCompleto.includes(busqueda.toLowerCase());
    if (esAdmin) return coincide;
    return coincide && t.areaId === usuario?.areaId;
  });

  // ── Selección masiva (nuevo esquema: array de ids) ──────────
  const handleSelectAll = (e) => {
    setSeleccionados(e.target.checked ? trabajadoresFiltrados.map(t => t.id) : []);
  };
  const toggleSeleccion = (id) => {
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };
  const todosSeleccionados = trabajadoresFiltrados.length > 0 &&
    seleccionados.length === trabajadoresFiltrados.length;
  const algunoSeleccionado = seleccionados.length > 0 && !todosSeleccionados;

  // ── Carga de datos ──────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    if (!usuario) return;
    const [t, a] = await Promise.all([
      db.trabajadores.toArray(),
      db.areas.toArray(),
    ]);
    setTrabajadores(t);
    setAreas(a);
  }, [usuario]);

  useEffect(() => { cargarDatos(); }, [cargarDatos, vista]);

  // ── Días con registros para el calendario ──────────────────
  useEffect(() => {
    if (!usuario) return;
    const cargar = async () => {
      const inicio = new Date(calAnio, calMes, 1).toISOString();
      const fin    = new Date(calAnio, calMes + 1, 0, 23, 59, 59).toISOString();
      const regs   = await db.asistencias.where('fecha').between(inicio, fin, true, true).toArray();
      const mapa   = {};
      regs.forEach(r => { mapa[r.fecha.slice(0, 10)] = true; });
      setDiasConDatos(mapa);
    };
    cargar();
  }, [calMes, calAnio, usuario]);

  // ─────────────────────────────────────────────────────────────
  //  AUTH
  // ─────────────────────────────────────────────────────────────
  const handleAuth = async () => {
    limpiarError();
    if (authMode === 'register') {
      const err = validarRegistro(formData);
      if (err) { setErrorMsg(err); return; }

      const existente = await db.supervisores.where('email').equalsIgnoreCase(formData.email.trim()).first();
      if (existente) { setErrorMsg('Ya existe una cuenta con ese correo.'); return; }

      await db.supervisores.add({
        nombre:   formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        email:    formData.email.trim().toLowerCase(),
        password: formData.pass,
        rol:      formData.rol,        // 'admin' | 'encargado'
        areaId:   formData.areaId ? Number(formData.areaId) : null,
      });
      setStatus('Cuenta creada ✓');
      setAuthMode('login');
      setFormData({ nombre:'', apellido:'', email:'', pass:'', confirm:'', rol:'encargado', areaId:'' });
    } else {
      const err = validarLogin(formData);
      if (err) { setErrorMsg(err); return; }

      const user = await db.supervisores.where('email').equalsIgnoreCase(formData.email.trim()).first();
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

  const cerrarSesion = () => {
    localStorage.removeItem('session_usuario');
    setUsuario(null);
    setVista('welcome');
    setStatus('Sesión cerrada');
    limpiarError();
  };

  // ─────────────────────────────────────────────────────────────
  //  GPS
  // ─────────────────────────────────────────────────────────────
  const obtenerGPS = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('GPS no disponible')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 30000 }
    );
  });

  const geocodificar = async (lat, lng) => {
    if (!navigator.onLine) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch { return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
  };

  // ─────────────────────────────────────────────────────────────
  //  CONFIRMAR ASISTENCIA
  // ─────────────────────────────────────────────────────────────
  const confirmarAsistencia = async () => {
    const presentes = trabajadores.filter(t => seleccionados.includes(t.id));
    if (presentes.length === 0) { setErrorMsg('Selecciona al menos un trabajador presente.'); return; }

    setLoading(true);
    setStatus('Guardando...');
    setErrorMsg('');
    setGpsEstado('loading');

    try {
      const fecha = new Date().toISOString();

      // Calcular pago por trabajador (8 horas base)
      const registros = presentes.map(t => ({
        trabajadorId:   `${t.nombre} ${t.apellido}`,
        areaId:         t.areaId,
        fecha,
        lat:            null,
        lng:            null,
        lugar:          'Obteniendo ubicación...',
        tipo:           'entrada',
        totalCalculado: (t.pagoPorHora || 0) * 8,
        sincronizado:   0,
      }));

      const ids = await db.asistencias.bulkAdd(registros, { allKeys: true });

      setFaltantes(trabajadores.filter(t => !seleccionados.includes(t.id)));
      setSeleccionados([]);
      setLugarResumen('Obteniendo ubicación...');
      setCoordsResumen(null);

      // Refrescar mapa del calendario
      const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
      const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const regsH = await db.asistencias.where('fecha').between(ini, fin, true, true).toArray();
      const mapaH = {};
      regsH.forEach(r => { mapaH[r.fecha.slice(0, 10)] = true; });
      setDiasConDatos(mapaH);

      setVista('resumen');
      setStatus('Guardado');
      setLoading(false);

      // GPS en segundo plano
      (async () => {
        try {
          const coords = await obtenerGPS();
          const lugar  = await geocodificar(coords.lat, coords.lng);
          await Promise.all(ids.map(id => db.asistencias.update(id, { lat: coords.lat, lng: coords.lng, lugar })));
          setGpsEstado('ok');
          setLugarResumen(lugar);
          setCoordsResumen(coords);
          setStatus('Guardado ✓');

          if (navigator.onLine) {
            fetch('https://jobasisitand-backend.onrender.com/api/asistencia', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(registros.map((r, i) => ({ ...r, id: ids[i], lat: coords.lat, lng: coords.lng, lugar }))),
            }).catch(() => {});
          }
        } catch {
          setGpsEstado('error');
          setLugarResumen('Sin ubicación (GPS no disponible)');
          setStatus('Guardado sin GPS');
        }
      })();

    } catch (err) {
      console.error(err);
      setErrorMsg('Error al procesar la asistencia. Intenta de nuevo.');
      setStatus('Error');
      setLoading(false);
      setGpsEstado('error');
    }
  };

  // ─────────────────────────────────────────────────────────────
  //  AGREGAR TRABAJADOR (solo admin)
  // ─────────────────────────────────────────────────────────────
  const handleAgregarTrabajador = async () => {
    limpiarError();
    if (!formTrabajador.nombre.trim())   { setErrorMsg('El nombre es obligatorio.');  return; }
    if (!formTrabajador.apellido.trim()) { setErrorMsg('El apellido es obligatorio.'); return; }
    if (!formTrabajador.areaId)          { setErrorMsg('El área es obligatoria.');     return; }

    await db.trabajadores.add({
      nombre:      formTrabajador.nombre.trim(),
      apellido:    formTrabajador.apellido.trim(),
      areaId:      Number(formTrabajador.areaId),
      telefono:    formTrabajador.telefono.trim(),
      curp:        formTrabajador.curp.trim().toUpperCase(),
      pagoPorHora: Number(formTrabajador.pagoPorHora) || 0,
    });
    setFormTrabajador({ nombre:'', apellido:'', areaId:'', telefono:'', curp:'', pagoPorHora:'' });
    setVista('welcome');
  };

  // ─────────────────────────────────────────────────────────────
  //  AGREGAR ÁREA (solo admin)
  // ─────────────────────────────────────────────────────────────
  const handleAgregarArea = async () => {
    limpiarError();
    if (!formArea.nombre.trim()) { setErrorMsg('El nombre del área es obligatorio.'); return; }
    await db.areas.add({ nombre: formArea.nombre.trim(), pagoPorHora: Number(formArea.pagoPorHora) || 0 });
    setFormArea({ nombre:'', pagoPorHora:'' });
    await cargarDatos();

    // Sincronizar con backend
    if (navigator.onLine) {
      fetch('https://jobasisitand-backend.onrender.com/api/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formArea),
      }).catch(() => {});
    }
  };

  // ─────────────────────────────────────────────────────────────
  //  DETALLE DEL DÍA EN CALENDARIO
  // ─────────────────────────────────────────────────────────────
  const abrirDia = async (anio, mes, dia) => {
    const inicio = new Date(anio, mes, dia, 0, 0, 0).toISOString();
    const fin    = new Date(anio, mes, dia, 23, 59, 59).toISOString();
    const regs   = await db.asistencias.where('fecha').between(inicio, fin, true, true).toArray();
    const todos  = await db.trabajadores.toArray();
    const areasArr = await db.areas.toArray();
    const mapaArea = Object.fromEntries(areasArr.map(a => [a.id, a.nombre]));

    const mapaLugar = Object.fromEntries(regs.map(r => [r.trabajadorId, r.lugar && r.lugar !== 'Obteniendo ubicación...' ? r.lugar : null]));
    const presentesNom = regs.map(r => r.trabajadorId);

    // Calcular total de pago del día
    const totalPago = regs.reduce((s, r) => s + (r.totalCalculado || 0), 0);

    setAsistDia({
      presentes: presentesNom.map(nombre => {
        const t = todos.find(x => `${x.nombre} ${x.apellido}` === nombre);
        return { nombre, area: mapaArea[t?.areaId] || '', lugar: mapaLugar[nombre] || null, pago: t ? (t.pagoPorHora || 0) * 8 : 0 };
      }),
      ausentes: todos
        .filter(t => !presentesNom.includes(`${t.nombre} ${t.apellido}`))
        .map(t => ({ nombre: `${t.nombre} ${t.apellido}`, area: mapaArea[t.areaId] || '' })),
      sinRegistro: regs.length === 0,
      totalPago,
    });
    setDiaSelec({ anio, mes, dia });
  };

  const obtenerFechaActual = () =>
    new Date().toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  const areaNombre = (id) => areas.find(a => a.id === id)?.nombre || 'Sin área';

  // ───────────────────────────────────────────────────────────
  //  RENDER
  // ───────────────────────────────────────────────────────────
  return (
    <div style={s.container}>

      {/* ── HEADER ── */}
      {usuario && (
        <header style={s.header}>
          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <div style={s.logoBadge}>
              <i className="bi bi-diagram-3-fill" style={{ fontSize: 14 }} />
            </div>
            <div>
              <div style={{ color:'#fff', fontSize:15, fontWeight:700, lineHeight:1 }}>AgriSync</div>
              <div style={{ color:'#6b7280', fontSize:11 }}>{usuario.nombre} {usuario.apellido}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <RolBadge rol={usuario.rol} />
            <div style={{ fontSize:10, color:'#10b981', fontWeight:700, textAlign:'right' }}>
              <i className="bi bi-circle-fill" style={{ fontSize:7, marginRight:4 }} />
              {status}
            </div>
          </div>
        </header>
      )}

      {/* ── MAIN ── */}
      <main style={s.main}>

        {/* ══ LOGIN / REGISTER ══ */}
        {!usuario ? (
          <div style={s.card}>
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <div style={s.loginIcon}>
                <i className="bi bi-person-badge" style={{ fontSize:28, color:'#3b82f6' }} />
              </div>
              <h2 style={{ color:'#fff', fontSize:20, margin:'12px 0 0' }}>
                {authMode === 'login' ? 'Iniciar Sesión' : 'Nueva Cuenta'}
              </h2>
              <p style={{ color:'#6b7280', fontSize:13, margin:'4px 0 0' }}>
                Sistema de Asistencia AgriSync
              </p>
            </div>

            <ErrorMsg msg={errorMsg} />

            {authMode === 'register' && (
              <>
                <div style={s.inputRow}>
                  <div style={s.inputWrap}>
                    <input placeholder="Nombre" style={s.input} value={formData.nombre}
                      onChange={e => setFormData({ ...formData, nombre: e.target.value })} onFocus={limpiarError} />
                  </div>
                  <div style={s.inputWrap}>
                    <input placeholder="Apellido" style={s.input} value={formData.apellido}
                      onChange={e => setFormData({ ...formData, apellido: e.target.value })} onFocus={limpiarError} />
                  </div>
                </div>
                {/* Rol y área solo en registro */}
                <select style={s.select} value={formData.rol}
                  onChange={e => setFormData({ ...formData, rol: e.target.value })}>
                  <option value="encargado">Encargado</option>
                  <option value="admin">Administrador</option>
                </select>
                {formData.rol === 'encargado' && (
                  <select style={s.select} value={formData.areaId}
                    onChange={e => setFormData({ ...formData, areaId: e.target.value })}>
                    <option value="">-- Selecciona tu área --</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                )}
              </>
            )}

            <input type="email" placeholder="Correo electrónico" style={s.input} value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })} onFocus={limpiarError} />
            <input type="password" placeholder="Contraseña" style={s.input} value={formData.pass}
              onChange={e => setFormData({ ...formData, pass: e.target.value })} onFocus={limpiarError} />
            {authMode === 'register' && (
              <input type="password" placeholder="Confirmar contraseña" style={s.input} value={formData.confirm}
                onChange={e => setFormData({ ...formData, confirm: e.target.value })} onFocus={limpiarError} />
            )}

            <button onClick={handleAuth} style={s.btnPrimary}>
              {authMode === 'login' ? 'Entrar' : 'Crear Cuenta'}
            </button>
            <p onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); limpiarError(); }}
              style={{ textAlign:'center', color:'#3b82f6', cursor:'pointer', marginTop:18, fontSize:13 }}>
              {authMode === 'login' ? '¿Sin cuenta? Regístrate' : '¿Ya tienes cuenta? Entra'}
            </p>
          </div>

        ) : (

          /* ══ VISTAS AUTENTICADAS ══ */
          <>

            {/* ─── WELCOME / DASHBOARD ─── */}
            {vista === 'welcome' && (
              <div style={{ padding:'0 10px' }}>
                <h2 style={{ color:'#fff', fontSize:22, margin:'0 0 3px' }}>Dashboard</h2>
                <p style={{ color:'#6b7280', fontSize:12, marginBottom:18, textTransform:'capitalize' }}>
                  {obtenerFechaActual()}
                </p>

                {/* KPI grid */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                  <div style={{ ...s.statCard, cursor:'pointer' }} onClick={() => setModalPersonal(true)}>
                    <i className="bi bi-people" style={{ fontSize:26, color:'#3b82f6' }} />
                    <div style={{ color:'#fff', fontSize:22, fontWeight:700, margin:'8px 0 0' }}>
                      {esAdmin ? trabajadores.length : trabajadores.filter(t => t.areaId === usuario.areaId).length}
                    </div>
                    <div style={{ color:'#6b7280', fontSize:11 }}>Personal</div>
                    <div style={{ color:'#3b82f6', fontSize:10, marginTop:3 }}>Ver lista</div>
                  </div>
                  <div style={s.statCard}>
                    <i className="bi bi-geo-alt" style={{ fontSize:26, color:'#10b981' }} />
                    <div style={{ color:'#fff', fontSize:14, fontWeight:700, margin:'8px 0 0' }}>GPS</div>
                    <div style={{ color:'#6b7280', fontSize:11 }}>
                      {gpsEstado === 'ok' ? '✓ Activo' : 'En espera'}
                    </div>
                  </div>
                </div>

                {/* Áreas — solo admin */}
                {esAdmin && areas.length > 0 && (
                  <div style={s.card}>
                    <h4 style={{ color:'#9ca3af', fontSize:11, textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 12px' }}>
                      <i className="bi bi-diagram-3 me-2" />Áreas Activas
                    </h4>
                    {areas.map(a => (
                      <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid #1f2937' }}>
                        <span style={{ color:'#e5e7eb', fontSize:13 }}>{a.nombre}</span>
                        <span style={{ color:'#10b981', fontSize:12, fontWeight:700 }}>${a.pagoPorHora}/hr</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Acciones rápidas */}
                <div style={s.card}>
                  <h3 style={{ color:'#fff', margin:'0 0 14px', fontSize:15 }}>Acciones Rápidas</h3>
                  <button onClick={() => { setVista('registro'); limpiarError(); setBusqueda(''); }}
                    style={{ ...s.btnPrimary, marginBottom:10, display:'flex', justifyContent:'space-between' }}>
                    <span><i className="bi bi-clipboard-check me-2" />Pasar Asistencia</span>
                    <i className="bi bi-chevron-right" />
                  </button>

                  {/* NUEVO COLABORADOR — solo admin */}
                  {esAdmin && (
                    <button onClick={() => { setVista('agregar'); limpiarError(); }}
                      style={{ ...s.btnGhost, marginBottom:10, display:'flex', justifyContent:'space-between' }}>
                      <span><i className="bi bi-person-plus-fill me-2" />Nuevo Colaborador</span>
                      <i className="bi bi-plus-lg" />
                    </button>
                  )}

                  {/* NUEVA ÁREA — solo admin */}
                  {esAdmin && (
                    <button onClick={() => { setVista('nueva-area'); limpiarError(); }}
                      style={{ ...s.btnGhost, display:'flex', justifyContent:'space-between' }}>
                      <span><i className="bi bi-diagram-3-fill me-2" />Nueva Área</span>
                      <i className="bi bi-plus-lg" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ─── PASE DE LISTA ─── */}
            {vista === 'registro' && (
              <div>
                {/* Encabezado con buscador */}
                <div style={{ padding:'0 16px 12px', display:'flex', gap:8, alignItems:'center' }}>
                  <div style={{ flex:1 }}>
                    <h3 style={{ color:'#fff', margin:'0 0 2px', fontSize:18 }}>Pase de Lista</h3>
                    <p style={{ color:'#6b7280', fontSize:11, margin:0 }}>
                      {esAdmin ? 'Todos los colaboradores' : areaNombre(usuario.areaId)}
                    </p>
                  </div>
                </div>

                {/* Buscador */}
                <div style={{ padding:'0 16px 12px' }}>
                  <div style={{ position:'relative' }}>
                    <i className="bi bi-search" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#4b5563', fontSize:13 }} />
                    <input
                      type="text"
                      placeholder="Buscar por nombre..."
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      style={{ ...s.input, paddingLeft:36, marginBottom:0 }}
                    />
                  </div>
                </div>

                <ErrorMsg msg={errorMsg} />

                {trabajadoresFiltrados.length === 0 ? (
                  <div style={{ ...s.card, textAlign:'center', color:'#6b7280' }}>
                    <i className="bi bi-people" style={{ fontSize:36, display:'block', marginBottom:10 }} />
                    <p style={{ margin:0 }}>
                      {busqueda ? 'Sin coincidencias' : 'No hay colaboradores en tu área'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Select-all row */}
                    <div style={{ ...s.item, margin:'0 16px 8px', background:'rgba(59,130,246,.06)', border:'1px solid rgba(59,130,246,.2)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <input type="checkbox"
                          className="form-check-input"
                          checked={todosSeleccionados}
                          ref={el => { if (el) el.indeterminate = algunoSeleccionado; }}
                          onChange={handleSelectAll}
                          style={{ width:18, height:18, accentColor:'#3b82f6', cursor:'pointer' }}
                        />
                        <span style={{ color:'#9ca3af', fontSize:12 }}>
                          {seleccionados.length > 0
                            ? `${seleccionados.length} seleccionados`
                            : 'Seleccionar todos'}
                        </span>
                      </div>
                    </div>

                    {/* Lista de trabajadores */}
                    {trabajadoresFiltrados.map(t => {
                      const sel = seleccionados.includes(t.id);
                      return (
                        <div key={t.id}
                          style={{ ...s.item, margin:'0 16px 8px', background: sel ? 'rgba(59,130,246,.08)' : 'rgba(255,255,255,.03)', border: sel ? '1px solid rgba(59,130,246,.3)' : '1px solid #1f2937', cursor:'pointer' }}
                          onClick={() => toggleSeleccion(t.id)}>
                          <div style={{ display:'flex', alignItems:'center', gap:12, flex:1, minWidth:0 }}>
                            <Avatar nombre={t.nombre} color={sel ? '#3b82f6' : '#6b7280'} />
                            <div style={{ minWidth:0 }}>
                              <div style={{ color:'#fff', fontSize:14, fontWeight:500 }}>{t.nombre} {t.apellido}</div>
                              <div style={{ color:'#6b7280', fontSize:11 }}>
                                {areaNombre(t.areaId)}
                                {t.curp && <span style={{ marginLeft:8, color:'#374151' }}>{t.curp}</span>}
                              </div>
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
                            {/* Pago por 8h — visible solo para admin */}
                            {esAdmin && t.pagoPorHora > 0 && (
                              <span style={{ color:'#10b981', fontSize:12, fontWeight:700 }}>
                                ${(t.pagoPorHora * 8).toFixed(0)}
                              </span>
                            )}
                            <input type="checkbox"
                              className="form-check-input"
                              checked={sel}
                              onChange={() => toggleSeleccion(t.id)}
                              onClick={e => e.stopPropagation()}
                              style={{ width:20, height:20, accentColor:'#10b981', cursor:'pointer', flexShrink:0 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                <button style={{ ...s.btnConfirm, opacity: loading ? 0.6 : 1 }}
                  onClick={confirmarAsistencia} disabled={loading}>
                  {loading
                    ? <><i className="bi bi-arrow-repeat" style={{ marginRight:8 }} />Registrando...</>
                    : <><i className="bi bi-clipboard-check me-2" />Confirmar Asistencia</>}
                </button>

                {/* Acción masiva flotante */}
                {seleccionados.length > 0 && (
                  <div style={s.bulkBar}>
                    <i className="bi bi-check2-circle" style={{ color:'#3b82f6', fontSize:16 }} />
                    <span style={{ color:'#3b82f6', fontWeight:700 }}>{seleccionados.length}</span>
                    <span style={{ color:'#9ca3af', fontSize:13 }}>seleccionados</span>
                    <div style={{ width:1, height:20, background:'#1f2937' }} />
                    <button style={{ background:'#10b981', border:'none', borderRadius:20, padding:'7px 16px', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}
                      onClick={confirmarAsistencia}>
                      Pasar Lista
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ─── AGREGAR COLABORADOR (solo admin) ─── */}
            {vista === 'agregar' && (
              <div style={s.card}>
                <h3 style={{ color:'#fff', margin:'0 0 18px', fontSize:17 }}>
                  <i className="bi bi-person-plus-fill" style={{ color:'#3b82f6', marginRight:8 }} />
                  Nuevo Colaborador
                </h3>
                <ErrorMsg msg={errorMsg} />
                <div style={s.inputRow}>
                  <input placeholder="Nombre" style={{ ...s.input, flex:1 }} value={formTrabajador.nombre}
                    onChange={e => setFormTrabajador({ ...formTrabajador, nombre: e.target.value })} onFocus={limpiarError} />
                  <input placeholder="Apellido" style={{ ...s.input, flex:1 }} value={formTrabajador.apellido}
                    onChange={e => setFormTrabajador({ ...formTrabajador, apellido: e.target.value })} onFocus={limpiarError} />
                </div>
                <select style={s.select} value={formTrabajador.areaId}
                  onChange={e => setFormTrabajador({ ...formTrabajador, areaId: e.target.value })}>
                  <option value="">-- Seleccionar área --</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.nombre} (${a.pagoPorHora}/hr)</option>)}
                </select>
                <input placeholder="CURP" style={s.input} value={formTrabajador.curp}
                  onChange={e => setFormTrabajador({ ...formTrabajador, curp: e.target.value })} onFocus={limpiarError} />
                <input placeholder="Teléfono" type="tel" style={s.input} value={formTrabajador.telefono}
                  onChange={e => setFormTrabajador({ ...formTrabajador, telefono: e.target.value })} onFocus={limpiarError} />
                <input placeholder="Pago por hora ($)" type="number" style={s.input} value={formTrabajador.pagoPorHora}
                  onChange={e => setFormTrabajador({ ...formTrabajador, pagoPorHora: e.target.value })} onFocus={limpiarError} />
                <button onClick={handleAgregarTrabajador} style={s.btnPrimary}>
                  <i className="bi bi-plus-lg me-2" />Registrar
                </button>
              </div>
            )}

            {/* ─── NUEVA ÁREA (solo admin) ─── */}
            {vista === 'nueva-area' && (
              <div style={s.card}>
                <h3 style={{ color:'#fff', margin:'0 0 18px', fontSize:17 }}>
                  <i className="bi bi-diagram-3-fill" style={{ color:'#10b981', marginRight:8 }} />
                  Nueva Área
                </h3>
                <ErrorMsg msg={errorMsg} />
                <input placeholder="Nombre del área" style={s.input} value={formArea.nombre}
                  onChange={e => setFormArea({ ...formArea, nombre: e.target.value })} onFocus={limpiarError} />
                <input placeholder="Pago base por hora ($)" type="number" style={s.input} value={formArea.pagoPorHora}
                  onChange={e => setFormArea({ ...formArea, pagoPorHora: e.target.value })} onFocus={limpiarError} />
                <button onClick={handleAgregarArea} style={{ ...s.btnPrimary, background:'#10b981' }}>
                  <i className="bi bi-plus-lg me-2" />Crear Área
                </button>
                {areas.length > 0 && (
                  <div style={{ marginTop:16 }}>
                    <p style={{ color:'#6b7280', fontSize:11, textTransform:'uppercase', letterSpacing:'0.1em' }}>Áreas existentes</p>
                    {areas.map(a => (
                      <div key={a.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #1f2937' }}>
                        <span style={{ color:'#e5e7eb', fontSize:13 }}>{a.nombre}</span>
                        <span style={{ color:'#10b981', fontSize:12, fontWeight:700 }}>${a.pagoPorHora}/hr</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── RESUMEN POST-ASISTENCIA ─── */}
            {vista === 'resumen' && (
              <div style={{ padding:20 }}>
                <div style={{ textAlign:'center', marginBottom:20 }}>
                  <i className="bi bi-check-circle" style={{ fontSize:52, color:'#10b981' }} />
                  <h3 style={{ color:'#fff', margin:'10px 0 0' }}>Reporte de Hoy</h3>
                </div>

                {/* GPS Card */}
                <div style={s.locationCard}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    <i className={`bi ${gpsEstado === 'ok' ? 'bi-geo-alt-fill' : gpsEstado === 'loading' ? 'bi-arrow-repeat' : 'bi-geo-alt'}`}
                      style={{ color: gpsEstado === 'ok' ? '#10b981' : gpsEstado === 'error' ? '#ef4444' : '#f59e0b', fontSize:20, flexShrink:0, marginTop:2 }} />
                    <div>
                      <p style={{ color:'#6b7280', fontSize:10, margin:'0 0 3px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Ubicación del registro</p>
                      <p style={{ color:'#fff', fontSize:13, margin:0, lineHeight:1.4 }}>{lugarResumen || 'Sin ubicación registrada'}</p>
                      {coordsResumen && (
                        <p style={{ color:'#4b5563', fontSize:10, margin:'3px 0 0' }}>{coordsResumen.lat.toFixed(6)}, {coordsResumen.lng.toFixed(6)}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ausentes */}
                {faltantes.length > 0 ? (
                  <>
                    <p style={{ color:'#6b7280', fontSize:11, textTransform:'uppercase', letterSpacing:'0.1em', marginTop:20, marginBottom:8 }}>Ausentes</p>
                    {faltantes.map(f => (
                      <div key={f.id} style={{ ...s.item, borderColor:'rgba(239,68,68,.25)', background:'rgba(239,68,68,.05)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <Avatar nombre={f.nombre} color="#ef4444" />
                          <div>
                            <div style={{ color:'#ef4444', fontSize:13, fontWeight:500 }}>
                              <i className="bi bi-x-circle me-1" />{f.nombre} {f.apellido}
                            </div>
                            <div style={{ color:'#6b7280', fontSize:11 }}>{areaNombre(f.areaId)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <p style={{ color:'#10b981', textAlign:'center', marginTop:10, fontSize:14 }}>✓ Asistencia completa</p>
                )}

                <button style={{ ...s.btnPrimary, marginTop:20 }} onClick={() => setVista('welcome')}>
                  Volver al inicio
                </button>
              </div>
            )}

            {/* ─── CONFIGURACIÓN ─── */}
            {vista === 'configuracion' && (
              <div style={{ padding:'0 10px' }}>
                <h2 style={{ color:'#fff', marginBottom:20 }}>Configuración</h2>
                <div style={s.card}>
                  <div style={{ textAlign:'center', marginBottom:20 }}>
                    <div style={s.avatarLg}>{(usuario.nombre || 'U').charAt(0).toUpperCase()}</div>
                    <h3 style={{ color:'#fff', margin:'10px 0 0' }}>{usuario.nombre} {usuario.apellido}</h3>
                    <p style={{ color:'#6b7280', fontSize:13, margin:'4px 0 6px' }}>{usuario.email}</p>
                    <RolBadge rol={usuario.rol} />
                    {usuario.areaId && (
                      <p style={{ color:'#3b82f6', fontSize:12, marginTop:6 }}>
                        <i className="bi bi-diagram-3 me-1" />{areaNombre(usuario.areaId)}
                      </p>
                    )}
                  </div>
                  <hr style={{ border:'none', borderTop:'1px solid #1f2937', margin:'18px 0' }} />
                  <button onClick={cerrarSesion} style={{ ...s.btnPrimary, background:'#ef4444' }}>
                    <i className="bi bi-box-arrow-left me-2" />Cerrar Sesión
                  </button>
                </div>
              </div>
            )}

            {/* ─── CALENDARIO ─── */}
            {vista === 'calendario' && (() => {
              const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
              const DIAS  = ['D','L','M','X','J','V','S'];
              const primerDia = new Date(calAnio, calMes, 1).getDay();
              const totalDias = new Date(calAnio, calMes + 1, 0).getDate();
              const celdas    = Array(primerDia).fill(null).concat(Array.from({ length: totalDias }, (_, i) => i + 1));
              while (celdas.length % 7 !== 0) celdas.push(null);

              return (
                <div style={{ padding:'0 12px' }}>
                  <h2 style={{ color:'#fff', fontSize:20, margin:'0 0 14px' }}>Calendario</h2>

                  {/* Nav mes */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(255,255,255,.03)', border:'1px solid #1f2937', borderRadius:14, padding:'10px 14px', marginBottom:10 }}>
                    <button onClick={() => { if (calMes===0){setCalMes(11);setCalAnio(calAnio-1);}else setCalMes(calMes-1); setDiaSelec(null); }}
                      style={{ background:'none', border:'none', color:'#9ca3af', fontSize:18, cursor:'pointer', padding:'2px 6px' }}>
                      <i className="bi bi-chevron-left" />
                    </button>
                    <span style={{ color:'#fff', fontWeight:700 }}>{MESES[calMes]} {calAnio}</span>
                    <button onClick={() => { if (calMes===11){setCalMes(0);setCalAnio(calAnio+1);}else setCalMes(calMes+1); setDiaSelec(null); }}
                      style={{ background:'none', border:'none', color:'#9ca3af', fontSize:18, cursor:'pointer', padding:'2px 6px' }}>
                      <i className="bi bi-chevron-right" />
                    </button>
                  </div>

                  {/* Cabecera días */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
                    {DIAS.map(d => <div key={d} style={{ textAlign:'center', color:'#4b5563', fontSize:11, fontWeight:700, padding:'4px 0' }}>{d}</div>)}
                  </div>

                  {/* Celdas */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
                    {celdas.map((dia, i) => {
                      if (!dia) return <div key={`e-${i}`} />;
                      const clave     = `${calAnio}-${String(calMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
                      const tieneDat  = diasConDatos[clave];
                      const esHoy     = dia===hoy.getDate() && calMes===hoy.getMonth() && calAnio===hoy.getFullYear();
                      const selec     = diaSelec && diaSelec.dia===dia && diaSelec.mes===calMes && diaSelec.anio===calAnio;
                      return (
                        <div key={dia} onClick={() => abrirDia(calAnio, calMes, dia)}
                          style={{ textAlign:'center', padding:'9px 0', borderRadius:10, cursor:'pointer', position:'relative',
                            background: selec ? '#3b82f6' : esHoy ? 'rgba(59,130,246,.12)' : 'rgba(255,255,255,.02)',
                            border: esHoy && !selec ? '1px solid rgba(59,130,246,.4)' : '1px solid transparent',
                            color: selec ? '#fff' : '#e5e7eb', fontWeight: esHoy||selec ? 700 : 400, fontSize:13 }}>
                          {dia}
                          {tieneDat && (
                            <div style={{ width:5, height:5, borderRadius:'50%', background: selec ? '#fff' : '#10b981', margin:'2px auto 0' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Detalle día */}
                  {diaSelec && (
                    <div style={{ marginTop:18, background:'rgba(255,255,255,.03)', border:'1px solid #1f2937', borderRadius:18, padding:18 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                        <h4 style={{ color:'#fff', margin:0, fontSize:14 }}>
                          <i className="bi bi-calendar-event" style={{ color:'#3b82f6', marginRight:6 }} />
                          {String(diaSelec.dia).padStart(2,'0')}/{String(diaSelec.mes+1).padStart(2,'0')}/{diaSelec.anio}
                        </h4>
                        {/* Cálculo financiero — solo admin */}
                        {esAdmin && asistDia.totalPago > 0 && (
                          <div style={{ background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.2)', borderRadius:20, padding:'4px 12px' }}>
                            <span style={{ color:'#10b981', fontSize:12, fontWeight:700 }}>
                              <i className="bi bi-currency-dollar" />
                              ${asistDia.totalPago.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>

                      {asistDia.sinRegistro ? (
                        <p style={{ color:'#4b5563', textAlign:'center', fontSize:13 }}>Sin registros para este día.</p>
                      ) : (
                        <>
                          {/* Presentes */}
                          {asistDia.presentes.length > 0 && (
                            <>
                              <p style={{ color:'#10b981', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 8px' }}>
                                <i className="bi bi-check-circle me-1" />Presentes ({asistDia.presentes.length})
                              </p>
                              {asistDia.presentes.map((t, i) => (
                                <div key={i} style={{ display:'flex', gap:10, padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                                  <Avatar nombre={t.nombre} color="#10b981" size={28} />
                                  <div>
                                    <div style={{ color:'#d1d5db', fontSize:13 }}>{t.nombre}</div>
                                    {t.area && <div style={{ color:'#3b82f6', fontSize:11 }}><i className="bi bi-diagram-3 me-1" />{t.area}</div>}
                                    {t.lugar && <div style={{ color:'#4b5563', fontSize:10, lineHeight:1.3 }}><i className="bi bi-geo-alt me-1" style={{ color:'#10b981' }} />{t.lugar}</div>}
                                    {esAdmin && t.pago > 0 && <div style={{ color:'#10b981', fontSize:10, fontWeight:700, marginTop:2 }}><i className="bi bi-currency-dollar" />${t.pago.toFixed(2)}</div>}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}

                          {/* Ausentes */}
                          {asistDia.ausentes.length > 0 && (
                            <>
                              <p style={{ color:'#ef4444', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'14px 0 8px' }}>
                                <i className="bi bi-x-circle me-1" />Ausentes ({asistDia.ausentes.length})
                              </p>
                              {asistDia.ausentes.map((t, i) => (
                                <div key={i} style={{ display:'flex', gap:10, padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                                  <Avatar nombre={t.nombre} color="#ef4444" size={28} />
                                  <div>
                                    <div style={{ color:'#9ca3af', fontSize:13 }}>{t.nombre}</div>
                                    {t.area && <div style={{ color:'#374151', fontSize:11 }}>{t.area}</div>}
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

          </>
        )}
      </main>

      {/* ── NAV BOTTOM ── */}
      {usuario && (
        <nav style={s.nav}>
          {[
            { id:'registro',      icon:'bi-clipboard-check', label:'Lista' },
            { id:'welcome',       icon:'bi-house-door',      label:'Inicio' },
            { id:'calendario',    icon:'bi-calendar3',        label:'Cal.' },
            { id:'configuracion', icon:'bi-gear',             label:'Config' },
          ].map(item => (
            <div key={item.id} style={s.navItem}
              onClick={() => { setVista(item.id); if (item.id==='calendario') setDiaSelec(null); }}>
              <i className={`bi ${item.icon}`}
                style={{ fontSize:22, color: vista===item.id ? '#3b82f6' : '#4b5563', display:'block', transition:'color .15s' }} />
              <span style={{ fontSize:10, color: vista===item.id ? '#3b82f6' : '#4b5563', marginTop:2 }}>{item.label}</span>
            </div>
          ))}
        </nav>
      )}

      {/* ── MODAL PERSONAL ── */}
      {modalPersonal && (
        <div style={s.modalOverlay} onClick={() => setModalPersonal(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <h3 style={{ color:'#fff', margin:0, fontSize:16 }}>
                <i className="bi bi-people" style={{ color:'#3b82f6', marginRight:8 }} />
                Personal ({esAdmin ? trabajadores.length : trabajadores.filter(t=>t.areaId===usuario.areaId).length})
              </h3>
              <button onClick={() => setModalPersonal(false)}
                style={{ background:'none', border:'none', color:'#6b7280', fontSize:18, cursor:'pointer' }}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div style={{ maxHeight:'60vh', overflowY:'auto' }}>
              {(esAdmin ? trabajadores : trabajadores.filter(t=>t.areaId===usuario.areaId)).map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #1f2937' }}>
                  <Avatar nombre={t.nombre} color="#3b82f6" size={36} />
                  <div style={{ flex:1 }}>
                    <div style={{ color:'#fff', fontSize:13, fontWeight:500 }}>{t.nombre} {t.apellido}</div>
                    <div style={{ color:'#3b82f6', fontSize:11 }}>
                      <i className="bi bi-diagram-3 me-1" />{areaNombre(t.areaId)}
                    </div>
                    {t.curp && <div style={{ color:'#374151', fontSize:10 }}>{t.curp}</div>}
                  </div>
                  {esAdmin && t.pagoPorHora > 0 && (
                    <span style={{ color:'#10b981', fontSize:12, fontWeight:700 }}>${t.pagoPorHora}/hr</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Estilos ───────────────────────────────────────────────────
const s = {
  container:    { backgroundColor:'#080C12', minHeight:'100vh', paddingBottom:80, fontFamily:"'DM Sans', system-ui, sans-serif" },
  header:       { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'13px 18px', borderBottom:'1px solid #111827', position:'sticky', top:0, backgroundColor:'#080C12', zIndex:10, backdropFilter:'blur(10px)' },
  logoBadge:    { width:34, height:34, borderRadius:8, background:'rgba(59,130,246,.15)', border:'1px solid rgba(59,130,246,.25)', display:'flex', alignItems:'center', justifyContent:'center', color:'#3b82f6' },
  main:         { padding:12 },
  card:         { backgroundColor:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)', padding:20, borderRadius:20, margin:'0 0 14px', boxShadow:'0 8px 24px rgba(0,0,0,.3)' },
  statCard:     { backgroundColor:'rgba(255,255,255,.03)', padding:14, borderRadius:18, textAlign:'center', border:'1px solid #111827' },
  input:        { width:'100%', padding:'13px 14px', marginBottom:12, borderRadius:10, border:'1px solid #1f2937', backgroundColor:'#0F1520', color:'white', boxSizing:'border-box', fontSize:14, outline:'none' },
  inputRow:     { display:'flex', gap:10 },
  inputWrap:    { flex:1 },
  select:       { width:'100%', padding:'13px 14px', marginBottom:12, borderRadius:10, border:'1px solid #1f2937', backgroundColor:'#0F1520', color:'white', boxSizing:'border-box', fontSize:14, outline:'none' },
  btnPrimary:   { width:'100%', padding:'14px', backgroundColor:'#3b82f6', color:'white', border:'none', borderRadius:12, cursor:'pointer', fontWeight:700, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', gap:6 },
  btnGhost:     { width:'100%', padding:'13px', backgroundColor:'rgba(255,255,255,.04)', color:'#d1d5db', border:'1px solid #1f2937', borderRadius:12, cursor:'pointer', fontWeight:600, fontSize:14 },
  btnConfirm:   { width:'90%', margin:'0 5% 16px', padding:16, backgroundColor:'#10b981', color:'white', border:'none', borderRadius:12, cursor:'pointer', fontSize:15, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6 },
  item:         { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px', borderRadius:14, border:'1px solid #1f2937', marginBottom:8 },
  nav:          { position:'fixed', bottom:0, width:'100%', height:68, backgroundColor:'rgba(8,12,18,.92)', backdropFilter:'blur(12px)', display:'flex', borderTop:'1px solid #111827', justifyContent:'space-around', alignItems:'center', zIndex:100 },
  navItem:      { cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', padding:'4px 12px' },
  locationCard: { backgroundColor:'rgba(16,185,129,.06)', border:'1px solid rgba(16,185,129,.2)', borderRadius:14, padding:'14px 16px', marginBottom:10 },
  errorBanner:  { backgroundColor:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', color:'#fca5a5', borderRadius:10, padding:'11px 14px', marginBottom:14, fontSize:13, display:'flex', alignItems:'center' },
  modalOverlay: { position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,.75)', backdropFilter:'blur(6px)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' },
  modalBox:     { backgroundColor:'#0F1520', border:'1px solid #1f2937', borderRadius:'20px 20px 0 0', padding:22, width:'100%', maxWidth:500 },
  avatarLg:     { width:56, height:56, backgroundColor:'#3b82f6', borderRadius:'50%', margin:'0 auto 10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'#fff', fontWeight:700 },
  loginIcon:    { width:64, height:64, borderRadius:18, background:'rgba(59,130,246,.12)', border:'1px solid rgba(59,130,246,.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto' },
  bulkBar:      { position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)', background:'#0F1520', border:'1px solid #1f2937', borderRadius:30, padding:'10px 20px', display:'flex', alignItems:'center', gap:12, boxShadow:'0 8px 32px rgba(0,0,0,.6)', zIndex:99, whiteSpace:'nowrap' },
};
