import Dexie from 'dexie';

export const db = new Dexie('AgroAsistenciaDB');

// Subimos la versión para incluir 'areaId' y 'rol' en las tablas correspondientes
db.version(21).stores({
  // 'areaId' es clave para filtrar quién ve a qué trabajador
  asistencias: '++id, trabajadorId, fecha, lat, lng, tipo, areaId, totalCalculado', 
  
  // Agregamos 'areaId' para vincular al trabajador con su pago
  trabajadores: '++id, nombre, apellido, areaId, telefono, curp, pagoPorHora',
  
  // Agregamos 'rol' y 'areaId' para el control de acceso
  supervisores: '++id, email, password, nombre, apellido, rol, areaId', 
  
  // Tabla nueva para gestionar los costos por zona
  areas: '++id, nombre, pagoPorHora' 
});

export default db;
