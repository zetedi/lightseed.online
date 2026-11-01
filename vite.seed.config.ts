import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { seedBrowserConfig } from './src/domain/seedBrowser';

// A deliberately separate entry: importing the current App would initialize Firebase.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'SEED_'), ...process.env };
  const config = seedBrowserConfig({ appOrigin: env.SEED_WEB_ORIGIN, issuer: env.SEED_IDENTITY_ISSUER });
  return {
    root: resolve('seed/web'), publicDir: false, envPrefix: [],
    plugins: [react(), {
      name: 'seed:no-firebase',
      generateBundle() {
        for (const id of this.getModuleIds()) {
          if (/node_modules\/(?:@firebase\/|firebase\/)/.test(id)) this.error('Independent browser must not import Firebase.');
        }
      },
    }],
    define: { SEED_BROWSER_CONFIG: JSON.stringify(config) },
    build: { outDir: resolve('seed/web-dist'), emptyOutDir: true, sourcemap: false },
  };
});
