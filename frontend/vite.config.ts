/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// API-Ziel: Port aus `make serve-local` (Standard 5000), siehe PLAN A8 / B3.
// Bewusst 127.0.0.1 statt localhost: OpenFisca lauscht nur auf IPv4, und auf macOS belegt der
// AirPlay-Empfänger Port 5000 auch unter IPv6 (::1). „localhost“ landet sonst dort (HTTP 403).
const API_ZIEL = process.env.API_ZIEL ?? 'http://127.0.0.1:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: API_ZIEL,
        changeOrigin: true,
        rewrite: (pfad) => pfad.replace(/^\/api/, ''),
      },
    },
    // contract/ liegt ausserhalb von frontend/ und wird direkt importiert.
    fs: { allow: ['..'] },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
