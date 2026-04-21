import React from 'react'
import RegistroAsistencia from './components/RegistroAsistencia'
import './App.css'

function App() {
  return (
    // Aplicamos el fondo oscuro al contenedor principal
    <div className="App" style={{ backgroundColor: '#0B0E14', minHeight: '100vh', color: 'white', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Header minimalista y futurista */}
      <header style={{ padding: '25px', textAlign: 'center', borderBottom: '1px solid #1f2937' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 300, letterSpacing: '2px' }}>
          JOB<span style={{ color: '#3b82f6' }}>ASSISTAND</span>
        </h1>
      </header>

      <main>
        <RegistroAsistencia />
      </main>
    </div>
  )
}

export default App