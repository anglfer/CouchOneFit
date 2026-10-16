import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5000,
    host: '127.0.0.1',
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
  },
  plugins: [
    react(),
    VitePWA({
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'logo.png'],
      manifest: {
        name: 'CouchOne Fit',
        short_name: 'CouchOneFit',
        description:
          'Aplicación Web y PWA de gestión fitness para profesionales y clientes',
        theme_color: '#4037f7',
        background_color: '#eaeffd',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'logo.png',
            sizes: '1254x1254',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
