import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerCocoServiceWorker } from './lib/registerServiceWorker.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    registerCocoServiceWorker().catch(() => {
      // PWA support is optional; the web app should keep working if registration fails.
    })
  })
}
