// HTTP 요청과 WebSocket 연결을 Hub 에 잇는다. 시작·종료는 index.js 가 맡는다.
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { LIMITS, PLACE_RE, TICK_MS } from '../public/shared/protocol.js';
import { createStatic } from './static.js';
import { ROOT } from './config.js';

const HEARTBEAT_MS = 30_000;
const STATS_SAVE_MS = 10_000;

function sendJson(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

export function createApp(hub) {
  // three 는 빌드 없이 node_modules 에서 바로 내려준다. 버전이 바뀌지 않는 한 그대로라 하루 동안 캐시한다
  const serveStatic = createStatic([
    ['/vendor/three/', path.join(ROOT, 'node_modules/three'), { maxAge: 86400 }],
    ['/', path.join(ROOT, 'public')],
  ]);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/healthz') return sendJson(res, 200, { ok: true, peers: hub.peers.size });
    if (url.pathname === '/api/rooms') {
      const place = url.searchParams.get('place') || 'temple';
      if (!PLACE_RE.test(place)) return sendJson(res, 400, { error: 'place' });
      return sendJson(res, 200, { capacity: hub.capacity, rooms: hub.listRooms(place), stats: hub.store.of(place) });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD' }); return res.end(); }
    serveStatic(req, res);
  });

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: LIMITS.messageBytes * 2 });
  wss.on('connection', (ws) => {
    ws.alive = true;
    const conn = { send: (t) => ws.readyState === 1 && ws.send(t), close: () => ws.close() };
    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', (data, isBinary) => { if (!isBinary) hub.handle(conn, data.toString()); });
    ws.on('close', () => hub.leave(conn));
    ws.on('error', () => ws.terminate());
  });

  const timers = [
    // 응답 없는 연결 정리
    setInterval(() => {
      for (const ws of wss.clients) {
        if (!ws.alive) { ws.terminate(); continue; }
        ws.alive = false;
        ws.ping();
      }
    }, HEARTBEAT_MS),
    setInterval(() => hub.tick(), TICK_MS),
    setInterval(() => hub.saveStats(), STATS_SAVE_MS),
  ];
  for (const t of timers) t.unref();

  /** 연결을 닫고 동작 수를 저장한다 */
  function close() {
    timers.forEach(clearInterval);
    hub.saveStats();
    for (const ws of wss.clients) ws.close(1001);
    wss.close();
    return new Promise((resolve) => server.close(() => resolve()));
  }

  return { server, wss, close };
}
