// 온라인 성당. 절과 같은 뼈대에 건물·동작·소리만 바꿨다.
import { kit } from './kit.js';

export default {
  id: 'cathedral',
  title: '성당',
  tagline: '촛불 하나 켜 두고 가는 곳',
  sky: {
    day: { top: '#b7c4d6', fog: '#d8dde4', ground: '#6b6458' },
    night: { top: '#0b1020', fog: '#141a28', ground: '#121014' },
  },
  spawn: { x: 0, z: 3, yaw: 0 },
  bounds: { minX: -8.2, maxX: 8.2, minZ: -24.5, maxZ: 5.2 },
  avatar: { skin: '#e8b48c', sash: null, hair: '#3b2c25', robes: ['#3e4a63', '#5b4a5e', '#2f4f4a', '#6a5a48', '#4a4f57'] },
  names: {
    a: ['조용한', '따뜻한', '맑은', '작은', '깊은', '느린'],
    b: ['촛불', '종소리', '창가', '오후', '발걸음', '숨결'],
  },
  ambient: 'hall',
  actions: [
    { id: 'cross', label: '성호', icon: '✝', key: '1', type: 'gesture', sound: 'chime' },
    { id: 'pray', label: '기도', icon: '🙏', key: '2', type: 'loop', pose: 'kneel', every: 5, bow: true, sound: 'bell', counter: '기도 한 번 · 모두 {n}번' },
    { id: 'candle', label: '초 켜기', icon: '🕯', key: '3', type: 'gesture', sound: 'chime', counter: '초 하나를 켰습니다 · 모두 {n}개' },
  ],
  residents: [
    { name: '창가의 수녀', x: -4.2, z: -16, yaw: Math.PI, pose: 'kneel', bowEvery: 12, look: { robe: '#2a2a30', hair: '#2a2a30' } },
  ],

  build({ THREE, scene }) {
    const k = kit(scene);
    const colliders = [], glows = [];
    const WALL = '#d9d2c3', STONE = '#9a9384', WOOD = '#5a3b26';

    const ground = k.ground(200, '#6b6458');
    const tiles = k.canvasTex(256, 256, (g) => {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#bdb5a5' : '#8e8676'; g.fillRect(x * 32, y * 32, 32, 32); }
    });
    tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
    tiles.repeat.set(5, 9);
    const floor = k.add(new THREE.PlaneGeometry(18, 32), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.6 }), 0, 0.01, -10, { rx: -Math.PI / 2, shadow: false });
    const chancel = k.box(18, 0.4, 5, STONE, 0, 0, -24); // 제단 단

    // 벽: 양옆·뒤·앞(문 자리 비움)
    for (const sx of [-1, 1]) k.box(0.5, 11, 32, WALL, sx * 9.2, 0, -10, { shadow: false });
    k.box(18.9, 11, 0.5, WALL, 0, 0, -26.5, { shadow: false });
    for (const sx of [-1, 1]) k.box(7, 11, 0.5, WALL, sx * 5.7, 0, 6, { shadow: false });
    k.box(4.4, 4, 0.5, WALL, 0, 7, 6, { shadow: false });
    // 박공 지붕
    for (const sx of [-1, 1]) k.box(11, 0.4, 33, '#4b3f39', sx * 4.6, 12.4, -10, { rz: sx * -0.55, shadow: false });

    // 기둥 두 줄
    for (let z = -20; z <= 2; z += 5.5) for (const x of [-6.2, 6.2]) {
      k.cyl(0.42, 11, STONE, x, 0, z);
      colliders.push({ x, z, r: 0.5 });
    }
    // 스테인드글라스: 낮에는 빛이 들어와 밝고 밤에는 어둡다
    const glass = k.canvasTex(128, 256, (g, w, h) => {
      const cs = ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60', '#8e44ad', '#e67e22'];
      for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { g.fillStyle = cs[(x / 32 + y / 32 * 3) % cs.length]; g.fillRect(x, y, 32, 32); }
      g.strokeStyle = '#1b1b1b'; g.lineWidth = 4;
      for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    });
    for (let z = -22.5; z <= 0; z += 5.5) for (const sx of [-1, 1]) {
      const win = k.add(new THREE.PlaneGeometry(1.8, 4.2), new THREE.MeshStandardMaterial({ map: glass, emissive: '#ffffff', emissiveMap: glass, emissiveIntensity: 1.2 }), sx * 8.9, 5.5, z, { ry: -sx * Math.PI / 2, shadow: false });
      win.userData = { day: 1.3, night: 0.25 };
      glows.push(win);
    }
    const rose = k.add(new THREE.CircleGeometry(2, 32), new THREE.MeshStandardMaterial({ map: glass, emissive: '#ffffff', emissiveMap: glass, emissiveIntensity: 1.2 }), 0, 8, -26.2, { shadow: false });
    rose.userData = { day: 1.3, night: 0.3 };
    glows.push(rose);

    // 의자 줄 (가운데 통로를 남긴다)
    for (let z = -17; z <= 1; z += 2.2) for (const sx of [-1, 1]) {
      const cx = sx * 4.1;
      k.box(5.2, 0.45, 0.5, WOOD, cx, 0, z);
      k.box(5.2, 0.6, 0.12, WOOD, cx, 0.45, z + 0.25);
      colliders.push({ box: [cx - 2.6, z - 0.25, cx + 2.6, z + 0.3] });
    }
    // 제단·십자가
    k.box(3.4, 1, 1.1, '#e9e3d6', 0, 0.4, -24.2);
    colliders.push({ box: [-1.7, -24.75, 1.7, -23.65] });
    const GOLD = k.mat('#d4ad55', { metalness: 0.7, roughness: 0.3 });
    k.add(new THREE.BoxGeometry(0.25, 3.2, 0.15), GOLD, 0, 5.6, -26.1);
    k.add(new THREE.BoxGeometry(1.7, 0.25, 0.15), GOLD, 0, 6.4, -26.1);
    for (const x of [-1.2, 1.2]) {
      k.cyl(0.07, 0.5, '#f4ecd8', x, 1.4, -24.2);
      glows.push(k.glow(new THREE.SphereGeometry(0.07, 10, 8).scale(1, 1.8, 1), '#ffcf6a', x, 1.98, -24.2, 1.4, 3));
    }
    // 봉헌 초 받침: 누가 '초 켜기'를 하면 하나씩 켜진다
    k.box(3, 0.9, 0.7, '#3a2a20', -6.5, 0.4, -20.5, { ry: Math.PI / 2 });
    colliders.push({ box: [-6.9, -22, -6.1, -19] });
    const flames = [];
    for (let i = 0; i < 36; i++) {
      const x = -6.75 + (i % 3) * 0.25, z = -21.9 + Math.floor(i / 3) * 0.24;
      k.cyl(0.035, 0.14, '#f4ecd8', x, 1.3, z);
      const f = k.glow(new THREE.SphereGeometry(0.035, 8, 6).scale(1, 1.8, 1), '#ffc95a', x, 1.5, z, 2, 3);
      f.visible = false;
      flames.push(f);
    }
    let lit = 0;

    const warm = new THREE.PointLight('#ffcc88', 18, 30, 1.4);
    warm.position.set(0, 7, -14);
    const warm2 = new THREE.PointLight('#ffcc88', 10, 24, 1.4);
    warm2.position.set(0, 6, -2);
    scene.add(warm, warm2);

    return {
      ground: [ground, floor, chancel],
      colliders, glows,
      heightAt: (x, z) => (z < -21.5 ? 0.4 : 0),
      onAct(kind) { if (kind === 'candle') { flames[lit % flames.length].visible = true; lit++; } },
      tick(t, dt, night) {
        warm.intensity = 14 + night * 14;
        flames.forEach((f, i) => { if (f.visible) f.scale.y = 1 + Math.sin(t * 9 + i) * 0.15; });
      },
    };
  },
};
