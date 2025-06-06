import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite';


// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [tailwindcss(), svelte()],
  base: command === 'build' ? '/adsb/' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  }
}))
