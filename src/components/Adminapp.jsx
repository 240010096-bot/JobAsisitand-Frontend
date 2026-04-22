import React, { useState, useEffect } from 'react';
import { db } from '../db';

const ErrorMsg = ({ msg }) => msg ? (
  <div style={errorStyle}>
    <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: 8 }} />{msg}
  </div>
) : null;

const Avatar = ({ nombre, color = '#3b82f6', size = 36 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    backgroundColor: color + '22', border: `1px solid ${color}55`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color, fontSize: size * 0.38, fontWeight: 'bold', flexShrink: 0
  }}>
    {(nombre || '?').charAt(0).toUpperCase()}
  </div>
);

// ── PDF GENERATOR ──────────────────────────────────────────────
function generarPDFSemanal(encargado, area, trabajadores, asistencias, fechaInicio, fechaFin) {
  const dias = [];
  const d = new Date(fechaInicio);
  while (d <= fechaFin) {
    dias.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  const fmt = (fecha) => new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtHora = (iso) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  // Calcular horas y pago por trabajador
  const resumen = trabajadores.map(t => {
    let totalHoras = 0;
    const detalles = [];

    dias.forEach(dia => {
      const diaStr = dia.toISOString().slice(0, 10);
      const entradas = asistencias.filter(a =>
        a.trabajadorId === t.id && a.tipo === 'entrada' && a.fecha.slice(0, 10) === diaStr
      );
      const salidas = asistencias.filter(a =>
        a.trabajadorId === t.id && a.tipo === 'salida' && a.fecha.slice(0, 10) === diaStr
      );

      if (entradas.length > 0) {
        const entrada = entradas[0];
        const salida = salidas[0];
        let horas = 0;
        if (salida) {
          horas = (new Date(salida.fecha) - new Date(entrada.fecha)) / 3600000;
          totalHoras += horas;
        }
        detalles.push({
          fecha: diaStr,
          entrada: fmtHora(entrada.fecha),
          salida: salida ? fmtHora(salida.fecha) : '—',
          horas: salida ? horas.toFixed(2) : '—',
          lugar: entrada.lugar || 'Sin ubicación',
        });
      }
    });

    const pago = totalHoras * (area.salarioPorHora || 0);
    return { ...t, detalles, totalHoras: totalHoras.toFixed(2), pago: pago.toFixed(2) };
  });

  const totalGeneral = resumen.reduce((s, t) => s + parseFloat(t.pago), 0).toFixed(2);

  // Build HTML for PDF
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #111; font-size: 12px; padding: 30px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #1d4ed8; padding-bottom: 16px; }
  .logo { font-size: 20px; font-weight: 800; color: #1d4ed8; letter-spacing: 1px; }
  .logo span { color: #10b981; }
  .meta { text-align: right; color: #555; font-size: 11px; line-height: 1.6; }
  .section-title { font-size: 13px; font-weight: 700; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 10px 0; border-left: 3px solid #1d4ed8; padding-left: 8px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .info-card .label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 3px; }
  .info-card .value { font-size: 13px; font-weight: 600; color: #0f172a; }
  .worker-block { margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  .worker-header { background: #1e3a5f; color: white; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; }
  .worker-name { font-weight: 700; font-size: 13px; }
  .worker-sub { font-size: 10px; color: #93c5fd; }
  .worker-pago { font-size: 14px; font-weight: 800; color: #10b981; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; color: #475569; font-size: 10px; text-transform: uppercase; padding: 7px 10px; text-align: left; font-weight: 600; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #334155; }
  tr:last-child td { border-bottom: none; }
  .total-row { background: #f0fdf4; }
  .total-row td { font-weight: 700; color: #065f46; font-size: 12px; }
  .summary-box { background: #0f172a; color: white; border-radius: 10px; padding: 20px; margin-top: 24px; display: flex; justify-content: space-between; align-items: center; }
  .summary-box .label { font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
  .summary-box .amount { font-size: 28px; font-weight: 800; color: #10b981; }
  .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  @media print { body { padding: 15px; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">JOB<span>ASSISTAND</span></div>
    <div style="font-size:11px;color:#64748b;margin-top:4px;">Sistema de Control de Asistencia</div>
  </div>
  <div class="meta">
    <strong>REPORTE SEMANAL DE ASISTENCIA</strong><br/>
    Período: ${fmt(fechaInicio)} — ${fmt(fechaFin)}<br/>
    Generado: ${fmt(new Date())}<br/>
    Encargado: ${encargado.nombre} ${encargado.apellido}<br/>
    Área: ${area.nombre}
  </div>
</div>

<div class="section-title">Información General</div>
<div class="info-grid">
  <div class="info-card">
    <div class="label">Encargado</div>
    <div class="value">${encargado.nombre} ${encargado.apellido}</div>
  </div>
  <div class="info-card">
    <div class="label">Área</div>
    <div class="value">${area.nombre}</div>
  </div>
  <div class="info-card">
    <div class="label">Salario por hora</div>
    <div class="value">$${(area.salarioPorHora || 0).toFixed(2)}</div>
  </div>
  <div class="info-card">
    <div class="label">Total trabajadores</div>
    <div class="value">${trabajadores.length}</div>
  </div>
  <div class="info-card">
    <div class="label">Semana</div>
    <div class="value">${fmt(fechaInicio)} al ${fmt(fechaFin)}</div>
  </div>
  <div class="info-card">
    <div class="label">Total a pagar</div>
    <div class="value" style="color:#10b981">$${totalGeneral}</div>
  </div>
</div>

<div class="section-title">Detalle por Trabajador</div>

${resumen.map(t => `
<div class="worker-block">
  <div class="worker-header">
    <div>
      <div class="worker-name">${t.nombre} ${t.apellido}</div>
      <div class="worker-sub">Tel: ${t.telefono || '—'} &nbsp;|&nbsp; ${t.totalHoras} horas trabajadas</div>
    </div>
    <div class="worker-pago">$${t.pago}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Entrada</th>
        <th>Salida</th>
        <th>Horas</th>
        <th>Ubicación</th>
      </tr>
    </thead>
    <tbody>
      ${t.detalles.length > 0 ? t.detalles.map(d => `
      <tr>
        <td>${d.fecha}</td>
        <td>${d.entrada}</td>
        <td>${d.salida}</td>
        <td>${d.horas}</td>
        <td style="font-size:10px;color:#64748b">${d.lugar.slice(0, 60)}${d.lugar.length > 60 ? '...' : ''}</td>
      </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:14px">Sin asistencias en este período</td></tr>`}
      <tr class="total-row">
        <td colspan="3"><strong>Total</strong></td>
        <td><strong>${t.totalHoras} h</strong></td>
        <td><strong style="color:#10b981">$${t.pago}</strong></td>
      </tr>
    </tbody>
  </table>
</div>`).join('')}

<div class="summary-box">
  <div>
    <div class="label">Total a pagar esta semana</div>
    <div class="amount">$${totalGeneral}</div>
  </div>
  <div style="text-align:right">
    <div class="label">Trabajadores activos</div>
    <div style="font-size:20px;font-weight:700;color:#fff">${trabajadores.length}</div>
  </div>
</div>

<div class="footer">
  JobAssistand PWA — Reporte generado automáticamente el ${new Date().toLocaleString('es-MX')}
</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}

// ── MAIN COMPONENT ─────────────────────────────────────────────
export default function AdminApp() {
  const [admin, setAdmin]         = useState(() => {
    try { return JSON.parse(localStorage.getItem('session_admin')); } catch { return null; }
  });
  const [vista, setVista]         = useState('dashboard');
  const [errorMsg, setErrorMsg]   = useState('');
  const [loading, setLoading]     = useState(false);

  // Data
  const [encargados,   setEncargados]   = useState([]);
  const [areas,        setAreas]        = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);

  // Selected context
  const [encargadoSel, setEncargadoSel] = useState(null);
  const [areaSel,      setAreaSel]      = useState(null);

  // Forms
  const [formAdmin,      setFormAdmin]      = useState({ nombre: '', apellido: '', email: '', pass: '', confirm: '' });
  const [formEncargado,  setFormEncargado]  = useState({ nombre: '', apellido: '', email: '', pass: '' });
  const [formArea,       setFormArea]       = useState({ nombre: '', salarioPorHora: '' });
  const [formTrabajador, setFormTrabajador] = useState({ nombre: '', apellido: '', telefono: '' });
  const [authMode,       setAuthMode]       = useState('login');

  // Reporte
  const [reporteEncargado, setReporteEncargado] = useState('');
  const [reporteArea,      setReporteArea]      = useState('');
  const [reporteFechaIni,  setReporteFechaIni]  = useState('');
  const [reporteFechaFin,  setReporteFechaFin]  = useState('');

  const limpiar = () => setErrorMsg('');

  // ── Load data ──
  useEffect(() => {
    if (!admin) return;
    const load = async () => {
      const [e, a, t] = await Promise.all([
        db.encargados.where('adminId').equals(admin.id).toArray(),
        db.areas.toArray(),
        db.trabajadores.toArray(),
      ]);
      setEncargados(e);
      setAreas(a);
      setTrabajadores(t);
    };
    load();
  }, [admin, vista]);

  // ── Auth ──
  const handleAuth = async () => {
    limpiar();
    if (authMode === 'register') {
      if (!formAdmin.nombre.trim())   return setErrorMsg('Nombre obligatorio.');
      if (!formAdmin.apellido.trim()) return setErrorMsg('Apellido obligatorio.');
      if (!formAdmin.email.trim())    return setErrorMsg('Correo obligatorio.');
      if (!formAdmin.pass)            return setErrorMsg('Contraseña obligatoria.');
      if (formAdmin.pass.length < 6)  return setErrorMsg('Mínimo 6 caracteres.');
      if (formAdmin.pass !== formAdmin.confirm) return setErrorMsg('Las contraseñas no coinciden.');
      const existe = await db.administradores.where('email').equalsIgnoreCase(formAdmin.email.trim()).first();
      if (existe) return setErrorMsg('Ya existe una cuenta con ese correo.');
      const id = await db.administradores.add({ nombre: formAdmin.nombre.trim(), apellido: formAdmin.apellido.trim(), email: formAdmin.email.trim().toLowerCase(), password: formAdmin.pass });
      const newAdmin = { id, ...formAdmin };
      localStorage.setItem('session_admin', JSON.stringify(newAdmin));
      setAdmin(newAdmin);
    } else {
      if (!formAdmin.email.trim()) return setErrorMsg('Correo obligatorio.');
      if (!formAdmin.pass)         return setErrorMsg('Contraseña obligatoria.');
      const user = await db.administradores.where('email').equalsIgnoreCase(formAdmin.email.trim()).first();
      if (!user || user.password !== formAdmin.pass) return setErrorMsg('Correo o contraseña incorrectos.');
      localStorage.setItem('session_admin', JSON.stringify(user));
      setAdmin(user);
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('session_admin');
    setAdmin(null);
    setVista('dashboard');
  };

  // ── Encargados ──
  const agregarEncargado = async () => {
    limpiar();
    if (!formEncargado.nombre.trim())    return setErrorMsg('Nombre obligatorio.');
    if (!formEncargado.apellido.trim())  return setErrorMsg('Apellido obligatorio.');
    if (!formEncargado.email.trim())     return setErrorMsg('Correo obligatorio.');
    if (!formEncargado.pass)             return setErrorMsg('Contraseña obligatoria.');
    if (formEncargado.pass.length < 6)   return setErrorMsg('Mínimo 6 caracteres.');
    const existe = await db.encargados.where('email').equalsIgnoreCase(formEncargado.email.trim()).first();
    if (existe) return setErrorMsg('Ya existe un encargado con ese correo.');
    await db.encargados.add({ ...formEncargado, nombre: formEncargado.nombre.trim(), apellido: formEncargado.apellido.trim(), email: formEncargado.email.trim().toLowerCase(), adminId: admin.id });
    setFormEncargado({ nombre: '', apellido: '', email: '', pass: '' });
    setVista('encargados');
  };

  const eliminarEncargado = async (id) => {
    if (!confirm('¿Eliminar este encargado y todos sus datos?')) return;
    const areasEnc = areas.filter(a => a.encargadoId === id).map(a => a.id);
    await db.trabajadores.where('encargadoId').equals(id).delete();
    for (const aId of areasEnc) await db.areas.delete(aId);
    await db.encargados.delete(id);
    setVista('encargados');
  };

  // ── Áreas ──
  const agregarArea = async () => {
    limpiar();
    if (!formArea.nombre.trim())         return setErrorMsg('Nombre del área obligatorio.');
    if (!formArea.salarioPorHora || isNaN(formArea.salarioPorHora) || parseFloat(formArea.salarioPorHora) <= 0)
      return setErrorMsg('Ingresa un salario por hora válido.');
    if (!encargadoSel)                   return setErrorMsg('Selecciona un encargado primero.');
    await db.areas.add({ nombre: formArea.nombre.trim(), salarioPorHora: parseFloat(formArea.salarioPorHora), encargadoId: encargadoSel.id });
    setFormArea({ nombre: '', salarioPorHora: '' });
    setVista('detalle-encargado');
  };

  const eliminarArea = async (id) => {
    if (!confirm('¿Eliminar esta área y sus trabajadores?')) return;
    await db.trabajadores.where('areaId').equals(id).delete();
    await db.areas.delete(id);
    setVista('detalle-encargado');
  };

  // ── Trabajadores ──
  const agregarTrabajador = async () => {
    limpiar();
    if (!formTrabajador.nombre.trim())    return setErrorMsg('Nombre obligatorio.');
    if (!formTrabajador.apellido.trim())  return setErrorMsg('Apellido obligatorio.');
    if (!areaSel)                         return setErrorMsg('Selecciona un área primero.');
    await db.trabajadores.add({ nombre: formTrabajador.nombre.trim(), apellido: formTrabajador.apellido.trim(), telefono: formTrabajador.telefono.trim(), areaId: areaSel.id, encargadoId: encargadoSel?.id || areaSel.encargadoId });
    setFormTrabajador({ nombre: '', apellido: '', telefono: '' });
    setVista('detalle-area');
  };

  const eliminarTrabajador = async (id) => {
    if (!confirm('¿Eliminar este trabajador?')) return;
    await db.trabajadores.delete(id);
    setVista('detalle-area');
  };

  // ── Reporte PDF ──
  const generarReporte = async () => {
    limpiar();
    if (!reporteEncargado) return setErrorMsg('Selecciona un encargado.');
    if (!reporteArea)      return setErrorMsg('Selecciona un área.');
    if (!reporteFechaIni || !reporteFechaFin) return setErrorMsg('Selecciona el rango de fechas.');

    const encargado = encargados.find(e => e.id === parseInt(reporteEncargado));
    const area      = areas.find(a => a.id === parseInt(reporteArea));
    const trabajs   = trabajadores.filter(t => t.areaId === parseInt(reporteArea));

    const inicio = new Date(reporteFechaIni + 'T00:00:00');
    const fin    = new Date(reporteFechaFin + 'T23:59:59');

    const asists = await db.asistencias
      .where('areaId').equals(parseInt(reporteArea))
      .filter(a => new Date(a.fecha) >= inicio && new Date(a.fecha) <= fin)
      .toArray();

    generarPDFSemanal(encargado, area, trabajs, asists, inicio, fin);
  };

  // ── Nav items ──
  const navItems = [
    { id: 'dashboard',  icon: 'bi-house-door',  label: 'Inicio'     },
    { id: 'encargados', icon: 'bi-people',       label: 'Encargados' },
    { id: 'reporte',    icon: 'bi-file-earmark-pdf', label: 'Reportes'  },
    { id: 'perfil',     icon: 'bi-gear',         label: 'Perfil'     },
  ];

  // ── Helpers ──
  const areasDeEncargado   = (encId)  => areas.filter(a => a.encargadoId === encId);
  const trabajadoresDeArea = (areaId) => trabajadores.filter(t => t.areaId === areaId);

  // ═══════════════════════════════════════════════
  // LOGIN / REGISTER
  // ═══════════════════════════════════════════════
  if (!admin) return (
    <div style={{ backgroundColor: '#0B0E14', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
            <i className="bi bi-shield-lock" style={{ marginRight: 6 }} />Modo Administrador
          </div>
          <h1 style={{ color: '#fff', fontSize: 28, margin: 0, fontWeight: 800 }}>
            JOB<span style={{ color: '#3b82f6' }}>ASSISTAND</span>
          </h1>
        </div>

        <div style={card}>
          <h2 style={{ color: '#fff', margin: '0 0 20px 0', fontSize: 18 }}>
            {authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta Admin'}
          </h2>
          <ErrorMsg msg={errorMsg} />

          {authMode === 'register' && (<>
            <input placeholder="Nombre" style={input} value={formAdmin.nombre}
              onChange={e => setFormAdmin({ ...formAdmin, nombre: e.target.value })} onFocus={limpiar} />
            <input placeholder="Apellido" style={input} value={formAdmin.apellido}
              onChange={e => setFormAdmin({ ...formAdmin, apellido: e.target.value })} onFocus={limpiar} />
          </>)}

          <input type="email" placeholder="Correo electrónico" style={input} value={formAdmin.email}
            onChange={e => setFormAdmin({ ...formAdmin, email: e.target.value })} onFocus={limpiar} />
          <input type="password" placeholder="Contraseña" style={input} value={formAdmin.pass}
            onChange={e => setFormAdmin({ ...formAdmin, pass: e.target.value })} onFocus={limpiar} />

          {authMode === 'register' && (
            <input type="password" placeholder="Confirmar contraseña" style={input} value={formAdmin.confirm}
              onChange={e => setFormAdmin({ ...formAdmin, confirm: e.target.value })} onFocus={limpiar} />
          )}

          <button onClick={handleAuth} style={btnBlue}>
            {authMode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
          <p onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); limpiar(); }}
            style={{ textAlign: 'center', color: '#3b82f6', cursor: 'pointer', marginTop: 16, fontSize: 14 }}>
            {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Entra'}
          </p>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════
  // MAIN ADMIN SHELL
  // ═══════════════════════════════════════════════
  return (
    <div className="app-shell" style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#0B0E14' }}>

      {/* ── SIDEBAR desktop ── */}
      <aside className="app-sidebar">
        <div className="app-sidebar-logo">JOB<span>ASSISTAND</span></div>
        <div style={{ fontSize: 10, color: '#3b82f6', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, padding: '0 8px 16px 8px' }}>
          <i className="bi bi-shield-lock" style={{ marginRight: 4 }} />Administrador
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
          <p>{admin.nombre} {admin.apellido}</p>
          <span style={{ color: '#3b82f6', fontSize: 10 }}>Administrador</span>
        </div>
      </aside>

      {/* ── CONTENT ── */}
      <div className="app-content" style={{ minHeight: '100vh' }}>

        {/* Header mobile */}
        <header style={headerSt}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 18, margin: 0, fontWeight: 800 }}>
              JOB<span style={{ color: '#3b82f6' }}>ASSISTAND</span>
            </h1>
            <span style={{ color: '#3b82f6', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>
              <i className="bi bi-shield-lock" style={{ marginRight: 3 }} />Admin
            </span>
          </div>
          <span style={{ color: '#9ca3af', fontSize: 12 }}>{admin.nombre}</span>
        </header>

        <main style={{ padding: '16px' }}>

          {/* ══ DASHBOARD ══ */}
          {vista === 'dashboard' && (
            <div>
              <h2 style={pageTitle}>Dashboard</h2>
              <p style={pageSub}>{new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Encargados', value: encargados.length, icon: 'bi-person-badge', color: '#3b82f6', action: () => setVista('encargados') },
                  { label: 'Áreas',      value: areas.length,      icon: 'bi-diagram-3',    color: '#8b5cf6', action: () => setVista('encargados') },
                  { label: 'Trabajadores', value: trabajadores.length, icon: 'bi-people-fill', color: '#10b981', action: () => setVista('encargados') },
                  { label: 'Reportes',   value: 'PDF',             icon: 'bi-file-earmark-pdf', color: '#f59e0b', action: () => setVista('reporte') },
                ].map((s, i) => (
                  <div key={i} onClick={s.action} style={{ ...statCard, cursor: 'pointer' }}>
                    <i className={'bi ' + s.icon} style={{ fontSize: 28, color: s.color }} />
                    <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '8px 0 2px' }}>{s.value}</div>
                    <div style={{ color: '#9ca3af', fontSize: 12 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={card}>
                <h3 style={{ color: '#fff', margin: '0 0 14px 0', fontSize: 15 }}>Acciones rápidas</h3>
                <button onClick={() => setVista('nuevo-encargado')} style={{ ...btnBlue, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <span><i className="bi bi-person-plus" style={{ marginRight: 8 }} />Nuevo Encargado</span>
                  <i className="bi bi-chevron-right" />
                </button>
                <button onClick={() => setVista('reporte')} style={{ ...btnGhost, display: 'flex', justifyContent: 'space-between' }}>
                  <span><i className="bi bi-file-earmark-pdf" style={{ marginRight: 8 }} />Generar Reporte PDF</span>
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          )}

          {/* ══ LISTA ENCARGADOS ══ */}
          {vista === 'encargados' && (
            <div>
              <div style={pageHeader}>
                <h2 style={pageTitle}>Encargados</h2>
                <button onClick={() => setVista('nuevo-encargado')} style={btnSmBlue}>
                  <i className="bi bi-plus-lg" style={{ marginRight: 4 }} />Nuevo
                </button>
              </div>

              {encargados.length === 0 ? (
                <div style={{ ...card, textAlign: 'center', color: '#6b7280', padding: 40 }}>
                  <i className="bi bi-person-badge" style={{ fontSize: 40, marginBottom: 10, display: 'block' }} />
                  No hay encargados registrados aún.
                </div>
              ) : encargados.map(enc => {
                const areasEnc = areasDeEncargado(enc.id);
                const trabsEnc = trabajadores.filter(t => t.encargadoId === enc.id);
                return (
                  <div key={enc.id} style={{ ...card, marginBottom: 12, cursor: 'pointer' }}
                    onClick={() => { setEncargadoSel(enc); setVista('detalle-encargado'); }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar nombre={enc.nombre} color="#3b82f6" size={42} />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{enc.nombre} {enc.apellido}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{enc.email}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#9ca3af', fontSize: 11 }}>{areasEnc.length} áreas · {trabsEnc.length} trabajadores</div>
                        <i className="bi bi-chevron-right" style={{ color: '#4b5563', fontSize: 14 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ NUEVO ENCARGADO ══ */}
          {vista === 'nuevo-encargado' && (
            <div>
              <div style={pageHeader}>
                <button onClick={() => setVista('encargados')} style={btnBack}><i className="bi bi-arrow-left" /></button>
                <h2 style={pageTitle}>Nuevo Encargado</h2>
              </div>
              <div style={card}>
                <ErrorMsg msg={errorMsg} />
                <label style={labelSt}>Nombre</label>
                <input placeholder="Nombre" style={input} value={formEncargado.nombre}
                  onChange={e => setFormEncargado({ ...formEncargado, nombre: e.target.value })} onFocus={limpiar} />
                <label style={labelSt}>Apellido</label>
                <input placeholder="Apellido" style={input} value={formEncargado.apellido}
                  onChange={e => setFormEncargado({ ...formEncargado, apellido: e.target.value })} onFocus={limpiar} />
                <label style={labelSt}>Correo electrónico</label>
                <input type="email" placeholder="correo@ejemplo.com" style={input} value={formEncargado.email}
                  onChange={e => setFormEncargado({ ...formEncargado, email: e.target.value })} onFocus={limpiar} />
                <label style={labelSt}>Contraseña de acceso</label>
                <input type="password" placeholder="Mínimo 6 caracteres" style={input} value={formEncargado.pass}
                  onChange={e => setFormEncargado({ ...formEncargado, pass: e.target.value })} onFocus={limpiar} />
                <button onClick={agregarEncargado} style={{ ...btnBlue, marginTop: 6 }}>
                  <i className="bi bi-person-check" style={{ marginRight: 8 }} />Registrar Encargado
                </button>
              </div>
            </div>
          )}

          {/* ══ DETALLE ENCARGADO ══ */}
          {vista === 'detalle-encargado' && encargadoSel && (
            <div>
              <div style={pageHeader}>
                <button onClick={() => setVista('encargados')} style={btnBack}><i className="bi bi-arrow-left" /></button>
                <h2 style={pageTitle}>{encargadoSel.nombre} {encargadoSel.apellido}</h2>
                <button onClick={() => eliminarEncargado(encargadoSel.id)} style={btnDanger}>
                  <i className="bi bi-trash" />
                </button>
              </div>

              <div style={{ ...card, marginBottom: 12 }}>
                <div style={{ color: '#9ca3af', fontSize: 12 }}>
                  <i className="bi bi-envelope" style={{ marginRight: 6, color: '#3b82f6' }} />{encargadoSel.email}
                </div>
              </div>

              <div style={pageHeader}>
                <h3 style={{ color: '#fff', margin: 0, fontSize: 15 }}>Áreas</h3>
                <button onClick={() => setVista('nueva-area')} style={btnSmBlue}>
                  <i className="bi bi-plus-lg" style={{ marginRight: 4 }} />Nueva Área
                </button>
              </div>

              {areasDeEncargado(encargadoSel.id).length === 0 ? (
                <div style={{ ...card, textAlign: 'center', color: '#6b7280', padding: 30 }}>
                  Sin áreas. Agrega una para registrar trabajadores.
                </div>
              ) : areasDeEncargado(encargadoSel.id).map(area => {
                const trabsArea = trabajadoresDeArea(area.id);
                return (
                  <div key={area.id} style={{ ...card, marginBottom: 10, cursor: 'pointer' }}
                    onClick={() => { setAreaSel(area); setVista('detalle-area'); }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="bi bi-diagram-3" style={{ color: '#8b5cf6', fontSize: 18 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{area.nombre}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>
                          ${area.salarioPorHora}/hr &nbsp;·&nbsp; {trabsArea.length} trabajadores
                        </div>
                      </div>
                      <i className="bi bi-chevron-right" style={{ color: '#4b5563' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ NUEVA ÁREA ══ */}
          {vista === 'nueva-area' && encargadoSel && (
            <div>
              <div style={pageHeader}>
                <button onClick={() => setVista('detalle-encargado')} style={btnBack}><i className="bi bi-arrow-left" /></button>
                <h2 style={pageTitle}>Nueva Área</h2>
              </div>
              <div style={card}>
                <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 16 }}>
                  Encargado: <span style={{ color: '#fff' }}>{encargadoSel.nombre} {encargadoSel.apellido}</span>
                </div>
                <ErrorMsg msg={errorMsg} />
                <label style={labelSt}>Nombre del área</label>
                <input placeholder="Ej: Empaque, Campo, Invernadero..." style={input} value={formArea.nombre}
                  onChange={e => setFormArea({ ...formArea, nombre: e.target.value })} onFocus={limpiar} />
                <label style={labelSt}>Salario por hora ($)</label>
                <input type="number" placeholder="Ej: 80.00" style={input} value={formArea.salarioPorHora}
                  onChange={e => setFormArea({ ...formArea, salarioPorHora: e.target.value })} onFocus={limpiar} />
                <button onClick={agregarArea} style={{ ...btnBlue, marginTop: 6 }}>
                  <i className="bi bi-plus-circle" style={{ marginRight: 8 }} />Crear Área
                </button>
              </div>
            </div>
          )}

          {/* ══ DETALLE ÁREA ══ */}
          {vista === 'detalle-area' && areaSel && (
            <div>
              <div style={pageHeader}>
                <button onClick={() => setVista('detalle-encargado')} style={btnBack}><i className="bi bi-arrow-left" /></button>
                <h2 style={pageTitle}>{areaSel.nombre}</h2>
                <button onClick={() => eliminarArea(areaSel.id)} style={btnDanger}><i className="bi bi-trash" /></button>
              </div>

              <div style={{ ...card, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 20 }}>
                  <div>
                    <div style={{ color: '#9ca3af', fontSize: 11, textTransform: 'uppercase' }}>Salario/hora</div>
                    <div style={{ color: '#10b981', fontSize: 20, fontWeight: 800 }}>${areaSel.salarioPorHora}</div>
                  </div>
                  <div>
                    <div style={{ color: '#9ca3af', fontSize: 11, textTransform: 'uppercase' }}>Trabajadores</div>
                    <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{trabajadoresDeArea(areaSel.id).length}</div>
                  </div>
                </div>
              </div>

              <div style={pageHeader}>
                <h3 style={{ color: '#fff', margin: 0, fontSize: 15 }}>Trabajadores</h3>
                <button onClick={() => setVista('nuevo-trabajador')} style={btnSmBlue}>
                  <i className="bi bi-plus-lg" style={{ marginRight: 4 }} />Agregar
                </button>
              </div>

              {trabajadoresDeArea(areaSel.id).length === 0 ? (
                <div style={{ ...card, textAlign: 'center', color: '#6b7280', padding: 30 }}>
                  Sin trabajadores en esta área.
                </div>
              ) : trabajadoresDeArea(areaSel.id).map(t => (
                <div key={t.id} style={{ ...card, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar nombre={t.nombre} color="#10b981" size={38} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t.nombre} {t.apellido}</div>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>
                        <i className="bi bi-telephone" style={{ marginRight: 4 }} />{t.telefono || 'Sin teléfono'}
                      </div>
                    </div>
                    <button onClick={() => eliminarTrabajador(t.id)} style={btnIconDanger}>
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ NUEVO TRABAJADOR ══ */}
          {vista === 'nuevo-trabajador' && areaSel && (
            <div>
              <div style={pageHeader}>
                <button onClick={() => setVista('detalle-area')} style={btnBack}><i className="bi bi-arrow-left" /></button>
                <h2 style={pageTitle}>Nuevo Trabajador</h2>
              </div>
              <div style={card}>
                <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 16 }}>
                  Área: <span style={{ color: '#8b5cf6' }}>{areaSel.nombre}</span> &nbsp;·&nbsp;
                  Encargado: <span style={{ color: '#fff' }}>{encargadoSel?.nombre}</span>
                </div>
                <ErrorMsg msg={errorMsg} />
                <label style={labelSt}>Nombre</label>
                <input placeholder="Nombre" style={input} value={formTrabajador.nombre}
                  onChange={e => setFormTrabajador({ ...formTrabajador, nombre: e.target.value })} onFocus={limpiar} />
                <label style={labelSt}>Apellido</label>
                <input placeholder="Apellido" style={input} value={formTrabajador.apellido}
                  onChange={e => setFormTrabajador({ ...formTrabajador, apellido: e.target.value })} onFocus={limpiar} />
                <label style={labelSt}>Teléfono</label>
                <input type="tel" placeholder="Ej: 6671234567" style={input} value={formTrabajador.telefono}
                  onChange={e => setFormTrabajador({ ...formTrabajador, telefono: e.target.value })} onFocus={limpiar} />
                <button onClick={agregarTrabajador} style={{ ...btnBlue, marginTop: 6 }}>
                  <i className="bi bi-person-plus" style={{ marginRight: 8 }} />Registrar Trabajador
                </button>
              </div>
            </div>
          )}

          {/* ══ REPORTE PDF ══ */}
          {vista === 'reporte' && (
            <div>
              <h2 style={pageTitle}>Generar Reporte</h2>
              <p style={pageSub}>Reporte semanal de asistencia y nómina en PDF</p>

              <div style={card}>
                <ErrorMsg msg={errorMsg} />

                <label style={labelSt}>Encargado</label>
                <select style={input} value={reporteEncargado}
                  onChange={e => { setReporteEncargado(e.target.value); setReporteArea(''); }}>
                  <option value="">— Selecciona encargado —</option>
                  {encargados.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>)}
                </select>

                <label style={labelSt}>Área</label>
                <select style={input} value={reporteArea} onChange={e => setReporteArea(e.target.value)}
                  disabled={!reporteEncargado}>
                  <option value="">— Selecciona área —</option>
                  {areas.filter(a => a.encargadoId === parseInt(reporteEncargado)).map(a => (
                    <option key={a.id} value={a.id}>{a.nombre} (${a.salarioPorHora}/hr)</option>
                  ))}
                </select>

                <label style={labelSt}>Fecha inicio</label>
                <input type="date" style={input} value={reporteFechaIni}
                  onChange={e => setReporteFechaIni(e.target.value)} />

                <label style={labelSt}>Fecha fin</label>
                <input type="date" style={input} value={reporteFechaFin}
                  onChange={e => setReporteFechaFin(e.target.value)} />

                <button onClick={generarReporte} style={{ ...btnBlue, marginTop: 8, backgroundColor: '#dc2626' }}>
                  <i className="bi bi-file-earmark-pdf" style={{ marginRight: 8 }} />Generar PDF
                </button>
              </div>

              {reporteEncargado && reporteArea && (
                <div style={{ ...card, marginTop: 12 }}>
                  <h4 style={{ color: '#fff', margin: '0 0 10px 0', fontSize: 14 }}>Vista previa</h4>
                  {(() => {
                    const area = areas.find(a => a.id === parseInt(reporteArea));
                    const trabsArea = trabajadoresDeArea(parseInt(reporteArea));
                    return (
                      <>
                        <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>
                          <i className="bi bi-diagram-3" style={{ color: '#8b5cf6', marginRight: 6 }} />
                          {area?.nombre} — ${area?.salarioPorHora}/hr
                        </div>
                        <div style={{ color: '#9ca3af', fontSize: 12 }}>
                          <i className="bi bi-people" style={{ color: '#10b981', marginRight: 6 }} />
                          {trabsArea.length} trabajador(es) en esta área
                        </div>
                        {trabsArea.map(t => (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '8px 0', borderTop: '1px solid #1f2937' }}>
                            <Avatar nombre={t.nombre} color="#10b981" size={28} />
                            <span style={{ color: '#d1d5db', fontSize: 13 }}>{t.nombre} {t.apellido}</span>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ══ PERFIL ══ */}
          {vista === 'perfil' && (
            <div>
              <h2 style={pageTitle}>Perfil</h2>
              <div style={card}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <Avatar nombre={admin.nombre} color="#3b82f6" size={64} />
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginTop: 12 }}>
                    {admin.nombre} {admin.apellido}
                  </div>
                  <div style={{ color: '#3b82f6', fontSize: 12, marginTop: 4 }}>
                    <i className="bi bi-shield-lock" style={{ marginRight: 4 }} />Administrador
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>{admin.email}</div>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid #1f2937', margin: '16px 0' }} />
                <button onClick={cerrarSesion} style={{ ...btnBlue, backgroundColor: '#ef4444' }}>
                  <i className="bi bi-box-arrow-left" style={{ marginRight: 8 }} />Cerrar Sesión
                </button>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── BOTTOM NAV mobile ── */}
      <nav className="app-bottom-nav" style={navSt}>
        {navItems.map(item => (
          <div key={item.id} style={{ cursor: 'pointer', fontSize: 24 }}
            onClick={() => { setVista(item.id); limpiar(); }}>
            <i className={'bi ' + item.icon} style={{ color: vista === item.id ? '#3b82f6' : '#9ca3af' }} />
          </div>
        ))}
      </nav>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const card       = { backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', borderRadius: 20, padding: 20, marginBottom: 0 };
const input      = { width: '100%', padding: '13px 14px', marginBottom: 12, borderRadius: 12, border: '1px solid #374151', backgroundColor: '#111827', color: 'white', boxSizing: 'border-box', fontSize: 14, outline: 'none' };
const btnBlue    = { width: '100%', padding: '14px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 14 };
const btnGhost   = { width: '100%', padding: '14px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid #374151', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const btnSmBlue  = { padding: '8px 14px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13 };
const btnBack    = { background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer', padding: '4px 8px' };
const btnDanger  = { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 8, cursor: 'pointer', padding: '6px 10px', fontSize: 14 };
const btnIconDanger = { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '4px 8px', fontSize: 16 };
const statCard   = { backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', borderRadius: 20, padding: 16, textAlign: 'center' };
const pageTitle  = { color: '#fff', fontSize: 22, margin: '0 0 4px 0', fontWeight: 800 };
const pageSub    = { color: '#6b7280', fontSize: 13, margin: '0 0 20px 0', textTransform: 'capitalize' };
const pageHeader = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 };
const labelSt    = { color: '#9ca3af', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 };
const headerSt   = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, backgroundColor: '#0B0E14', zIndex: 10 };
const navSt      = { position: 'fixed', bottom: 0, width: '100%', height: 70, backgroundColor: 'rgba(17,24,39,0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid #1f2937', justifyContent: 'space-around', alignItems: 'center', zIndex: 100 };
const errorStyle = { backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5', borderRadius: 10, padding: '12px 15px', marginBottom: 14, fontSize: 14, display: 'flex', alignItems: 'center' };
