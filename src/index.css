import React, { useState, useEffect } from 'react';
// IMPORTANTE: Esta línea es la que arregla el error 'db is not defined'
import { db } from '../db'; 

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

  // 2. Lógica de Roles
  const esAdmin = usuario?.rol === 'admin';

  // 3. Filtrado de trabajadores
  const trabajadoresFiltrados = listaTrabajadores.filter(t => {
    const coincideNombre = `${t.nombre} ${t.apellido}`.toLowerCase().includes(busqueda.toLowerCase());
    // El encargado solo ve su área, el admin ve todo
    return esAdmin ? coincideNombre : (coincideNombre && t.areaId === usuario?.areaId);
  });

  // 4. Manejo de selección masiva
  const handleSelectAll = (e) => {
    setSeleccionados(e.target.checked ? trabajadoresFiltrados.map(t => t.id) : []);
  };

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // 5. Carga de datos desde la DB (Dexie)
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
    <div style={{ backgroundColor: '#0B0E14', minHeight: '100vh', color: '#fff' }}>
      
      {/* HEADER DINÁMICO */}
      <div className="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
        <h2 className="h5 mb-0">Panel de {esAdmin ? 'Administrador' : 'Encargado'}</h2>
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
          <span className="input-group-text bg-dark border-secondary text-white">
            <i className="bi bi-search"></i>
          </span>
          <input 
            type="text" 
            className="form-control bg-dark text-white border-secondary shadow-none"
            placeholder="Buscar trabajador..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* TABLA */}
      <div className="table-responsive px-3">
        <table className="table table-dark table-hover align-middle">
          <thead>
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
              {esAdmin && <th>Pago Base (8h)</th>}
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {trabajadoresFiltrados.map(t => (
              <tr key={t.id}>
                <td>
                  <input 
                    type="checkbox" 
                    className="form-check-input"
                    checked={seleccionados.includes(t.id)}
                    onChange={() => toggleSeleccion(t.id)}
                  />
                </td>
                <td>{t.nombre} {t.apellido}</td>
                <td><span className="badge bg-secondary">{t.areaNombre || 'Sin área'}</span></td>
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
    </div>
  );
}

export default Jobassistand;
