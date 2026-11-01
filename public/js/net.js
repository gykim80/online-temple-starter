// 서버와 WebSocket 으로 주고받는다. 끊기면 1→2→4…최대 15초 간격으로 다시 붙는다.
export class Net {
  constructor({ url, join, on }) {
    this.url = url;
    this.join = join; // () => 입장 메시지 (다시 붙을 때 현재 위치를 넣기 위해 함수로 받는다)
    this.on = on; // { welcome, join, leave, moves, act, name, status }
    this.retry = 1000;
    this.last = null;
    this.timer = null;
    this.open();
  }

  open() {
    this.on.status?.('connecting');
    const ws = (this.ws = new WebSocket(this.url));
    ws.onopen = () => { this.retry = 1000; ws.send(JSON.stringify({ t: 'join', ...this.join() })); };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'welcome') this.on.status?.('online');
      if (m.t === 'full') { this.on.status?.('full'); this.closed = true; return; }
      this.on[m.t]?.(m);
    };
    ws.onclose = () => {
      if (this.closed) return;
      this.on.status?.('offline');
      setTimeout(() => this.open(), this.retry);
      this.retry = Math.min(this.retry * 2, 15000);
    };
  }

  send(msg) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg)); }

  // 움직임은 바뀌었을 때만, 0.1초에 한 번까지 보낸다
  move(x, z, yaw, pose) {
    const m = { t: 'move', x: +x.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(2), pose };
    const l = this.last;
    if (l && l.x === m.x && l.z === m.z && l.yaw === m.yaw && l.pose === m.pose) return;
    this.pending = m;
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.last = this.pending; this.send(this.pending); }, 100);
  }

  act(kind) { this.send({ t: 'act', kind }); }

  // 다른 방으로 옮길 때: 연결을 새로 연다
  reconnect(url) { this.closed = true; this.ws?.close(); this.closed = false; this.url = url; this.last = null; this.open(); }
}
