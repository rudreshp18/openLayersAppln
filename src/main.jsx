import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MapComponent from './MapComp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MapComponent />
  </StrictMode>
)
