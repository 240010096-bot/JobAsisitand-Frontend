import Dexie from 'dexie';

export const db = new Dexie('AgroAsistenciaDB');

db.version(21).stores({
  asistencias: '++id, trabajadorId, fecha, lat, lng, tipo, areaId, totalCalculado', 
  trabajadores: '++id, nombre, apellido, areaId, telefono, curp',
  supervisores: '++id, email, password, nombre, apellido, rol, areaId', 
  areas: '++id, nombre, pagoPorHora' 
});
