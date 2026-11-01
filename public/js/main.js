// 입장 → 3D 공간 → 내 캐릭터 조작 → 서버로 위치·동작 공유 → 다른 사람 그리기
// 각 부분은 모듈로 나뉘어 있고, 여기서는 그것들을 잇기만 한다.
import * as THREE from 'three';
import { PLACES, DEFAULT_PLACE } from '../places/index.js';
import { createWorld } from './world.js';
import { Net } from './net.js';
import { createSound } from './sound.js';
import { createPlayer } from './player.js';
import { createCrowd } from './crowd.js';
import { createKeyboard } from './input.js';
import { createHud } from './ui/hud.js';
import { createLabels } from './ui/labels.js';
import { $, fmt, pick } from './ui/dom.js';
import { cleanName } from '../shared/protocol.js';

const params = new URLSearchParams(location.search);
const placeId = PLACES.some((p) => p.id === params.get('place')) ? params.get('place') : DEFAULT_PLACE;
const place = (await import(`../places/${placeId}.js`)).default;

// 지난번 이름과 옷 색을 기억한다
let saved = {};
try { saved = JSON.parse(localStorage.getItem('visitor') || '{}'); } catch {}
const myName = saved.name || `${pick(place.names.a)} ${pick(place.names.b)}`;
const myColor = place.avatar.robes.includes(saved.color) ? saved.color : pick(place.avatar.robes);

const hud = createHud(place, placeId);
const world = createWorld($('#view'), place, { time: params.get('time') });
world.cam.yaw = place.spawn.yaw ?? 0;
const labels = createLabels($('#labels'), world.camera);
const player = createPlayer({ world, place, color: myColor, name: myName, labels });
const { me } = player;
const crowd = createCrowd({ world, place, labels, onChange: (n) => hud.setPeopleCount(n + 1) });
const sound = createSound();
const clock = new THREE.Timer();
clock.connect(document);

const totals = {};
let net = null;
let room = Number(params.get('room')) || null;

// ── 동작 ──
function doAction(id) {
  if (!net) return;
  const a = player.trigger(id, clock.getElapsed());
  if (a) { sound.play(a.sound); net.act(a.id); }
}
player.onModeChange((id) => hud.setMode(id));
hud.onAction(doAction);
const keyboard = createKeyboard((key) => {
  const a = place.actions.find((x) => x.key === key);
  if (a) doAction(a.id);
  return Boolean(a);
});
world.onGroundClick((p) => { if (net) player.walkTo(p.x, p.z); });

// ── 서버 연결 ──
const wsUrl = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
const handlers = {
  welcome(m) {
    me.id = m.id;
    room = m.room;
    hud.setRoom(m.room);
    const u = new URL(location.href);
    u.searchParams.set('room', m.room);
    history.replaceState(null, '', u);
    crowd.clear();
    m.peers.forEach(crowd.add);
    Object.assign(totals, m.stats);
    hud.showTotals(totals);
    hud.setPeopleCount(crowd.remotes.size + 1);
  },
  join: (m) => crowd.add(m.peer),
  leave: (m) => crowd.remove(m.id),
  moves: (m) => crowd.moves(m.list),
  act(m) {
    totals[m.kind] = m.total;
    hud.showTotals(totals);
    world.built.onAct?.(m.kind);
    const a = player.actions.get(m.kind);
    if (m.id === me.id) { if (a?.counter) hud.toast(a.counter.replace('{n}', fmt(m.total))); return; }
    crowd.perform(m.id, a, clock.getElapsed());
  },
  name(m) { if (m.id === me.id) me.name = m.name; else crowd.rename(m.id, m.name); },
  status(s) {
    if (s === 'offline') hud.toast('연결이 끊겼습니다. 다시 잇는 중');
    if (s === 'full') hud.toast('모든 방이 찼습니다. 잠시 뒤에 다시 와 주세요');
  },
};
const joinMessage = () => ({ place: place.id, room, name: me.name, color: myColor, x: me.x, z: me.z, yaw: me.yaw });

// ── 화면 ──
const syncSound = hud.onSound(() => sound.toggle(place.ambient));
hud.gate(myName, (name) => {
  me.name = cleanName(name);
  try { localStorage.setItem('visitor', JSON.stringify({ name: me.name, color: myColor })); } catch {}
  if (!sound.on) syncSound(sound.toggle(place.ambient));
  net = new Net({ url: wsUrl(), join: joinMessage, on: handlers });
});
hud.onPeople(() => [[`${me.name} (나)`, myColor], ...[...crowd.remotes.values()].map((r) => [r.name, r.color])]);
hud.onRooms(() => room, (no) => { room = no; net?.reconnect(wsUrl()); });

// ── 매 프레임 ──
function frame() {
  clock.update();
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.getElapsed();
  const fired = player.update(t, dt, keyboard.axis(), world.cam.yaw, Boolean(net));
  if (fired) { sound.play(fired.sound); net?.act(fired.id); }
  net?.move(me.x, me.z, me.yaw, me.pose);
  crowd.update(t, dt);
  if (!net) world.cam.yaw += dt * 0.05; // 들어가기 전에는 천천히 돌며 둘러본다
  world.follow(me.avatar.root.position, dt);
  world.render(t, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__place = { world, me, remotes: crowd.remotes, doAction }; // 자동 테스트용
