
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Use process.cwd() to ensure we look in the project root for .env
    const env = loadEnv(mode, process.cwd(), '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Polyfill process.env to work locally (from .env file) AND in AI Studio (from window.process)
        // Checks if window.process exists before accessing it to avoid errors in some environments
        'process.env': `Object.assign({}, ${JSON.stringify(env)}, (typeof window !== "undefined" && window.process ? window.process.env : {}) || {})`,
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
