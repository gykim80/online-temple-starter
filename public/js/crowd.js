// 다른 사람들(서버에서 온 사람)과 늘 그 자리에 있는 사람들(장소 설정의 residents)
import { makeAvatar } from './avatar.js';

const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export function createCrowd({ world, place, labels, onChange }) {
  const remotes = new Map();

  const residents = (place.residents || []).map((r, i) => {
    const avatar = makeAvatar({ ...place.avatar, ...r.look });
    avatar.root.position.set(r.x, world.heightAt(r.x, r.z), r.z);
    avatar.root.rotation.y = r.yaw;
    world.scene.add(avatar.root);
    return { ...r, avatar, label: labels.add(r.name, 'npc'), next: 3 + i * 2.3 };
  });

  function add(p) {
    if (remotes.has(p.id)) return;
    const avatar = makeAvatar({ ...place.avatar, robe: p.color });
    avatar.root.position.set(p.x, world.heightAt(p.x, p.z), p.z);
    avatar.root.rotation.y = p.yaw;
    world.scene.add(avatar.root);
    remotes.set(p.id, { ...p, avatar, label: labels.add(p.name), tx: p.x, tz: p.z, tyaw: p.yaw });
    onChange(remotes.size);
  }

  function remove(id) {
    const r = remotes.get(id);
    if (!r) return;
    world.scene.remove(r.avatar.root);
    r.avatar.dispose();
    r.label.remove();
    remotes.delete(id);
    onChange(remotes.size);
  }

  return {
    remotes,
    add,
    remove,
    clear() { for (const id of [...remotes.keys()]) remove(id); },
    /** 서버가 0.1초마다 보낸 목표 위치. 그리는 건 update 에서 부드럽게 따라간다 */
    moves(list) {
      for (const [id, x, z, yaw, pose] of list) {
        const r = remotes.get(id);
        if (r) { r.tx = x; r.tz = z; r.tyaw = yaw; r.pose = pose; }
      }
    },
    rename(id, name) { const r = remotes.get(id); if (r) { r.name = name; r.label.textContent = name; } },
    /** 동작 몸짓: bow 는 절, gesture 는 합장 같은 짧은 몸짓 */
    perform(id, action, t) {
      const r = remotes.get(id);
      if (!r || !action) return;
      if (action.bow) r.avatar.bow(t); else if (action.type === 'gesture') r.avatar.gesture(t);
    },
    update(t, dt) {
      const k = 1 - Math.exp(-dt * 10);
      for (const r of remotes.values()) {
        const root = r.avatar.root, p = root.position;
        const moving = Math.hypot(r.tx - p.x, r.tz - p.z) > 0.04;
        p.x += (r.tx - p.x) * k;
        p.z += (r.tz - p.z) * k;
        p.y = world.heightAt(p.x, p.z);
        root.rotation.y += angleDelta(root.rotation.y, r.tyaw) * k;
        r.avatar.animate(t, dt, moving ? 'walk' : r.pose === 'walk' ? 'stand' : r.pose);
        labels.place(r.label, root);
      }
      for (const r of residents) {
        if (r.bowEvery && t > r.next) { r.avatar.bow(t); r.next = t + r.bowEvery; }
        r.avatar.animate(t, dt, r.pose);
        labels.place(r.label, r.avatar.root);
      }
    },
  };
}
