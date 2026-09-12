
import path from 'path';
import { createReadStream, existsSync, readdirSync, readFileSync } from 'fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import charter from './src/config/charter.json';

// THE NODE (ring 2026-09-06): the shell's name, colours and Open Graph card come from the
// charter — index.html reads them as %VITE_NODE_*% at build time.
process.env.VITE_NODE_NAME = charter.name;
process.env.VITE_NODE_SHORT = charter.shortName;
process.env.VITE_NODE_TAGLINE = charter.tagline;
process.env.VITE_NODE_DESCRIPTION = charter.description;
process.env.VITE_NODE_ORIGIN = `https://${charter.domain}`;

// THE ROOT AS FILES (ring 2026-09-13). Every root/*.md is served at /root/<NAME>.md — by this
// middleware in dev, emitted beside the shell in the build — so the deployed node carries the
// constitution it grew from at an address anyone it serves can open, and the white paper
// fetches a chapter when it is read instead of carrying 290 kB inside a script.
// src/domain/whitePaper names the chapters and the door; firebase.json serves /root/** no-cache.
const rootPapers = (rootDir: string): Plugin => ({
    name: 'lightseed:root-papers',
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            const m = /^\/root\/([A-Z_]+\.md)$/.exec((req.url || '').split('?')[0]);
            const file = m ? path.join(rootDir, m[1]) : null;
            if (!file || !existsSync(file)) return next();
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            createReadStream(file).pipe(res);
        });
    },
    generateBundle() {
        for (const name of readdirSync(rootDir).filter((n) => /^[A-Z_]+\.md$/.test(n))) {
            this.emitFile({ type: 'asset', fileName: `root/${name}`, source: readFileSync(path.join(rootDir, name)) });
        }
    },
});

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
      build: {
        rollupOptions: {
          // Two doors out of one build: the app shell, and the SSO door a mother site
          // iframes so a seed face can share its sign-in (sso.html → src/sso.ts;
          // domain/ssoDoor.ts is the law). The door stays its own tiny entry so a
          // hidden iframe never pays for the whole forest.
          input: {
            main: path.resolve(cwd, 'index.html'),
            sso: path.resolve(cwd, 'sso.html'),
          },
          output: {
            // THE VENDORS KEEP THEIR OWN NAMES (ring 2026-09-13). React and Firebase change
            // when we upgrade them, not when a line of App.tsx moves; in one chunk with the
            // shell, every deploy re-sent all of them to every returning reader. Each vendor
            // is its own chunk now, so its hash holds still across our edits and the worker's
            // precache keeps it. Firestore and Storage are split from the rest of Firebase on
            // purpose: the SSO door only needs app + auth + functions, and must never inherit
            // the forest's database through a shared vendor chunk. The thin `firebase/<x>`
            // re-exports ride with the package they re-export, or they would drag it along.
            manualChunks(id: string) {
              if (!id.includes('node_modules/')) return undefined;
              if (/node_modules\/(?:react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
              if (/node_modules\/(?:@firebase\/(?:firestore|webchannel-wrapper)|firebase\/firestore)\//.test(id)) return 'vendor-firestore';
              if (/node_modules\/(?:@firebase\/storage|firebase\/storage)\//.test(id)) return 'vendor-storage';
              if (/node_modules\/(?:@firebase|firebase)\//.test(id)) return 'vendor-firebase';
              return undefined;
            },
          },
        },
      },
      plugins: [
        react(),
        rootPapers(path.resolve(cwd, 'root')),
        // PWA: installable app + offline shell. The service worker precaches the built shell
        // (fingerprinted js/css/html + small images). Live data stays live — Firestore/Storage
        // requests are not cached. 'prompt': a fresh deploy surfaces the UpdateToast ("a new
        // version is ready — refresh") instead of silently swapping shells one visit later.
        VitePWA({
          registerType: 'prompt',
          includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
          manifest: {
            name: `${charter.name} — ${charter.tagline}`,
            short_name: charter.shortName,
            description: charter.description,
            start_url: '/',
            display: 'standalone',
            background_color: charter.theme.background,
            theme_color: charter.theme.color,
            icons: [
              { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
              { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
              { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            // The push half of the worker (public/push-sw.js) rides inside the generated one.
            importScripts: ['push-sw.js'],
            globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
            // Leave the media library (webp/mp4) to the network — precaching it would bloat installs.
            maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
            // Never serve the SPA shell for Firebase's reserved paths: /__/* (auth helpers),
            // /u/* (the unsubscribe Cloud Function rewrite), or the SSO door (its own page).
            navigateFallbackDenylist: [/^\/__\//, /^\/u\//, /^\/sso\.html/],
            runtimeCaching: [
              {
                // The constitution (/root/*.md): read from the copy, refreshed behind it, so the
                // book opens offline after a first reading. Served no-cache by hosting, so the
                // refresh is always the deploy's own text.
                urlPattern: /\/root\/[A-Z_]+\.md$/,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'root-papers',
                  expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 30 },
                  cacheableResponse: { statuses: [200] },
                },
              },
              {
                // Satellite tiles: pan/zoom and repeat visits hit the local copy first;
                // imagery this old doesn't change under our feet.
                urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*\/tile\/.*/i,
                handler: 'CacheFirst',
                options: {
                  // v2 (2026-09-12): the first cache admitted status 0 — an OPAQUE response,
                  // which is what a no-CORS fetch returns whether it succeeded or failed. The
                  // tile <img> carries crossorigin (so the cache can hold real responses), and
                  // an opaque body can never satisfy it: the image decodes to nothing and the
                  // map shows grey. CacheFirst then served those lies for thirty days. Only 200
                  // is cacheable now, and the name is new so the poisoned entries are abandoned.
                  cacheName: 'map-tiles-v2',
                  expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true },
                  cacheableResponse: { statuses: [200] },
                },
              },
              {
                // Tree portraits (webp'd on upload): serve cached, refresh in the background.
                // Status 0 stays admitted HERE on purpose: pictures are plain no-CORS <img>s, so
                // their responses are opaque and an opaque body satisfies a plain <img>. That holds
                // only while no storage picture wears crossorigin — the day one does (a canvas
                // export, a splat), this cache tells the tile lie again. tests/opaqueCache guards it.
                urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'tree-images',
                  expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14, purgeOnQuotaError: true },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
            ],
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
