import React, { useState, useEffect } from 'react';
import { db } from './db'; // Asegúrate de que la ruta a db.js sea correcta

function Jobassistand() {
  // 1. Estados
  const [usuario, setUsuario] = useState(() => {
    try {
      const guardado = localStorage.getItem('session_usuario');
      return guardado ? JSON.parse(guardado) : null;
    } catch { return null; }
  });

  const [busqueda, setBusqueda] = useState('');
  const [seleccionados, setSeleccionados] = useState([]);
  const [listaTrabajadores, setListaTrabajadores] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);

  // 2. Lógica de Roles (Seguridad)
  const esAdmin = usuario?.rol === 'admin';

  // 3. Filtrado Dinámico
  const trabajadoresFiltrados = listaTrabajadores.filter(t => {
    const nombreCompleto = `${t.nombre} ${t.apellido}`.toLowerCase();
    const coincideBusqueda = nombreCompleto.includes(busqueda.toLowerCase());
    
    // El administrador ve a todos, el encargado solo su área asignada
    if (esAdmin) return coincideBusqueda;
    return coincideBusqueda && t.areaId === usuario?.areaId;
  });

  // 4. Manejo de Selección Masiva
  const handleSelectAll = (e) => {
    setSeleccionados(e.target.checked ? trabajadoresFiltrados.map(t => t.id) : []);
  };

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // 5. Cargar datos de la base de datos local
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const data = await db.trabajadores.toArray();
        setListaTrabajadores(data);
      } catch (err) {
        console.error("Error al cargar trabajadores:", err);
      }
    };
    cargarDatos();
  }, []);

  if (!usuario) return <div className="p-5 text-center text-white">Inicia sesión para continuar.</div>;

  return (
    <div style={{ backgroundColor: '#0B0E14', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif' }}>
      
      {/* HEADER DINÁMICO */}
      <div className="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
        <h2 className="h5 mb-0">
          <i className={`bi ${esAdmin ? 'bi-shield-lock-fill text-primary' : 'bi-person-badge text-info'} me-2`}></i>
          Panel de {esAdmin ? 'Administrador' : 'Encargado'}
        </h2>
        {esAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => setMostrarModal(true)}>
            <i className="bi bi-person-plus-fill me-2"></i>
            Nuevo Colaborador
          </button>
        )}
      </div>

      {/* BUSCADOR */}
      <div className="p-3">
        <div className="input-group">
          <span className="input-group-text bg-dark border-secondary text-white border-end-0">
            <i className="bi bi-search"></i>
          </span>
          <input 
            type="text" 
            className="form-control bg-dark text-white border-secondary border-start-0 shadow-none"
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* TABLA DE ASISTENCIA */}
      <div className="table-responsive px-3">
        <table className="table table-dark table-hover align-middle border-secondary">
          <thead className="text-secondary">
            <tr>
              <th style={{ width: '40px' }}>
                <input 
                  type="checkbox" 
                  className="form-check-input" 
                  onChange={handleSelectAll}
                  checked={seleccionados.length === trabajadoresFiltrados.length && trabajadoresFiltrados.length > 0}
                />
              </th>
              <th>Nombre</th>
              <th>Área</th>
              {esAdmin && <th>Pago (8h)</th>}
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {trabajadoresFiltrados.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #1f2937' }}>
                <td>
                  <input 
                    type="checkbox" 
                    className="form-check-input"
                    checked={seleccionados.includes(t.id)}
                    onChange={() => toggleSeleccion(t.id)}
                  />
                </td>
                <td>
                  <div className="fw-bold">{t.nombre} {t.apellido}</div>
                  <small className="text-secondary" style={{ fontSize: '11px' }}>{t.curp || 'IDENTIFICACIÓN PENDIENTE'}</small>
                </td>
                <td><span className="badge bg-secondary opacity-75">{t.areaNombre || 'General'}</span></td>
                {esAdmin && (
                  <td className="text-success fw-bold">
                    ${(t.pagoPorHora * 8) || 0}
                  </td>
                )}
                <td className="text-end">
                  <i className="bi bi-geo-alt-fill text-info" style={{ cursor: 'pointer' }}></i>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ACCIÓN MASIVA (Flotante) */}
      {seleccionados.length > 0 && (
        <div className="position-fixed bottom-0 start-50 translate-middle-x mb-4 p-3 bg-primary rounded-pill shadow-lg d-flex align-items-center" style={{ zIndex: 1000 }}>
          <span className="me-3 fw-bold">{seleccionados.length} seleccionados</span>
          <button className="btn btn-light btn-sm rounded-pill fw-bold" onClick={() => alert("Registrando asistencia...")}>
            Pasar Lista
          </button>
        </div>
      )}
    </div>
  );
}

export default Jobassistand;
