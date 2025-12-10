
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
        // Expose loaded env vars as a global constant
        '__STATIC_ENV__': JSON.stringify(env),
        // Remap process.env to window.process.env to support runtime injection + static build
        // This satisfies esbuild (it's a simple identifier replacement)
        'process.env': 'window.process.env',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
