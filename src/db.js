import Dexie from 'dexie';

export const db = new Dexie('AgroAsistenciaDB');

// Version 20 — nueva arquitectura admin/encargado
db.version(20).stores({
  administradores: '++id, email',
  encargados:      '++id, email, adminId',
  areas:           '++id, nombre, encargadoId, salarioPorHora',
  trabajadores:    '++id, nombre, apellido, areaId, encargadoId, telefono',
  asistencias:     '++id, trabajadorId, areaId, encargadoId, fecha, tipo, lat, lng, lugar, sincronizado',
});

db.open().catch(err => console.error('DB error:', err));
