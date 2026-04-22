import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Se actualiza sola cuando haces cambios
      devOptions: { enabled: true }, // Permite probar la PWA en tu PC
      manifest: {
        name: 'JobAssistand - Asistencia',
        short_name: 'JobAssistand',
        description: 'Control de asistencia agrícola offline',
        theme_color: '#0B0E14',
        background_color: '#0B0E14',
        display: 'standalone', // Hace que se vea como app nativa (sin barra de navegador)
        // ... dentro de los iconos
icons: [
  {
    src: '/icono-192.png', // Cambiado a .png
    sizes: '192x192',
    type: 'image/png'
  },
  {
    src: '/icono-512.png', // Cambiado a .png
    sizes: '512x512',
    type: 'image/png'
  }
]
      }
    })
  ]
})
