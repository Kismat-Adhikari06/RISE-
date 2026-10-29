import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS=1 npm run dev -> self-signed cert so a phone on the LAN can use the camera (getUserMedia needs a secure context).
const useHttps = process.env.HTTPS === '1';

export default defineConfig({
  plugins: [
    react(),
    ...(useHttps ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'RISE — Wake up. Prove you\'re awake.',
        short_name: 'RISE',
        description: 'A smart alarm clock that makes you complete missions before it stops.',
        theme_color: '#09090B',
        background_color: '#09090B',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['models/**', 'ort/**'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // The detector model + ONNX runtime wasm are cached the first time they are actually loaded.
            urlPattern: ({ url }) => url.pathname.startsWith('/models/') || url.pathname.startsWith('/ort/'),
            handler: 'CacheFirst',
            options: { cacheName: 'rise-models-v3', expiration: { maxEntries: 40 } },
          },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 4000 },
  test: { environment: 'jsdom', setupFiles: ['src/test/setup.ts'], include: ['src/**/*.test.ts'] },
});
