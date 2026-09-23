/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
    alias: {
      $lib: path.resolve(import.meta.dirname, './src/lib'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    globals: true,
  },
});
