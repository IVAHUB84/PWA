// Минимальный статик-сервер для E2E (без зависимостей). Отдаёт docs/ на указанном порту.
// Нужен потому, что ES-модули требуют http(s)/localhost, не file://.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'docs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

export function startServer(port = 5050) {
  const server = createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (pathname === '/' || pathname === '') pathname = '/prototype.html';
      const filePath = normalize(join(ROOT, pathname));
      if (!filePath.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
      const data = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
    }
  });
  return new Promise(resolve => server.listen(port, () => resolve(server)));
}

// Запуск напрямую: node e2e/static-server.mjs [port]
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('static-server.mjs')) {
  const port = Number(process.argv[2]) || 5050;
  startServer(port).then(() => console.log(`[e2e] static server on http://localhost:${port}  (root: ${ROOT})`));
}
