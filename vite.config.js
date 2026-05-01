import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: 'wss',     // Crucial: Use Secure WebSockets
      host: 'gnalin.xyz',  // Your domain
      clientPort: 5174      // The browser should look at the standard SSL port
    },
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})