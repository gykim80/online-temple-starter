// 서버 방 관리 로직 단위 테스트: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hub, cleanName } from '../server/hub.js';

// 보낸 메시지를 모아 두는 가짜 연결
const fake = () => { const c = { out: [], closed: false, send: (t) => c.out.push(JSON.parse(t)), close: () => { c.closed = true; } }; return c; };
const join = (hub, c, o = {}) => hub.handle(c, JSON.stringify({ t: 'join', place: 'temple', name: '손님', ...o }));

test('입장하면 welcome 을 받고 먼저 온 사람에게 join 이 간다', () => {
  const hub = new Hub();
  const a = fake(), b = fake();
  join(hub, a); join(hub, b);
  assert.equal(b.out[0].t, 'welcome');
  assert.equal(b.out[0].peers.length, 1);
  assert.equal(a.out.at(-1).t, 'join');
});

test('정원이 차면 다음 방으로 보낸다', () => {
  const hub = new Hub({ capacity: 2 });
  const cs = [fake(), fake(), fake()];
  cs.forEach((c) => join(hub, c, { room: 1 }));
  assert.deepEqual(cs.map((c) => c.out[0].room), [1, 1, 2]);
});

test('장소가 다르면 같은 번호여도 다른 방이다', () => {
  const hub = new Hub();
  const a = fake(), b = fake();
  join(hub, a, { room: 1 }); join(hub, b, { room: 1, place: 'beach' });
  assert.equal(b.out[0].peers.length, 0);
});

test('움직임은 tick 때 모아서 보낸다', () => {
  const hub = new Hub();
  const a = fake(), b = fake();
  join(hub, a); join(hub, b);
  hub.handle(a, JSON.stringify({ t: 'move', x: 3, z: 4, yaw: 1, pose: 'walk' }));
  hub.tick();
  assert.deepEqual(b.out.at(-1), { t: 'moves', list: [[1, 3, 4, 1, 'walk']] });
});

test('좌표는 한계 안으로 자르고 모르는 자세는 무시한다', () => {
  const hub = new Hub();
  const a = fake();
  join(hub, a);
  hub.handle(a, JSON.stringify({ t: 'move', x: 9999, z: -9999, yaw: 0, pose: 'fly' }));
  const p = hub.peers.get(a);
  assert.equal(p.x, 90); assert.equal(p.z, -90); assert.equal(p.pose, 'stand');
});

test('동작 수를 장소별로 센다', () => {
  const hub = new Hub();
  const a = fake();
  join(hub, a);
  hub.handle(a, JSON.stringify({ t: 'act', kind: 'bow' }));
  hub.handle(a, JSON.stringify({ t: 'act', kind: 'bow' }));
  hub.handle(a, JSON.stringify({ t: 'act', kind: '<script>' }));
  assert.equal(hub.stats.temple.bow, 2);
  assert.equal(Object.keys(hub.stats.temple).length, 1);
});

test('너무 많이 보내면 넘친 것은 버리고 계속되면 끊는다', () => {
  const hub = new Hub();
  const a = fake();
  join(hub, a);
  for (let i = 0; i < 60; i++) hub.handle(a, JSON.stringify({ t: 'act', kind: 'bow' }), 1000);
  assert.equal(hub.stats.temple.bow, 40);
  for (let i = 0; i < 200; i++) hub.handle(a, '{"t":"ping"}', 1000);
  assert.equal(a.closed, true);
});

test('나가면 남은 사람에게 leave 가 가고 빈 방은 지운다', () => {
  const hub = new Hub();
  const a = fake(), b = fake();
  join(hub, a); join(hub, b);
  hub.leave(b);
  assert.equal(a.out.at(-1).t, 'leave');
  hub.leave(a);
  assert.equal(hub.rooms.size, 0);
});

test('이름에서 태그 문자를 지우고 12자로 자른다', () => {
  assert.equal(cleanName('<b>안녕</b>'), 'b안녕/b');
  assert.equal(cleanName('가나다라마바사아자차카타파하'), '가나다라마바사아자차카타');
  assert.equal(cleanName('   '), '손님');
});
