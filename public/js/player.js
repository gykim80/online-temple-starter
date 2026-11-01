// 내 캐릭터: 클릭·키보드 이동, 켜고 끄는 동작(loop·pose), 서버로 위치 보내기
import { makeAvatar } from './avatar.js';

const SPEED = 2.8; // m/s
const ARRIVE = 0.15; // 목표에 이만큼 가까우면 멈춘다 (m)
const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export function createPlayer({ world, place, color, name, labels }) {
  const actions = new Map(place.actions.map((a) => [a.id, a]));
  const me = {
    id: null,
    x: place.spawn.x + (Math.random() - 0.5) * 3, z: place.spawn.z + Math.random() * 2,
    yaw: Math.PI + (place.spawn.yaw ?? 0), pose: 'stand',
    target: null, // { x, z } 클릭한 곳
    mode: null, modeAt: 0, // 켜 둔 동작 id 와 마지막으로 센 시각
    avatar: makeAvatar({ ...place.avatar, robe: color }),
    label: labels.add(name, 'me'),
    color,
    get name() { return this.label.textContent; },
    set name(v) { this.label.textContent = v; },
  };
  world.scene.add(me.avatar.root);

  let onModeChange = () => {};

  function stopWalking() { me.target = null; world.marker.visible = false; }

  function setMode(id, t) {
    me.mode = id;
    const a = actions.get(id);
    me.modeAt = t - (a?.every ?? 0) + 0.5; // 누르고 0.5초 뒤 첫 동작
    onModeChange(id);
  }

  return {
    me,
    actions,
    onModeChange(fn) { onModeChange = fn; },
    walkTo(x, z) {
      [x, z] = world.resolve(x, z);
      me.target = { x, z };
      world.marker.position.set(x, world.heightAt(x, z) + 0.03, z);
      world.marker.visible = true;
    },
    /**
     * 동작 버튼·키. gesture 는 바로 한 번, loop·pose 는 켜고 끈다.
     * 서버에 알려야 하면 그 동작을 돌려준다
     */
    trigger(id, t) {
      const a = actions.get(id);
      if (!a) return null;
      stopWalking();
      if (a.type === 'gesture') { me.avatar.gesture(t); return a; }
      setMode(me.mode === a.id ? null : a.id, t);
      return null;
    },
    /**
     * 한 프레임 진행. axis 는 키보드 방향, camYaw 는 카메라 방향.
     * 켜 둔 동작이 every 초를 채우면 그 동작을 돌려준다
     */
    update(t, dt, axis, camYaw, canMove) {
      let mx = 0, mz = 0, fired = null;
      const [ix, iz] = axis;
      if (canMove && (ix || iz)) {
        const c = Math.cos(camYaw), s = Math.sin(camYaw);
        mx = ix * c + iz * s; mz = -ix * s + iz * c;
        stopWalking();
      } else if (me.target) {
        mx = me.target.x - me.x; mz = me.target.z - me.z;
        if (Math.hypot(mx, mz) < ARRIVE) { stopWalking(); mx = mz = 0; }
      }
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        if (me.mode) setMode(null, t);
        const step = Math.min(len, SPEED * dt);
        [me.x, me.z] = world.resolve(me.x + (mx / len) * step, me.z + (mz / len) * step);
        me.yaw += angleDelta(me.yaw, Math.atan2(mx, mz)) * Math.min(1, dt * 10);
        me.pose = 'walk';
      } else {
        const a = actions.get(me.mode);
        me.pose = a?.pose ?? 'stand';
        if (a?.every && t - me.modeAt >= a.every) {
          me.modeAt = t;
          if (a.bow) me.avatar.bow(t);
          fired = a;
        }
      }
      const root = me.avatar.root;
      root.position.set(me.x, world.heightAt(me.x, me.z), me.z);
      root.rotation.y = me.yaw;
      me.avatar.animate(t, dt, me.pose);
      labels.place(me.label, root);
      return fired;
    },
  };
}
