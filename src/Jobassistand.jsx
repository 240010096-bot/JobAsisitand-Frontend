import React, { useState, useEffect } from 'react';
import { db } from './db';

// --- Helpers de UI ---
const inputStyle = { width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #374151', backgroundColor: '#1f2937', color: '#fff' };
const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' };
const modalContent = { backgroundColor: '#111827', width: '100%', maxWidth: '500px', borderRadius: '15px', padding: '20px', maxHeight: '80vh', overflowY: 'auto', border: '1px solid #374151' };

function Jobassistand() {
  const [usuario, setUsuario] = useState(() => JSON.parse(localStorage.getItem('session_usuario')));
  const [activeTab, setActiveTab] = useState('asistencia');
  const [listaTrabajadores, setListaTrabajadores] = useState([]);
  const [asistenciasHoy, setAsistenciasHoy] = useState([]);
  
  // Estados de UI
  const [mostrarPass, setMostrarPass] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(null); // 'entrada' | 'retardo' | 'salida'
  const [registrosCalendario, setRegistrosCalendario] = useState([]);

  const hoy = new Date().toISOString().split('T')[0];
  const esAdmin = usuario?.rol === 'admin';

  // 1. Carga de Datos y Sincronización con Calendario
  useEffect(() => {
    const cargarDatos = async () => {
      const t = await db.trabajadores.toArray();
      const a = await db.asistencias.where('fecha').equals(hoy).toArray();
      const todos = await db.asistencias.toArray();
      setListaTrabajadores(t);
      setAsistenciasHoy(a);
      setRegistrosCalendario(todos);
    };
    cargarDatos();
  }, [modalAbierto]);

  // 2. Lógica de Filtrado para Salida
  const obtenerCandidatosSalida = () => {
    return listaTrabajadores.filter(t => 
      asistenciasHoy.some(a => a.trabajadorId === t.id && (a.tipo === 'entrada' || a.tipo === 'retardo'))
    );
  };

  // 3. Componente de Input de Password con Visibilidad
  const PasswordInput = ({ placeholder, value, onChange, name }) => (
    <div style={{ position: 'relative', marginBottom: '10px' }}>
      <input 
        type={mostrarPass ? "text" : "password"} 
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={inputStyle}
      />
      <i 
        className={`bi ${mostrarPass ? 'bi-eye-slash' : 'bi-eye'} position-absolute`}
        style={{ right: '15px', top: '12px', cursor: 'pointer', color: '#9ca3af' }}
        onClick={() => setMostrarPass(!mostrarPass)}
      />
    </div>
  );

  // 4. Modal de Asistencia (Lista Emergente)
  const ModalAsistencia = ({ tipo }) => {
    const titulo = tipo === 'entrada' ? 'Registrar Entrada' : tipo === 'retardo' ? 'Registrar Retardos' : 'Registrar Salida';
    const personal = tipo === 'salida' ? obtenerCandidatosSalida() : listaTrabajadores;

    return (
      <div style={modalOverlay}>
        <div style={modalContent}>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h3 className="h5 mb-0 text-capitalize">{titulo}</h3>
            <button className="btn-close btn-close-white" onClick={() => setModalAbierto(null)}></button>
          </div>
          
          <div className="list-group list-group-flush">
            {personal.map(t => {
              const registro = asistenciasHoy.find(a => a.trabajadorId === t.id && a.tipo === tipo);
              const yaEntro = asistenciasHoy.some(a => a.trabajadorId === t.id && a.tipo === 'entrada');

              return (
                <div key={t.id} className="list-group-item bg-transparent border-secondary d-flex justify-content-between align-items-center px-0">
                  <div>
                    <div className="text-white fw-bold">{t.nombre} {t.apellido}</div>
                    <small className="text-secondary">{t.areaNombre}</small>
                  </div>
                  <button 
                    disabled={registro || (tipo === 'retardo' && yaEntro)}
                    className={`btn btn-sm ${registro ? 'btn-success' : 'btn-outline-primary'}`}
                    onClick={() => registrarAccion(t.id, tipo)}
                  >
                    {registro ? <i className="bi bi-check-lg"></i> : 'Marcar'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const registrarAccion = async (id, tipo) => {
    await db.asistencias.add({
      trabajadorId: id,
      tipo: tipo,
      fecha: hoy,
      hora: new Date().toLocaleTimeString(),
      sincronizado: 0
    });
    // Forzar recarga de datos
    const a = await db.asistencias.where('fecha').equals(hoy).toArray();
    setAsistenciasHoy(a);
  };

  return (
    <div style={{ backgroundColor: '#0B0E14', minHeight: '100vh', color: '#fff' }}>
      
      {/* Botones de Acción */}
      <div className="p-3 d-flex gap-2">
        <button className="btn btn-primary flex-grow-1" onClick={() => setModalAbierto('entrada')}>Entrada</button>
        <button className="btn btn-warning flex-grow-1" onClick={() => setModalAbierto('retardo')}>Retardo</button>
        <button className="btn btn-danger flex-grow-1" onClick={() => setModalAbierto('salida')}>Salida</button>
      </div>

      {/* Lista Principal (Lectura) */}
      <div className="px-3">
        <h4 className="h6 text-secondary mb-3">Estatus de Hoy ({hoy})</h4>
        <div className="table-responsive">
          <table className="table table-dark table-hover border-secondary">
            <thead>
              <tr>
                <th>Personal</th>
                <th>Estado</th>
                {esAdmin && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {listaTrabajadores.map(t => {
                const asis = asistenciasHoy.filter(a => a.trabajadorId === t.id);
                return (
                  <tr key={t.id}>
                    <td>{t.nombre}</td>
                    <td>
                      {asis.map(a => (
                        <span key={a.id} className="badge bg-info me-1">{a.tipo}</span>
                      ))}
                    </td>
                    {esAdmin && (
                      <td>
                        <button className="btn btn-sm btn-outline-light border-0">
                          <i className="bi bi-pencil-square"></i>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Renderizado de Modales */}
      {modalAbierto && <ModalAsistencia tipo={modalAbierto} />}

      {/* Calendario Corregido */}
      {activeTab === 'calendario' && (
        <div className="p-3">
          {/* Aquí mapear registrosCalendario para mostrar puntos en los días correspondientes */}
        </div>
      )}
    </div>
  );
}

export default Jobassistand;
