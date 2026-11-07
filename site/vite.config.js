import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The site imports ../access.json, ../data/notes.json, ../server.py, ../RUN_OUTPUT.txt and ../README.md
// at build time, so every number on the page is read from the repo, never typed.
export default defineConfig({
  base: '/pattern19-wk1-mcp-server/',
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
});
