import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the site under /biofuel-radar/; dev stays at /
  base: command === 'build' || isPreview ? '/biofuel-radar/' : '/',
  plugins: [react()],
}))
