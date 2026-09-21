import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const target = process.env.CIHOF_TARGET === 'public' ? 'public' : 'kiosk';

export default defineConfig({
  base: process.env.CIHOF_BASE_PATH ?? '/cihof/',
  resolve: {
    // Operator recovery belongs on an installed display. A public target
    // resolves it to a stub, so the panel is absent from the bundle rather
    // than merely unadvertised.
    alias: target === 'public'
      ? [{ find: /^.*\/Recovery\.tsx$/, replacement: resolve('src/app/Recovery.public-stub.tsx') }]
      : [],
  },
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [react()],
});
