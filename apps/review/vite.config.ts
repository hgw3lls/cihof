import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev --workspace @cihof/review` for working on the pages: the API and
// portraits come from the review server, started separately on 5180.
export default defineConfig({
  base: '/',
  build: { outDir: 'dist', emptyOutDir: true },
  server: { proxy: { '/api': 'http://127.0.0.1:5180', '/media': 'http://127.0.0.1:5180' } },
  plugins: [react()],
});
