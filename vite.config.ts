import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Proxy /api/googlemaps requests to the Google Maps API
      '/api/googlemaps': {
        target: 'https://maps.googleapis.com',
        changeOrigin: true, // Needed for virtual hosted sites
        secure: false,      // Usually false for https targets
        rewrite: (path) => path.replace(/^\/api\/googlemaps/, ''), // Remove the base path
      },
    },
  },
})
