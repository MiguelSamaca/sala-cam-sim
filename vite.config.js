import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Si usas GitHub Pages, descomenta y cambia por el nombre de tu repo:
  // base: '/sala-cam-sim/',
})
