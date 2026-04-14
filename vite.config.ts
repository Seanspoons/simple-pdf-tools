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
          watermarker: resolve(__dirname, 'watermarker/index.html'),
          collage: resolve(__dirname, 'collage/index.html'),
          convert: resolve(__dirname, 'convert/index.html'),
          resize: resolve(__dirname, 'resize/index.html'),
          compress: resolve(__dirname, 'compress/index.html'),
          crop: resolve(__dirname, 'crop/index.html'),
          rotate: resolve(__dirname, 'rotate/index.html'),
          social: resolve(__dirname, 'social/index.html'),
          metadata: resolve(__dirname, 'metadata/index.html'),
          resizeImageOnline: resolve(__dirname, 'resize-image-online/index.html'),
          compressImageOnline: resolve(__dirname, 'compress-image-online/index.html'),
          cropImageOnline: resolve(__dirname, 'crop-image-online/index.html'),
          rotateImageOnline: resolve(__dirname, 'rotate-image-online/index.html'),
          formatImageForSocialMedia: resolve(__dirname, 'format-image-for-social-media/index.html'),
          convertImageOnline: resolve(__dirname, 'convert-image-online/index.html'),
          removePhotoMetadata: resolve(__dirname, 'remove-photo-metadata/index.html'),
          convertHeicToJpg: resolve(__dirname, 'convert-heic-to-jpg/index.html'),
          addWatermarkToPhoto: resolve(__dirname, 'add-watermark-to-photo/index.html'),
          makePhotoCollageOnline: resolve(__dirname, 'make-photo-collage-online/index.html')
        }
      }
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'Simple Photo Tools',
          short_name: 'Photo Tools',
          description: 'Free browser-based photo tools for watermarking, collages, and more.',
          theme_color: '#f4efe6',
          background_color: '#f4efe6',
          display: 'standalone',
          start_url: base,
          icons: [
            {
              src: `${base}pwa-192.png`,
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: `${base}pwa-512.png`,
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: `${base}pwa-512-maskable.png`,
              sizes: '512x512',
              type: 'image/png',
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
