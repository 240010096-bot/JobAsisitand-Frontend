import React, { useState, useEffect, useRef } from 'react';
import { db } from './db';

// ─── Validaciones ─────────────────────────────────────────────────────────────
const validarEmail  = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const validarLogin  = ({ email, pass }) => {
  if (!email.trim())        return 'El correo es obligatorio.';
  if (!validarEmail(email)) return 'Correo no válido.';
  if (!pass)                return 'La contraseña es obligatoria.';
  return null;
};
const validarRegistro = ({ nombre, apellido, email, pass, confirm }) => {
  if (!nombre.trim())           return 'El nombre es obligatorio.';
  if (!apellido.trim())         return 'El apellido es obligatorio.';
  if (!email.trim())            return 'El correo es obligatorio.';
  if (!validarEmail(email))     return 'Correo no válido.';
  if (!pass || pass.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  if (pass !== confirm)         return 'Las contraseñas no coinciden.';
  return null;
};

const validarTelefono = (tel) => {
  if (!tel) return true;
  return /^\d{10}$/.test(tel);
};
const validarCURP = (curp) => {
  if (!curp) return true;
  const regex = /^[A-Z]{4}\d{6}[A-Z]{6}\d{2}$/;
  return regex.test(curp.toUpperCase());
};

// ─── Helpers tiempo ───────────────────────────────────────────────────────────
const hhmm = iso => {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
};
const horasDiff = (isoEntrada, isoSalida) => {
  if (!isoEntrada || !isoSalida) return 0;
  return Math.max(0, (new Date(isoSalida) - new Date(isoEntrada)) / 3_600_000);
};
const isoHoy = () => new Date().toISOString().slice(0, 10);

const inicioDiaLocal = (anio, mes, dia) => {
  const d = new Date(anio, mes, dia, 0, 0, 0, 0);
  return d.toISOString();
};
const finDiaLocal = (anio, mes, dia) => {
  const d = new Date(anio, mes, dia, 23, 59, 59, 999);
  return d.toISOString();
};

// ─── Componentes pequeños ─────────────────────────────────────────────────────
const Err = ({ msg }) => msg ? (
  <div style={s.errBanner}><i className="bi bi-exclamation-triangle-fill" style={{ marginRight: 7 }} />{msg}</div>
) : null;
const Ok = ({ msg }) => msg ? (
  <div style={s.okBanner}><i className="bi bi-check-circle-fill" style={{ marginRight: 7 }} />{msg}</div>
) : null;
const Avatar = ({ nombre, color = '#3b82f6', size = 36 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    backgroundColor: `${color}22`, border: `1px solid ${color}44`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color, fontWeight: 'bold', fontSize: size * 0.38, flexShrink: 0,
  }}>
    {(nombre || '?').charAt(0).toUpperCase()}
  </div>
);

// ─── App principal ────────────────────────────────────────────────────────────
export default function Jobassistand() {

   ////////////////////
// --- PEGA ESTO AQUÍ, justo después de function Jobassistand() { ---
  useEffect(() => {
    const syncToMongoDB = async () => {
      // Busca los que tienen sincronizado = 0
      const pendientes = await db.asistencias.where('sincronizado').equals(0).toArray();
      
      for (const registro of pendientes) {
        try {
          const response = await fetch('https://jobasisitand-backend.onrender.com/api/asistencias', { // <--- CAMBIA ESTO
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registro)
          });

          if (response.ok) {
            // Si el servidor guardó, marcamos como 1 en la base local
            await db.asistencias.update(registro.id, { sincronizado: 1 });
            console.log("Sincronizado:", registro.id);
          }
        } catch (err) {
          console.log("Sin conexión, intentamos luego");
        }
      }
    };

    window.addEventListener('online', syncToMongoDB);
    syncToMongoDB(); // Ejecutar al cargar
    return () => window.removeEventListener('online', syncToMongoDB);
  }, []);
  // ------------------------------------------------------------------


  ///////////////////////
  const [usuario,  setUsuario]  = useState(() => { try { return JSON.parse(localStorage.getItem('session_usuario')); } catch { return null; } });
  const [modo,     setModo]     = useState('login');
  const [errorMsg, setErrorMsg] = useState('');
  const [okMsg,    setOkMsg]    = useState('');
  const [form,     setForm]     = useState({ nombre: '', apellido: '', email: '', pass: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);

  const limpiar    = () => { setErrorMsg(''); setOkMsg(''); };
  const cambiarModo = m => { setModo(m); setForm({ nombre: '', apellido: '', email: '', pass: '', confirm: '' }); limpiar(); setShowPass(false); };

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

  const handleRegistro = async () => {
    limpiar();
    const err = validarRegistro(form);
    if (err) { setErrorMsg(err); return; }
    const existe = await db.supervisores.where('email').equalsIgnoreCase(form.email.trim()).first();
    if (existe) { setErrorMsg('Ya existe una cuenta con ese correo.'); return; }
    await db.supervisores.add({
      nombre: form.nombre.trim(), apellido: form.apellido.trim(),
      email: form.email.trim().toLowerCase(), password: form.pass,
      rol: 'admin',
    });
    setOkMsg('Cuenta creada. Ahora puedes ingresar.');
    cambiarModo('login');
  };

  const cerrarSesion = () => {
    localStorage.removeItem('session_usuario');
    setUsuario(null);
    setForm({ nombre: '', apellido: '', email: '', pass: '', confirm: '' });
    limpiar();
  };

  if (!usuario) return (
    <div style={s.bg}>
      <div style={s.loginCard}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <i className="bi bi-shield-lock" style={{ fontSize: 48, color: '#3b82f6' }} />
          <h2 style={{ color: '#fff', margin: '10px 0 4px', fontWeight: 700, fontSize: 22 }}>
            JOB<span style={{ color: '#3b82f6' }}>ASSISTAND</span>
          </h2>
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Sistema de asistencia</p>
        </div>
        <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, marginBottom: 20 }}>
          {[['login', 'Ingresar'], ['register', 'Crear cuenta']].map(([m, label]) => (
            <button key={m} onClick={() => cambiarModo(m)} style={{
              flex: 1, padding: '9px 0', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              backgroundColor: modo === m ? '#3b82f6' : 'transparent',
              color: modo === m ? '#fff' : '#6b7280',
            }}>{label}</button>
          ))}
        </div>
        <Err msg={errorMsg} /><Ok msg={okMsg} />
        {modo === 'register' && (
          <>
            <input placeholder="Nombre" maxLength={50} style={s.input} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} onFocus={limpiar} />
            <input placeholder="Apellido" maxLength={50} style={s.input} value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} onFocus={limpiar} />
          </>
        )}
        <input type="email" placeholder="Correo electrónico" maxLength={100} style={s.input} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} onFocus={limpiar} />
        <div style={{ position: 'relative' }}>
          <input type={showPass ? 'text' : 'password'} placeholder="Contraseña" maxLength={50} style={s.input} value={form.pass} onChange={e => setForm({ ...form, pass: e.target.value })} onFocus={limpiar}
            onKeyDown={e => e.key === 'Enter' && modo === 'login' && handleLogin()} />
          <i className={`bi bi-eye${showPass ? '-slash' : ''}`} style={{ position: 'absolute', right: 12, top: 14, cursor: 'pointer', color: '#9ca3af' }} onClick={() => setShowPass(!showPass)} />
        </div>
        {modo === 'register' && (
          <>
            <div style={{ position: 'relative' }}>
              <input type={showPass ? 'text' : 'password'} placeholder="Confirmar contraseña" maxLength={50} style={s.input} value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} onFocus={limpiar} />
              <i className={`bi bi-eye${showPass ? '-slash' : ''}`} style={{ position: 'absolute', right: 12, top: 14, cursor: 'pointer', color: '#9ca3af' }} onClick={() => setShowPass(!showPass)} />
            </div>
          </>
        )}
        <button onClick={modo === 'login' ? handleLogin : handleRegistro} style={s.btnBlue}>
          {modo === 'login' ? 'Ingresar' : 'Crear Cuenta Admin'}
        </button>
        {modo === 'register' && (
          <p style={{ color: '#4b5563', fontSize: 11, textAlign: 'center', marginTop: 12 }}>Las cuentas creadas aquí son de administrador.</p>
        )}
      </div>
    </div>
  );

  if (usuario.rol === 'admin')     return <AdminPanel    usuario={usuario} onLogout={cerrarSesion} />;
  if (usuario.rol === 'encargado') return <EncargadoPanel usuario={usuario} onLogout={cerrarSesion} />;
  return <div style={{ color: '#fff', padding: 40 }}>Rol desconocido. <button onClick={cerrarSesion}>Salir</button></div>;
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
  const [modalPersonal, setModalPersonal] = useState(false);
  const [modalAreasList, setModalAreasList] = useState(false);
  const [modalEncargadosList, setModalEncargadosList] = useState(false);

  // Estados para encargados independiente
  const [fEnc,  setFEnc]  = useState({ nombre: '', apellido: '', email: '', pass: '', confirm: '' });
  const [showEncPass, setShowEncPass] = useState(false);

  // Estados para trabajador
  const [fTrab, setFTrab] = useState({ nombre: '', apellido: '', telefono: '', curp: '', areaId: '' });
  const [fArea, setFArea] = useState({ nombre: '', pagoPorHora: '' });
  const [editArea, setEditArea] = useState(null);

  // Estados para crear área con encargados múltiples
  const [encargadosExistentes, setEncargadosExistentes] = useState([]);
  const [selectedEncargados, setSelectedEncargados] = useState([]);
  const [crearNuevoEnc, setCrearNuevoEnc] = useState(false);
  const [nuevoEncData, setNuevoEncData] = useState({ nombre: '', apellido: '', email: '', pass: '', confirm: '', showPass: false });

  // Calendario
  const hoy = new Date();
  const [calMes,       setCalMes]       = useState(hoy.getMonth());
  const [calAnio,      setCalAnio]      = useState(hoy.getFullYear());
  const [diaSelec,     setDiaSelec]     = useState(null);
  const [datosDia,     setDatosDia]     = useState(null);
  const [diasConDatos, setDiasConDatos] = useState({});

  // Reporte
  const lunesDeEsta = new Date(hoy); lunesDeEsta.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const fmtISO = d => d.toISOString().slice(0, 10);
  const [repInicio, setRepInicio] = useState(fmtISO(lunesDeEsta));
  const [repFin,    setRepFin]    = useState(fmtISO(hoy));
  const [repDatos,  setRepDatos]  = useState(null);
  const [repLoading,setRepLoading]= useState(false);

  const limpiar  = () => { setErrorMsg(''); setOkMsg(''); };
  
  const recargar = async () => {
    // Cargar encargados con sus áreas
    const encs = await db.supervisores.where('rol').equals('encargado').toArray();
    const encsConAreas = [];
    for (const enc of encs) {
      const relaciones = await db.supervisor_areas.where('supervisorId').equals(enc.id).toArray();
      const areasIds = relaciones.map(r => r.areaId);
      const areasNombres = areasIds.length ? (await db.areas.where('id').anyOf(areasIds).toArray()).map(a => a.nombre).join(', ') : 'Sin áreas';
      encsConAreas.push({ ...enc, areas: areasNombres });
    }
    setEncargados(encsConAreas);
    setTrabajadores(await db.trabajadores.toArray());
    setAreas(await db.areas.toArray());
    const encsSimples = await db.supervisores.where('rol').equals('encargado').toArray();
    setEncargadosExistentes(encsSimples);
  };

  useEffect(() => { recargar(); }, [vista]);

  // Puntos del calendario
  useEffect(() => {
    if (vista !== 'calendario') return;
    const cargar = async () => {
      const inicio = inicioDiaLocal(calAnio, calMes, 1);
      const fin    = finDiaLocal(calAnio, calMes + 1, 0);
      const regs   = await db.asistencias.where('fecha').between(inicio, fin, true, true).toArray();
      const mapa   = {};
      regs.forEach(r => { 
        const fechaLocal = new Date(r.fecha).toLocaleDateString('sv-SE');
        mapa[fechaLocal] = true;
      });
      setDiasConDatos(mapa);
    };
    cargar();
  }, [vista, calMes, calAnio]);

  // Abrir día calendario
  const abrirDia = async (anio, mes, dia) => {
    const inicio = inicioDiaLocal(anio, mes, dia);
    const fin    = finDiaLocal(anio, mes, dia);
    const regs   = await db.asistencias.where('fecha').between(inicio, fin, true, true).toArray();
    const areasDB= await db.areas.toArray();
    const trabsDB= await db.trabajadores.toArray();
    const encsDB = await db.supervisores.where('rol').equals('encargado').toArray();

    const supAreas = await db.supervisor_areas.toArray();

    const porArea = areasDB.map(area => {
      const regsArea  = regs.filter(r => r.areaId === area.id);
      if (regsArea.length === 0) return null;

      const encargadosArea = encsDB.filter(enc => supAreas.some(sa => sa.supervisorId === enc.id && sa.areaId === area.id));
      const lugar     = regsArea.find(r => r.lugar && r.lugar !== 'Sin GPS')?.lugar || 'Sin ubicación';
      const coords    = regsArea.find(r => r.lat);
      const trabsArea = trabsDB.filter(t => t.areaId === area.id);

      const porTrab = trabsArea.map(t => {
        const nombre = `${t.nombre} ${t.apellido}`;
        const entrada = regsArea.find(r => r.trabajadorId === nombre && r.tipo === 'entrada');
        const salida  = regsArea.find(r => r.trabajadorId === nombre && r.tipo === 'salida');
        const horas   = horasDiff(entrada?.fecha, salida?.fecha);
        const ganancia = horas * (area.pagoPorHora || 0);
        const presente = !!entrada;
        return { nombre, entrada: entrada?.fecha || null, salida: salida?.fecha || null, horas, ganancia, presente };
      });

      const totalGanancia = porTrab.reduce((s, t) => s + t.ganancia, 0);
      return { area, encargados: encargadosArea, lugar, coords: coords ? { lat: coords.lat, lng: coords.lng } : null, trabajadores: porTrab, totalGanancia };
    }).filter(Boolean);

    setDatosDia({ porArea, fecha: { anio, mes, dia } });
    setDiaSelec({ anio, mes, dia });
  };

  // ── ÁREA con encargados múltiples ───────────────────────────────────────────
  const crearAreaConEncargados = async () => {
    limpiar();
    if (!fArea.nombre.trim()) { setErrorMsg('El nombre del área es obligatorio.'); return; }

    let encargadosIds = [];

    if (crearNuevoEnc) {
      if (!nuevoEncData.nombre.trim())     { setErrorMsg('Nombre del encargado es obligatorio.'); return; }
      if (!nuevoEncData.apellido.trim())   { setErrorMsg('Apellido del encargado es obligatorio.'); return; }
      if (!nuevoEncData.email.trim())      { setErrorMsg('Correo del encargado es obligatorio.'); return; }
      if (!validarEmail(nuevoEncData.email)) { setErrorMsg('Correo no válido.'); return; }
      if (!nuevoEncData.pass || nuevoEncData.pass.length < 6) { setErrorMsg('Contraseña mínimo 6 caracteres.'); return; }
      if (nuevoEncData.pass !== nuevoEncData.confirm) { setErrorMsg('Las contraseñas no coinciden.'); return; }

      const existe = await db.supervisores.where('email').equalsIgnoreCase(nuevoEncData.email.trim()).first();
      if (existe) { setErrorMsg('Ya existe un supervisor con ese correo.'); return; }

      const nuevoId = await db.supervisores.add({
        nombre: nuevoEncData.nombre.trim(), apellido: nuevoEncData.apellido.trim(),
        email: nuevoEncData.email.trim().toLowerCase(), password: nuevoEncData.pass,
        rol: 'encargado',
      });
      encargadosIds = [nuevoId];
    } else {
      if (selectedEncargados.length === 0) {
        setErrorMsg('Debes seleccionar al menos un encargado existente o crear uno nuevo.');
        return;
      }
      encargadosIds = selectedEncargados;
    }

    const areaId = await db.areas.add({
      nombre: fArea.nombre.trim(),
      pagoPorHora: fArea.pagoPorHora ? Number(fArea.pagoPorHora) : 0,
    });

    for (const supId of encargadosIds) {
      await db.supervisor_areas.add({ supervisorId: supId, areaId });
    }

    setFArea({ nombre: '', pagoPorHora: '' });
    setSelectedEncargados([]);
    setCrearNuevoEnc(false);
    setNuevoEncData({ nombre: '', apellido: '', email: '', pass: '', confirm: '', showPass: false });
    setOkMsg('Área creada y asignada a los encargados seleccionados.');
    recargar();
  };

  const guardarEditArea = async () => {
    if (!editArea) return;
    await db.areas.update(editArea.id, {
      nombre: editArea.nombre.trim(),
      pagoPorHora: editArea.pagoPorHora ? Number(editArea.pagoPorHora) : 0,
    });
    setEditArea(null);
    setOkMsg('Área actualizada.');
    recargar();
  };

  const eliminarArea = async id => { 
    await db.supervisor_areas.where('areaId').equals(id).delete();
    await db.areas.delete(id);
    recargar();
  };

  // ── ENCARGADO (registro independiente) ──────────────────────────────────────
  const agregarEncargado = async () => {
  limpiar();

  // 1. Validaciones existentes
  if (!fEnc.nombre.trim())            { setErrorMsg('Nombre obligatorio.'); return; }
  if (!fEnc.apellido.trim())          { setErrorMsg('Apellido obligatorio.'); return; }
  if (!fEnc.email.trim())             { setErrorMsg('Correo obligatorio.'); return; }
  if (!validarEmail(fEnc.email))      { setErrorMsg('Correo no válido.'); return; }
  if (!fEnc.pass || fEnc.pass.length < 6) { setErrorMsg('Contraseña mínimo 6 caracteres.'); return; }
  if (fEnc.pass !== fEnc.confirm)     { setErrorMsg('Las contraseñas no coinciden.'); return; }

  const existe = await db.supervisores.where('email').equalsIgnoreCase(fEnc.email.trim()).first();
  if (existe) { setErrorMsg('Ya existe una cuenta con ese correo.'); return; }

 const agregarEncargado = async () => {
  limpiar();
  // ... (tus validaciones previas aquí) ...

  const nuevoSupervisor = {
    nombre: fEnc.nombre.trim(),
    apellido: fEnc.apellido.trim(),
    email: fEnc.email.trim().toLowerCase(),
    password: fEnc.pass,
    rol: 'encargado'
  };

  try {
    // 1. Intentar guardar en la Nube
    const res = await fetch('https://jobasisitand-backend.onrender.com/api/supervisores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoSupervisor)
    });

    if (!res.ok) throw new Error('No se pudo guardar en la nube');

    // 2. Solo si tuvo éxito, guardamos localmente
    await db.supervisores.add(nuevoSupervisor);
    
    setFEnc({ nombre: '', apellido: '', email: '', pass: '', confirm: '' });
    setOkMsg('Guardado en la nube y localmente.');
    recargar();
  } catch (err) {
    setErrorMsg('Error de conexión con el servidor: ' + err.message);
  }
};
  // ── TRABAJADOR ────────────────────────────────────────────────────────────
  const agregarTrabajador = async () => {
    limpiar();
    if (!fTrab.nombre.trim())   { setErrorMsg('Nombre obligatorio.'); return; }
    if (!fTrab.apellido.trim()) { setErrorMsg('Apellido obligatorio.'); return; }
    if (!fTrab.areaId)          { setErrorMsg('Asigna un área.'); return; }
    if (fTrab.telefono && !validarTelefono(fTrab.telefono)) {
      setErrorMsg('El teléfono debe contener exactamente 10 dígitos numéricos.');
      return;
    }
    if (fTrab.curp && !validarCURP(fTrab.curp)) {
      setErrorMsg('El formato de CURP no es válido (18 caracteres, ej: GODE561231HDFR).');
      return;
    }
  
    const nuevoTrabajador = {
    nombre: fTrab.nombre.trim(), 
    apellido: fTrab.apellido.trim(),
    telefono: fTrab.telefono.trim(), 
    curp: fTrab.curp.trim().toUpperCase(),
    areaId: Number(fTrab.areaId)
  };

  try {
    // 1. Intentar guardar en la Nube
    const res = await fetch('https://jobasisitand-backend.onrender.com/api/trabajadores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoTrabajador)
    });

    if (!res.ok) throw new Error('No se pudo guardar en la nube');

    // 2. Solo si tuvo éxito, guardamos localmente
    await db.trabajadores.add(nuevoTrabajador);
    
    setFTrab({ nombre: '', apellido: '', telefono: '', curp: '', areaId: '' });
    setOkMsg('Trabajador registrado en la nube.');
    recargar();
  } catch (err) {
    setErrorMsg('Error al conectar con la nube: ' + err.message);
  }
};


/////////////////////////////////////////////////////////////////////////////////////

    
  const eliminarEncargado  = async id => {
    await db.supervisor_areas.where('supervisorId').equals(id).delete();
    await db.supervisores.delete(id);
    recargar();
  };
  const eliminarTrabajador = async id => { await db.trabajadores.delete(id); recargar(); };
  const areaNombre = id => areas.find(a => a.id === Number(id))?.nombre || '—';

  // ── REPORTE ───────────────────────────────────────────────────────────────
  const generarReporte = async () => {
    setRepLoading(true); setRepDatos(null);
    try {
      const inicio = inicioDiaLocal(new Date(repInicio).getFullYear(), new Date(repInicio).getMonth(), new Date(repInicio).getDate());
      const fin    = finDiaLocal(new Date(repFin).getFullYear(), new Date(repFin).getMonth(), new Date(repFin).getDate());
      const regs   = await db.asistencias.where('fecha').between(inicio, fin, true, true).toArray();
      const trabs  = await db.trabajadores.toArray();
      const areasL = await db.areas.toArray();

      const diasRango = [];
      const cur = new Date(repInicio + 'T12:00:00');
      const end = new Date(repFin + 'T12:00:00');
      while (cur <= end) { if (cur.getDay() !== 0) diasRango.push(cur.toISOString().slice(0,10)); cur.setDate(cur.getDate()+1); }

      const filas = trabs.map(t => {
        const nombre = `${t.nombre} ${t.apellido}`;
        const area   = areasL.find(a => a.id === Number(t.areaId));
        const regsT  = regs.filter(r => r.trabajadorId === nombre);
        let totalHoras = 0;
        diasRango.forEach(fecha => {
          const e = regsT.find(r => r.tipo === 'entrada' && r.fecha.slice(0,10) === fecha);
          const sal = regsT.find(r => r.tipo === 'salida'  && r.fecha.slice(0,10) === fecha);
          totalHoras += horasDiff(e?.fecha, sal?.fecha);
        });
        const diasPresente = new Set(regsT.filter(r => r.tipo==='entrada').map(r => r.fecha.slice(0,10))).size;
        const diasAusente  = Math.max(0, diasRango.length - diasPresente);
        const pph          = area?.pagoPorHora || 0;
        const totalPago    = totalHoras * pph;
        return { nombre, area: area?.nombre || '—', diasPresente, diasAusente, totalHoras, pph, totalPago };
      });

      setRepDatos({ filas, totalDiasLab: diasRango.length, inicio: repInicio, fin: repFin });
    } finally { setRepLoading(false); }
  };



const registrarAsistencia = async (datos) => {
  // 1. Guardamos localmente (Dexie)
  await db.asistencias.add(datos);

  // 2. ENVIAMOS AL SERVIDOR (Aquí está el secreto)
  try {
    const response = await fetch('https://jobasisitand-backend.onrender.com/api/asistencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos) // Enviamos los datos al servidor
    });

    if (!response.ok) throw new Error('Error al sincronizar con el servidor');
    
    console.log('Asistencia sincronizada con la nube correctamente');
  } catch (error) {
    console.error('No se pudo enviar al servidor, quedará pendiente:', error);
  }
};




  


  
  const descargarPDF = () => {
    if (!repDatos) return;
    if (!window.jspdf) { alert('jsPDF no cargado.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFillColor(11,14,20); doc.rect(0,0,297,297,'F');
    doc.setFontSize(20); doc.setTextColor(59,130,246); doc.text('JOBASSISTAND', 14, 18);
    doc.setFontSize(11); doc.setTextColor(200,200,200); doc.text('Reporte Semanal de Asistencias y Pagos', 14, 25);
    doc.setFontSize(9); doc.setTextColor(107,114,128);
    doc.text(`Periodo: ${repDatos.inicio}  al  ${repDatos.fin}   |   Días laborables: ${repDatos.totalDiasLab}`, 14, 31);
    doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 14, 36);
    const cols = ['Empleado','Área','Días Presentes','Días Ausentes','Horas Trabajadas','Pago/Hr','Total MXN'];
    const rows = repDatos.filas.map(f => [
      f.nombre, f.area, f.diasPresente, f.diasAusente,
      f.totalHoras.toFixed(1),
      f.pph > 0 ? `$${f.pph.toFixed(2)}` : 'N/A',
      f.pph > 0 ? `$${f.totalPago.toFixed(2)}` : 'N/A',
    ]);
    const totP = repDatos.filas.reduce((a,f)=>a+f.diasPresente,0);
    const totA = repDatos.filas.reduce((a,f)=>a+f.diasAusente,0);
    const totH = repDatos.filas.reduce((a,f)=>a+f.totalHoras,0);
    const totT = repDatos.filas.reduce((a,f)=>a+f.totalPago,0);
    rows.push(['TOTAL','',totP,totA,totH.toFixed(1),'',`$${totT.toFixed(2)}`]);
    doc.autoTable({
      startY: 42, head: [cols], body: rows, theme: 'grid',
      headStyles: { fillColor:[30,41,59], textColor:[148,163,184], fontStyle:'bold', fontSize:8 },
      bodyStyles: { fillColor:[15,23,42], textColor:[226,232,240], fontSize:8 },
      alternateRowStyles: { fillColor:[20,30,55] },
      didParseCell: data => { if (data.row.index===rows.length-1) { data.cell.styles.fillColor=[30,64,175]; data.cell.styles.textColor=[255,255,255]; data.cell.styles.fontStyle='bold'; } },
      margin: { left:14, right:14 },
    });
    doc.save(`reporte_${repDatos.inicio}.pdf`);
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={s.bg}>
      <header style={s.header}>
        <div>
          <h1 style={{ color: '#fff', fontSize: 18, margin: 0, fontWeight: 700 }}>
            JOB<span style={{ color: '#3b82f6' }}>ASSISTAND</span>
          </h1>
          <span style={{ color: '#6b7280', fontSize: 11 }}>Administrador</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#9ca3af', fontSize: 12 }}>{usuario.nombre}</span>
          <button onClick={onLogout} style={s.btnLogout}><i className="bi bi-box-arrow-right" /></button>
        </div>
      </header>

      <main style={{ padding: '10px 12px 90px' }}>

        {/* DASHBOARD */}
        {vista === 'dashboard' && (
          <div>
            <h2 style={s.pageTitle}>Dashboard</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {/* Empleados */}
              <div style={{ ...s.statCard, cursor: 'pointer' }} onClick={() => setModalPersonal(true)}>
                <i className="bi bi-people" style={{ fontSize: 26, color: '#3b82f6' }} />
                <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '6px 0 0' }}>{trabajadores.length}</div>
                <div style={{ color: '#6b7280', fontSize: 11 }}>Empleados</div>
                <div style={{ color: '#3b82f6', fontSize: 10, marginTop: 2 }}>Ver lista</div>
              </div>
              {/* Encargados */}
              <div style={{ ...s.statCard, cursor: 'pointer' }} onClick={() => setModalEncargadosList(true)}>
                <i className="bi bi-person-badge" style={{ fontSize: 26, color: '#a78bfa' }} />
                <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '6px 0 0' }}>{encargados.length}</div>
                <div style={{ color: '#6b7280', fontSize: 11 }}>Encargados</div>
                <div style={{ color: '#a78bfa', fontSize: 10, marginTop: 2 }}>Ver lista</div>
              </div>
              {/* Áreas */}
              <div style={{ ...s.statCard, cursor: 'pointer' }} onClick={() => setModalAreasList(true)}>
                <i className="bi bi-diagram-3" style={{ fontSize: 26, color: '#10b981' }} />
                <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '6px 0 0' }}>{areas.length}</div>
                <div style={{ color: '#6b7280', fontSize: 11 }}>Áreas</div>
                <div style={{ color: '#10b981', fontSize: 10, marginTop: 2 }}>Ver lista</div>
              </div>
              {/* GPS */}
              <div style={s.statCard}>
                <i className="bi bi-geo-alt" style={{ fontSize: 26, color: '#f59e0b' }} />
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '6px 0 0' }}>GPS</div>
                <div style={{ color: '#6b7280', fontSize: 11 }}>Activo</div>
              </div>
            </div>
            <div style={s.card}>
              <h3 style={s.cardTitle}>Acciones rápidas</h3>
              {[
                { label: 'Nueva Área',      icon: 'bi-diagram-3',    v: 'areas' },
                { label: 'Nuevo Encargado', icon: 'bi-person-badge', v: 'encargados' },
                { label: 'Nuevo Empleado',  icon: 'bi-person-plus',  v: 'trabajadores' },
              ].map(a => (
                <button key={a.v} onClick={() => { setVista(a.v); limpiar(); }} style={{ ...s.btnBlue, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span><i className={`bi ${a.icon}`} style={{ marginRight: 8 }} />{a.label}</span>
                  <i className="bi bi-chevron-right" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ÁREAS */}
        {vista === 'areas' && (
          <div>
            <h2 style={s.pageTitle}>Áreas de Trabajo</h2>
            <div style={s.card}>
              <h3 style={s.cardTitle}>Crear área con encargados</h3>
              <Err msg={errorMsg} /><Ok msg={okMsg} />
              <input placeholder="Nombre del área" maxLength={100} style={s.input}
                value={fArea.nombre} onChange={e => setFArea({ ...fArea, nombre: e.target.value })} onFocus={limpiar} />
              <label style={s.fieldLabel}>Pago por hora (MXN)</label>
              <input type="number" step="0.01" min="0" max="999999.99" placeholder="Ej: 85.00" style={s.input}
                value={fArea.pagoPorHora} onChange={e => setFArea({ ...fArea, pagoPorHora: e.target.value })} onFocus={limpiar} />
              
              <div style={{ borderTop: '1px solid #1f2937', margin: '16px 0 12px', paddingTop: 12 }}>
                <label style={s.fieldLabel}>Encargados responsables</label>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <input type="checkbox" checked={!crearNuevoEnc} onChange={() => setCrearNuevoEnc(false)} />
                    <span>Seleccionar encargados existentes</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={crearNuevoEnc} onChange={() => setCrearNuevoEnc(true)} />
                    <span>Crear nuevo encargado</span>
                  </label>
                </div>

                {!crearNuevoEnc && (
                  <div>
                    <label style={s.fieldLabel}>Encargados disponibles</label>
                    <select multiple style={{ ...s.select, height: 'auto', minHeight: 100 }} value={selectedEncargados} onChange={e => {
                      const opts = Array.from(e.target.selectedOptions, o => Number(o.value));
                      setSelectedEncargados(opts);
                    }}>
                      {encargadosExistentes.map(enc => (
                        <option key={enc.id} value={enc.id}>{enc.nombre} {enc.apellido} ({enc.email})</option>
                      ))}
                    </select>
                    <p style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>Mantén presionado Ctrl/Cmd para seleccionar múltiples</p>
                  </div>
                )}

                {crearNuevoEnc && (
                  <div>
                    <input placeholder="Nombre del nuevo encargado" maxLength={50} style={s.input}
                      value={nuevoEncData.nombre} onChange={e => setNuevoEncData({ ...nuevoEncData, nombre: e.target.value })} />
                    <input placeholder="Apellido" maxLength={50} style={s.input}
                      value={nuevoEncData.apellido} onChange={e => setNuevoEncData({ ...nuevoEncData, apellido: e.target.value })} />
                    <input type="email" placeholder="Correo electrónico" maxLength={100} style={s.input}
                      value={nuevoEncData.email} onChange={e => setNuevoEncData({ ...nuevoEncData, email: e.target.value })} />
                    <div style={{ position: 'relative' }}>
                      <input type={nuevoEncData.showPass ? 'text' : 'password'} placeholder="Contraseña (mín 6)" maxLength={50} style={s.input}
                        value={nuevoEncData.pass} onChange={e => setNuevoEncData({ ...nuevoEncData, pass: e.target.value })} />
                      <i className={`bi bi-eye${nuevoEncData.showPass ? '-slash' : ''}`} style={{ position: 'absolute', right: 12, top: 14, cursor: 'pointer' }}
                        onClick={() => setNuevoEncData({ ...nuevoEncData, showPass: !nuevoEncData.showPass })} />
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input type={nuevoEncData.showPass ? 'text' : 'password'} placeholder="Confirmar contraseña" maxLength={50} style={s.input}
                        value={nuevoEncData.confirm} onChange={e => setNuevoEncData({ ...nuevoEncData, confirm: e.target.value })} />
                    </div>
                  </div>
                )}
              </div>

              <button onClick={crearAreaConEncargados} style={s.btnBlue}>Crear Área</button>
            </div>

            {editArea && (
              <div style={s.overlay} onClick={() => setEditArea(null)}>
                <div style={s.modalBox} onClick={e => e.stopPropagation()}>
                  <h3 style={{ color: '#fff', margin: '0 0 16px' }}>Editar Área</h3>
                  <input placeholder="Nombre" maxLength={100} style={s.input} value={editArea.nombre}
                    onChange={e => setEditArea({ ...editArea, nombre: e.target.value })} />
                  <label style={s.fieldLabel}>Pago por hora (MXN)</label>
                  <input type="number" step="0.01" min="0" max="999999.99" style={s.input} value={editArea.pagoPorHora}
                    onChange={e => setEditArea({ ...editArea, pagoPorHora: e.target.value })} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button onClick={guardarEditArea} style={{ ...s.btnBlue, flex: 1 }}>Guardar</button>
                    <button onClick={() => setEditArea(null)} style={{ ...s.btnLogout, flex: 1, padding: 12, borderRadius: 11, fontSize: 14 }}>Cancelar</button>
                  </div>
                  <Ok msg={okMsg} />
                </div>
              </div>
            )}

            <h3 style={s.secLabel}>Áreas registradas ({areas.length})</h3>
            {areas.map(a => (
              <div key={a.id} style={s.listItem}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar nombre={a.nombre} color="#10b981" />
                  <div>
                    <div style={{ color: '#fff', fontWeight: 500 }}>{a.nombre}</div>
                    <div style={{ color: '#f59e0b', fontSize: 11 }}>
                      <i className="bi bi-cash" style={{ marginRight: 4 }} />
                      ${(a.pagoPorHora || 0).toFixed(2)} / hora
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditArea({ id: a.id, nombre: a.nombre, pagoPorHora: a.pagoPorHora || '' })} style={s.btnEdit}>
                    <i className="bi bi-pencil" />
                  </button>
                  <button onClick={() => eliminarArea(a.id)} style={s.btnDanger}>
                    <i className="bi bi-trash3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ENCARGADOS (registro independiente) */}
        {vista === 'encargados' && (
          <div>
            <h2 style={s.pageTitle}>Encargados</h2>
            <div style={s.card}>
              <h3 style={s.cardTitle}>Registrar encargado</h3>
              <Err msg={errorMsg} /><Ok msg={okMsg} />
              <input placeholder="Nombre" maxLength={50} style={s.input} value={fEnc.nombre} onChange={e => setFEnc({ ...fEnc, nombre: e.target.value })} onFocus={limpiar} />
              <input placeholder="Apellido" maxLength={50} style={s.input} value={fEnc.apellido} onChange={e => setFEnc({ ...fEnc, apellido: e.target.value })} onFocus={limpiar} />
              <input type="email" placeholder="Correo" maxLength={100} style={s.input} value={fEnc.email} onChange={e => setFEnc({ ...fEnc, email: e.target.value })} onFocus={limpiar} />
              <div style={{ position: 'relative' }}>
                <input type={showEncPass ? 'text' : 'password'} placeholder="Contraseña (mín 6)" maxLength={50} style={s.input} value={fEnc.pass} onChange={e => setFEnc({ ...fEnc, pass: e.target.value })} onFocus={limpiar} />
                <i className={`bi bi-eye${showEncPass ? '-slash' : ''}`} style={{ position: 'absolute', right: 12, top: 14, cursor: 'pointer', color: '#9ca3af' }} onClick={() => setShowEncPass(!showEncPass)} />
              </div>
              <div style={{ position: 'relative' }}>
                <input type={showEncPass ? 'text' : 'password'} placeholder="Confirmar contraseña" maxLength={50} style={s.input} value={fEnc.confirm} onChange={e => setFEnc({ ...fEnc, confirm: e.target.value })} onFocus={limpiar} />
              </div>
              <button onClick={agregarEncargado} style={s.btnBlue}>Registrar Encargado</button>
            </div>
            <h3 style={s.secLabel}>Encargados registrados</h3>
            {encargados.map(e => (
              <div key={e.id} style={s.listItem}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar nombre={e.nombre} color="#a78bfa" />
                  <div>
                    <div style={{ color: '#fff', fontWeight: 500, fontSize: 14 }}>{e.nombre} {e.apellido}</div>
                    <div style={{ color: '#6b7280', fontSize: 11 }}>{e.email}</div>
                    <div style={{ color: '#a78bfa', fontSize: 11 }}><i className="bi bi-diagram-3" style={{ marginRight: 4 }} />Áreas: {e.areas || 'Sin asignar'}</div>
                  </div>
                </div>
                <button onClick={() => eliminarEncargado(e.id)} style={s.btnDanger}><i className="bi bi-trash3" /></button>
              </div>
            ))}
          </div>
        )}

        {/* TRABAJADORES */}
        {vista === 'trabajadores' && (
          <div>
            <h2 style={s.pageTitle}>Empleados</h2>
            <div style={s.card}>
              <h3 style={s.cardTitle}>Registrar empleado</h3>
              <Err msg={errorMsg} /><Ok msg={okMsg} />
              <input placeholder="Nombre" maxLength={50} style={s.input} value={fTrab.nombre} onChange={e => setFTrab({ ...fTrab, nombre: e.target.value })} onFocus={limpiar} />
              <input placeholder="Apellido" maxLength={50} style={s.input} value={fTrab.apellido} onChange={e => setFTrab({ ...fTrab, apellido: e.target.value })} onFocus={limpiar} />
              <input placeholder="Teléfono (10 dígitos)" maxLength={10} style={s.input} value={fTrab.telefono} onChange={e => setFTrab({ ...fTrab, telefono: e.target.value })} onFocus={limpiar} />
              <input placeholder="CURP (opcional)" maxLength={18} style={s.input} value={fTrab.curp} onChange={e => setFTrab({ ...fTrab, curp: e.target.value.toUpperCase() })} onFocus={limpiar} />
              <select style={s.select} value={fTrab.areaId} onChange={e => setFTrab({ ...fTrab, areaId: e.target.value })} onFocus={limpiar}>
                <option value="">-- Asignar Área --</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.nombre} — ${(a.pagoPorHora||0).toFixed(2)}/hr</option>)}
              </select>
              <button onClick={agregarTrabajador} style={s.btnBlue}>Registrar Empleado</button>
            </div>
            <h3 style={s.secLabel}>Empleados registrados ({trabajadores.length})</h3>
            {trabajadores.map(t => (
              <div key={t.id} style={s.listItem}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar nombre={t.nombre} color="#3b82f6" />
                  <div>
                    <div style={{ color: '#fff', fontWeight: 500, fontSize: 14 }}>{t.nombre} {t.apellido}</div>
                    {t.telefono && <div style={{ color: '#6b7280', fontSize: 11 }}>📞 {t.telefono}</div>}
                    {t.curp && <div style={{ color: '#6b7280', fontSize: 11 }}>CURP: {t.curp}</div>}
                    <div style={{ color: '#3b82f6', fontSize: 11 }}><i className="bi bi-diagram-3" style={{ marginRight: 4 }} />{areaNombre(t.areaId)}</div>
                  </div>
                </div>
                <button onClick={() => eliminarTrabajador(t.id)} style={s.btnDanger}><i className="bi bi-trash3" /></button>
              </div>
            ))}
          </div>
        )}

        {/* CALENDARIO */}
        {vista === 'calendario' && (
          <CalendarioAdmin
            calMes={calMes} setCalMes={setCalMes}
            calAnio={calAnio} setCalAnio={setCalAnio}
            diaSelec={diaSelec} setDiaSelec={setDiaSelec}
            datosDia={datosDia} diasConDatos={diasConDatos}
            abrirDia={abrirDia}
          />
        )}

        {/* REPORTE */}
        {vista === 'reporte' && (
          <div>
            <h2 style={s.pageTitle}>Reporte Semanal</h2>
            <div style={s.card}>
              <h3 style={s.cardTitle}>Rango de fechas</h3>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 4 }}>Desde</label>
                  <input type="date" style={{ ...s.input, marginBottom: 0 }} value={repInicio} onChange={e => setRepInicio(e.target.value)} />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 4 }}>Hasta</label>
                  <input type="date" style={{ ...s.input, marginBottom: 0 }} value={repFin} onChange={e => setRepFin(e.target.value)} />
                </div>
              </div>
              <button onClick={generarReporte} style={{ ...s.btnBlue, opacity: repLoading ? 0.6 : 1 }} disabled={repLoading}>
                <i className="bi bi-bar-chart-line" style={{ marginRight: 8 }} />
                {repLoading ? 'Generando...' : 'Generar Reporte'}
              </button>
            </div>
            {repDatos && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ ...s.statCard, padding: 12 }}>
                    <i className="bi bi-check-circle" style={{ color: '#10b981', fontSize: 20 }} />
                    <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '4px 0 0' }}>{repDatos.filas.reduce((a,f)=>a+f.diasPresente,0)}</div>
                    <div style={{ color: '#6b7280', fontSize: 10 }}>Asistencias</div>
                  </div>
                  <div style={{ ...s.statCard, padding: 12 }}>
                    <i className="bi bi-x-circle" style={{ color: '#ef4444', fontSize: 20 }} />
                    <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '4px 0 0' }}>{repDatos.filas.reduce((a,f)=>a+f.diasAusente,0)}</div>
                    <div style={{ color: '#6b7280', fontSize: 10 }}>Inasistencias</div>
                  </div>
                  <div style={{ ...s.statCard, padding: 12 }}>
                    <i className="bi bi-cash" style={{ color: '#f59e0b', fontSize: 20 }} />
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '4px 0 0' }}>
                      ${repDatos.filas.reduce((a,f)=>a+f.totalPago,0).toLocaleString('es-MX',{minimumFractionDigits:0,maximumFractionDigits:0})}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 10 }}>Total MXN</div>
                  </div>
                </div>
                <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #1f2937' }}>
                    <h3 style={{ color: '#fff', margin: 0, fontSize: 14 }}>Detalle por empleado</h3>
                    <p style={{ color: '#6b7280', fontSize: 11, margin: '2px 0 0' }}>{repDatos.totalDiasLab} días laborables (lun–sáb)</p>
                  </div>
                  {repDatos.filas.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #1f2937', backgroundColor: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                      <div style={{ flex: 2, minWidth: 100 }}>
                        <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{f.nombre}</div>
                        <div style={{ color: '#3b82f6', fontSize: 11 }}>{f.area}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ color: '#10b981', fontWeight: 700, fontSize: 15 }}>{f.diasPresente}</div>
                          <div style={{ color: '#6b7280', fontSize: 9 }}>presentes</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 15 }}>{f.diasAusente}</div>
                          <div style={{ color: '#6b7280', fontSize: 9 }}>ausentes</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: 13 }}>{f.totalHoras.toFixed(1)}h</div>
                          <div style={{ color: '#6b7280', fontSize: 9 }}>horas</div>
                        </div>
                        <div style={{ textAlign: 'center', minWidth: 60 }}>
                          <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13 }}>
                            {f.pph > 0 ? `$${f.totalPago.toLocaleString('es-MX',{minimumFractionDigits:0})}` : 'N/A'}
                          </div>
                          <div style={{ color: '#6b7280', fontSize: 9 }}>total</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={descargarPDF} style={{ ...s.btnBlue, backgroundColor: '#dc2626', marginTop: 14, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                  <i className="bi bi-file-earmark-pdf" /> Descargar PDF
                </button>
                <p style={{ color: '#4b5563', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                  * Pago calculado con horas reales de entrada/salida × pago/hora del área
                </p>
              </>
            )}
          </div>
        )}
      </main>

      {/* Nav inferior */}
      <nav style={s.nav}>
        {[
          { v: 'dashboard',    icon: 'bi-house-door' },
          { v: 'areas',        icon: 'bi-diagram-3' },
          { v: 'encargados',   icon: 'bi-person-badge' },
          { v: 'trabajadores', icon: 'bi-people' },
          { v: 'calendario',   icon: 'bi-calendar3' },
          { v: 'reporte',      icon: 'bi-file-earmark-bar-graph' },
        ].map(n => (
          <div key={n.v} style={s.navItem} onClick={() => { setVista(n.v); limpiar(); setRepDatos(null); }}>
            <i className={`bi ${n.icon}`} style={{ color: vista === n.v ? '#3b82f6' : '#6b7280', fontSize: 20 }} />
          </div>
        ))}
      </nav>

      {/* Modales de listas */}
      {modalPersonal && (
        <div style={s.overlay} onClick={() => setModalPersonal(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#fff', margin: 0 }}><i className="bi bi-people" style={{ color: '#3b82f6', marginRight: 8 }} />Empleados ({trabajadores.length})</h3>
              <button onClick={() => setModalPersonal(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}><i className="bi bi-x-lg" /></button>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {trabajadores.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #1f2937' }}>
                  <Avatar nombre={t.nombre} />
                  <div>
                    <div style={{ color: '#fff', fontWeight: 500 }}>{t.nombre} {t.apellido}</div>
                    <div style={{ color: '#3b82f6', fontSize: 11 }}><i className="bi bi-diagram-3" style={{ marginRight: 4 }} />{areaNombre(t.areaId)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalEncargadosList && (
        <div style={s.overlay} onClick={() => setModalEncargadosList(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#fff', margin: 0 }}><i className="bi bi-person-badge" style={{ color: '#a78bfa', marginRight: 8 }} />Encargados ({encargados.length})</h3>
              <button onClick={() => setModalEncargadosList(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}><i className="bi bi-x-lg" /></button>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {encargados.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #1f2937' }}>
                  <Avatar nombre={e.nombre} color="#a78bfa" />
                  <div>
                    <div style={{ color: '#fff', fontWeight: 500 }}>{e.nombre} {e.apellido}</div>
                    <div style={{ color: '#6b7280', fontSize: 11 }}>{e.email}</div>
                    <div style={{ color: '#a78bfa', fontSize: 11 }}>Áreas: {e.areas}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalAreasList && (
        <div style={s.overlay} onClick={() => setModalAreasList(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#fff', margin: 0 }}><i className="bi bi-diagram-3" style={{ color: '#10b981', marginRight: 8 }} />Áreas ({areas.length})</h3>
              <button onClick={() => setModalAreasList(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}><i className="bi bi-x-lg" /></button>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {areas.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #1f2937' }}>
                  <Avatar nombre={a.nombre} color="#10b981" />
                  <div>
                    <div style={{ color: '#fff', fontWeight: 500 }}>{a.nombre}</div>
                    <div style={{ color: '#f59e0b', fontSize: 11 }}>${(a.pagoPorHora || 0).toFixed(2)} / hora</div>
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
  const [areasEncargado, setAreasEncargado] = useState([]);
  const [areaSeleccionada, setAreaSeleccionada] = useState(null);
  const [areaObj, setAreaObj] = useState(null);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [okMsg,        setOkMsg]        = useState('');

  const [registrosHoy, setRegistrosHoy] = useState([]);
  const [busqueda,     setBusqueda]     = useState('');
  const [cargandoGPS,  setCargandoGPS]  = useState(false);
  const [lugarActual,  setLugarActual]  = useState('');
  const [coordsActual, setCoordsActual] = useState(null);
  const [modalEditHora, setModalEditHora] = useState(null);

  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalSalida,  setModalSalida]  = useState(false);
  const [seleccionEntrada, setSeleccionEntrada] = useState({});
  const [seleccionSalida,  setSeleccionSalida]  = useState({});

  const hoy = new Date();
  const [calMes,       setCalMes]       = useState(hoy.getMonth());
  const [calAnio,      setCalAnio]      = useState(hoy.getFullYear());
  const [diaSelec,     setDiaSelec]     = useState(null);
  const [datosDia,     setDatosDia]     = useState(null);
  const [diasConDatos, setDiasConDatos] = useState({});

  const limpiar = () => { setErrorMsg(''); setOkMsg(''); };

  const cargarAreasDelEncargado = async () => {
    const relaciones = await db.supervisor_areas.where('supervisorId').equals(usuario.id).toArray();
    const ids = relaciones.map(r => r.areaId);
    const areasList = await db.areas.where('id').anyOf(ids).toArray();
    setAreasEncargado(areasList);
    if (areasList.length > 0) {
      setAreaSeleccionada(areasList[0].id);
      setAreaObj(areasList[0]);
    }
  };

  const cargarDatos = async () => {
    await cargarAreasDelEncargado();
    await cargarTrabajadoresYRegistros();
  };

  const cargarTrabajadoresYRegistros = async () => {
    if (!areaSeleccionada) return;
    const area = await db.areas.get(areaSeleccionada);
    setAreaObj(area);
    const trabs = await db.trabajadores.where('areaId').equals(areaSeleccionada).toArray();
    setTrabajadores(trabs);
    await cargarRegistrosHoy();
  };

  const cargarRegistrosHoy = async () => {
    if (!areaSeleccionada) return;
    const inicio = inicioDiaLocal(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const fin    = finDiaLocal(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const regs   = (await db.asistencias.where('fecha').between(inicio, fin, true, true).toArray())
                  .filter(r => r.areaId === areaSeleccionada);
    setRegistrosHoy(regs);
  };

  useEffect(() => {
    cargarDatos();
  }, [vista]);

  useEffect(() => {
    if (areaSeleccionada) {
      cargarTrabajadoresYRegistros();
    }
  }, [areaSeleccionada]);

  useEffect(() => {
    if (vista !== 'calendario') return;
    const cargar = async () => {
      const inicio = inicioDiaLocal(calAnio, calMes, 1);
      const fin    = finDiaLocal(calAnio, calMes + 1, 0);
      const regs   = (await db.asistencias.where('fecha').between(inicio, fin, true, true).toArray())
                    .filter(r => r.areaId === areaSeleccionada);
      const mapa = {};
      regs.forEach(r => {
        const fechaLocal = new Date(r.fecha).toLocaleDateString('sv-SE');
        mapa[fechaLocal] = true;
      });
      setDiasConDatos(mapa);
    };
    if (areaSeleccionada) cargar();
  }, [vista, calMes, calAnio, areaSeleccionada]);

  const abrirDia = async (anio, mes, dia) => {
    const inicio = inicioDiaLocal(anio, mes, dia);
    const fin    = finDiaLocal(anio, mes, dia);
    const regs   = (await db.asistencias.where('fecha').between(inicio, fin, true, true).toArray())
                  .filter(r => r.areaId === areaSeleccionada);
    const encsDB = await db.supervisores.where('rol').equals('encargado').toArray();
    const areasDB= await db.areas.toArray();
    const enc    = encsDB.find(e => e.id === usuario.id);

    const porArea = areasDB.filter(a => a.id === areaSeleccionada).map(area => {
      const lugar = regs.find(r => r.lugar && r.lugar !== 'Sin GPS')?.lugar || 'Sin ubicación';
      const coords = regs.find(r => r.lat);
      const porTrab = trabajadores.map(t => {
        const nombre  = `${t.nombre} ${t.apellido}`;
        const entrada = regs.find(r => r.trabajadorId === nombre && r.tipo === 'entrada');
        const salida  = regs.find(r => r.trabajadorId === nombre && r.tipo === 'salida');
        const horas   = horasDiff(entrada?.fecha, salida?.fecha);
        const ganancia = horas * (area.pagoPorHora || 0);
        return { nombre, entrada: entrada?.fecha || null, salida: salida?.fecha || null, horas, ganancia, presente: !!entrada };
      });
      const totalGanancia = porTrab.reduce((s,t) => s+t.ganancia, 0);
      return { area, encargado: enc, lugar, coords: coords ? { lat: coords.lat, lng: coords.lng } : null, trabajadores: porTrab, totalGanancia };
    }).filter(Boolean);
    setDatosDia({ porArea, fecha: { anio, mes, dia } });
    setDiaSelec({ anio, mes, dia });
  };

  const obtenerGPS = async () => {
    setCargandoGPS(true);
    try {
      const coords = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(
          p => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
          rej, { timeout: 8000, enableHighAccuracy: true }
        )
      );
      setCoordsActual(coords);
      let lugar = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
      if (navigator.onLine) {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}`);
          const d = await r.json();
          lugar = d.display_name;
        } catch {}
      }
      setLugarActual(lugar);
      return { coords, lugar };
    } catch {
      setLugarActual('Sin GPS');
      return { coords: null, lugar: 'Sin GPS' };
    } finally {
      setCargandoGPS(false);
    }
  };

  const abrirModalEntrada = async () => {
    await obtenerGPS();
    const newSeleccion = {};
    for (const t of trabajadores) {
      const nombre = `${t.nombre} ${t.apellido}`;
      const reg = registrosHoy.find(r => r.trabajadorId === nombre && r.tipo === 'entrada');
      if (reg) {
        const fecha = new Date(reg.fecha);
        const hora = `${fecha.getHours().toString().padStart(2,'0')}:${fecha.getMinutes().toString().padStart(2,'0')}`;
        newSeleccion[t.id] = { checked: true, hora };
      } else {
        const ahora = new Date();
        const horaActual = `${ahora.getHours().toString().padStart(2,'0')}:${ahora.getMinutes().toString().padStart(2,'0')}`;
        newSeleccion[t.id] = { checked: false, hora: horaActual };
      }
    }
    setSeleccionEntrada(newSeleccion);
    setModalEntrada(true);
  };

  const guardarEntradas = async () => {
    limpiar();
    const operaciones = [];
    for (const [idStr, data] of Object.entries(seleccionEntrada)) {
      if (!data.checked) continue;
      const id = parseInt(idStr);
      const t = trabajadores.find(x => x.id === id);
      if (!t) continue;
      const nombre = `${t.nombre} ${t.apellido}`;
      const [hh, mm] = data.hora.split(':');
      const fechaPersonalizada = new Date();
      fechaPersonalizada.setHours(parseInt(hh), parseInt(mm), 0, 0);
      const isoFecha = fechaPersonalizada.toISOString();
      const existente = registrosHoy.find(r => r.trabajadorId === nombre && r.tipo === 'entrada');
      if (existente) {
        operaciones.push(db.asistencias.update(existente.id, { fecha: isoFecha, lat: coordsActual?.lat, lng: coordsActual?.lng, lugar: lugarActual || 'Sin GPS' }));
      } else {
        operaciones.push(db.asistencias.add({
          trabajadorId: nombre, fecha: isoFecha, tipo: 'entrada',
          lat: coordsActual?.lat, lng: coordsActual?.lng, lugar: lugarActual || 'Sin GPS',
          areaId: areaSeleccionada, sincronizado: 0
        }));
      }
    }
    await Promise.all(operaciones);
    await cargarRegistrosHoy();
    setModalEntrada(false);
    setOkMsg(`Entradas guardadas correctamente.`);
  };

  const abrirModalSalida = async () => {
    await obtenerGPS();
    const newSeleccion = {};
    for (const t of trabajadores) {
      const nombre = `${t.nombre} ${t.apellido}`;
      const regEntrada = registrosHoy.find(r => r.trabajadorId === nombre && r.tipo === 'entrada');
      if (!regEntrada) continue;
      const regSalida = registrosHoy.find(r => r.trabajadorId === nombre && r.tipo === 'salida');
      if (regSalida) {
        const fecha = new Date(regSalida.fecha);
        const hora = `${fecha.getHours().toString().padStart(2,'0')}:${fecha.getMinutes().toString().padStart(2,'0')}`;
        newSeleccion[t.id] = { checked: true, hora };
      } else {
        const ahora = new Date();
        const horaActual = `${ahora.getHours().toString().padStart(2,'0')}:${ahora.getMinutes().toString().padStart(2,'0')}`;
        newSeleccion[t.id] = { checked: false, hora: horaActual };
      }
    }
    setSeleccionSalida(newSeleccion);
    setModalSalida(true);
  };

  const guardarSalidas = async () => {
    limpiar();
    const operaciones = [];
    for (const [idStr, data] of Object.entries(seleccionSalida)) {
      if (!data.checked) continue;
      const id = parseInt(idStr);
      const t = trabajadores.find(x => x.id === id);
      if (!t) continue;
      const nombre = `${t.nombre} ${t.apellido}`;
      const [hh, mm] = data.hora.split(':');
      const fechaPersonalizada = new Date();
      fechaPersonalizada.setHours(parseInt(hh), parseInt(mm), 0, 0);
      const isoFecha = fechaPersonalizada.toISOString();
      const existente = registrosHoy.find(r => r.trabajadorId === nombre && r.tipo === 'salida');
      if (existente) {
        operaciones.push(db.asistencias.update(existente.id, { fecha: isoFecha, lat: coordsActual?.lat, lng: coordsActual?.lng, lugar: lugarActual || 'Sin GPS' }));
      } else {
        operaciones.push(db.asistencias.add({
          trabajadorId: nombre, fecha: isoFecha, tipo: 'salida',
          lat: coordsActual?.lat, lng: coordsActual?.lng, lugar: lugarActual || 'Sin GPS',
          areaId: areaSeleccionada, sincronizado: 0
        }));
      }
    }
    await Promise.all(operaciones);
    await cargarRegistrosHoy();
    setModalSalida(false);
    setOkMsg(`Salidas guardadas correctamente.`);
  };

  const guardarEdicionHora = async (nuevoISO) => {
    if (!modalEditHora || !nuevoISO) return;
    const reg = registrosHoy.find(r =>
      r.trabajadorId === modalEditHora.nombre &&
      r.tipo === modalEditHora.tipo &&
      new Date(r.fecha).toLocaleDateString('sv-SE') === new Date().toLocaleDateString('sv-SE')
    );
    if (reg) {
      await db.asistencias.update(reg.id, { fecha: nuevoISO });
      await cargarRegistrosHoy();
      setOkMsg('Hora actualizada ✓');
    }
    setModalEditHora(null);
  };

  const tieneEntrada = tid => {
    const t = trabajadores.find(x => x.id === tid);
    if (!t) return null;
    return registrosHoy.find(r => r.trabajadorId === `${t.nombre} ${t.apellido}` && r.tipo === 'entrada');
  };
  const tieneSalida = tid => {
    const t = trabajadores.find(x => x.id === tid);
    if (!t) return null;
    return registrosHoy.find(r => r.trabajadorId === `${t.nombre} ${t.apellido}` && r.tipo === 'salida');
  };
  const calcGanancia = tid => {
    const e = tieneEntrada(tid); const sal = tieneSalida(tid);
    if (!e || !sal) return null;
    return (horasDiff(e.fecha, sal.fecha) * (areaObj?.pagoPorHora || 0)).toFixed(2);
  };

  const filtrados = trabajadores.filter(t =>
    `${t.nombre} ${t.apellido}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={s.bg}>
      <header style={s.header}>
        <div>
          <h1 style={{ color: '#fff', fontSize: 18, margin: 0, fontWeight: 700 }}>
            JOB<span style={{ color: '#3b82f6' }}>ASSISTAND</span>
          </h1>
          <span style={{ color: '#10b981', fontSize: 11 }}>Encargado · {areaObj?.nombre || '—'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#9ca3af', fontSize: 12 }}>{usuario.nombre}</span>
          <button onClick={onLogout} style={s.btnLogout}><i className="bi bi-box-arrow-right" /></button>
        </div>
      </header>

      <main style={{ padding: '10px 12px 90px' }}>

        {vista === 'lista' && (
          <div>
            <h2 style={s.pageTitle}>Registro de Asistencia</h2>

            {areasEncargado.length > 1 && (
              <select style={s.select} value={areaSeleccionada || ''} onChange={e => setAreaSeleccionada(Number(e.target.value))}>
                {areasEncargado.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            )}

            {areaObj && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
                <span style={{ color: '#10b981', fontSize: 13, fontWeight: 600 }}>
                  <i className="bi bi-diagram-3" style={{ marginRight: 6 }} />{areaObj.nombre}
                </span>
                <span style={{ color: '#f59e0b', fontSize: 12, fontWeight: 600 }}>
                  <i className="bi bi-cash" style={{ marginRight: 4 }} />${(areaObj.pagoPorHora || 0).toFixed(2)}/hr
                </span>
              </div>
            )}

            <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={obtenerGPS} disabled={cargandoGPS}
                style={{ ...s.btnLogout, fontSize: 12, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 5, opacity: cargandoGPS ? 0.6 : 1 }}>
                <i className="bi bi-geo-alt" />{cargandoGPS ? 'Obteniendo GPS...' : 'Capturar Ubicación'}
              </button>
              {lugarActual && lugarActual !== 'Sin GPS' && (
                <span style={{ color: '#10b981', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <i className="bi bi-geo-alt-fill" style={{ marginRight: 4 }} />{lugarActual.slice(0, 60)}…
                </span>
              )}
            </div>

            <Err msg={errorMsg} /><Ok msg={okMsg} />

            {trabajadores.length === 0 ? (
              <div style={{ ...s.card, textAlign: 'center', color: '#6b7280' }}>
                <i className="bi bi-people" style={{ fontSize: 36, marginBottom: 10 }} />
                <p>No hay empleados en esta área.</p>
              </div>
            ) : (
              <>
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <i className="bi bi-search" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 14 }} />
                  <input
                    placeholder="Buscar empleado..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    style={{ ...s.input, marginBottom: 0, paddingLeft: 36 }}
                  />
                </div>

                <div style={{ maxHeight: '45vh', overflowY: 'auto', marginBottom: 10 }}>
                  {filtrados.map(t => {
                    const entrada  = tieneEntrada(t.id);
                    const salida   = tieneSalida(t.id);
                    const ganancia = calcGanancia(t.id);
                    const nombre   = `${t.nombre} ${t.apellido}`;
                    return (
                      <div key={t.id} style={{ ...s.listItem, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                          <Avatar nombre={t.nombre} color={entrada ? '#10b981' : '#6b7280'} size={32} />
                          <div>
                            <div style={{ color: '#fff', fontWeight: 500, fontSize: 14 }}>{nombre}</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                              {entrada && (
                                <span style={{ color: '#10b981', fontSize: 11 }}>
                                  <i className="bi bi-box-arrow-in-right" style={{ marginRight: 3 }} />
                                  {hhmm(entrada.fecha)}
                                  <button onClick={e => { e.stopPropagation(); setModalEditHora({ nombre, tipo: 'entrada', isoActual: entrada.fecha }); }}
                                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}>✏️</button>
                                </span>
                              )}
                              {salida && (
                                <span style={{ color: '#3b82f6', fontSize: 11 }}>
                                  <i className="bi bi-box-arrow-right" style={{ marginRight: 3 }} />
                                  {hhmm(salida.fecha)}
                                  <button onClick={e => { e.stopPropagation(); setModalEditHora({ nombre, tipo: 'salida', isoActual: salida.fecha }); }}
                                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}>✏️</button>
                                </span>
                              )}
                              {ganancia && (
                                <span style={{ color: '#f59e0b', fontSize: 11 }}>
                                  <i className="bi bi-cash" style={{ marginRight: 3 }} />${ganancia}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          {!entrada && <span style={{ background: 'rgba(107,114,128,0.15)', color: '#6b7280', borderRadius: 6, padding: '3px 8px', fontSize: 10 }}>Sin registro</span>}
                          {entrada && !salida && <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', borderRadius: 6, padding: '3px 8px', fontSize: 10 }}>En turno</span>}
                          {salida && <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', borderRadius: 6, padding: '3px 8px', fontSize: 10 }}>Completado</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={abrirModalEntrada} style={{ ...s.btnGreen, flex: 1, fontSize: 13 }}>
                    <i className="bi bi-box-arrow-in-right" style={{ marginRight: 6 }} />Registrar Entrada
                  </button>
                  <button onClick={abrirModalSalida} style={{ ...s.btnBlue, flex: 1, fontSize: 13 }}>
                    <i className="bi bi-box-arrow-right" style={{ marginRight: 6 }} />Registrar Salida
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {vista === 'calendario' && (
          <CalendarioAdmin
            calMes={calMes} setCalMes={setCalMes}
            calAnio={calAnio} setCalAnio={setCalAnio}
            diaSelec={diaSelec} setDiaSelec={setDiaSelec}
            datosDia={datosDia} diasConDatos={diasConDatos}
            abrirDia={abrirDia}
          />
        )}
      </main>

      <nav style={s.nav}>
        {[{ v: 'lista', icon: 'bi-clipboard-check' }, { v: 'calendario', icon: 'bi-calendar3' }].map(n => (
          <div key={n.v} style={s.navItem} onClick={() => { setVista(n.v); limpiar(); }}>
            <i className={`bi ${n.icon}`} style={{ color: vista === n.v ? '#3b82f6' : '#6b7280', fontSize: 22 }} />
          </div>
        ))}
      </nav>

      {modalEntrada && (
        <div style={s.overlay} onClick={() => setModalEntrada(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ color: '#fff', margin: '0 0 16px' }}>Registrar Entrada</h3>
            {trabajadores.map(t => {
              const sel = seleccionEntrada[t.id] || { checked: false, hora: '08:00' };
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <input type="checkbox" checked={sel.checked} onChange={e => setSeleccionEntrada(prev => ({ ...prev, [t.id]: { ...prev[t.id], checked: e.target.checked } }))} />
                  <span style={{ flex: 1, color: '#e5e7eb' }}>{t.nombre} {t.apellido}</span>
                  <input type="time" value={sel.hora} onChange={e => setSeleccionEntrada(prev => ({ ...prev, [t.id]: { ...prev[t.id], hora: e.target.value } }))}
                    style={{ ...s.input, width: 'auto', margin: 0, padding: '6px 10px' }} />
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={guardarEntradas} style={{ ...s.btnBlue, flex: 1 }}>Guardar</button>
              <button onClick={() => setModalEntrada(false)} style={{ ...s.btnLogout, flex: 1 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modalSalida && (
        <div style={s.overlay} onClick={() => setModalSalida(false)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ color: '#fff', margin: '0 0 16px' }}>Registrar Salida (solo presentes)</h3>
            {trabajadores.map(t => {
              const tieneEntradaHoy = registrosHoy.some(r => r.trabajadorId === `${t.nombre} ${t.apellido}` && r.tipo === 'entrada');
              if (!tieneEntradaHoy) return null;
              const sel = seleccionSalida[t.id] || { checked: false, hora: '17:00' };
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <input type="checkbox" checked={sel.checked} onChange={e => setSeleccionSalida(prev => ({ ...prev, [t.id]: { ...prev[t.id], checked: e.target.checked } }))} />
                  <span style={{ flex: 1, color: '#e5e7eb' }}>{t.nombre} {t.apellido}</span>
                  <input type="time" value={sel.hora} onChange={e => setSeleccionSalida(prev => ({ ...prev, [t.id]: { ...prev[t.id], hora: e.target.value } }))}
                    style={{ ...s.input, width: 'auto', margin: 0, padding: '6px 10px' }} />
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={guardarSalidas} style={{ ...s.btnBlue, flex: 1 }}>Guardar</button>
              <button onClick={() => setModalSalida(false)} style={{ ...s.btnLogout, flex: 1 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modalEditHora && (
        <ModalEditHora
          info={modalEditHora}
          onGuardar={guardarEdicionHora}
          onCerrar={() => setModalEditHora(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL EDITAR HORA
// ═══════════════════════════════════════════════════════════════════════════════
function ModalEditHora({ info, onGuardar, onCerrar }) {
  const actualHHMM = info.isoActual ? new Date(info.isoActual).toTimeString().slice(0,5) : '';
  const [hora, setHora] = useState(actualHHMM);

  const confirmar = () => {
    if (!hora) return;
    const [hh, mm] = hora.split(':');
    const base = new Date(info.isoActual || new Date());
    base.setHours(Number(hh), Number(mm), 0, 0);
    onGuardar(base.toISOString());
  };

  return (
    <div style={s.overlay} onClick={onCerrar}>
      <div style={s.modalBox} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: '#fff', margin: '0 0 6px' }}>
          Editar hora de {info.tipo === 'entrada' ? 'entrada' : 'salida'}
        </h3>
        <p style={{ color: '#6b7280', fontSize: 12, margin: '0 0 16px' }}>{info.nombre}</p>
        <input type="time" value={hora} onChange={e => setHora(e.target.value)}
          style={{ ...s.input, fontSize: 24, textAlign: 'center', letterSpacing: 3 }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={confirmar} style={{ ...s.btnBlue, flex: 1 }}>Guardar</button>
          <button onClick={onCerrar} style={{ ...s.btnLogout, flex: 1, padding: 12, borderRadius: 11, fontSize: 14 }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDARIO
// ═══════════════════════════════════════════════════════════════════════════════
function CalendarioAdmin({ calMes, setCalMes, calAnio, setCalAnio, diaSelec, setDiaSelec, datosDia, diasConDatos, abrirDia }) {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dias  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const hoy   = new Date();
  const primerDia = new Date(calAnio, calMes, 1).getDay();
  const totalDias = new Date(calAnio, calMes + 1, 0).getDate();
  const celdas    = Array(primerDia).fill(null).concat(Array.from({ length: totalDias }, (_, i) => i + 1));
  while (celdas.length % 7 !== 0) celdas.push(null);

  return (
    <div>
      <h2 style={s.pageTitle}>Calendario</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: '10px 16px', border: '1px solid #1f2937' }}>
        <button onClick={() => { if (calMes === 0) { setCalMes(11); setCalAnio(calAnio - 1); } else setCalMes(calMes - 1); setDiaSelec(null); }}
          style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}>
          <i className="bi bi-chevron-left" />
        </button>
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>{meses[calMes]} {calAnio}</span>
        <button onClick={() => { if (calMes === 11) { setCalMes(0); setCalAnio(calAnio + 1); } else setCalMes(calMes + 1); setDiaSelec(null); }}
          style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}>
          <i className="bi bi-chevron-right" />
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
        <button onClick={() => { setCalAnio(calAnio - 1); setDiaSelec(null); }}
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #374151', color: '#9ca3af', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>
          {calAnio - 1}
        </button>
        <span style={{ color: '#4b5563', fontSize: 12, alignSelf: 'center' }}>{calAnio}</span>
        <button onClick={() => { setCalAnio(calAnio + 1); setDiaSelec(null); }}
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #374151', color: '#9ca3af', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>
          {calAnio + 1}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 6 }}>
        {dias.map(d => <div key={d} style={{ textAlign: 'center', color: '#6b7280', fontSize: 11, fontWeight: 600, padding: '4px 0' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {celdas.map((dia, i) => {
          if (!dia) return <div key={`v-${i}`} />;
          const clave = `${calAnio}-${String(calMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
          const tiene = diasConDatos[clave];
          const esHoy = dia === hoy.getDate() && calMes === hoy.getMonth() && calAnio === hoy.getFullYear();
          const selec = diaSelec && diaSelec.dia === dia && diaSelec.mes === calMes && diaSelec.anio === calAnio;
          return (
            <div key={dia} onClick={() => abrirDia(calAnio, calMes, dia)}
              style={{
                textAlign: 'center', padding: '10px 0', borderRadius: 10, cursor: 'pointer',
                backgroundColor: selec ? '#3b82f6' : esHoy ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)',
                border: esHoy && !selec ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
                color: selec ? '#fff' : '#e5e7eb', fontWeight: esHoy || selec ? '700' : '400', fontSize: 14,
              }}>
              {dia}
              {tiene && <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: selec ? '#fff' : '#10b981', margin: '2px auto 0' }} />}
            </div>
          );
        })}
      </div>
      {diaSelec && datosDia && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ color: '#fff', margin: '0 0 12px', fontSize: 15 }}>
            <i className="bi bi-calendar-event" style={{ color: '#3b82f6', marginRight: 8 }} />
            {String(diaSelec.dia).padStart(2,'0')}/{String(diaSelec.mes+1).padStart(2,'0')}/{diaSelec.anio}
          </h4>
          {datosDia.porArea.length === 0 && <p style={{ color: '#4b5563', textAlign: 'center', fontSize: 13 }}>Sin registros para este día.</p>}
          {datosDia.porArea.map((bloque, bi) => (
            <div key={bi} style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid #1f2937', borderRadius: 16, padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ color: '#10b981', fontWeight: 700, fontSize: 14 }}>
                    <i className="bi bi-diagram-3" style={{ marginRight: 6 }} />{bloque.area.nombre}
                  </div>
                  {bloque.encargados && bloque.encargados.length > 0 && (
                    <div style={{ color: '#a78bfa', fontSize: 12, marginTop: 2 }}>
                      <i className="bi bi-person-badge" style={{ marginRight: 4 }} />
                      {bloque.encargados.map(e => `${e.nombre} ${e.apellido}`).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 15 }}>${bloque.totalGanancia.toFixed(2)}</div>
                  <div style={{ color: '#6b7280', fontSize: 10 }}>ganancia total</div>
                </div>
              </div>
              {bloque.lugar && bloque.lugar !== 'Sin ubicación' && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', backgroundColor: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 8, padding: '7px 10px', marginBottom: 10 }}>
                  <i className="bi bi-geo-alt-fill" style={{ color: '#10b981', fontSize: 12, marginTop: 2, flexShrink: 0 }} />
                  <span style={{ color: '#9ca3af', fontSize: 11, lineHeight: 1.4 }}>{bloque.lugar}</span>
                </div>
              )}
              {bloque.trabajadores.map((t, ti) => (
                <div key={ti} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar nombre={t.nombre} color={t.presente ? '#10b981' : '#4b5563'} size={28} />
                    <div>
                      <div style={{ color: t.presente ? '#d1d5db' : '#6b7280', fontSize: 13 }}>{t.nombre}</div>
                      {t.presente && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          {t.entrada && <span style={{ color: '#10b981', fontSize: 10 }}>↗ {hhmm(t.entrada)}</span>}
                          {t.salida  && <span style={{ color: '#3b82f6', fontSize: 10 }}>↙ {hhmm(t.salida)}</span>}
                          {t.horas > 0 && <span style={{ color: '#a78bfa', fontSize: 10 }}>{t.horas.toFixed(1)}h</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {t.presente ? (
                      <>
                        {t.ganancia > 0 && <div style={{ color: '#f59e0b', fontSize: 12, fontWeight: 600 }}>${t.ganancia.toFixed(2)}</div>}
                        <div style={{ color: '#10b981', fontSize: 10 }}>✓ presente</div>
                      </>
                    ) : (
                      <div style={{ color: '#ef4444', fontSize: 10 }}>✗ ausente</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESTILOS GLOBALES
// ═══════════════════════════════════════════════════════════════════════════════
const s = {
  bg:        { backgroundColor: '#0B0E14', minHeight: '100vh', fontFamily: 'system-ui,sans-serif', color: '#fff' },
  loginCard: { backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: 28, margin: '60px auto 0', maxWidth: 380, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, backgroundColor: '#0B0E14', zIndex: 10 },
  pageTitle: { color: '#fff', fontSize: 22, margin: '0 0 14px', fontWeight: 700 },
  card:      { backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 20, marginBottom: 14 },
  cardTitle: { color: '#fff', fontSize: 15, margin: '0 0 14px', fontWeight: 600 },
  statCard:  { backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', borderRadius: 18, padding: 14, textAlign: 'center' },
  listItem:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: 8, borderRadius: 14, border: '1px solid #1f2937' },
  input:     { width: '100%', padding: '13px 14px', marginBottom: 12, borderRadius: 11, border: '1px solid #374151', backgroundColor: '#111827', color: 'white', boxSizing: 'border-box', fontSize: 14, outline: 'none' },
  select:    { width: '100%', padding: '13px 14px', marginBottom: 12, borderRadius: 11, border: '1px solid #374151', backgroundColor: '#111827', color: 'white', boxSizing: 'border-box', fontSize: 14, outline: 'none' },
  fieldLabel:{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 5, fontWeight: 600, letterSpacing: 0.3 },
  secLabel:  { color: '#9ca3af', fontSize: 12, margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: 1 },
  btnBlue:   { width: '100%', padding: '13px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: 11, cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  btnGreen:  { width: '100%', padding: '13px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 11, cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  btnDanger: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', flexShrink: 0 },
  btnEdit:   { background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', flexShrink: 0 },
  btnLogout: { background: 'rgba(255,255,255,0.06)', border: '1px solid #374151', color: '#9ca3af', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' },
  nav:       { position: 'fixed', bottom: 0, width: '100%', height: 64, backgroundColor: 'rgba(11,14,20,0.95)', backdropFilter: 'blur(10px)', display: 'flex', borderTop: '1px solid #1f2937', justifyContent: 'space-around', alignItems: 'center', zIndex: 100 },
  navItem:   { cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 16px' },
  errBanner: { backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: 10, padding: '11px 14px', marginBottom: 13, fontSize: 13, display: 'flex', alignItems: 'center' },
  okBanner:  { backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7', borderRadius: 10, padding: '11px 14px', marginBottom: 13, fontSize: 13, display: 'flex', alignItems: 'center' },
  overlay:   { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modalBox:  { backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '22px 22px 0 0', padding: 22, width: '100%', maxWidth: 500 },
};
