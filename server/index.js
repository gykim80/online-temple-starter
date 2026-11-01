// 정적 파일 + WebSocket 서버 하나로 끝나는 구성. npm start → http://localhost:8787
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Hub } from './hub.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8787);
const hub = new Hub({
  capacity: Number(process.env.ROOM_CAPACITY || 50),
  statsFile: process.env.STATS_FILE || path.join(ROOT, 'data/stats.json'),
});

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary' };
// URL 앞부분 → 실제 폴더. three 는 빌드 없이 node_modules 에서 바로 내려준다
const MOUNTS = [
  ['/vendor/three/', path.join(ROOT, 'node_modules/three/')],
  ['/', path.join(ROOT, 'public/')],
];

function sendJson(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function serveFile(req, res) {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  for (const [prefix, dir] of MOUNTS) {
    if (!p.startsWith(prefix)) continue;
    const file = path.join(dir, p.slice(prefix.length));
    if (!file.startsWith(dir)) break; // ../ 로 폴더 밖을 읽지 못하게
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) break;
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('없는 페이지입니다');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') return sendJson(res, 200, { ok: true });
  if (url.pathname === '/api/rooms') {
    const place = url.searchParams.get('place') || 'temple';
    return sendJson(res, 200, { capacity: hub.capacity, rooms: hub.listRooms(place), stats: hub.stats[place] ?? {} });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveFile(req, res);
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });
wss.on('connection', (ws) => {
  ws.alive = true;
  const conn = { send: (t) => ws.readyState === 1 && ws.send(t), close: () => ws.close() };
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (data) => hub.handle(conn, data.toString()));
  ws.on('close', () => hub.leave(conn));
});

// 응답 없는 연결 정리 (30초)
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    ws.ping();
  }
}, 30_000).unref();
setInterval(() => hub.tick(), 100).unref();
setInterval(() => hub.saveStats(), 10_000).unref();

server.listen(PORT, () => console.log(`열렸습니다: http://localhost:${PORT}`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { hub.saveStats(); process.exit(0); });
