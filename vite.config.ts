import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor', '@monaco-editor/react'],
          supabase: ['@supabase/supabase-js'],
          vendor: ['react', 'react-dom', 'react-markdown', 'remark-gfm', 'zustand', 'diff', 'nanoid'],
        },
      },
    },
  },
});
