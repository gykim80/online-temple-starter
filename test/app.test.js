// HTTP·WebSocket 을 실제로 띄워서 확인한다
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import zlib from 'node:zlib';
import WebSocket from 'ws';
import { Hub } from '../server/hub.js';
import { createApp } from '../server/app.js';

let app, base;
before(async () => {
  app = createApp(new Hub({ capacity: 2 }));
  await new Promise((r) => app.server.listen(0, r));
  base = `http://localhost:${app.server.address().port}`;
});
after(() => app.close());

// fetch 는 압축을 알아서 풀어 버려서 머리글을 그대로 보려고 http.get 을 쓴다
const get = (p, headers = {}) => new Promise((resolve, reject) => {
  http.get(base + p, { headers }, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
  }).on('error', reject);
});

test('첫 화면과 three 를 내려준다', async () => {
  const html = await get('/');
  assert.equal(html.status, 200);
  assert.match(html.headers['content-type'], /text\/html/);
  const three = await get('/vendor/three/build/three.module.js');
  assert.equal(three.status, 200);
  assert.match(three.headers['cache-control'], /max-age=86400/);
});

test('gzip 으로 압축하고 ETag 가 같으면 304', async () => {
  const r = await get('/js/main.js', { 'accept-encoding': 'gzip' });
  assert.equal(r.headers['content-encoding'], 'gzip');
  assert.match(zlib.gunzipSync(r.body).toString(), /createWorld/);
  const again = await get('/js/main.js', { 'if-none-match': r.headers.etag });
  assert.equal(again.status, 304);
});

test('폴더 밖 파일은 읽을 수 없다', async () => {
  for (const p of ['/../package.json', '/%2e%2e/package.json', '/vendor/three/../../package.json', '/js/%00.js']) {
    const r = await get(p);
    assert.ok(r.status === 404 || r.status === 400, `${p} → ${r.status}`);
  }
});

test('방 목록 API 는 장소 이름을 검사한다', async () => {
  assert.equal((await get('/api/rooms?place=temple')).status, 200);
  assert.equal((await get('/api/rooms?place=../../x')).status, 400);
});

test('WebSocket 으로 들어가면 welcome 을 받고 방 목록에 잡힌다', async () => {
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws');
  await new Promise((r) => ws.once('open', r));
  ws.send(JSON.stringify({ t: 'join', place: 'temple', name: '시험' }));
  const m = JSON.parse(await new Promise((r) => ws.once('message', r)));
  assert.equal(m.t, 'welcome');
  const rooms = JSON.parse((await get('/api/rooms?place=temple')).body);
  assert.deepEqual(rooms.rooms, [{ room: 1, count: 1 }]);
  ws.close();
});
