import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.CIHOF_BASE_PATH ?? '/cihof/',
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [react()],
});
