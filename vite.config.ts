import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execFileSync } from 'node:child_process';
import { env } from 'node:process';
import manifest from './package.json';
let commit = env.CF_PAGES_COMMIT_SHA || env.GITHUB_SHA || '';
if (!commit) { try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { commit = 'unversioned'; } }
export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'valoprac-release-metadata',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ app: 'VALOPRAC', version: manifest.version, commit }) }); }
  }],
  build: {
    target: 'es2022', manifest: true, sourcemap: false,
    rollupOptions: { output: { manualChunks: { three: ['three'], react: ['react', 'react-dom', 'react-dom/client'] } } }
  },
  test: { environment: 'node', include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'] }
});
