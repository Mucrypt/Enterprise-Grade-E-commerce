import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'

// A tab left open across a deploy still holds the OLD content-hashed
// chunk filenames from the index.html it originally loaded -- Docker
// swaps the whole container on deploy, so those old files are simply
// gone, not just stale. Route-level code-splitting (React.lazy) then
// 404s the moment that tab navigates somewhere it hasn't already
// loaded, crashing to an uncaught "Failed to fetch dynamically imported
// module" instead of recovering (confirmed live, 2026-09-20, on
// /profile). Vite's import() helper fires this event on exactly that
// failure; reloading is the correct recovery since the CURRENT
// index.html points at the CURRENT chunks.
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
