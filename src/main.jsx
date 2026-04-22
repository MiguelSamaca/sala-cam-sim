import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ConferenceRoomSim from './ConferenceRoomSim.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConferenceRoomSim />
  </StrictMode>,
)
