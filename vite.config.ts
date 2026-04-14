import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const base = '/';

  return {
    base,
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          mergePdf: resolve(__dirname, 'merge-pdf/index.html')
        }
      }
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.svg'],
        manifest: {
          name: 'Simple PDF Tools',
          short_name: 'PDF Tools',
          description: 'Free browser-based PDF tools for merging, splitting, and organizing documents.',
          theme_color: '#f3eee7',
          background_color: '#f3eee7',
          display: 'standalone',
          start_url: base,
          icons: [
            {
              src: `${base}pwa-192.svg`,
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: `${base}pwa-512.svg`,
              sizes: '512x512',
              type: 'image/svg+xml'
            },
            {
              src: `${base}pwa-512-maskable.svg`,
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          runtimeCaching: []
        }
      })
    ]
  };
});
