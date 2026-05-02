import { defineConfig } from 'vite'
import { resolve }      from 'path'

export default defineConfig({
  base: './',   // relative asset paths → works from any server subdirectory
  server: {
    port: 5173,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 800,   // Three.js + GSAP legitimately exceed 500 kB
    rollupOptions: {
      input: {
        main:       resolve(__dirname, 'index.html'),
        experience: resolve(__dirname, 'experience.html'),
      },
    },
  },
})
