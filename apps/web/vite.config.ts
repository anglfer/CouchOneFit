import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5000,
    host: '127.0.0.1',
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      // La nueva versión se aplica cuando el usuario lo confirma (ver src/services/pwa.ts).
      registerType: 'prompt',
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
      includeAssets: [
        'favicon.svg',
        'favicon-64x64.png',
        'apple-touch-icon-180x180.png',
        'logo.png',
      ],
      manifest: {
        id: '/app/',
        name: 'CouchOne Fit — Panel profesional',
        short_name: 'CouchOne Fit',
        description:
          'Panel de CouchOne Fit para entrenadores, nutriólogos y administración.',
        lang: 'es-MX',
        dir: 'ltr',
        categories: ['health', 'fitness', 'productivity'],
        theme_color: '#ffffff',
        background_color: '#eaeffd',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        scope: '/',
        // El panel redirige a /admin/ cuando la cuenta es administradora.
        start_url: '/app/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Inicio',
            url: '/app/',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Mi perfil',
            url: '/app/perfil',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
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
