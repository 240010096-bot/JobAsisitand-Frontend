import Dexie from 'dexie';

export const db = new Dexie('AgroAsistenciaDB');

// Versión 21 — nuevo esquema con roles, áreas y pagos
db.version(21).stores({
  // areaId vincula al trabajador con su área y permite filtrado por encargado
  asistencias: '++id, trabajadorId, fecha, lat, lng, tipo, areaId, totalCalculado',

  // pagoPorHora para cálculo financiero; curp como identificación
  trabajadores: '++id, nombre, apellido, areaId, telefono, curp, pagoPorHora',

  // rol ('admin' | 'encargado') + areaId para control de acceso
  supervisores: '++id, email, password, nombre, apellido, rol, areaId',

  // Catálogo de áreas con tarifa por hora
  areas: '++id, nombre, pagoPorHora',
});

db.open().catch(err => {
  console.error('No se pudo abrir la base de datos:', err);
});

export default db;
