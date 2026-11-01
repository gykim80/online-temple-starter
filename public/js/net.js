// 서버와 WebSocket 으로 주고받는다. 끊기면 1→2→4…최대 15초 간격으로 다시 붙는다.
import { TICK_MS } from '../shared/protocol.js';

const RETRY_MIN = 1000, RETRY_MAX = 15000;

export class Net {
  /**
   * @param {{ url: string, join: () => object, on: Record<string, (m: any) => void> }} o
   * join 은 함수로 받는다. 다시 붙을 때 그때의 위치를 넣기 위해서다
   * on: { welcome, join, leave, moves, act, name, status }
   */
  constructor({ url, join, on }) {
    this.url = url;
    this.join = join;
    this.on = on;
    this.retry = RETRY_MIN;
    this.ws = null;
    this.last = null; // 마지막으로 보낸 move
    this.pending = null;
    this.timer = null;
    this.retryTimer = null;
    this.stopped = false;
    this.open();
  }

  open() {
    this.on.status?.('connecting');
    const ws = (this.ws = new WebSocket(this.url));
    // 방을 옮기면 예전 소켓의 이벤트가 늦게 올 수 있다. 지금 소켓이 아니면 무시한다
    const current = () => this.ws === ws;
    ws.onopen = () => {
      if (!current()) return;
      this.retry = RETRY_MIN;
      ws.send(JSON.stringify({ t: 'join', ...this.join() }));
    };
    ws.onmessage = (e) => {
      if (!current()) return;
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'welcome') this.on.status?.('online');
      if (m.t === 'full') { this.stopped = true; this.on.status?.('full'); return; }
      this.on[m.t]?.(m);
    };
    ws.onclose = () => {
      if (!current() || this.stopped) return;
      this.on.status?.('offline');
      this.retryTimer = setTimeout(() => this.open(), this.retry);
      this.retry = Math.min(this.retry * 2, RETRY_MAX);
    };
  }

  send(msg) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)); }

  // 움직임은 바뀌었을 때만, TICK_MS 에 한 번까지 보낸다
  move(x, z, yaw, pose) {
    const m = { t: 'move', x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(2), pose };
    const l = this.pending ?? this.last;
    if (l && l.x === m.x && l.z === m.z && l.yaw === m.yaw && l.pose === m.pose) return;
    this.pending = m;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.last = this.pending;
      this.pending = null;
      this.send(this.last);
    }, TICK_MS);
  }

  act(kind) { this.send({ t: 'act', kind }); }

  // 다른 방으로 옮길 때: 예전 연결을 닫고 새로 연다
  reconnect(url = this.url) {
    clearTimeout(this.retryTimer);
    const old = this.ws;
    this.ws = null;
    old?.close();
    this.url = url;
    this.last = this.pending = null;
    this.stopped = false;
    this.retry = RETRY_MIN;
    this.open();
  }
}
