import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/xai': {
        target: 'https://api.x.ai/v1/grok',
        changeOrigin: true,
        headers: {
          'Authorization': `Bearer ${process.env.VITE_APP_XAI_API_KEY}`,
        },
      },
    },
  },
});