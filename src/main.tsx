import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import './i18n'
import { applyTheme, getStoredTheme } from './hooks/useTheme'

// Before createRoot, so a dark-mode user never sees a white flash.
applyTheme(getStoredTheme())

// HashRouter: GitHub Pages serves a static folder under /<repo>/ with no SPA fallback,
// so deep links and reloads must not depend on the server.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
