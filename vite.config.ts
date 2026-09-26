/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import path from 'path';
import { execSync } from 'child_process';

function getAppVersion(): string {
  try {
    return execSync('git describe --tags --always --dirty', { encoding: 'utf8' }).trim();
  } catch {
    return process.env.VITE_APP_VERSION || 'v0.1.0';
  }
}

const appVersion = getAppVersion();
process.env.VITE_APP_VERSION = appVersion;

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
    alias: {
      $lib: path.resolve(import.meta.dirname, './src/lib'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['{src,scripts}/**/*.{test,spec}.{js,ts}'],
    globals: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        about: path.resolve(import.meta.dirname, 'about/index.html'),
        faq: path.resolve(import.meta.dirname, 'faq/index.html'),
        privacy: path.resolve(import.meta.dirname, 'privacy/index.html'),
      },
    },
  },
});
