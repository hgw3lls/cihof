import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Same resolution as the publish step, so the bundle's content and the code
// compiled to render it can never disagree about who this build is for.
import { resolveTarget } from './scripts/target.mjs';

const target = resolveTarget();
// The staff portal's own copy of the exhibit, which edits it in place. Only
// ever a kiosk build; every other build has the editor's stub instead.
const editor = process.env.CIHOF_EDITOR === '1';
if (editor && target !== 'kiosk') throw new Error('CIHOF_EDITOR builds the staff portal\'s copy of the display, never the public website.');

export default defineConfig({
  base: process.env.CIHOF_BASE_PATH ?? '/cihof/',
  resolve: {
    // Operator recovery belongs on an installed display. A public target
    // resolves it to a stub, so the panel is absent from the bundle rather
    // than merely unadvertised.
    alias: [
      ...(target === 'public' ? [{ find: /^.*\/Recovery\.tsx$/, replacement: resolve('src/app/Recovery.public-stub.tsx') }] : []),
      // The staff portal's editing is in its copy alone (src/app/editor.ts).
      ...(editor ? [] : [{ find: /^.*\/editor\.ts$/, replacement: resolve('src/app/editor.stub.ts') }]),
    ],
  },
  // The page chooses its default theme by audience before the bundle loads.
  define: { 'import.meta.env.VITE_CIHOF_TARGET': JSON.stringify(target) },
  // The editor's copy takes no content from public/: the staff portal serves its own preview.
  build: { outDir: 'dist', emptyOutDir: true, copyPublicDir: !editor },
  plugins: [react()],
});
