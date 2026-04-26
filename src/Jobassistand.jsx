import React, { useState, useEffect } from 'react';
import { db } from './db';

// ─── Validaciones ─────────────────────────────────────────────────────────────
const validarEmail  = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const validarLogin  = ({ email, pass }) => {
  if (!email.trim())       return 'El correo es obligatorio.';
  if (!validarEmail(email)) return 'Correo no válido.';
  if (!pass)               return 'La contraseña es obligatoria.';
  return null;
};

// ─── Componentes pequeños ─────────────────────────────────────────────────────
const Err = ({ msg }) => msg ? (
  <div style={s.errBanner}><i className="bi bi-exclamation-triangle-fill" style={{marginRight:7}}/>{msg}</div>
) : null;

const Ok = ({ msg }) => msg ? (
  <div style={s.okBanner}><i className="bi bi-check-circle-fill" style={{marginRight:7}}/>{msg}</div>
) : null;

const Avatar = ({ nombre, color = '#3b82f6', size = 36 }) => (
  <div style={{width:size,height:size,borderRadius:'50%',backgroundColor:`${color}22`,border:`1px solid ${color}44`,
    display:'flex',alignItems:'center',justifyContent:'center',color,fontWeight:'bold',fontSize:size*0.38,flexShrink:0}}>
    {(nombre||'?').charAt(0).toUpperCase()}
  </div>
);

const validarRegistro = ({ nombre, apellido, email, pass, confirm }) => {
  if (!nombre.trim())           return 'El nombre es obligatorio.';
  if (!apellido.trim())         return 'El apellido es obligatorio.';
  if (!email.trim())            return 'El correo es obligatorio.';
  if (!validarEmail(email))     return 'Correo no válido.';
  if (!pass || pass.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  if (pass !== confirm)         return 'Las contraseñas no coinciden.';
  return null;
};

// ─── App principal ────────────────────────────────────────────────────────────
export default function Jobassistand() {
  const [usuario,   setUsuario]   = useState(() => { try { return JSON.parse(localStorage.getItem('session_usuario')); } catch { return null; } });
  const [modo,      setModo]      = useState('login'); // 'login' | 'register'
  const [errorMsg,  setErrorMsg]  = useState('');
  const [okMsg,     setOkMsg]     = useState('');
  const [form,      setForm]      = useState({ nombre:'', apellido:'', email:'', pass:'', confirm:'' });

  const limpiar = () => { setErrorMsg(''); setOkMsg(''); };
  const cambiarModo = m => { setModo(m); setForm({ nombre:'', apellido:'', email:'', pass:'', confirm:'' }); limpiar(); };

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    limpiar();
    const err = validarLogin(form);
    if (err) { setErrorMsg(err); return; }
    const user = await db.supervisores.where('email').equalsIgnoreCase(form.email.trim()).first();
    if (user && user.password === form.pass) {
      localStorage.setItem('session_usuario', JSON.stringify(user));
      setUsuario(user);
    } else {
      setErrorMsg('Correo o contraseña incorrectos.');
    }
  };

  // ── REGISTRO ADMIN ─────────────────────────────────────────────────────────
  const handleRegistro = async () => {
    limpiar();
    const err = validarRegistro(form);
    if (err) { setErrorMsg(err); return; }
    const existe = await db.supervisores.where('email').equalsIgnoreCase(form.email.trim()).first();
    if (existe) { setErrorMsg('Ya existe una cuenta con ese correo.'); return; }
    await db.supervisores.add({
      nombre: form.nombre.trim(), apellido: form.apellido.trim(),
      email: form.email.trim().toLowerCase(), password: form.pass,
      rol: 'admin', areaId: null,
    });
    setOkMsg('Cuenta creada. Ahora puedes ingresar.');
    cambiarModo('login');
  };

  const cerrarSesion = () => {
    localStorage.removeItem('session_usuario');
    setUsuario(null);
    setForm({ nombre:'', apellido:'', email:'', pass:'', confirm:'' });
    limpiar();
  };

  // ── PANTALLA LOGIN / REGISTRO ──────────────────────────────────────────────
  if (!usuario) return (
    <div style={s.bg}>
      <div style={s.loginCard}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <i className="bi bi-shield-lock" style={{fontSize:48,color:'#3b82f6'}}/>
          <h2 style={{color:'#fff',margin:'10px 0 4px',fontWeight:700,fontSize:22}}>
            JOB<span style={{color:'#3b82f6'}}>ASSISTAND</span>
          </h2>
          <p style={{color:'#6b7280',fontSize:13,margin:0}}>Sistema de asistencia</p>
        </div>

        {/* Tabs login / registro */}
        <div style={{display:'flex',backgroundColor:'rgba(255,255,255,0.04)',borderRadius:12,padding:4,marginBottom:20}}>
          {[['login','Ingresar'],['register','Crear cuenta']].map(([m,label])=>(
            <button key={m} onClick={()=>cambiarModo(m)} style={{
              flex:1, padding:'9px 0', border:'none', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:600,
              backgroundColor: modo===m ? '#3b82f6' : 'transparent',
              color: modo===m ? '#fff' : '#6b7280',
            }}>{label}</button>
          ))}
        </div>

        <Err msg={errorMsg}/>
        <Ok  msg={okMsg}/>

        {modo === 'register' && (
          <>
            <input placeholder="Nombre" style={s.input} value={form.nombre}
              onChange={e=>setForm({...form,nombre:e.target.value})} onFocus={limpiar}/>
            <input placeholder="Apellido" style={s.input} value={form.apellido}
              onChange={e=>setForm({...form,apellido:e.target.value})} onFocus={limpiar}/>
          </>
        )}
        <input type="email" placeholder="Correo electronico" style={s.input} value={form.email}
          onChange={e=>setForm({...form,email:e.target.value})} onFocus={limpiar}/>
        <input type="password" placeholder="Contrasena" style={s.input} value={form.pass}
          onChange={e=>setForm({...form,pass:e.target.value})} onFocus={limpiar}
          onKeyDown={e=>e.key==='Enter'&&modo==='login'&&handleLogin()}/>
        {modo === 'register' && (
          <input type="password" placeholder="Confirmar contrasena" style={s.input} value={form.confirm}
            onChange={e=>setForm({...form,confirm:e.target.value})} onFocus={limpiar}/>
        )}

        <button onClick={modo==='login'?handleLogin:handleRegistro} style={s.btnBlue}>
          {modo === 'login' ? 'Ingresar' : 'Crear Cuenta Admin'}
        </button>

        {modo === 'register' && (
          <p style={{color:'#4b5563',fontSize:11,textAlign:'center',marginTop:12}}>
            Las cuentas creadas aqui son de administrador.
          </p>
        )}
      </div>
    </div>
  );

  // ── INTERFAZ SEGÚN ROL ─────────────────────────────────────────────────────
  if (usuario.rol === 'admin') return (
    <AdminPanel usuario={usuario} onLogout={cerrarSesion}/>
  );

  if (usuario.rol === 'encargado') return (
    <EncargadoPanel usuario={usuario} onLogout={cerrarSesion}/>
  );

  return <div style={{color:'#fff',padding:40}}>Rol desconocido. <button onClick={cerrarSesion}>Salir</button></div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANEL ADMINISTRADOR
// ═══════════════════════════════════════════════════════════════════════════════
function AdminPanel({ usuario, onLogout }) {
  const [vista,        setVista]        = useState('dashboard');
  const [encargados,   setEncargados]   = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [areas,        setAreas]        = useState([]);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [okMsg,        setOkMsg]        = useState('');

  // Formularios
  const [fEnc,  setFEnc]  = useState({ nombre:'', apellido:'', email:'', pass:'', areaId:'' });
  const [fTrab, setFTrab] = useState({ nombre:'', apellido:'', telefono:'', curp:'', areaId:'', pagoPorHora:'' });
  const [fArea, setFArea] = useState({ nombre:'' });

  // Calendario
  const hoy = new Date();
  const [calMes,       setCalMes]       = useState(hoy.getMonth());
  const [calAnio,      setCalAnio]      = useState(hoy.getFullYear());
  const [diaSelec,     setDiaSelec]     = useState(null);
  const [asistDia,     setAsistDia]     = useState(null);
  const [diasConDatos, setDiasConDatos] = useState({});
  const [modalPersonal, setModalPersonal] = useState(false);

  // Reporte semanal
  const hoyR = new Date();
  const lunesDeEsta = new Date(hoyR);
  lunesDeEsta.setDate(hoyR.getDate() - ((hoyR.getDay()+6)%7));
  const fmtISO = d => d.toISOString().slice(0,10);
  const [repInicio, setRepInicio] = useState(fmtISO(lunesDeEsta));
  const [repFin,    setRepFin]    = useState(fmtISO(hoyR));
  const [repDatos,  setRepDatos]  = useState(null);
  const [repLoading,setRepLoading]= useState(false);

  const limpiar = () => { setErrorMsg(''); setOkMsg(''); };

  const recargar = async () => {
    setEncargados(await db.supervisores.where('rol').equals('encargado').toArray());
    setTrabajadores(await db.trabajadores.toArray());
    setAreas(await db.areas.toArray());
  };

  useEffect(() => { recargar(); }, [vista]);

  // Cargar puntos en calendario
  useEffect(() => {
    if (vista !== 'calendario') return;
    const cargar = async () => {
      const inicio = new Date(calAnio, calMes, 1).toISOString();
      const fin    = new Date(calAnio, calMes+1, 0, 23, 59, 59).toISOString();
      const regs   = await db.asistencias.where('fecha').between(inicio, fin, true, true).toArray();
      const mapa   = {};
      regs.forEach(r => { mapa[r.fecha.slice(0,10)] = true; });
      setDiasConDatos(mapa);
    };
    cargar();
  }, [vista, calMes, calAnio]);

  const abrirDia = async (anio, mes, dia) => {
    const inicio    = new Date(anio, mes, dia, 0,0,0).toISOString();
    const fin       = new Date(anio, mes, dia, 23,59,59).toISOString();
    const registros = await db.asistencias.where('fecha').between(inicio, fin, true, true).toArray();
    const todos     = (await db.trabajadores.toArray()).map(t => `${t.nombre} ${t.apellido}`);
    const presentes = registros.map(r => r.trabajadorId);
    const ausentes  = registros.length > 0 ? todos.filter(n => !presentes.includes(n)) : [];
    setAsistDia({ presentes, ausentes, lugar: registros[0]?.lugar || null, sinRegistro: registros.length === 0 });
    setDiaSelec({ anio, mes, dia });
  };

  // ── AGREGAR ÁREA ───────────────────────────────────────────────────────────
  const agregarArea = async () => {
    limpiar();
    if (!fArea.nombre.trim()) { setErrorMsg('El nombre del área es obligatorio.'); return; }
    await db.areas.add({ nombre: fArea.nombre.trim() });
    setFArea({ nombre:'' });
    setOkMsg('Área creada.');
    recargar();
  };

  // ── AGREGAR ENCARGADO ─────────────────────────────────────────────────────
  const agregarEncargado = async () => {
    limpiar();
    if (!fEnc.nombre.trim())    { setErrorMsg('Nombre obligatorio.'); return; }
    if (!fEnc.apellido.trim())  { setErrorMsg('Apellido obligatorio.'); return; }
    if (!fEnc.email.trim())     { setErrorMsg('Correo obligatorio.'); return; }
    if (!validarEmail(fEnc.email)) { setErrorMsg('Correo no válido.'); return; }
    if (!fEnc.pass || fEnc.pass.length < 6) { setErrorMsg('Contraseña mínimo 6 caracteres.'); return; }
    if (!fEnc.areaId)           { setErrorMsg('Asigna un área.'); return; }

    const existe = await db.supervisores.where('email').equalsIgnoreCase(fEnc.email.trim()).first();
    if (existe) { setErrorMsg('Ya existe una cuenta con ese correo.'); return; }

    await db.supervisores.add({
      nombre: fEnc.nombre.trim(), apellido: fEnc.apellido.trim(),
      email: fEnc.email.trim().toLowerCase(), password: fEnc.pass,
      rol: 'encargado', areaId: Number(fEnc.areaId),
    });
    setFEnc({ nombre:'', apellido:'', email:'', pass:'', areaId:'' });
    setOkMsg('Encargado registrado.');
    recargar();
  };

  // ── AGREGAR TRABAJADOR ────────────────────────────────────────────────────
  const agregarTrabajador = async () => {
    limpiar();
    if (!fTrab.nombre.trim())   { setErrorMsg('Nombre obligatorio.'); return; }
    if (!fTrab.apellido.trim()) { setErrorMsg('Apellido obligatorio.'); return; }
    if (!fTrab.areaId)          { setErrorMsg('Asigna un área.'); return; }

    await db.trabajadores.add({
      nombre: fTrab.nombre.trim(), apellido: fTrab.apellido.trim(),
      telefono: fTrab.telefono.trim(), curp: fTrab.curp.trim().toUpperCase(),
      areaId: Number(fTrab.areaId),
      pagoPorHora: fTrab.pagoPorHora ? Number(fTrab.pagoPorHora) : 0,
    });
    setFTrab({ nombre:'', apellido:'', telefono:'', curp:'', areaId:'', pagoPorHora:'' });
    setOkMsg('Trabajador registrado.');
    recargar();
  };

  const eliminarEncargado   = async id => { await db.supervisores.delete(id); recargar(); };
  const eliminarTrabajador  = async id => { await db.trabajadores.delete(id); recargar(); };
  const eliminarArea        = async id => { await db.areas.delete(id); recargar(); };

  const areaNombre = id => areas.find(a => a.id === Number(id))?.nombre || '—';

  // ── GENERAR REPORTE ────────────────────────────────────────────────────────
  const generarReporte = async () => {
    setRepLoading(true);
    setRepDatos(null);
    try {
      const inicio = new Date(repInicio + 'T00:00:00').toISOString();
      const fin    = new Date(repFin    + 'T23:59:59').toISOString();
      const regs   = await db.asistencias.where('fecha').between(inicio, fin, true, true).toArray();
      const trabs  = await db.trabajadores.toArray();
      const areasL = await db.areas.toArray();

      // Calcular dias laborables en el rango (lunes a sabado)
      const diasRango = [];
      const cur = new Date(repInicio + 'T12:00:00');
      const end = new Date(repFin    + 'T12:00:00');
      while (cur <= end) {
        if (cur.getDay() !== 0) diasRango.push(cur.toISOString().slice(0,10));
        cur.setDate(cur.getDate() + 1);
      }
      const totalDiasLab = diasRango.length;

      const filas = trabs.map(t => {
        const nombre   = `${t.nombre} ${t.apellido}`;
        const area     = areasL.find(a => a.id === Number(t.areaId));
        const diasPresente = new Set(
          regs.filter(r => r.trabajadorId === nombre).map(r => r.fecha.slice(0,10))
        ).size;
        const diasAusente  = Math.max(0, totalDiasLab - diasPresente);
        const pagoPorDia   = t.pagoPorHora ? Number(t.pagoPorHora) * 8 : 0;
        const totalPago    = diasPresente * pagoPorDia;
        return {
          nombre, area: area?.nombre || '—',
          presentes: diasPresente, ausentes: diasAusente,
          pagoPorDia, totalPago,
        };
      });

      setRepDatos({ filas, totalDiasLab, inicio: repInicio, fin: repFin });
    } finally {
      setRepLoading(false);
    }
  };

  const descargarPDF = () => {
    if (!repDatos) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Encabezado
    doc.setFillColor(11, 14, 20);
    doc.rect(0, 0, 297, 297, 'F');

    doc.setFontSize(20);
    doc.setTextColor(59, 130, 246);
    doc.text('JOBASSISTAND', 14, 18);
    doc.setFontSize(11);
    doc.setTextColor(200, 200, 200);
    doc.text('Reporte Semanal de Asistencias y Pagos', 14, 25);
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Periodo: ${repDatos.inicio}  al  ${repDatos.fin}   |   Dias laborables: ${repDatos.totalDiasLab}`, 14, 31);
    doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 14, 36);

    // Tabla
    const cols = ['Empleado', 'Area', 'Dias Presentes', 'Dias Ausentes', 'Pago/Dia (MXN)', 'Total (MXN)'];
    const rows = repDatos.filas.map(f => [
      f.nombre, f.area,
      f.presentes, f.ausentes,
      f.pagoPorDia > 0 ? `$${f.pagoPorDia.toFixed(2)}` : 'N/A',
      f.pagoPorDia > 0 ? `$${f.totalPago.toFixed(2)}` : 'N/A',
    ]);

    // Totales
    const totPresentes = repDatos.filas.reduce((a,f)=>a+f.presentes,0);
    const totAusentes  = repDatos.filas.reduce((a,f)=>a+f.ausentes,0);
    const totPago      = repDatos.filas.reduce((a,f)=>a+f.totalPago,0);
    rows.push(['TOTAL', '', totPresentes, totAusentes, '', `$${totPago.toFixed(2)}`]);

    doc.autoTable({
      startY: 42,
      head: [cols],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [148, 163, 184], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fillColor: [15, 23, 42], textColor: [226, 232, 240], fontSize: 8 },
      alternateRowStyles: { fillColor: [20, 30, 55] },
      footStyles: { fillColor: [30, 64, 175], textColor: [255,255,255], fontStyle: 'bold' },
      didParseCell: (data) => {
        if (data.row.index === rows.length - 1) {
          data.cell.styles.fillColor = [30, 64, 175];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 14, right: 14 },
    });

    const fecha = repDatos.inicio.replace(/-/g,'');
    doc.save(`reporte_asistencias_${fecha}.pdf`);
  };

  // ── RENDER ADMIN ──────────────────────────────────────────────────────────
  return (
    <div style={s.bg}>
      {/* Header */}
      <header style={s.header}>
        <div>
          <h1 style={{color:'#fff',fontSize:18,margin:0,fontWeight:700}}>
            JOB<span style={{color:'#3b82f6'}}>ASSISTAND</span>
          </h1>
          <span style={{color:'#6b7280',fontSize:11}}>Administrador</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:'#9ca3af',fontSize:12}}>{usuario.nombre}</span>
          <button onClick={onLogout} style={s.btnLogout}><i className="bi bi-box-arrow-right"/></button>
        </div>
      </header>

      {/* Contenido */}
      <main style={{padding:'10px 12px 90px'}}>

        {/* ── DASHBOARD ── */}
        {vista === 'dashboard' && (
          <div>
            <h2 style={s.pageTitle}>Dashboard</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
              <div style={{...s.statCard, cursor:'pointer'}} onClick={()=>setModalPersonal(true)}>
                <i className="bi bi-people" style={{fontSize:26,color:'#3b82f6'}}/>
                <div style={{color:'#fff',fontSize:22,fontWeight:700,margin:'6px 0 0'}}>{trabajadores.length}</div>
                <div style={{color:'#6b7280',fontSize:11}}>Empleados</div>
                <div style={{color:'#3b82f6',fontSize:10,marginTop:2}}>Ver lista</div>
              </div>
              <div style={s.statCard}>
                <i className="bi bi-person-badge" style={{fontSize:26,color:'#a78bfa'}}/>
                <div style={{color:'#fff',fontSize:22,fontWeight:700,margin:'6px 0 0'}}>{encargados.length}</div>
                <div style={{color:'#6b7280',fontSize:11}}>Encargados</div>
              </div>
              <div style={s.statCard}>
                <i className="bi bi-diagram-3" style={{fontSize:26,color:'#10b981'}}/>
                <div style={{color:'#fff',fontSize:22,fontWeight:700,margin:'6px 0 0'}}>{areas.length}</div>
                <div style={{color:'#6b7280',fontSize:11}}>Areas</div>
              </div>
              <div style={s.statCard}>
                <i className="bi bi-geo-alt" style={{fontSize:26,color:'#f59e0b'}}/>
                <div style={{color:'#fff',fontSize:14,fontWeight:700,margin:'6px 0 0'}}>GPS</div>
                <div style={{color:'#6b7280',fontSize:11}}>Activo</div>
              </div>
            </div>

            {/* Acciones rápidas */}
            <div style={s.card}>
              <h3 style={s.cardTitle}>Acciones rápidas</h3>
              {[
                { label:'Nueva Área',       icon:'bi-diagram-3',      v:'areas' },
                { label:'Nuevo Encargado',  icon:'bi-person-badge',   v:'encargados' },
                { label:'Nuevo Empleado',   icon:'bi-person-plus',    v:'trabajadores' },
              ].map(a=>(
                <button key={a.v} onClick={()=>{setVista(a.v);limpiar();}} style={{...s.btnBlue,marginBottom:8,display:'flex',justifyContent:'space-between'}}>
                  <span><i className={`bi ${a.icon}`} style={{marginRight:8}}/>{a.label}</span>
                  <i className="bi bi-chevron-right"/>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── ÁREAS ── */}
        {vista === 'areas' && (
          <div>
            <h2 style={s.pageTitle}>Areas de Trabajo</h2>
            <div style={s.card}>
              <h3 style={s.cardTitle}>Crear área</h3>
              <Err msg={errorMsg}/><Ok msg={okMsg}/>
              <input placeholder="Nombre del área" style={s.input}
                value={fArea.nombre} onChange={e=>setFArea({nombre:e.target.value})} onFocus={limpiar}/>
              <button onClick={agregarArea} style={s.btnBlue}>Crear Área</button>
            </div>
            <h3 style={{color:'#9ca3af',fontSize:12,margin:'16px 0 8px',textTransform:'uppercase',letterSpacing:1}}>
              Áreas registradas ({areas.length})
            </h3>
            {areas.map(a=>(
              <div key={a.id} style={s.listItem}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <Avatar nombre={a.nombre} color="#10b981"/>
                  <span style={{color:'#fff',fontWeight:500}}>{a.nombre}</span>
                </div>
                <button onClick={()=>eliminarArea(a.id)} style={s.btnDanger}>
                  <i className="bi bi-trash3"/>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── ENCARGADOS ── */}
        {vista === 'encargados' && (
          <div>
            <h2 style={s.pageTitle}>Encargados</h2>
            <div style={s.card}>
              <h3 style={s.cardTitle}>Registrar encargado</h3>
              <Err msg={errorMsg}/><Ok msg={okMsg}/>
              <input placeholder="Nombre" style={s.input} value={fEnc.nombre}
                onChange={e=>setFEnc({...fEnc,nombre:e.target.value})} onFocus={limpiar}/>
              <input placeholder="Apellido" style={s.input} value={fEnc.apellido}
                onChange={e=>setFEnc({...fEnc,apellido:e.target.value})} onFocus={limpiar}/>
              <input type="email" placeholder="Correo" style={s.input} value={fEnc.email}
                onChange={e=>setFEnc({...fEnc,email:e.target.value})} onFocus={limpiar}/>
              <input type="password" placeholder="Contrasena (min 6)" style={s.input} value={fEnc.pass}
                onChange={e=>setFEnc({...fEnc,pass:e.target.value})} onFocus={limpiar}/>
              <select style={s.select} value={fEnc.areaId}
                onChange={e=>setFEnc({...fEnc,areaId:e.target.value})} onFocus={limpiar}>
                <option value="">-- Asignar Area --</option>
                {areas.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
              <button onClick={agregarEncargado} style={s.btnBlue}>Registrar Encargado</button>
            </div>
            <h3 style={{color:'#9ca3af',fontSize:12,margin:'16px 0 8px',textTransform:'uppercase',letterSpacing:1}}>
              Encargados registrados ({encargados.length})
            </h3>
            {encargados.map(e=>(
              <div key={e.id} style={s.listItem}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <Avatar nombre={e.nombre} color="#a78bfa"/>
                  <div>
                    <div style={{color:'#fff',fontWeight:500,fontSize:14}}>{e.nombre} {e.apellido}</div>
                    <div style={{color:'#6b7280',fontSize:11}}>{e.email}</div>
                    <div style={{color:'#a78bfa',fontSize:11}}>
                      <i className="bi bi-diagram-3" style={{marginRight:4}}/>
                      {areaNombre(e.areaId)}
                    </div>
                  </div>
                </div>
                <button onClick={()=>eliminarEncargado(e.id)} style={s.btnDanger}>
                  <i className="bi bi-trash3"/>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── TRABAJADORES ── */}
        {vista === 'trabajadores' && (
          <div>
            <h2 style={s.pageTitle}>Empleados</h2>
            <div style={s.card}>
              <h3 style={s.cardTitle}>Registrar empleado</h3>
              <Err msg={errorMsg}/><Ok msg={okMsg}/>
              <input placeholder="Nombre" style={s.input} value={fTrab.nombre}
                onChange={e=>setFTrab({...fTrab,nombre:e.target.value})} onFocus={limpiar}/>
              <input placeholder="Apellido" style={s.input} value={fTrab.apellido}
                onChange={e=>setFTrab({...fTrab,apellido:e.target.value})} onFocus={limpiar}/>
              <input placeholder="Telefono (opcional)" style={s.input} value={fTrab.telefono}
                onChange={e=>setFTrab({...fTrab,telefono:e.target.value})} onFocus={limpiar}/>
              <input placeholder="CURP (opcional)" style={s.input} value={fTrab.curp}
                onChange={e=>setFTrab({...fTrab,curp:e.target.value})} onFocus={limpiar}/>
              <select style={s.select} value={fTrab.areaId}
                onChange={e=>setFTrab({...fTrab,areaId:e.target.value})} onFocus={limpiar}>
                <option value="">-- Asignar Area --</option>
                {areas.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
              <input type="number" placeholder="Pago por hora en MXN (opcional)" style={s.input} value={fTrab.pagoPorHora}
                onChange={e=>setFTrab({...fTrab,pagoPorHora:e.target.value})} onFocus={limpiar}/>
              <button onClick={agregarTrabajador} style={s.btnBlue}>Registrar Empleado</button>
            </div>
            <h3 style={{color:'#9ca3af',fontSize:12,margin:'16px 0 8px',textTransform:'uppercase',letterSpacing:1}}>
              Empleados registrados ({trabajadores.length})
            </h3>
            {trabajadores.map(t=>(
              <div key={t.id} style={s.listItem}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <Avatar nombre={t.nombre} color="#3b82f6"/>
                  <div>
                    <div style={{color:'#fff',fontWeight:500,fontSize:14}}>{t.nombre} {t.apellido}</div>
                    {t.curp && <div style={{color:'#6b7280',fontSize:11}}>CURP: {t.curp}</div>}
                    <div style={{color:'#3b82f6',fontSize:11}}>
                      <i className="bi bi-diagram-3" style={{marginRight:4}}/>
                      {areaNombre(t.areaId)}
                    </div>
                  </div>
                </div>
                <button onClick={()=>eliminarTrabajador(t.id)} style={s.btnDanger}>
                  <i className="bi bi-trash3"/>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── CALENDARIO ADMIN ── */}
        {vista === 'calendario' && (
          <CalendarioVista
            calMes={calMes} setCalMes={setCalMes}
            calAnio={calAnio} setCalAnio={setCalAnio}
            diaSelec={diaSelec} setDiaSelec={setDiaSelec}
            asistDia={asistDia} diasConDatos={diasConDatos}
            abrirDia={abrirDia}
          />
        )}

        {/* ── REPORTE SEMANAL ── */}
        {vista === 'reporte' && (
          <div>
            <h2 style={s.pageTitle}>Reporte Semanal</h2>

            {/* Selector de fechas */}
            <div style={s.card}>
              <h3 style={s.cardTitle}>Rango de fechas</h3>
              <div style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:120}}>
                  <label style={{color:'#9ca3af',fontSize:11,display:'block',marginBottom:4}}>Desde</label>
                  <input type="date" style={{...s.input,marginBottom:0}} value={repInicio}
                    onChange={e=>setRepInicio(e.target.value)}/>
                </div>
                <div style={{flex:1,minWidth:120}}>
                  <label style={{color:'#9ca3af',fontSize:11,display:'block',marginBottom:4}}>Hasta</label>
                  <input type="date" style={{...s.input,marginBottom:0}} value={repFin}
                    onChange={e=>setRepFin(e.target.value)}/>
                </div>
              </div>
              <button onClick={generarReporte} style={{...s.btnBlue, opacity: repLoading?0.6:1}} disabled={repLoading}>
                <i className="bi bi-bar-chart-line" style={{marginRight:8}}/>
                {repLoading ? 'Generando...' : 'Generar Reporte'}
              </button>
            </div>

            {/* Resultados */}
            {repDatos && (
              <>
                {/* Resumen cards */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
                  <div style={{...s.statCard,padding:12}}>
                    <i className="bi bi-check-circle" style={{color:'#10b981',fontSize:20}}/>
                    <div style={{color:'#fff',fontSize:18,fontWeight:700,margin:'4px 0 0'}}>
                      {repDatos.filas.reduce((a,f)=>a+f.presentes,0)}
                    </div>
                    <div style={{color:'#6b7280',fontSize:10}}>Asistencias</div>
                  </div>
                  <div style={{...s.statCard,padding:12}}>
                    <i className="bi bi-x-circle" style={{color:'#ef4444',fontSize:20}}/>
                    <div style={{color:'#fff',fontSize:18,fontWeight:700,margin:'4px 0 0'}}>
                      {repDatos.filas.reduce((a,f)=>a+f.ausentes,0)}
                    </div>
                    <div style={{color:'#6b7280',fontSize:10}}>Inasistencias</div>
                  </div>
                  <div style={{...s.statCard,padding:12}}>
                    <i className="bi bi-cash" style={{color:'#f59e0b',fontSize:20}}/>
                    <div style={{color:'#fff',fontSize:14,fontWeight:700,margin:'4px 0 0'}}>
                      ${repDatos.filas.reduce((a,f)=>a+f.totalPago,0).toLocaleString('es-MX',{minimumFractionDigits:0,maximumFractionDigits:0})}
                    </div>
                    <div style={{color:'#6b7280',fontSize:10}}>Total MXN</div>
                  </div>
                </div>

                {/* Tabla por empleado */}
                <div style={{...s.card,padding:0,overflow:'hidden'}}>
                  <div style={{padding:'14px 16px',borderBottom:'1px solid #1f2937'}}>
                    <h3 style={{color:'#fff',margin:0,fontSize:14}}>Detalle por empleado</h3>
                    <p style={{color:'#6b7280',fontSize:11,margin:'2px 0 0'}}>
                      {repDatos.totalDiasLab} dias laborables (lun-sab)
                    </p>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    {repDatos.filas.length === 0 ? (
                      <p style={{color:'#6b7280',textAlign:'center',padding:20}}>No hay empleados registrados.</p>
                    ) : repDatos.filas.map((f,i) => (
                      <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                        padding:'12px 16px',borderBottom:'1px solid #1f2937',
                        backgroundColor: i%2===0?'transparent':'rgba(255,255,255,0.01)'}}>
                        <div style={{flex:2,minWidth:100}}>
                          <div style={{color:'#fff',fontSize:13,fontWeight:500}}>{f.nombre}</div>
                          <div style={{color:'#3b82f6',fontSize:11}}>{f.area}</div>
                        </div>
                        <div style={{display:'flex',gap:16,alignItems:'center'}}>
                          <div style={{textAlign:'center'}}>
                            <div style={{color:'#10b981',fontWeight:700,fontSize:15}}>{f.presentes}</div>
                            <div style={{color:'#6b7280',fontSize:9}}>presentes</div>
                          </div>
                          <div style={{textAlign:'center'}}>
                            <div style={{color:'#ef4444',fontWeight:700,fontSize:15}}>{f.ausentes}</div>
                            <div style={{color:'#6b7280',fontSize:9}}>ausentes</div>
                          </div>
                          <div style={{textAlign:'center',minWidth:60}}>
                            <div style={{color:'#f59e0b',fontWeight:700,fontSize:13}}>
                              {f.pagoPorDia>0 ? `$${f.totalPago.toLocaleString('es-MX',{minimumFractionDigits:0})}` : 'N/A'}
                            </div>
                            <div style={{color:'#6b7280',fontSize:9}}>total</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botón PDF */}
                <button onClick={descargarPDF}
                  style={{...s.btnBlue,backgroundColor:'#dc2626',marginTop:14,display:'flex',justifyContent:'center',alignItems:'center',gap:8}}>
                  <i className="bi bi-file-earmark-pdf"/>
                  Descargar PDF
                </button>

                <p style={{color:'#4b5563',fontSize:11,textAlign:'center',marginTop:8}}>
                  * El pago se calcula con el campo "Pago por hora" de cada empleado x 8 hrs/dia
                </p>
              </>
            )}
          </div>
        )}

      </main>

      {/* Nav inferior */}
      <nav style={s.nav}>
        {[
          { v:'dashboard',    icon:'bi-house-door' },
          { v:'areas',        icon:'bi-diagram-3' },
          { v:'encargados',   icon:'bi-person-badge' },
          { v:'trabajadores', icon:'bi-people' },
          { v:'calendario',   icon:'bi-calendar3' },
          { v:'reporte',      icon:'bi-file-earmark-bar-graph' },
        ].map(n=>(
          <div key={n.v} style={s.navItem} onClick={()=>{setVista(n.v);limpiar();setRepDatos(null);}}>
            <i className={`bi ${n.icon}`} style={{color: vista===n.v ? '#3b82f6' : '#6b7280', fontSize:20}}/>
          </div>
        ))}
      </nav>

      {/* Modal lista de personal */}
      {modalPersonal && (
        <div style={s.overlay} onClick={()=>setModalPersonal(false)}>
          <div style={s.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h3 style={{color:'#fff',margin:0}}>
                <i className="bi bi-people" style={{color:'#3b82f6',marginRight:8}}/>
                Empleados ({trabajadores.length})
              </h3>
              <button onClick={()=>setModalPersonal(false)} style={{background:'none',border:'none',color:'#9ca3af',fontSize:20,cursor:'pointer'}}>
                <i className="bi bi-x-lg"/>
              </button>
            </div>
            <div style={{maxHeight:'60vh',overflowY:'auto'}}>
              {trabajadores.map(t=>(
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid #1f2937'}}>
                  <Avatar nombre={t.nombre}/>
                  <div>
                    <div style={{color:'#fff',fontWeight:500}}>{t.nombre} {t.apellido}</div>
                    <div style={{color:'#3b82f6',fontSize:11}}>
                      <i className="bi bi-diagram-3" style={{marginRight:4}}/>
                      {areaNombre(t.areaId)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANEL ENCARGADO
// ═══════════════════════════════════════════════════════════════════════════════
function EncargadoPanel({ usuario, onLogout }) {
  const [vista,        setVista]        = useState('lista');
  const [trabajadores, setTrabajadores] = useState([]);
  const [area,         setArea]         = useState(null);
  const [seleccionados,setSeleccionados]= useState({});
  const [loading,      setLoading]      = useState(false);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [okMsg,        setOkMsg]        = useState('');
  const [faltantes,    setFaltantes]    = useState([]);
  const [lugarResumen, setLugarResumen] = useState('');
  const [coordsResumen,setCoordsResumen]= useState(null);

  // Calendario
  const hoy = new Date();
  const [calMes,       setCalMes]       = useState(hoy.getMonth());
  const [calAnio,      setCalAnio]      = useState(hoy.getFullYear());
  const [diaSelec,     setDiaSelec]     = useState(null);
  const [asistDia,     setAsistDia]     = useState(null);
  const [diasConDatos, setDiasConDatos] = useState({});

  const limpiar = () => { setErrorMsg(''); setOkMsg(''); };

  useEffect(() => {
    const cargar = async () => {
      const areaObj = await db.areas.get(usuario.areaId);
      setArea(areaObj);
      const trabs = await db.trabajadores.where('areaId').equals(usuario.areaId).toArray();
      setTrabajadores(trabs);
    };
    cargar();
  }, [vista]);

  useEffect(() => {
    if (vista !== 'calendario') return;
    const cargar = async () => {
      const inicio = new Date(calAnio, calMes, 1).toISOString();
      const fin    = new Date(calAnio, calMes+1, 0, 23, 59, 59).toISOString();
      const regs   = await db.asistencias
        .where('fecha').between(inicio, fin, true, true).toArray();
      const filtered = regs.filter(r => r.areaId === usuario.areaId);
      const mapa = {};
      filtered.forEach(r => { mapa[r.fecha.slice(0,10)] = true; });
      setDiasConDatos(mapa);
    };
    cargar();
  }, [vista, calMes, calAnio]);

  const abrirDia = async (anio, mes, dia) => {
    const inicio    = new Date(anio, mes, dia, 0,0,0).toISOString();
    const fin       = new Date(anio, mes, dia, 23,59,59).toISOString();
    const registros = (await db.asistencias.where('fecha').between(inicio, fin, true, true).toArray())
      .filter(r => r.areaId === usuario.areaId);
    const todos     = trabajadores.map(t => `${t.nombre} ${t.apellido}`);
    const presentes = registros.map(r => r.trabajadorId);
    const ausentes  = registros.length > 0 ? todos.filter(n => !presentes.includes(n)) : [];
    setAsistDia({ presentes, ausentes, lugar: registros[0]?.lugar || null, sinRegistro: registros.length === 0 });
    setDiaSelec({ anio, mes, dia });
  };

  // ── PASE DE LISTA ─────────────────────────────────────────────────────────
  const confirmarAsistencia = async () => {
    limpiar();
    const presentes = trabajadores.filter(t => seleccionados[t.id]);
    if (presentes.length === 0) { setErrorMsg('Selecciona al menos un trabajador.'); return; }

    setLoading(true);
    try {
      let lat = null, lng = null, nombreLugar = 'Sin GPS';

      try {
        const coords = await new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(
            p => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
            rej, { timeout: 5000, enableHighAccuracy: true }
          );
        });
        lat = coords.lat; lng = coords.lng;

        if (navigator.onLine) {
          try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
            const d = await r.json();
            nombreLugar = d.display_name;
          } catch { nombreLugar = `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
        } else {
          nombreLugar = `${lat.toFixed(5)}, ${lng.toFixed(5)} (sin internet)`;
        }
      } catch { console.warn('GPS no disponible'); }

      const registros = presentes.map(t => ({
        trabajadorId: `${t.nombre} ${t.apellido}`,
        fecha: new Date().toISOString(),
        lat, lng, lugar: nombreLugar,
        areaId: usuario.areaId,
        sincronizado: 0,
      }));

      await db.asistencias.bulkAdd(registros);

      if (navigator.onLine) {
        try {
          await fetch('https://jobasisitand-backend.onrender.com/api/asistencia', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registros),
          });
        } catch { console.warn('Backend inalcanzable'); }
      }

      setLugarResumen(nombreLugar);
      setCoordsResumen(lat && lng ? { lat, lng } : null);
      setFaltantes(trabajadores.filter(t => !seleccionados[t.id]));
      setSeleccionados({});
      setVista('resumen');
    } catch (err) {
      setErrorMsg('Error al registrar asistencia.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.bg}>
      {/* Header */}
      <header style={s.header}>
        <div>
          <h1 style={{color:'#fff',fontSize:18,margin:0,fontWeight:700}}>
            JOB<span style={{color:'#3b82f6'}}>ASSISTAND</span>
          </h1>
          <span style={{color:'#10b981',fontSize:11}}>
            Encargado · {area?.nombre || '—'}
          </span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:'#9ca3af',fontSize:12}}>{usuario.nombre}</span>
          <button onClick={onLogout} style={s.btnLogout}><i className="bi bi-box-arrow-right"/></button>
        </div>
      </header>

      <main style={{padding:'10px 12px 90px'}}>

        {/* ── PASE DE LISTA ── */}
        {vista === 'lista' && (
          <div>
            <h2 style={s.pageTitle}>Pase de Lista</h2>
            {area && (
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,backgroundColor:'rgba(16,185,129,0.07)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:12,padding:'10px 14px'}}>
                <i className="bi bi-diagram-3" style={{color:'#10b981'}}/>
                <span style={{color:'#10b981',fontSize:13,fontWeight:600}}>Area: {area.nombre}</span>
              </div>
            )}
            <Err msg={errorMsg}/>
            {trabajadores.length === 0 ? (
              <div style={{...s.card,textAlign:'center',color:'#6b7280'}}>
                <i className="bi bi-people" style={{fontSize:36,marginBottom:10}}/>
                <p>No hay empleados en tu area.</p>
              </div>
            ) : (
              <>
                {trabajadores.map(t => (
                  <div key={t.id} style={{...s.listItem, cursor:'pointer'}}
                    onClick={()=>setSeleccionados({...seleccionados,[t.id]:!seleccionados[t.id]})}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <Avatar nombre={t.nombre} color={seleccionados[t.id]?'#10b981':'#6b7280'}/>
                      <div>
                        <div style={{color:seleccionados[t.id]?'#fff':'#9ca3af',fontWeight:500,fontSize:14}}>
                          {t.nombre} {t.apellido}
                        </div>
                        {t.curp && <div style={{color:'#4b5563',fontSize:11}}>CURP: {t.curp}</div>}
                      </div>
                    </div>
                    <div style={{
                      width:24,height:24,borderRadius:6,
                      backgroundColor: seleccionados[t.id] ? '#10b981' : 'rgba(255,255,255,0.05)',
                      border: seleccionados[t.id] ? '2px solid #10b981' : '2px solid #374151',
                      display:'flex',alignItems:'center',justifyContent:'center',
                    }}>
                      {seleccionados[t.id] && <i className="bi bi-check" style={{color:'#fff',fontSize:14,fontWeight:'bold'}}/>}
                    </div>
                  </div>
                ))}
                <button
                  style={{...s.btnGreen, opacity: loading ? 0.6 : 1, marginTop:12}}
                  onClick={confirmarAsistencia} disabled={loading}>
                  {loading ? 'Registrando...' : 'Confirmar Asistencia'}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── RESUMEN ── */}
        {vista === 'resumen' && (
          <div>
            <div style={{textAlign:'center',marginBottom:20}}>
              <i className="bi bi-check-circle" style={{fontSize:54,color:'#10b981'}}/>
              <h3 style={{color:'#fff',marginTop:10}}>Asistencia registrada</h3>
            </div>
            {lugarResumen && (
              <div style={{backgroundColor:'rgba(16,185,129,0.07)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:14,padding:'14px 16px',marginBottom:14,display:'flex',gap:10,alignItems:'flex-start'}}>
                <i className="bi bi-geo-alt-fill" style={{color:'#10b981',fontSize:18,flexShrink:0,marginTop:2}}/>
                <div>
                  <div style={{color:'#9ca3af',fontSize:10,textTransform:'uppercase',letterSpacing:0.5,marginBottom:3}}>Ubicacion del registro</div>
                  <div style={{color:'#fff',fontSize:12,lineHeight:1.4}}>{lugarResumen}</div>
                  {coordsResumen && <div style={{color:'#4b5563',fontSize:10,marginTop:3}}>{coordsResumen.lat.toFixed(6)}, {coordsResumen.lng.toFixed(6)}</div>}
                </div>
              </div>
            )}
            {faltantes.length > 0 && (
              <>
                <p style={{color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Ausentes</p>
                {faltantes.map(f=>(
                  <div key={f.id} style={{...s.listItem,borderColor:'rgba(239,68,68,0.3)',backgroundColor:'rgba(239,68,68,0.05)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <Avatar nombre={f.nombre} color="#ef4444"/>
                      <span style={{color:'#ef4444',fontSize:14}}>{f.nombre} {f.apellido}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
            {faltantes.length === 0 && <p style={{color:'#10b981',textAlign:'center'}}>Asistencia completa</p>}
            <button style={{...s.btnBlue,marginTop:16}} onClick={()=>setVista('lista')}>Volver</button>
          </div>
        )}

        {/* ── CALENDARIO ENCARGADO ── */}
        {vista === 'calendario' && (
          <CalendarioVista
            calMes={calMes} setCalMes={setCalMes}
            calAnio={calAnio} setCalAnio={setCalAnio}
            diaSelec={diaSelec} setDiaSelec={setDiaSelec}
            asistDia={asistDia} diasConDatos={diasConDatos}
            abrirDia={abrirDia}
          />
        )}

      </main>

      {/* Nav inferior */}
      <nav style={s.nav}>
        {[
          { v:'lista',      icon:'bi-clipboard-check' },
          { v:'calendario', icon:'bi-calendar3' },
        ].map(n=>(
          <div key={n.v} style={s.navItem} onClick={()=>{setVista(n.v);limpiar();}}>
            <i className={`bi ${n.icon}`} style={{color: vista===n.v ? '#3b82f6' : '#6b7280', fontSize:22}}/>
          </div>
        ))}
      </nav>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDARIO — componente compartido
// ═══════════════════════════════════════════════════════════════════════════════
function CalendarioVista({ calMes, setCalMes, calAnio, setCalAnio, diaSelec, setDiaSelec, asistDia, diasConDatos, abrirDia }) {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dias  = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
  const hoy   = new Date();
  const primerDia = new Date(calAnio, calMes, 1).getDay();
  const totalDias = new Date(calAnio, calMes+1, 0).getDate();
  const celdas    = Array(primerDia).fill(null).concat(Array.from({length:totalDias},(_,i)=>i+1));
  while (celdas.length % 7 !== 0) celdas.push(null);

  return (
    <div>
      <h2 style={s.pageTitle}>Calendario</h2>

      {/* Navegacion mes */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,backgroundColor:'rgba(255,255,255,0.03)',borderRadius:14,padding:'10px 16px',border:'1px solid #1f2937'}}>
        <button onClick={()=>{ if(calMes===0){setCalMes(11);setCalAnio(calAnio-1);}else setCalMes(calMes-1); setDiaSelec(null); }}
          style={{background:'none',border:'none',color:'#9ca3af',fontSize:20,cursor:'pointer',padding:'4px 8px'}}>
          <i className="bi bi-chevron-left"/>
        </button>
        <span style={{color:'#fff',fontWeight:600,fontSize:16}}>{meses[calMes]} {calAnio}</span>
        <button onClick={()=>{ if(calMes===11){setCalMes(0);setCalAnio(calAnio+1);}else setCalMes(calMes+1); setDiaSelec(null); }}
          style={{background:'none',border:'none',color:'#9ca3af',fontSize:20,cursor:'pointer',padding:'4px 8px'}}>
          <i className="bi bi-chevron-right"/>
        </button>
      </div>

      {/* Cambio rapido de año */}
      <div style={{display:'flex',justifyContent:'center',gap:10,marginBottom:12}}>
        <button onClick={()=>{setCalAnio(calAnio-1);setDiaSelec(null);}}
          style={{background:'rgba(255,255,255,0.04)',border:'1px solid #374151',color:'#9ca3af',borderRadius:8,padding:'4px 12px',cursor:'pointer',fontSize:12}}>
          {calAnio-1}
        </button>
        <span style={{color:'#4b5563',fontSize:12,alignSelf:'center'}}>{calAnio}</span>
        <button onClick={()=>{setCalAnio(calAnio+1);setDiaSelec(null);}}
          style={{background:'rgba(255,255,255,0.04)',border:'1px solid #374151',color:'#9ca3af',borderRadius:8,padding:'4px 12px',cursor:'pointer',fontSize:12}}>
          {calAnio+1}
        </button>
      </div>

      {/* Cabecera dias */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',marginBottom:6}}>
        {dias.map(d=>(
          <div key={d} style={{textAlign:'center',color:'#6b7280',fontSize:11,fontWeight:600,padding:'4px 0'}}>{d}</div>
        ))}
      </div>

      {/* Celdas */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
        {celdas.map((dia,i)=>{
          if (!dia) return <div key={`v-${i}`}/>;
          const clave      = `${calAnio}-${String(calMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
          const tieneDatos = diasConDatos[clave];
          const esHoy      = dia===hoy.getDate() && calMes===hoy.getMonth() && calAnio===hoy.getFullYear();
          const selec      = diaSelec && diaSelec.dia===dia && diaSelec.mes===calMes && diaSelec.anio===calAnio;
          return (
            <div key={dia} onClick={()=>abrirDia(calAnio,calMes,dia)}
              style={{textAlign:'center',padding:'10px 0',borderRadius:10,cursor:'pointer',
                backgroundColor: selec?'#3b82f6':esHoy?'rgba(59,130,246,0.15)':'rgba(255,255,255,0.02)',
                border: esHoy&&!selec?'1px solid rgba(59,130,246,0.4)':'1px solid transparent',
                color: selec?'#fff':'#e5e7eb', fontWeight: esHoy||selec?'700':'400', fontSize:14}}>
              {dia}
              {tieneDatos && <div style={{width:5,height:5,borderRadius:'50%',backgroundColor:selec?'#fff':'#10b981',margin:'2px auto 0'}}/>}
            </div>
          );
        })}
      </div>

      {/* Detalle del dia */}
      {diaSelec && asistDia && (
        <div style={{marginTop:16,backgroundColor:'rgba(255,255,255,0.03)',border:'1px solid #1f2937',borderRadius:18,padding:18}}>
          <h4 style={{color:'#fff',margin:'0 0 12px',fontSize:14}}>
            <i className="bi bi-calendar-event" style={{color:'#3b82f6',marginRight:8}}/>
            {String(diaSelec.dia).padStart(2,'0')}/{String(diaSelec.mes+1).padStart(2,'0')}/{diaSelec.anio}
          </h4>

          {asistDia.sinRegistro ? (
            <p style={{color:'#4b5563',textAlign:'center',fontSize:13}}>Sin registros para este dia.</p>
          ) : (
            <>
              {asistDia.lugar && (
                <div style={{display:'flex',gap:8,alignItems:'flex-start',backgroundColor:'rgba(16,185,129,0.07)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:10,padding:10,marginBottom:12}}>
                  <i className="bi bi-geo-alt-fill" style={{color:'#10b981',fontSize:13,flexShrink:0,marginTop:2}}/>
                  <span style={{color:'#9ca3af',fontSize:11,lineHeight:1.4}}>{asistDia.lugar}</span>
                </div>
              )}
              {asistDia.presentes.length > 0 && (
                <>
                  <p style={{color:'#10b981',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:0.5,margin:'0 0 8px'}}>
                    <i className="bi bi-check-circle" style={{marginRight:5}}/>
                    Presentes ({asistDia.presentes.length})
                  </p>
                  {asistDia.presentes.map((n,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                      <Avatar nombre={n} color="#10b981" size={28}/>
                      <span style={{color:'#d1d5db',fontSize:13}}>{n}</span>
                    </div>
                  ))}
                </>
              )}
              {asistDia.ausentes.length > 0 && (
                <>
                  <p style={{color:'#ef4444',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:0.5,margin:'14px 0 8px'}}>
                    <i className="bi bi-x-circle" style={{marginRight:5}}/>
                    Ausentes ({asistDia.ausentes.length})
                  </p>
                  {asistDia.ausentes.map((n,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                      <Avatar nombre={n} color="#ef4444" size={28}/>
                      <span style={{color:'#9ca3af',fontSize:13}}>{n}</span>
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESTILOS GLOBALES
// ═══════════════════════════════════════════════════════════════════════════════
const s = {
  bg:        { backgroundColor:'#0B0E14', minHeight:'100vh', fontFamily:'system-ui,sans-serif', color:'#fff' },
  loginCard: { backgroundColor:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:24, padding:28, margin:'60px auto 0', maxWidth:380, boxShadow:'0 20px 40px rgba(0,0,0,0.4)' },
  header:    { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px', borderBottom:'1px solid #1f2937', position:'sticky', top:0, backgroundColor:'#0B0E14', zIndex:10 },
  pageTitle: { color:'#fff', fontSize:22, margin:'0 0 14px', fontWeight:700 },
  card:      { backgroundColor:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:20, padding:20, marginBottom:14 },
  cardTitle: { color:'#fff', fontSize:15, margin:'0 0 14px', fontWeight:600 },
  statCard:  { backgroundColor:'rgba(255,255,255,0.03)', border:'1px solid #1f2937', borderRadius:18, padding:14, textAlign:'center' },
  listItem:  { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'13px 14px', backgroundColor:'rgba(255,255,255,0.02)', marginBottom:8, borderRadius:14, border:'1px solid #1f2937' },
  input:     { width:'100%', padding:'13px 14px', marginBottom:12, borderRadius:11, border:'1px solid #374151', backgroundColor:'#111827', color:'white', boxSizing:'border-box', fontSize:14, outline:'none' },
  select:    { width:'100%', padding:'13px 14px', marginBottom:12, borderRadius:11, border:'1px solid #374151', backgroundColor:'#111827', color:'white', boxSizing:'border-box', fontSize:14, outline:'none' },
  btnBlue:   { width:'100%', padding:'13px', backgroundColor:'#3b82f6', color:'white', border:'none', borderRadius:11, cursor:'pointer', fontWeight:700, fontSize:14 },
  btnGreen:  { width:'100%', padding:'15px', backgroundColor:'#10b981', color:'white', border:'none', borderRadius:11, cursor:'pointer', fontWeight:700, fontSize:15 },
  btnDanger: { background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444', borderRadius:8, padding:'7px 10px', cursor:'pointer', flexShrink:0 },
  btnLogout: { background:'rgba(255,255,255,0.06)', border:'1px solid #374151', color:'#9ca3af', borderRadius:8, padding:'6px 10px', cursor:'pointer' },
  nav:       { position:'fixed', bottom:0, width:'100%', height:64, backgroundColor:'rgba(11,14,20,0.95)', backdropFilter:'blur(10px)', display:'flex', borderTop:'1px solid #1f2937', justifyContent:'space-around', alignItems:'center', zIndex:100 },
  navItem:   { cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 16px' },
  errBanner: { backgroundColor:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', color:'#fca5a5', borderRadius:10, padding:'11px 14px', marginBottom:13, fontSize:13, display:'flex', alignItems:'center' },
  okBanner:  { backgroundColor:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', color:'#6ee7b7', borderRadius:10, padding:'11px 14px', marginBottom:13, fontSize:13, display:'flex', alignItems:'center' },
  overlay:   { position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' },
  modalBox:  { backgroundColor:'#111827', border:'1px solid #1f2937', borderRadius:'22px 22px 0 0', padding:22, width:'100%', maxWidth:500 },
};
