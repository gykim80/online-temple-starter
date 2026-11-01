// 방(room) 관리와 메시지 처리. 네트워크 라이브러리에 묶이지 않게 conn 은 { send(text), close() } 만 쓴다.
import fs from 'node:fs';
import path from 'node:path';

export const POSES = ['stand', 'walk', 'kneel', 'sit', 'beads'];
const BOUND = 90; // 좌표 한계 (m)
const PLACE_RE = /^[a-z0-9-]{1,24}$/;
const KIND_RE = /^[a-z]{1,16}$/;

// 이름에서 태그 문자와 제어 문자를 빼고 12자로 자른다
export function cleanName(s) {
  const t = String(s ?? '').replace(/[<>&"'`\u0000-\u001f]/g, '').trim();
  return [...t].slice(0, 12).join('') || '손님';
}
const cleanColor = (c) => (/^#[0-9a-f]{6}$/i.test(String(c)) ? String(c) : '#b9c3c9');
const num = (v, lim) => (Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : 0);
const round = (v) => Math.round(v * 100) / 100;

export class Hub {
  constructor({ capacity = 50, maxRooms = 100, statsFile = null } = {}) {
    this.capacity = capacity;
    this.maxRooms = maxRooms;
    this.statsFile = statsFile;
    this.rooms = new Map(); // "place:번호" → Set<peer>
    this.peers = new Map(); // conn → peer
    this.nextId = 1;
    this.stats = {};
    if (statsFile && fs.existsSync(statsFile)) {
      try { this.stats = JSON.parse(fs.readFileSync(statsFile, 'utf8')); } catch { this.stats = {}; }
    }
  }

  key(place, room) { return `${place}:${room}`; }

  // 원하는 방에 자리가 있으면 그 방, 없으면 1번부터 빈 방을 찾는다
  pickRoom(place, wanted) {
    const has = (n) => (this.rooms.get(this.key(place, n))?.size ?? 0) < this.capacity;
    if (Number.isInteger(wanted) && wanted >= 1 && wanted <= this.maxRooms && has(wanted)) return wanted;
    for (let n = 1; n <= this.maxRooms; n++) if (has(n)) return n;
    return null;
  }

  listRooms(place) {
    const out = [];
    for (const [k, set] of this.rooms) {
      const [p, n] = k.split(':');
      if (p === place && set.size) out.push({ room: Number(n), count: set.size });
    }
    return out.sort((a, b) => a.room - b.room);
  }

  roomOf(peer) { return this.rooms.get(this.key(peer.place, peer.room)); }

  broadcast(peer, msg, includeSelf = false) {
    const text = JSON.stringify(msg);
    for (const p of this.roomOf(peer) ?? []) if (includeSelf || p !== peer) p.conn.send(text);
  }

  public(p) { return { id: p.id, name: p.name, color: p.color, x: p.x, z: p.z, yaw: p.yaw, pose: p.pose }; }

  join(conn, msg) {
    const place = PLACE_RE.test(String(msg.place)) ? msg.place : 'temple';
    const room = this.pickRoom(place, Number(msg.room));
    if (room == null) { conn.send(JSON.stringify({ t: 'full' })); conn.close(); return null; }
    const peer = {
      id: this.nextId++, conn, place, room,
      name: cleanName(msg.name), color: cleanColor(msg.color),
      x: num(msg.x, BOUND), z: num(msg.z, BOUND), yaw: num(msg.yaw, 10), pose: 'stand',
      dirty: false, win: 0, winCount: 0,
    };
    const k = this.key(place, room);
    if (!this.rooms.has(k)) this.rooms.set(k, new Set());
    const set = this.rooms.get(k);
    conn.send(JSON.stringify({ t: 'welcome', id: peer.id, room, capacity: this.capacity, peers: [...set].map((p) => this.public(p)), stats: this.stats[place] ?? {} }));
    set.add(peer);
    this.peers.set(conn, peer);
    this.broadcast(peer, { t: 'join', peer: this.public(peer) });
    return peer;
  }

  leave(conn) {
    const peer = this.peers.get(conn);
    if (!peer) return;
    this.peers.delete(conn);
    const set = this.roomOf(peer);
    set?.delete(peer);
    if (set && !set.size) this.rooms.delete(this.key(peer.place, peer.room));
    else this.broadcast(peer, { t: 'leave', id: peer.id });
  }

  // 1초에 40개 넘게 보내면 넘친 메시지는 버리고, 200개를 넘기면 연결을 끊는다
  allow(peer, now) {
    if (now - peer.win >= 1000) { peer.win = now; peer.winCount = 0; }
    peer.winCount++;
    if (peer.winCount > 200) { peer.conn.close(); return false; }
    return peer.winCount <= 40;
  }

  handle(conn, raw, now = Date.now()) {
    if (raw.length > 1024) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    const peer = this.peers.get(conn);
    if (!peer) { if (msg.t === 'join') this.join(conn, msg); return; }
    if (!this.allow(peer, now)) return;
    if (msg.t === 'move') {
      peer.x = round(num(msg.x, BOUND));
      peer.z = round(num(msg.z, BOUND));
      peer.yaw = round(num(msg.yaw, 10));
      if (POSES.includes(msg.pose)) peer.pose = msg.pose;
      peer.dirty = true;
    } else if (msg.t === 'act' && KIND_RE.test(String(msg.kind))) {
      const s = (this.stats[peer.place] ??= {});
      s[msg.kind] = (s[msg.kind] ?? 0) + 1;
      this.statsDirty = true;
      this.broadcast(peer, { t: 'act', id: peer.id, kind: msg.kind, total: s[msg.kind] }, true);
    } else if (msg.t === 'name') {
      peer.name = cleanName(msg.name);
      this.broadcast(peer, { t: 'name', id: peer.id, name: peer.name }, true);
    }
  }

  // 0.1초마다 움직인 사람만 모아서 방마다 한 번에 보낸다
  tick() {
    for (const set of this.rooms.values()) {
      const list = [];
      for (const p of set) if (p.dirty) { list.push([p.id, p.x, p.z, p.yaw, p.pose]); p.dirty = false; }
      if (!list.length) continue;
      const text = JSON.stringify({ t: 'moves', list });
      for (const p of set) p.conn.send(text);
    }
  }

  saveStats() {
    if (!this.statsFile || !this.statsDirty) return;
    this.statsDirty = false;
    fs.mkdirSync(path.dirname(this.statsFile), { recursive: true });
    fs.writeFileSync(this.statsFile, JSON.stringify(this.stats));
  }
}
