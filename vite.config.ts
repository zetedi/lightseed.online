
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const cwd = (process as any).cwd();
    const envFileVars = loadEnv(mode, cwd, '');
    const combinedEnv = { ...process.env, ...envFileVars };

    // Selectively expose variables. NOTE: only Firebase's public config belongs here — anything
    // in clientEnv is inlined into the public JS bundle. Never add a real secret (e.g. a Gemini/
    // Anthropic API_KEY); those live only in Cloud Functions secrets and are used server-side.
    const clientEnv = {
        MODE: mode,
        VITE_FIREBASE_API_KEY: combinedEnv.VITE_FIREBASE_API_KEY,
        VITE_FIREBASE_AUTH_DOMAIN: combinedEnv.VITE_FIREBASE_AUTH_DOMAIN,
        VITE_FIREBASE_PROJECT_ID: combinedEnv.VITE_FIREBASE_PROJECT_ID,
        VITE_FIREBASE_STORAGE_BUCKET: combinedEnv.VITE_FIREBASE_STORAGE_BUCKET,
        VITE_FIREBASE_MESSAGING_SENDER_ID: combinedEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
        VITE_FIREBASE_APP_ID: combinedEnv.VITE_FIREBASE_APP_ID,
        VITE_FIREBASE_MEASUREMENT_ID: combinedEnv.VITE_FIREBASE_MEASUREMENT_ID,
    };

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        // PWA: installable app + offline shell. The service worker precaches the built shell
        // (fingerprinted js/css/html + small images) and auto-updates on each deploy. Live data
        // stays live — Firestore/Storage requests are not cached.
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'script-defer',
          includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
          manifest: {
            name: 'Lightseed — life recognising life',
            short_name: '.seed',
            description: 'A living commons where trees, people and intelligences meet. Plant a lifetree, find your resonance, and help grow a New Earth.',
            start_url: '/',
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: '#065f46',
            icons: [
              { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
              { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
              { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
            // Leave the media library (webp/mp4) to the network — precaching it would bloat installs.
            maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
            // Never serve the SPA shell for Firebase's reserved paths: /__/* (auth helpers)
            // and /u/* (the unsubscribe Cloud Function rewrite).
            navigateFallbackDenylist: [/^\/__\//, /^\/u\//],
          },
        }),
      ],
      define: {
        // We define __STATIC_ENV__ instead of process.env.
        // This allows the polyfill (in utils/polyfill.ts) to merge these build-time vars
        // with the runtime vars (window.process.env) injected by the AI Studio UI.
        '__STATIC_ENV__': JSON.stringify(clientEnv),
      },
      resolve: {
        alias: {
          '@': path.resolve(cwd, 'src'),
        }
      }
    };
});
