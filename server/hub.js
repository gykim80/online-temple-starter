// 방(room) 관리와 메시지 처리. 네트워크 라이브러리에 묶이지 않게 conn 은 { send(text), close() } 만 쓴다.
import { POSES, LIMITS, PLACE_RE, KIND_RE, cleanName, cleanColor, clampNum, round2 } from '../public/shared/protocol.js';
import { StatsStore } from './stats.js';
import { checkRate } from './rate-limit.js';

export { cleanName, POSES };

const DEFAULT_PLACE = 'temple';

export class Hub {
  constructor({ capacity = 50, maxRooms = 100, statsFile = null, stats = new StatsStore(statsFile) } = {}) {
    this.capacity = capacity;
    this.maxRooms = maxRooms;
    this.store = stats;
    this.rooms = new Map(); // "place:번호" → Set<peer>
    this.peers = new Map(); // conn → peer
    this.nextId = 1;
  }

  /** 장소별 동작 수 ({ temple: { bow: 12 } }) */
  get stats() { return this.store.data; }

  key(place, room) { return `${place}:${room}`; }
  roomOf(peer) { return this.rooms.get(this.key(peer.place, peer.room)); }
  count(place, room) { return this.rooms.get(this.key(place, room))?.size ?? 0; }

  // 원하는 방에 자리가 있으면 그 방, 없으면 1번부터 빈 방을 찾는다
  pickRoom(place, wanted) {
    const has = (n) => this.count(place, n) < this.capacity;
    if (Number.isInteger(wanted) && wanted >= 1 && wanted <= this.maxRooms && has(wanted)) return wanted;
    for (let n = 1; n <= this.maxRooms; n++) if (has(n)) return n;
    return null;
  }

  listRooms(place) {
    const out = [];
    const prefix = `${place}:`;
    for (const [k, set] of this.rooms) if (k.startsWith(prefix)) out.push({ room: Number(k.slice(prefix.length)), count: set.size });
    return out.sort((a, b) => a.room - b.room);
  }

  /** 같은 방 사람들에게 보낸다. 글자로 한 번만 바꿔 모두에게 같은 것을 보낸다 */
  broadcast(peer, msg, includeSelf = false) {
    const text = JSON.stringify(msg);
    for (const p of this.roomOf(peer) ?? []) if (includeSelf || p !== peer) p.conn.send(text);
  }

  public(p) { return { id: p.id, name: p.name, color: p.color, x: p.x, z: p.z, yaw: p.yaw, pose: p.pose }; }

  join(conn, msg) {
    const place = PLACE_RE.test(String(msg.place)) ? msg.place : DEFAULT_PLACE;
    const room = this.pickRoom(place, Number(msg.room));
    if (room == null) { conn.send(JSON.stringify({ t: 'full' })); conn.close(); return null; }
    const peer = {
      id: this.nextId++, conn, place, room,
      name: cleanName(msg.name), color: cleanColor(msg.color),
      x: round2(clampNum(msg.x, LIMITS.bound)), z: round2(clampNum(msg.z, LIMITS.bound)), yaw: round2(clampNum(msg.yaw, LIMITS.yaw)), pose: 'stand',
      dirty: false, win: 0, winCount: 0,
    };
    const k = this.key(place, room);
    let set = this.rooms.get(k);
    if (!set) this.rooms.set(k, (set = new Set()));
    conn.send(JSON.stringify({ t: 'welcome', id: peer.id, room, capacity: this.capacity, peers: [...set].map((p) => this.public(p)), stats: this.store.of(place) }));
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

  handle(conn, raw, now = Date.now()) {
    if (typeof raw !== 'string' || raw.length > LIMITS.messageBytes) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    const peer = this.peers.get(conn);
    if (!peer) { if (msg.t === 'join') this.join(conn, msg); return; }
    const rate = checkRate(peer, now);
    if (rate === 'kick') { conn.close(); return; }
    if (rate === 'drop') return;
    if (Object.hasOwn(HANDLERS, msg.t)) HANDLERS[msg.t](this, peer, msg);
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

  saveStats() { this.store.save(); }
}

// 들어온 뒤에 받는 메시지. 여기 없는 종류는 무시한다
const HANDLERS = {
  move(hub, peer, m) {
    peer.x = round2(clampNum(m.x, LIMITS.bound));
    peer.z = round2(clampNum(m.z, LIMITS.bound));
    peer.yaw = round2(clampNum(m.yaw, LIMITS.yaw));
    if (POSES.includes(m.pose)) peer.pose = m.pose;
    peer.dirty = true;
  },
  act(hub, peer, m) {
    if (!KIND_RE.test(String(m.kind))) return;
    const total = hub.store.add(peer.place, m.kind);
    hub.broadcast(peer, { t: 'act', id: peer.id, kind: m.kind, total }, true);
  },
  name(hub, peer, m) {
    peer.name = cleanName(m.name);
    hub.broadcast(peer, { t: 'name', id: peer.id, name: peer.name }, true);
  },
};
