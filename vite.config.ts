import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const buildTarget = process.env.CIHOF_BUILD_TARGET === 'portal' ? 'portal' : 'kiosk';
const defaultBase = process.env.NODE_ENV === 'production' ? '/cihof/' : '/';
const base = process.env.CIHOF_BASE_PATH || defaultBase;
const outDir = process.env.CIHOF_OUT_DIR || (buildTarget === 'portal' ? 'dist-portal' : 'dist');

export default defineConfig({
  base,
  build: {
    outDir,
    rollupOptions: {
      input: buildTarget === 'portal' ? 'portal.html' : 'index.html',
    },
  },
  plugins: [react()],
});
