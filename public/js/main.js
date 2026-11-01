// 입장 → 3D 공간 → 내 캐릭터 조작 → 서버로 위치·동작 공유 → 다른 사람 그리기
import * as THREE from 'three';
import { PLACES, DEFAULT_PLACE } from '../places/index.js';
import { createWorld } from './world.js';
import { makeAvatar } from './avatar.js';
import { Net } from './net.js';
import { createSound } from './sound.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const placeId = PLACES.some((p) => p.id === params.get('place')) ? params.get('place') : DEFAULT_PLACE;
const place = (await import(`../places/${placeId}.js`)).default;
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── 입장 화면 ───────────────────────────────
document.title = `${place.title}, 잠깐 쉬어가요`;
$('#gate-title').textContent = place.title;
$('#gate-tagline').textContent = place.tagline;
$('#place-name').textContent = place.title;
$('#gate-places').innerHTML = PLACES.length > 1
  ? PLACES.map((p) => `<a href="?place=${p.id}"${p.id === placeId ? ' aria-current="page"' : ''}>${p.title}</a>`).join('') : '';
const saved = JSON.parse(localStorage.getItem('visitor') || '{}');
const myName = saved.name || `${pick(place.names.a)} ${pick(place.names.b)}`;
const myColor = place.avatar.robes.includes(saved.color) ? saved.color : pick(place.avatar.robes);
$('#gate-name').value = myName;

// ── 세상과 내 캐릭터 ─────────────────────────
const world = createWorld($('#view'), place);
const me = {
  x: place.spawn.x + (Math.random() - 0.5) * 3, z: place.spawn.z + Math.random() * 2,
  yaw: Math.PI + (place.spawn.yaw ?? 0), pose: 'stand', target: null, mode: null, modeAt: 0,
  avatar: makeAvatar({ ...place.avatar, robe: myColor }),
};
world.scene.add(me.avatar.root);
world.cam.yaw = place.spawn.yaw ?? 0;

const labels = $('#labels');
function makeLabel(text, cls = '') {
  const el = document.createElement('div');
  el.className = `tag ${cls}`;
  el.textContent = text;
  labels.append(el);
  return el;
}
me.label = makeLabel(myName, 'me');

// 늘 그 자리에 있는 사람들 (서버와 상관없이 화면에만 있다)
const residents = (place.residents || []).map((r, i) => {
  const avatar = makeAvatar({ ...place.avatar, ...r.look });
  avatar.root.position.set(r.x, world.heightAt(r.x, r.z), r.z);
  avatar.root.rotation.y = r.yaw;
  world.scene.add(avatar.root);
  return { ...r, avatar, label: makeLabel(r.name, 'npc'), next: 3 + i * 2.3 };
});

// ── 다른 사람들 ───────────────────────────────
const remotes = new Map();
function addRemote(p) {
  if (remotes.has(p.id)) return;
  const avatar = makeAvatar({ ...place.avatar, robe: p.color });
  avatar.root.position.set(p.x, world.heightAt(p.x, p.z), p.z);
  world.scene.add(avatar.root);
  remotes.set(p.id, { ...p, avatar, label: makeLabel(p.name), tx: p.x, tz: p.z, tyaw: p.yaw });
  updatePeople();
}
function removeRemote(id) {
  const r = remotes.get(id);
  if (!r) return;
  world.scene.remove(r.avatar.root);
  r.avatar.dispose();
  r.label.remove();
  remotes.delete(id);
  updatePeople();
}
function updatePeople() {
  $('#people-count').textContent = remotes.size + 1;
  $('#people-btn').setAttribute('aria-label', `같이 있는 사람 ${remotes.size + 1}명 보기`);
}

// ── 할 수 있는 것 (장소 설정의 actions) ────────
const sound = createSound();
const totals = {};
const actBtns = {};
$('#actions').innerHTML = place.actions.map((a) => `
  <button class="act" data-act="${a.id}" ${a.type === 'gesture' ? '' : 'aria-pressed="false"'} aria-keyshortcuts="${a.key}" title="${a.label} · ${a.key}">
    <span class="ico" aria-hidden="true">${a.icon}</span><span>${a.label}</span><kbd>${a.key}</kbd><span class="count" data-count="${a.id}"></span>
  </button>`).join('');
for (const a of place.actions) actBtns[a.id] = $(`[data-act="${a.id}"]`);
function showTotals() {
  for (const a of place.actions) if (a.counter) $(`[data-count="${a.id}"]`).textContent = totals[a.id] ? fmt(totals[a.id]) : '';
}
let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
}

// 경과 시간 (초)
const clock = new THREE.Timer();
clock.connect(document);
function doAction(id) {
  const a = place.actions.find((x) => x.id === id);
  if (!a || !net) return;
  const t = clock.getElapsed();
  me.target = null;
  world.marker.visible = false;
  if (a.type === 'gesture') {
    me.avatar.gesture(t);
    sound.play(a.sound);
    net.act(a.id);
    return;
  }
  // loop·pose 는 켜고 끄는 모드. 켜져 있는 동안 every 초마다 한 번씩 동작을 올린다
  setMode(me.mode === a.id ? null : a.id);
}
function setMode(id) {
  me.mode = id;
  const a = place.actions.find((x) => x.id === id);
  me.modeAt = clock.getElapsed() - (a?.every ?? 0) + 0.5; // 누르고 0.5초 뒤 첫 동작
  me.cycles = 0;
  for (const a of place.actions) if (a.type !== 'gesture') actBtns[a.id].setAttribute('aria-pressed', String(a.id === id));
}
$('#actions').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) doAction(b.dataset.act); });

// ── 키보드 ─────────────────────────────────
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.target.closest('input, dialog')) return;
  const a = place.actions.find((x) => x.key === e.key);
  if (a && !e.repeat) return doAction(a.id);
  keys.add(e.key.toLowerCase());
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

world.onGroundClick((p) => {
  if (!net) return;
  const [x, z] = world.resolve(p.x, p.z);
  me.target = new THREE.Vector3(x, 0, z);
  world.marker.position.set(me.target.x, world.heightAt(me.target.x, me.target.z) + 0.03, me.target.z);
  world.marker.visible = true;
});

// ── 서버 연결 ──────────────────────────────
let net = null;
let room = Number(params.get('room')) || null;
const wsUrl = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
function connect() {
  net = new Net({
    url: wsUrl(),
    join: () => ({ place: place.id, room, name: me.label.textContent, color: myColor, x: me.x, z: me.z, yaw: me.yaw }),
    on: {
      welcome(m) {
        me.id = m.id;
        room = m.room;
        $('#room-no').textContent = m.room;
        const u = new URL(location.href);
        u.searchParams.set('room', m.room);
        history.replaceState(null, '', u);
        for (const id of [...remotes.keys()]) removeRemote(id);
        m.peers.forEach(addRemote);
        Object.assign(totals, m.stats);
        showTotals();
        updatePeople();
      },
      join: (m) => addRemote(m.peer),
      leave: (m) => removeRemote(m.id),
      moves(m) {
        for (const [id, x, z, yaw, pose] of m.list) {
          const r = remotes.get(id);
          if (r) Object.assign(r, { tx: x, tz: z, tyaw: yaw, pose });
        }
      },
      act(m) {
        totals[m.kind] = m.total;
        showTotals();
        world.built.onAct?.(m.kind);
        const a = place.actions.find((x) => x.id === m.kind);
        if (m.id === me.id) { if (a?.counter) toast(a.counter.replace('{n}', fmt(m.total))); return; }
        const r = remotes.get(m.id);
        if (!r || !a) return;
        if (a.bow) r.avatar.bow(clock.getElapsed()); else if (a.type === 'gesture') r.avatar.gesture(clock.getElapsed());
      },
      name(m) { const r = m.id === me.id ? me : remotes.get(m.id); if (r) r.label.textContent = m.name; },
      status(s) {
        if (s === 'offline') toast('연결이 끊겼습니다. 다시 잇는 중');
        if (s === 'full') toast('모든 방이 찼습니다. 잠시 뒤에 다시 와 주세요');
      },
    },
  });
}

$('#gate-enter').disabled = false;
$('#gate-enter').textContent = '들어가기';
$('#gate-enter').addEventListener('click', () => {
  const name = $('#gate-name').value.trim().slice(0, 12) || myName;
  me.label.textContent = name;
  localStorage.setItem('visitor', JSON.stringify({ name, color: myColor }));
  $('#gate').hidden = true;
  for (const el of ['.hud-top', '#actions', '#hint']) $(el).hidden = false;
  setTimeout(() => { $('#hint').style.opacity = 0; }, 9000);
  if (!sound.on) toggleSound();
  connect();
});
$('#gate-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#gate-enter').click(); });

function toggleSound() {
  const on = sound.toggle(place.ambient);
  $('#sound-btn').setAttribute('aria-pressed', String(on));
  $('#sound-btn').setAttribute('aria-label', on ? '소리 끄기' : '소리 켜기');
}
$('#sound-btn').addEventListener('click', toggleSound);

// ── 대화상자 ───────────────────────────────
for (const d of document.querySelectorAll('dialog')) d.querySelector('.close').addEventListener('click', () => d.close());
$('#people-btn').addEventListener('click', () => {
  const rows = [[me.label.textContent + ' (나)', myColor], ...[...remotes.values()].map((r) => [r.name, r.color])];
  $('#people-list').innerHTML = rows.map(([n, c]) => `<li><i class="dot" style="background:${c}"></i>${n.replace(/[<>&]/g, '')}</li>`).join('');
  $('#people-dlg').showModal();
});
$('#room-btn').addEventListener('click', async () => {
  const res = await fetch(`/api/rooms?place=${place.id}`).then((r) => r.json());
  const used = new Set(res.rooms.map((r) => r.room));
  let empty = 1; while (used.has(empty)) empty++;
  const rows = [...res.rooms, { room: empty, count: 0 }].sort((a, b) => a.room - b.room);
  $('#room-list').innerHTML = rows.map((r) => `<li><button data-room="${r.room}" ${r.room === room ? 'aria-current="true"' : ''}>
    <span>${r.room}번 방${r.room === room ? ' · 지금 있는 곳' : ''}</span><span>${r.count}/${res.capacity}</span></button></li>`).join('');
  $('#room-dlg').showModal();
});
$('#room-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-room]');
  if (!b) return;
  room = Number(b.dataset.room);
  $('#room-dlg').close();
  net.reconnect(wsUrl());
});

// ── 매 프레임 ───────────────────────────────
const v = new THREE.Vector3();
function placeLabel(el, obj, h = 1.62) {
  v.set(obj.position.x, obj.position.y + h, obj.position.z);
  const dist = v.distanceTo(world.camera.position);
  v.project(world.camera);
  const show = v.z < 1 && dist < 28;
  el.style.display = show ? '' : 'none';
  if (show) el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
}

function frame() {
  clock.update();
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.getElapsed();

  // 키보드 이동: 카메라가 보는 방향 기준
  let ix = 0, iz = 0;
  if (keys.has('w') || keys.has('arrowup')) iz -= 1;
  if (keys.has('s') || keys.has('arrowdown')) iz += 1;
  if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
  if (keys.has('d') || keys.has('arrowright')) ix += 1;
  let mx = 0, mz = 0;
  if (net && (ix || iz)) {
    const c = Math.cos(world.cam.yaw), s = Math.sin(world.cam.yaw);
    mx = ix * c + iz * s; mz = -ix * s + iz * c;
    me.target = null; world.marker.visible = false;
  } else if (me.target) {
    mx = me.target.x - me.x; mz = me.target.z - me.z;
    if (Math.hypot(mx, mz) < 0.15) { me.target = null; world.marker.visible = false; mx = mz = 0; }
  }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    if (me.mode) setMode(null);
    const step = Math.min(len, 2.8 * dt);
    [me.x, me.z] = world.resolve(me.x + (mx / len) * step, me.z + (mz / len) * step);
    const want = Math.atan2(mx, mz);
    me.yaw += Math.atan2(Math.sin(want - me.yaw), Math.cos(want - me.yaw)) * Math.min(1, dt * 10);
    me.pose = 'walk';
  } else {
    const a = place.actions.find((x) => x.id === me.mode);
    me.pose = a ? a.pose : 'stand';
    if (a?.every && t - me.modeAt >= a.every) {
      me.modeAt = t;
      if (a.bow) me.avatar.bow(t);
      sound.play(a.sound);
      net?.act(a.id);
    }
  }
  me.avatar.root.position.set(me.x, world.heightAt(me.x, me.z), me.z);
  me.avatar.root.rotation.y = me.yaw;
  me.avatar.animate(t, dt, me.pose);
  net?.move(me.x, me.z, me.yaw, me.pose);
  placeLabel(me.label, me.avatar.root);

  const k = 1 - Math.exp(-dt * 10);
  for (const r of remotes.values()) {
    const p = r.avatar.root.position;
    const moving = Math.hypot(r.tx - p.x, r.tz - p.z) > 0.04;
    p.x += (r.tx - p.x) * k; p.z += (r.tz - p.z) * k;
    p.y = world.heightAt(p.x, p.z);
    r.avatar.root.rotation.y += Math.atan2(Math.sin(r.tyaw - r.avatar.root.rotation.y), Math.cos(r.tyaw - r.avatar.root.rotation.y)) * k;
    r.avatar.animate(t, dt, moving ? 'walk' : r.pose === 'walk' ? 'stand' : r.pose);
    placeLabel(r.label, r.avatar.root);
  }
  for (const r of residents) {
    if (r.bowEvery && t > r.next) { r.avatar.bow(t); r.next = t + r.bowEvery; }
    r.avatar.animate(t, dt, r.pose);
    placeLabel(r.label, r.avatar.root);
  }
  // 들어가기 전에는 천천히 돌며 둘러본다
  if (!net) world.cam.yaw += dt * 0.05;
  world.follow(me.avatar.root.position, dt);
  world.render(t, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__place = { world, me, remotes, doAction }; // 자동 테스트용
