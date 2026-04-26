import Dexie from 'dexie';

export const db = new Dexie('AgroAsistenciaDB');

db.version(22).stores({
  supervisores: '++id, email, password, nombre, apellido, rol, areaId',
  areas:        '++id, nombre',
  trabajadores: '++id, nombre, apellido, areaId, telefono, curp',
  asistencias:  '++id, trabajadorId, fecha, lat, lng, lugar, areaId, sincronizado',
});

db.open().catch(err => console.error('Error abriendo DB:', err));
export default db;
