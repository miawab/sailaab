// Vite config for the Sailaab website.
// - /api/* goes to Part C's local server (node api/_dev-server.js on port 3001).
// - /data/* is Part B's files in web/public/data. Until a file exists there,
//   we serve the mock from shared/mock/ instead (in dev AND in the build),
//   so the site always has something to show.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const WEB = import.meta.dirname;
const REAL = path.join(WEB, 'public', 'data');
const MOCK = path.join(WEB, '..', 'shared', 'mock');
const DATA_FILES = ['national_points.geojson', 'rivers.geojson', 'houses.geojson', 'flood2022.geojson'];

function mockDataFallback() {
  return {
    name: 'sailaab-mock-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url && req.url.match(/^\/data\/([\w.-]+)$/);
        if (!m || fs.existsSync(path.join(REAL, m[1]))) return next();
        const mock = path.join(MOCK, m[1]);
        if (!fs.existsSync(mock)) return next();
        res.setHeader('Content-Type', 'application/json');
        fs.createReadStream(mock).pipe(res);
      });
    },
    generateBundle() {
      for (const name of DATA_FILES) {
        if (fs.existsSync(path.join(REAL, name))) continue; // real file is copied by Vite
        const mock = path.join(MOCK, name);
        if (fs.existsSync(mock)) {
          this.emitFile({ type: 'asset', fileName: `data/${name}`, source: fs.readFileSync(mock) });
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), mockDataFallback()],
  server: {
    proxy: { '/api': 'http://localhost:3001' },
    fs: { allow: ['..'] }, // lets us import shared/alerts.json
  },
});
