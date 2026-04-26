import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Jobassistand from './Jobassistand'

// Bootstrap Icons CDN (inyectado via JS para PWA)
if (!document.getElementById('bi-cdn')) {
  const link = document.createElement('link');
  link.id = 'bi-cdn';
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';
  document.head.appendChild(link);
}

// DM Sans font
if (!document.getElementById('dm-sans')) {
  const link = document.createElement('link');
  link.id = 'dm-sans';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap';
  document.head.appendChild(link);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Jobassistand />
  </StrictMode>,
)
