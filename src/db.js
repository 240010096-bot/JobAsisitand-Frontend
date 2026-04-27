import Dexie from 'dexie';

export const db = new Dexie('AgroAsistenciaDB');

db.version(23).stores({
  supervisores: '++id, email, password, nombre, apellido, rol, areaId',
  areas:        '++id, nombre, pagoPorHora',
  trabajadores: '++id, nombre, apellido, areaId, telefono, curp',
  asistencias:  '++id, trabajadorId, fecha, tipo, lat, lng, lugar, areaId, sincronizado',
});

db.open().catch(err => console.error('Error abriendo DB:', err));
export default db;
