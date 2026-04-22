import Dexie from 'dexie';

// 1. Creamos la instancia
export const db = new Dexie('AgroAsistenciaDB'); 



db.version(16).stores({
  asistencias: '++id, trabajadorId, fecha, lat, lng, lugar, sincronizado',
  trabajadores: '++id, nombre, apellido, area',
  supervisores: '++id, email, password, nombre, apellido' // Nueva tabla
});
db.open().catch(err => {
  console.error("No se pudo abrir la base de datos:", err);
});
