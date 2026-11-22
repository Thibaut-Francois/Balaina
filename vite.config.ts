import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // chemins relatifs : fonctionne en local comme sur GitHub Pages (sous-dossier /Balaina/)
  base: './',
  plugins: [svelte()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
