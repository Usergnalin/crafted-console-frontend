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
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      hmr: {
        protocol: 'wss', 
        host: 'gnalin.xyz',
        clientPort: 443 
      }
    }
  })