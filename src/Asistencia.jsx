import React, { useState } from 'react';

function RegistroAsistencia() {
  const [ubicacion, setUbicacion] = useState({ lat: null, lng: null });

  const obtenerCoordenadas = () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta GPS");
      return;
    }

    navigator.geolocation.getCurrentPosition((pos) => {
      setUbicacion({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      });
      console.log("Ubicación capturada para auditoría:", pos.coords);
    }, (error) => {
      alert("Error al obtener GPS: " + error.message);
    });
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Pase de Lista</h2>
      <button onClick={obtenerCoordenadas}>Capturar Ubicación GPS</button>
      {ubicacion.lat && (
        <p>Coordenadas: {ubicacion.lat}, {ubicacion.lng}</p>
      )}
    </div>
  );
}

export default RegistroAsistencia;