import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const proxy = Object.fromEntries(
  ['/api', '/audio', '/audio311', '/call-check'].map((path) => [path, { target: 'http://localhost:8787', changeOrigin: false }]),
);

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 4173, strictPort: true, proxy },
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', clearMocks: true },
});
