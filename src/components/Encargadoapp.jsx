import React, { useState, useEffect } from 'react';
import { db } from '../db';

const ErrorMsg = ({ msg }) => msg ? (
  <div style={errorStyle}>
    <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: 8 }} />{msg}
  </div>
) : null;

const Avatar = ({ nombre, color = '#10b981', size = 36 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    backgroundColor: color + '22', border: `1px solid ${color}55`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color, fontSize: size * 0.38, fontWeight: 'bold', flexShrink: 0
  }}>
    {(nombre || '?').charAt(0).toUpperCase()}
  </div>
);

export default function EncargadoApp() {
  const [encargado, setEncargado] = useState(() => {
    try { return JSON.parse(localStorage.getItem('session_encargado')); } catch { return null; }
  });
  const [vista, setVista]           = useState('dashboard');
  const [errorMsg, setErrorMsg]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [status, setStatus]         = useState('Listo');

  // Data
  const [areas,        setAreas]        = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [areaSel,      setAreaSel]      = useState(null);

  // Asistencia
  const [seleccionados, setSeleccionados] = useState({});
  const [tipoAsist,     setTipoAsist]     = useState('entrada'); // 'entrada' | 'salida'
  const [resumen,       setResumen]       = useState(null);

  // Calendario
  const hoy = new Date();
  const [calMes,       setCalMes]       = useState(hoy.getMonth());
  const [calAnio,      setCalAnio]      = useState(hoy.getFullYear());
  const [diaSelec,     setDiaSelec]     = useState(null);
  const [asistDia,     setAsistDia]     = useState({ registros: [], sinRegistro: true });
  const [diasConDatos, setDiasConDatos] = useState({});

  // Auth
  const [formLogin, setFormLogin] = useState({ email: '', pass: '' });
  const limpiar = () => setErrorMsg('');

  // ── Load data ──
  useEffect(() => {
    if (!encargado) return;
    const load = async () => {
      const [a, t] = await Promise.all([
        db.areas.where('encargadoId').equals(encargado.id).toArray(),
        db.trabajadores.where('encargadoId').equals(encargado.id).toArray(),
      ]);
      setAreas(a);
      setTrabajadores(t);
      if (a.length === 1) setAreaSel(a[0]);
    };
    load();
  }, [encargado, vista]);

  // ── Calendario: cargar días con datos ──
  useEffect(() => {
    if (!encargado) return;
    const cargar = async () => {
      const inicio = new Date(calAnio, calMes, 1).toISOString();
      const fin    = new Date(calAnio, calMes + 1, 0, 23, 59, 59).toISOString();
      const regs   = await db.asistencias
        .where('encargadoId').equals(encargado.id)
        .filter(a => a.fecha >= inicio && a.fecha <= fin)
        .toArray();
      const mapa = {};
      regs.forEach(r => { mapa[r.fecha.slice(0, 10)] = true; });
      setDiasConDatos(mapa);
    };
    cargar();
  }, [calMes, calAnio, encargado]);

  // ── Auth ──
  const handleLogin = async () => {
    limpiar();
    if (!formLogin.email.trim()) return setErrorMsg('Correo obligatorio.');
    if (!formLogin.pass)         return setErrorMsg('Contraseña obligatoria.');
    const user = await db.encargados.where('email').equalsIgnoreCase(formLogin.email.trim()).first();
    if (!user || user.password !== formLogin.pass) return setErrorMsg('Correo o contraseña incorrectos.');
    localStorage.setItem('session_encargado', JSON.stringify(user));
    setEncargado(user);
  };

  const cerrarSesion = () => {
    localStorage.removeItem('session_encargado');
    setEncargado(null);
    setVista('dashboard');
  };

  // ── Confirmar asistencia (entrada o salida) ──
  const confirmarAsistencia = async () => {
    const presentes = trabajadores
      .filter(t => t.areaId === areaSel?.id)
      .filter(t => seleccionados[t.id]);

    if (presentes.length === 0) return setErrorMsg('Selecciona al menos un trabajador.');
    if (!areaSel)               return setErrorMsg('Selecciona un área primero.');

    setLoading(true);
    setStatus('Guardando...');
    limpiar();

    const fecha = new Date().toISOString();
    const registros = presentes.map(t => ({
      trabajadorId: t.id,
      areaId:       areaSel.id,
      encargadoId:  encargado.id,
      fecha,
      tipo:         tipoAsist,
      lat:          null,
      lng:          null,
      lugar:        'Obteniendo ubicación...',
      sincronizado: 0,
    }));

    const ids = await db.asistencias.bulkAdd(registros, { allKeys: true });

    // Calcular ganancia si es salida
    let gananciasHoy = {};
    if (tipoAsist === 'salida') {
      for (const t of presentes) {
        const diaStr = fecha.slice(0, 10);
        const entradas = await db.asistencias
          .where('trabajadorId').equals(t.id)
          .filter(a => a.tipo === 'entrada' && a.fecha.slice(0, 10) === diaStr)
          .toArray();
        if (entradas.length > 0) {
          const horas = (new Date(fecha) - new Date(entradas[0].fecha)) / 3600000;
          gananciasHoy[t.id] = (horas * (areaSel.salarioPorHora || 0)).toFixed(2);
        }
      }
    }

    const faltantes = trabajadores
      .filter(t => t.areaId === areaSel?.id && !seleccionados[t.id]);

    setResumen({ presentes, faltantes, tipo: tipoAsist, fecha, ganancias: gananciasHoy, area: areaSel });
    setSeleccionados({});
    setVista('resumen');
    setStatus('Guardado');
    setLoading(false);

    // GPS en segundo plano
    const obtenerGPS = async () => {
      try {
        const coords = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, enableHighAccuracy: true, maximumAge: 30000 })
        );
        let lugar = `${coords.coords.latitude.toFixed(5)}, ${coords.coords.longitude.toFixed(5)}`;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.coords.latitude}&lon=${coords.coords.longitude}`);
          if (r.ok) { const d = await r.json(); lugar = d.display_name; }
        } catch {}
        await Promise.all(ids.map(id => db.asistencias.update(id, { lat: coords.coords.latitude, lng: coords.coords.longitude, lugar })));
        setStatus('Guardado ✓');
      } catch { setStatus('Sin GPS'); }
    };
    obtenerGPS();
  };

  // ── Abrir día en calendario ──
  const abrirDia = async (anio, mes, dia) => {
    const inicio = new Date(anio, mes, dia, 0, 0, 0).toISOString();
    const fin    = new Date(anio, mes, dia, 23, 59, 59).toISOString();
    const regs   = await db.asistencias
      .where('encargadoId').equals(encargado.id)
      .filter(a => a.fecha >= inicio && a.fecha <= fin)
      .toArray();

    // Calcular ganancias del día
    const trabsDelDia = {};
    for (const r of regs) {
      if (!trabsDelDia[r.trabajadorId]) trabsDelDia[r.trabajadorId] = { entradas: [], salidas: [] };
      if (r.tipo === 'entrada') trabsDelDia[r.trabajadorId].entradas.push(r);
      else trabsDelDia[r.trabajadorId].salidas.push(r);
    }

    const detalles = [];
    let gananciaTotal = 0;
    for (const [tId, data] of Object.entries(trabsDelDia)) {
      const trabajador = trabajadores.find(t => t.id === parseInt(tId));
      const area = areas.find(a => a.id === trabajador?.areaId);
      let horas = 0;
      if (data.entradas.length > 0 && data.salidas.length > 0) {
        horas = (new Date(data.salidas[0].fecha) - new Date(data.entradas[0].fecha)) / 3600000;
      }
      const ganancia = horas * (area?.salarioPorHora || 0);
      gananciaTotal += ganancia;
      detalles.push({
        trabajador,
        area,
        entrada: data.entradas[0]?.fecha || null,
        salida:  data.salidas[0]?.fecha  || null,
        lugar:   data.entradas[0]?.lugar || null,
        horas:   horas.toFixed(2),
        ganancia: ganancia.toFixed(2),
      });
    }

    // Trabajadores ausentes (en áreas del encargado)
    const presentesIds = Object.keys(trabsDelDia).map(Number);
    const ausentes = trabajadores.filter(t => !presentesIds.includes(t.id));

    setAsistDia({ detalles, ausentes, gananciaTotal: gananciaTotal.toFixed(2), sinRegistro: regs.length === 0 });
    setDiaSelec({ anio, mes, dia });
  };

  const fmtHora = (iso) => iso ? new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—';

  // ── Nav ──
  const navItems = [
    { id: 'asistencia', icon: 'bi-clipboard-check', label: 'Asistencia' },
    { id: 'dashboard',  icon: 'bi-house-door',       label: 'Inicio'     },
    { id: 'calendario', icon: 'bi-calendar3',        label: 'Calendario' },
    { id: 'perfil',     icon: 'bi-gear',             label: 'Perfil'     },
  ];

  // ═══════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════
  if (!encargado) return (
    <div style={{ backgroundColor: '#0B0E14', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 13, color: '#10b981', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
            <i className="bi bi-person-badge" style={{ marginRight: 6 }} />Encargado
          </div>
          <h1 style={{ color: '#fff', fontSize: 28, margin: 0, fontWeight: 800 }}>
            JOB<span style={{ color: '#3b82f6' }}>ASSISTAND</span>
          </h1>
        </div>
        <div style={card}>
          <h2 style={{ color: '#fff', margin: '0 0 20px 0', fontSize: 18 }}>Iniciar Sesión</h2>
          <ErrorMsg msg={errorMsg} />
          <input type="email" placeholder="Correo electrónico" style={input} value={formLogin.email}
            onChange={e => setFormLogin({ ...formLogin, email: e.target.value })} onFocus={limpiar} />
          <input type="password" placeholder="Contraseña" style={input} value={formLogin.pass}
            onChange={e => setFormLogin({ ...formLogin, pass: e.target.value })} onFocus={limpiar} />
          <button onClick={handleLogin} style={btnGreen}>Entrar</button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════
  // MAIN SHELL
  // ═══════════════════════════════════════════════
  return (
    <div className="app-shell" style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#0B0E14' }}>

      {/* Sidebar desktop */}
      <aside className="app-sidebar">
        <div className="app-sidebar-logo">JOB<span>ASSISTAND</span></div>
        <div style={{ fontSize: 10, color: '#10b981', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, padding: '0 8px 16px 8px' }}>
          <i className="bi bi-person-badge" style={{ marginRight: 4 }} />Encargado
        </div>
        {navItems.map(item => (
          <button key={item.id}
            className={'app-sidebar-item' + (vista === item.id ? ' active' : '')}
            onClick={() => { setVista(item.id); limpiar(); }}>
            <i className={'bi ' + item.icon} />{item.label}
          </button>
        ))}
        <div className="app-sidebar-spacer" />
        <div className="app-sidebar-user">
          <p>{encargado.nombre} {encargado.apellido}</p>
          <span style={{ color: '#10b981', fontSize: 10 }}>Encargado</span>
        </div>
      </aside>

      <div className="app-content" style={{ minHeight: '100vh' }}>
        <header style={headerSt}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 18, margin: 0, fontWeight: 800 }}>AgriSync PWA</h1>
            <span style={{ color: '#9ca3af', fontSize: 12 }}>{encargado.nombre} {encargado.apellido}</span>
          </div>
          <div style={{ fontSize: 10, color: '#10b981', textTransform: 'uppercase', fontWeight: 700 }}>
            <i className="bi bi-circle-fill" style={{ fontSize: 7, marginRight: 3 }} />{status}
          </div>
        </header>

        <main style={{ padding: 16 }}>

          {/* ══ DASHBOARD ══ */}
          {vista === 'dashboard' && (
            <div>
              <h2 style={pageTitle}>Panel</h2>
              <p style={pageSub}>{new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={statCard}>
                  <i className="bi bi-people" style={{ fontSize: 26, color: '#3b82f6' }} />
                  <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '6px 0 2px' }}>{trabajadores.length}</div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>Trabajadores</div>
                </div>
                <div style={statCard}>
                  <i className="bi bi-diagram-3" style={{ fontSize: 26, color: '#8b5cf6' }} />
                  <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '6px 0 2px' }}>{areas.length}</div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>Áreas</div>
                </div>
              </div>

              <div style={card}>
                <h3 style={{ color: '#fff', margin: '0 0 14px 0', fontSize: 15 }}>Áreas asignadas</h3>
                {areas.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', fontSize: 13 }}>El administrador no ha asignado áreas.</p>
                ) : areas.map(a => {
                  const t = trabajadores.filter(tr => tr.areaId === a.id);
                  return (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1f2937' }}>
                      <div>
                        <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{a.nombre}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{t.length} trabajadores · ${a.salarioPorHora}/hr</div>
                      </div>
                      <button onClick={() => { setAreaSel(a); setVista('asistencia'); }} style={btnSmGreen}>
                        Asistencia
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ ASISTENCIA ══ */}
          {vista === 'asistencia' && (
            <div>
              <h2 style={pageTitle}>Pase de Lista</h2>

              {/* Selector de área */}
              {areas.length > 1 && (
                <div style={{ marginBottom: 14 }}>
                  <label style={labelSt}>Área</label>
                  <select style={input} value={areaSel?.id || ''} onChange={e => setAreaSel(areas.find(a => a.id === parseInt(e.target.value)))}>
                    <option value="">— Selecciona área —</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
              )}

              {/* Tipo: entrada / salida */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {['entrada', 'salida'].map(tipo => (
                  <button key={tipo} onClick={() => setTipoAsist(tipo)}
                    style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                      backgroundColor: tipoAsist === tipo ? (tipo === 'entrada' ? '#10b981' : '#ef4444') : 'rgba(255,255,255,0.05)',
                      color: tipoAsist === tipo ? '#fff' : '#9ca3af' }}>
                    <i className={'bi ' + (tipo === 'entrada' ? 'bi-box-arrow-in-right' : 'bi-box-arrow-left')} style={{ marginRight: 6 }} />
                    {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                  </button>
                ))}
              </div>

              <ErrorMsg msg={errorMsg} />

              {/* Lista de trabajadores */}
              {areaSel ? (
                trabajadores.filter(t => t.areaId === areaSel.id).length === 0 ? (
                  <div style={{ ...card, textAlign: 'center', color: '#6b7280', padding: 30 }}>
                    Sin trabajadores en esta área.
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      {trabajadores.filter(t => t.areaId === areaSel.id).map(t => (
                        <div key={t.id} onClick={() => setSeleccionados({ ...seleccionados, [t.id]: !seleccionados[t.id] })}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '14px 16px', backgroundColor: seleccionados[t.id] ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                            marginBottom: 8, borderRadius: 14, border: seleccionados[t.id] ? '1px solid rgba(16,185,129,0.3)' : '1px solid #1f2937',
                            cursor: 'pointer', transition: 'all 0.15s' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Avatar nombre={t.nombre} color={seleccionados[t.id] ? '#10b981' : '#6b7280'} size={36} />
                            <div>
                              <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{t.nombre} {t.apellido}</div>
                              <div style={{ color: '#6b7280', fontSize: 11 }}>{t.telefono || 'Sin teléfono'}</div>
                            </div>
                          </div>
                          <input type="checkbox" checked={!!seleccionados[t.id]} readOnly
                            style={{ width: 20, height: 20, accentColor: '#10b981' }} />
                        </div>
                      ))}
                    </div>
                    <button onClick={confirmarAsistencia} disabled={loading}
                      style={{ width: '100%', padding: 18, backgroundColor: tipoAsist === 'entrada' ? '#10b981' : '#ef4444',
                        color: 'white', border: 'none', borderRadius: 14, cursor: 'pointer', fontSize: 16, fontWeight: 800,
                        opacity: loading ? 0.6 : 1 }}>
                      {loading ? 'Guardando...' : `Confirmar ${tipoAsist.charAt(0).toUpperCase() + tipoAsist.slice(1)}`}
                    </button>
                  </>
                )
              ) : (
                <div style={{ ...card, textAlign: 'center', color: '#6b7280', padding: 30 }}>
                  Selecciona un área para tomar asistencia.
                </div>
              )}
            </div>
          )}

          {/* ══ RESUMEN ══ */}
          {vista === 'resumen' && resumen && (
            <div style={{ padding: '0 0 20px 0' }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <i className={'bi ' + (resumen.tipo === 'entrada' ? 'bi-box-arrow-in-right' : 'bi-check-circle')}
                  style={{ fontSize: 50, color: resumen.tipo === 'entrada' ? '#10b981' : '#3b82f6' }} />
                <h3 style={{ color: '#fff', margin: '10px 0 4px' }}>
                  {resumen.tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada'}
                </h3>
                <p style={{ color: '#6b7280', fontSize: 13 }}>
                  {new Date(resumen.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} — {resumen.area?.nombre}
                </p>
              </div>

              {/* Ganancias (solo en salida) */}
              {resumen.tipo === 'salida' && Object.keys(resumen.ganancias).length > 0 && (
                <div style={{ ...card, backgroundColor: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', marginBottom: 12 }}>
                  <div style={{ color: '#10b981', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>
                    <i className="bi bi-cash-stack" style={{ marginRight: 5 }} />Ganancias del día
                  </div>
                  {resumen.presentes.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ color: '#d1d5db', fontSize: 13 }}>{t.nombre} {t.apellido}</span>
                      <span style={{ color: '#10b981', fontWeight: 700, fontSize: 13 }}>
                        ${resumen.ganancias[t.id] || '0.00'}
                      </span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(16,185,129,0.2)' }}>
                    <span style={{ color: '#fff', fontWeight: 700 }}>Total</span>
                    <span style={{ color: '#10b981', fontWeight: 800, fontSize: 16 }}>
                      ${Object.values(resumen.ganancias).reduce((s, v) => s + parseFloat(v), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {resumen.presentes.length > 0 && (
                <div style={{ ...card, marginBottom: 10 }}>
                  <p style={{ color: '#10b981', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', margin: '0 0 10px 0' }}>
                    <i className="bi bi-check-circle" style={{ marginRight: 5 }} />
                    {resumen.tipo === 'entrada' ? 'Entradas' : 'Salidas'} ({resumen.presentes.length})
                  </p>
                  {resumen.presentes.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <Avatar nombre={t.nombre} color="#10b981" size={28} />
                      <span style={{ color: '#d1d5db', fontSize: 13 }}>{t.nombre} {t.apellido}</span>
                    </div>
                  ))}
                </div>
              )}

              {resumen.faltantes.length > 0 && (
                <div style={{ ...card, marginBottom: 10 }}>
                  <p style={{ color: '#ef4444', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', margin: '0 0 10px 0' }}>
                    <i className="bi bi-x-circle" style={{ marginRight: 5 }} />Sin registro ({resumen.faltantes.length})
                  </p>
                  {resumen.faltantes.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <Avatar nombre={t.nombre} color="#ef4444" size={28} />
                      <span style={{ color: '#9ca3af', fontSize: 13 }}>{t.nombre} {t.apellido}</span>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => setVista('dashboard')} style={btnGreen}>Volver al inicio</button>
            </div>
          )}

          {/* ══ CALENDARIO ══ */}
          {vista === 'calendario' && (() => {
            const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
            const dias  = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
            const primerDia = new Date(calAnio, calMes, 1).getDay();
            const totalDias = new Date(calAnio, calMes + 1, 0).getDate();
            const celdas = Array(primerDia).fill(null).concat(Array.from({ length: totalDias }, (_, i) => i + 1));
            while (celdas.length % 7 !== 0) celdas.push(null);

            return (
              <div>
                <h2 style={pageTitle}>Calendario</h2>

                {/* Navegación mes */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: '10px 16px', border: '1px solid #1f2937', marginBottom: 8 }}>
                  <button onClick={() => { if (calMes === 0) { setCalMes(11); setCalAnio(calAnio - 1); } else setCalMes(calMes - 1); setDiaSelec(null); }}
                    style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}>
                    <i className="bi bi-chevron-left" />
                  </button>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{meses[calMes]} {calAnio}</span>
                  <button onClick={() => { if (calMes === 11) { setCalMes(0); setCalAnio(calAnio + 1); } else setCalMes(calMes + 1); setDiaSelec(null); }}
                    style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}>
                    <i className="bi bi-chevron-right" />
                  </button>
                </div>

                {/* Cabecera días */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
                  {dias.map(d => <div key={d} style={{ textAlign: 'center', color: '#6b7280', fontSize: 11, fontWeight: 600, padding: '4px 0' }}>{d}</div>)}
                </div>

                {/* Celdas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                  {celdas.map((dia, i) => {
                    if (!dia) return <div key={`v-${i}`} />;
                    const clave = `${calAnio}-${String(calMes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                    const tieneDatos = diasConDatos[clave];
                    const esHoy  = dia === hoy.getDate() && calMes === hoy.getMonth() && calAnio === hoy.getFullYear();
                    const selec  = diaSelec?.dia === dia && diaSelec?.mes === calMes && diaSelec?.anio === calAnio;
                    return (
                      <div key={dia} onClick={() => abrirDia(calAnio, calMes, dia)}
                        style={{ textAlign: 'center', padding: '10px 0', borderRadius: 10, cursor: 'pointer', position: 'relative',
                          backgroundColor: selec ? '#3b82f6' : esHoy ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)',
                          border: esHoy && !selec ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
                          color: selec ? '#fff' : '#e5e7eb', fontWeight: esHoy || selec ? 700 : 400, fontSize: 14 }}>
                        {dia}
                        {tieneDatos && <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: selec ? '#fff' : '#10b981', margin: '2px auto 0' }} />}
                      </div>
                    );
                  })}
                </div>

                {/* Detalle del día */}
                {diaSelec && (
                  <div style={{ ...card, marginTop: 16 }}>
                    <h4 style={{ color: '#fff', margin: '0 0 14px 0', fontSize: 15 }}>
                      <i className="bi bi-calendar-event" style={{ color: '#3b82f6', marginRight: 8 }} />
                      {String(diaSelec.dia).padStart(2, '0')}/{String(diaSelec.mes + 1).padStart(2, '0')}/{diaSelec.anio}
                    </h4>

                    {asistDia.sinRegistro ? (
                      <p style={{ color: '#6b7280', textAlign: 'center', fontSize: 13 }}>Sin registros para este día.</p>
                    ) : (
                      <>
                        {/* Ganancia total del día */}
                        <div style={{ backgroundColor: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ color: '#9ca3af', fontSize: 12 }}>
                            <i className="bi bi-cash-stack" style={{ marginRight: 5, color: '#10b981' }} />Ganancia total del día
                          </div>
                          <div style={{ color: '#10b981', fontWeight: 800, fontSize: 20 }}>${asistDia.gananciaTotal}</div>
                        </div>

                        {/* Detalle por trabajador */}
                        {asistDia.detalles.map((d, i) => (
                          <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                              <Avatar nombre={d.trabajador?.nombre || '?'} color="#10b981" size={32} />
                              <div style={{ flex: 1 }}>
                                <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                                  {d.trabajador?.nombre} {d.trabajador?.apellido}
                                </div>
                                <div style={{ color: '#8b5cf6', fontSize: 11 }}>{d.area?.nombre}</div>
                              </div>
                              <div style={{ color: '#10b981', fontWeight: 800, fontSize: 14 }}>${d.ganancia}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280', paddingLeft: 42 }}>
                              <span><i className="bi bi-box-arrow-in-right" style={{ color: '#10b981', marginRight: 3 }} />{fmtHora(d.entrada)}</span>
                              <span><i className="bi bi-box-arrow-left" style={{ color: '#ef4444', marginRight: 3 }} />{fmtHora(d.salida)}</span>
                              <span><i className="bi bi-clock" style={{ color: '#f59e0b', marginRight: 3 }} />{d.horas}h</span>
                            </div>
                            {d.lugar && d.lugar !== 'Obteniendo ubicación...' && (
                              <div style={{ fontSize: 10, color: '#4b5563', paddingLeft: 42, marginTop: 4, lineHeight: 1.3 }}>
                                <i className="bi bi-geo-alt" style={{ color: '#10b981', marginRight: 3 }} />
                                {d.lugar.slice(0, 70)}{d.lugar.length > 70 ? '...' : ''}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Ausentes */}
                        {asistDia.ausentes?.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <p style={{ color: '#ef4444', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', margin: '0 0 8px 0' }}>
                              <i className="bi bi-x-circle" style={{ marginRight: 5 }} />Ausentes ({asistDia.ausentes.length})
                            </p>
                            {asistDia.ausentes.map((t, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <Avatar nombre={t.nombre} color="#ef4444" size={28} />
                                <div>
                                  <span style={{ color: '#9ca3af', fontSize: 13 }}>{t.nombre} {t.apellido}</span>
                                  <span style={{ color: '#4b5563', fontSize: 11, marginLeft: 8 }}>
                                    {areas.find(a => a.id === t.areaId)?.nombre}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ══ PERFIL ══ */}
          {vista === 'perfil' && (
            <div>
              <h2 style={pageTitle}>Perfil</h2>
              <div style={card}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <Avatar nombre={encargado.nombre} color="#10b981" size={64} />
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginTop: 12 }}>
                    {encargado.nombre} {encargado.apellido}
                  </div>
                  <div style={{ color: '#10b981', fontSize: 12, marginTop: 4 }}>
                    <i className="bi bi-person-badge" style={{ marginRight: 4 }} />Encargado
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>{encargado.email}</div>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid #1f2937', margin: '16px 0' }} />
                <button onClick={cerrarSesion} style={{ ...btnGreen, backgroundColor: '#ef4444' }}>
                  <i className="bi bi-box-arrow-left" style={{ marginRight: 8 }} />Cerrar Sesión
                </button>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="app-bottom-nav" style={navSt}>
        {navItems.map(item => (
          <div key={item.id} style={{ cursor: 'pointer', fontSize: 24 }}
            onClick={() => { setVista(item.id); limpiar(); }}>
            <i className={'bi ' + item.icon} style={{ color: vista === item.id ? '#10b981' : '#9ca3af' }} />
          </div>
        ))}
      </nav>
    </div>
  );
}

// ── Styles ──
const card      = { backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', borderRadius: 20, padding: 20 };
const input     = { width: '100%', padding: '13px 14px', marginBottom: 12, borderRadius: 12, border: '1px solid #374151', backgroundColor: '#111827', color: 'white', boxSizing: 'border-box', fontSize: 14, outline: 'none' };
const btnGreen  = { width: '100%', padding: 14, backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 14 };
const btnSmGreen = { padding: '7px 12px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12 };
const statCard  = { backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', borderRadius: 20, padding: 16, textAlign: 'center' };
const pageTitle = { color: '#fff', fontSize: 22, margin: '0 0 4px 0', fontWeight: 800 };
const pageSub   = { color: '#6b7280', fontSize: 13, margin: '0 0 20px 0', textTransform: 'capitalize' };
const labelSt   = { color: '#9ca3af', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 };
const headerSt  = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, backgroundColor: '#0B0E14', zIndex: 10 };
const navSt     = { position: 'fixed', bottom: 0, width: '100%', height: 70, backgroundColor: 'rgba(17,24,39,0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid #1f2937', justifyContent: 'space-around', alignItems: 'center', zIndex: 100 };
const errorStyle = { backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5', borderRadius: 10, padding: '12px 15px', marginBottom: 14, fontSize: 14, display: 'flex', alignItems: 'center' };
