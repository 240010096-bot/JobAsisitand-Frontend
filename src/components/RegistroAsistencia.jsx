import React, { useState, useEffect } from 'react';
import { db } from '../db';

function Jobassistand() {
  const [usuario, setUsuario] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [vista, setVista] = useState("welcome");
  const [status, setStatus] = useState("Listo");
  const [trabajadores, setTrabajadores] = useState([]);
  const [seleccionados, setSeleccionados] = useState({});
  const [faltantes, setFaltantes] = useState([]);

  const [formData, setFormData] = useState({ nombre: "", apellido: "", email: "", pass: "", confirm: "" });
  const [formTrabajador, setFormTrabajador] = useState({ nombre: "", apellido: "", area: "" });

  const toggleAuthMode = () => {
    setAuthMode(authMode === "login" ? "register" : "login");
    setFormData({ nombre: "", apellido: "", email: "", pass: "", confirm: "" });
  };

  useEffect(() => {
    if (usuario) {
      const load = async () => setTrabajadores(await db.trabajadores.toArray());
      load();
    }
  }, [vista, usuario]);

  const cerrarSesion = () => {
    setUsuario(null);
    setVista("welcome");
    setStatus("Sesión cerrada");
  };

  // --- FUNCIÓN DE ASISTENCIA CON SOPORTE OFFLINE TOTAL ---
const confirmarAsistencia = async () => {
    const presentes = trabajadores.filter(t => seleccionados[t.id]);
    if (presentes.length === 0) return alert("Selecciona al menos un trabajador");

    setStatus("Procesando...");
    
    try {
      let lat = null;
      let lng = null;
      let nombreLugar = "Ubicación desconocida (Offline/Sin GPS)";

      // 1. TIMEOUT ESTRICTO PARA EL GPS: Si tarda más de 3 segundos, lo abortamos.
      const gpsPromise = new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => reject(err),
          { timeout: 3000, enableHighAccuracy: false, maximumAge: Infinity }
        );
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Tiempo de GPS agotado")), 3000)
      );

      try {
        // Ejecutamos una "carrera". Gana el GPS o gana el Timeout.
        const coords = await Promise.race([gpsPromise, timeoutPromise]);
        lat = coords.lat;
        lng = coords.lng;

        // 2. ¿TENEMOS INTERNET? Solo pedimos la dirección si estamos online
        if (navigator.onLine) {
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
            if (response.ok) {
              const data = await response.json();
              nombreLugar = data.display_name;
            }
          } catch (apiError) {
            nombreLugar = "Coordenadas guardadas (Error de red al traducir lugar)";
          }
        } else {
          nombreLugar = "Coordenadas guardadas (Sin internet para traducir lugar)";
        }
      } catch (gpsError) {
        console.warn("Se saltó el GPS por estar offline o tardar demasiado.");
      }

      // 3. PREPARAMOS LOS DATOS
      const registros = presentes.map(t => ({
        trabajadorId: `${t.nombre} ${t.apellido}`,
        fecha: new Date().toISOString(),
        lat: lat,
        lng: lng,
        lugar: nombreLugar,
        sincronizado: 0
      }));

      // 4. ¡GUARDADO LOCAL INMEDIATO! 
      // Al no quedarse trabado arriba, esta línea ahora se ejecutará al instante.
      await db.asistencias.bulkAdd(registros);
      console.log("✅ Datos guardados en BD Local (Dexie):", registros);

      // 5. INTENTO DE SINCRONIZACIÓN AL BACKEND (Solo si hay internet)
      if (navigator.onLine) {
        try {
          await fetch('https://jobasisitand-backend.onrender.com/api/asistencia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registros)
          });
          console.log("✅ Datos enviados al servidor local.");
        } catch (err) {
          console.warn("⚠️ Servidor inalcanzable, se enviará después.");
        }
      }

      // 6. ACTUALIZAR INTERFAZ
      setFaltantes(trabajadores.filter(t => !seleccionados[t.id]));
      setSeleccionados({});
      setVista("resumen");
      setStatus("Guardado localmente");
      
    } catch (err) { 
      console.error("Error crítico:", err);
      alert("Error al procesar la información."); 
      setStatus("Error del sistema");
    }
  };

  //////////////////////////////////////////////////////////////////////////

  const handleAuth = async () => {
    if (authMode === "register") {
      if (formData.pass !== formData.confirm) return alert("Las contraseñas no coinciden");
      await db.supervisores.add({ 
        nombre: formData.nombre, 
        apellido: formData.apellido, 
        email: formData.email, 
        password: formData.pass 
      });
      alert("Cuenta creada con éxito");
      toggleAuthMode();
    } else {
      const user = await db.supervisores.where("email").equals(formData.email).first();
      if (user && user.password === formData.pass) {
        setUsuario(user);
        setStatus("Conectado");
      } else {
        alert("Credenciales incorrectas");
      }
    }
  };

  const obtenerFechaActual = () => {
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('es-ES', opciones);
  };

  return (
    <div style={containerStyle}>
      {/* HEADER VISIBLE SOLO AL INICIAR SESIÓN */}
      {usuario && (
        <header style={headerStyle}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '20px', margin: 0 }}>AgriSync PWA</h1>
            <span style={{ color: '#9ca3af', fontSize: '12px' }}>{usuario.nombre} {usuario.apellido}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#10b981', textTransform: 'uppercase', fontWeight: 'bold' }}>
              <i className="bi bi-circle-fill" style={{ fontSize: '8px', marginRight: '4px' }}></i>
              {status}
            </div>
          </div>
        </header>
      )}

      <main style={mainStyle}>
        {!usuario ? (
          <div style={cardStyle}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <i className="bi bi-person-badge" style={{ fontSize: '48px', color: '#3b82f6' }}></i>
              <h2 style={{ color: '#fff', marginTop: '10px' }}>{authMode === "login" ? "Ingresar" : "Nueva Cuenta"}</h2>
            </div>
            
            {authMode === "register" && (
              <>
                <input placeholder="Nombre" style={inputStyle} value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} />
                <input placeholder="Apellido" style={inputStyle} value={formData.apellido} onChange={e => setFormData({ ...formData, apellido: e.target.value })} />
              </>
            )}
            
            <input type="email" placeholder="Correo electrónico" style={inputStyle} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            <input type="password" placeholder="Contraseña" style={inputStyle} value={formData.pass} onChange={e => setFormData({ ...formData, pass: e.target.value })} />
            
            {authMode === "register" && (
              <input type="password" placeholder="Confirmar contraseña" style={inputStyle} value={formData.confirm} onChange={e => setFormData({ ...formData, confirm: e.target.value })} />
            )}

            <button onClick={handleAuth} style={btnPrimary}>{authMode === "login" ? "Entrar" : "Crear Cuenta"}</button>
            <p onClick={toggleAuthMode} style={{ textAlign: 'center', color: '#3b82f6', cursor: 'pointer', marginTop: '20px' }}>
              {authMode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Entra"}
            </p>
          </div>
        ) : (
          <>
            {/* VISTA DASHBOARD */}
            {vista === "welcome" && (
              <div style={{ padding: '0 10px' }}>
                <h2 style={{ color: '#fff', fontSize: '24px', margin: '0 0 5px 0' }}>Dashboard</h2>
                <p style={{ color: '#9ca3af', marginBottom: '20px', textTransform: 'capitalize' }}>{obtenerFechaActual()}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div style={statCardStyle}>
                    <i className="bi bi-people" style={{ fontSize: '28px', color: '#3b82f6' }}></i>
                    <h3 style={{ color: '#fff', margin: '10px 0 0 0' }}>{trabajadores.length}</h3>
                    <p style={{ color: '#9ca3af', fontSize: '12px' }}>Total Personal</p>
                  </div>
                  <div style={statCardStyle}>
                    <i className="bi bi-geo-alt" style={{ fontSize: '28px', color: '#10b981' }}></i>
                    <h3 style={{ color: '#fff', margin: '10px 0 0 0' }}>GPS</h3>
                    <p style={{ color: '#9ca3af', fontSize: '12px' }}>Activo</p>
                  </div>
                </div>
                <div style={cardStyle}>
                  <h3 style={{ color: '#fff', marginTop: 0 }}>Acciones Rápidas</h3>
                  <button onClick={() => setVista("registro")} style={{...btnPrimary, marginBottom: '10px', display: 'flex', justifyContent: 'space-between'}}>
                    <span>Pasar Asistencia</span><i className="bi bi-chevron-right"></i>
                  </button>
                  <button onClick={() => setVista("agregar")} style={{...btnPrimary, backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between'}}>
                    <span>Nuevo Colaborador</span><i className="bi bi-plus-lg"></i>
                  </button>
                </div>
              </div>
            )}

            {/* VISTA CONFIGURACIÓN */}
            {vista === "configuracion" && (
              <div style={{ padding: '0 10px' }}>
                <h2 style={{ color: '#fff', marginBottom: '20px' }}>Configuración</h2>
                <div style={cardStyle}>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ width: '60px', height: '60px', backgroundColor: '#3b82f6', borderRadius: '50%', margin: '0 auto 10px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#fff', fontWeight: 'bold' }}>
                      {usuario.nombre ? usuario.nombre.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <h3 style={{ color: '#fff', margin: 0 }}>{usuario.nombre} {usuario.apellido}</h3>
                    <p style={{ color: '#9ca3af', fontSize: '14px' }}>{usuario.email}</p>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid #1f2937', margin: '20px 0' }} />
                  <button onClick={cerrarSesion} style={{ ...btnPrimary, backgroundColor: '#ef4444' }}>
                    <i className="bi bi-box-arrow-left" style={{ marginRight: '10px' }}></i>
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            )}

            {/* VISTA AGREGAR TRABAJADOR */}
            {vista === "agregar" && (
              <div style={cardStyle}>
                <h3 style={{ color: '#fff' }}>Nuevo Colaborador</h3>
                <input placeholder="Nombre" style={inputStyle} value={formTrabajador.nombre} onChange={e => setFormTrabajador({ ...formTrabajador, nombre: e.target.value })} />
                <input placeholder="Apellido" style={inputStyle} value={formTrabajador.apellido} onChange={e => setFormTrabajador({ ...formTrabajador, apellido: e.target.value })} />
                <input placeholder="Área" style={inputStyle} value={formTrabajador.area} onChange={e => setFormTrabajador({ ...formTrabajador, area: e.target.value })} />
                <button onClick={async () => { await db.trabajadores.add({ ...formTrabajador }); setFormTrabajador({ nombre: "", apellido: "", area: "" }); alert("Guardado"); setVista("welcome"); }} style={btnPrimary}>Registrar</button>
              </div>
            )}

            {/* VISTA PASE DE LISTA */}
            {vista === "registro" && (
              <div>
                <h3 style={{ color: '#fff', paddingLeft: '20px' }}>Pase de Lista</h3>
                {trabajadores.map(t => (
                  <div key={t.id} style={itemStyle}>
                    <span style={{ color: '#fff' }}>{t.nombre} {t.apellido}</span>
                    <input type="checkbox" checked={!!seleccionados[t.id]} onChange={() => setSeleccionados({ ...seleccionados, [t.id]: !seleccionados[t.id] })} style={{ width: '22px', height: '22px', accentColor: '#10b981' }} />
                  </div>
                ))}
                <button style={btnConfirm} onClick={confirmarAsistencia}>Confirmar Asistencia</button>
              </div>
            )}

            {/* VISTA RESUMEN DE ASISTENCIA */}
            {vista === "resumen" && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <i className="bi bi-check-circle" style={{ fontSize: '50px', color: '#10b981' }}></i>
                <h3 style={{ color: '#fff' }}>Reporte de Hoy</h3>
                {faltantes.length > 0 ? (
                  faltantes.map(f => (
                    <div key={f.id} style={{ ...itemStyle, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                      <span style={{ color: '#ef4444' }}>AUSENTE: {f.nombre} {f.apellido}</span>
                    </div>
                  ))
                ) : <p style={{ color: '#10b981' }}>Asistencia completa</p>}
                <button style={{...btnPrimary, marginTop: '20px'}} onClick={() => setVista("welcome")}>Volver al inicio</button>
              </div>
            )}
          </>
        )}
      </main>

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      {usuario && (
        <nav style={navStyle}>
          <div style={navItem} onClick={() => setVista("registro")}><i className="bi bi-clipboard-check" style={{ color: vista === 'registro' ? '#3b82f6' : '#fff' }}></i></div>
          <div style={navItem} onClick={() => setVista("welcome")}><i className="bi bi-house-door" style={{ color: vista === 'welcome' ? '#3b82f6' : '#fff' }}></i></div>
          <div style={navItem} onClick={() => setVista("configuracion")}><i className="bi bi-gear" style={{ color: vista === 'configuracion' ? '#3b82f6' : '#fff' }}></i></div>
        </nav>
      )}
    </div>
  );
}

// --- ESTILOS DE LA APLICACIÓN ---
const containerStyle = { backgroundColor: '#0B0E14', minHeight: '100vh', paddingBottom: '90px', fontFamily: 'system-ui, sans-serif' };
const cardStyle = { backgroundColor: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '25px', borderRadius: '24px', margin: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' };
const inputStyle = { width: '100%', padding: '15px', marginBottom: '15px', borderRadius: '12px', border: '1px solid #374151', backgroundColor: '#111827', color: 'white', boxSizing: 'border-box' };
const btnPrimary = { width: '100%', padding: '15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' };
const btnConfirm = { width: '90%', margin: '0 5% 20px 5%', padding: '18px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' };
const navStyle = { position: 'fixed', bottom: 0, width: '100%', height: '70px', backgroundColor: 'rgba(17, 24, 39, 0.8)', backdropFilter: 'blur(10px)', display: 'flex', borderTop: '1px solid #1f2937', justifyContent: 'space-around', alignItems: 'center', zIndex: 100 };
const navItem = { cursor: 'pointer', fontSize: '24px', color: '#fff' };
const itemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', backgroundColor: 'rgba(255, 255, 255, 0.03)', margin: '0 20px 10px 20px', borderRadius: '15px', border: '1px solid #1f2937' };
const mainStyle = { padding: '10px' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 25px', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, backgroundColor: '#0B0E14', zIndex: 10 };
const statCardStyle = { backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '15px', borderRadius: '20px', textAlign: 'center', border: '1px solid #1f2937' };

export default Jobassistand;
