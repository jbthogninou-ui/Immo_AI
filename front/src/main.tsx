import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { DEMO_MODE } from '@/api/client'

/**
 * Point d'entrée.
 *
 * En mode démonstration, l'adaptateur Axios est remplacé avant le premier
 * rendu : aucune requête ne sort du navigateur et l'interface reste
 * entièrement navigable sans backend.
 */
async function bootstrap() {
  if (DEMO_MODE) {
    const { installMockServer } = await import('./mocks/server')
    installMockServer()
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()
