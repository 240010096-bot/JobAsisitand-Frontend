import Dexie from 'dexie';

export const db = new Dexie('AgroAsistenciaDB');

// Versión 24: relación supervisor_areas (muchos a muchos)
db.version(24).stores({
  supervisores:    '++id, email, password, nombre, apellido, rol',
  areas:           '++id, nombre, pagoPorHora',
  trabajadores:    '++id, nombre, apellido, areaId, telefono, curp',
  asistencias:     '++id, trabajadorId, fecha, tipo, lat, lng, lugar, areaId, sincronizado',
  supervisor_areas:'++id, supervisorId, areaId',
});

// Migración automática desde versión anterior (si existía campo areaId en supervisores)
db.open().then(async () => {
  try {
    const count = await db.supervisor_areas.count();
    if (count === 0) {
      const encargados = await db.supervisores.where('rol').equals('encargado').toArray();
      for (const enc of encargados) {
        if (enc.areaId) {
          await db.supervisor_areas.add({ supervisorId: enc.id, areaId: enc.areaId });
        }
      }
      console.log('Migración a supervisor_areas completada');
    }
  } catch (err) {
    console.error('Error en migración:', err);
  }
}).catch(err => console.error('Error abriendo DB:', err));

export default db;
