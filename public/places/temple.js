// 온라인 절. 법당·불상·방석·연등·석등·탑·소나무·먼 산을 기본 도형으로 짓는다.
import { kit } from './kit.js';

// 법당 기단 (이 안은 높이 1m)
const HALL = { x0: -10, x1: 10, z0: -16, z1: -4 };

export default {
  id: 'temple',
  title: '산사',
  tagline: '말없이 같이 앉아 있다 가는 절',
  sky: {
    day: { top: '#a9c1cf', fog: '#cfd6cb', ground: '#5d5a3f' },
    night: { top: '#0d1322', fog: '#18202e', ground: '#141410' },
  },
  spawn: { x: 0, z: 11, yaw: 0 },
  bounds: { minX: -38, maxX: 38, minZ: -15, maxZ: 38 },
  avatar: { skin: '#e2a679', sash: '#d9b24e', hair: null, robes: ['#b9c3c9', '#c4bca9', '#aebfb6', '#c9bfa0', '#b3b8c8'] },
  names: {
    a: ['고요한', '느긋한', '따스한', '은은한', '맑은', '조용한', '포근한', '잔잔한'],
    b: ['바람', '솔잎', '물결', '산새', '이슬', '구름', '풍경', '연잎'],
  },
  ambient: 'wind',
  actions: [
    { id: 'hello', label: '합장', icon: '🙏', key: '1', type: 'gesture', sound: 'bell' },
    { id: 'bow', label: '절하기', icon: '🙇', key: '2', type: 'loop', pose: 'kneel', every: 4, bow: true, sound: 'moktak', counter: '절 한 번 올렸습니다 · 모두 {n}번' },
    { id: 'bead', label: '염주', icon: '⭕', key: '3', type: 'loop', pose: 'beads', every: 1.2, sound: 'bead', counter: '염주 한 알 · 모두 {n}알' },
  ],
  // 늘 앉아 있는 스님 넷
  residents: [
    { name: '고요한 산새', x: -4.5, z: -9, yaw: Math.PI, pose: 'kneel', bowEvery: 9, look: { robe: '#bdc5ad' } },
    { name: '느긋한 솔잎', x: 4.5, z: -9, yaw: Math.PI, pose: 'kneel', bowEvery: 11, look: { robe: '#cbbdab' } },
    { name: '따스한 물결', x: -4.5, z: -7.2, yaw: Math.PI, pose: 'beads', look: { robe: '#b9c8c2' } },
    { name: '은은한 바람', x: 4.5, z: -7.2, yaw: Math.PI, pose: 'beads', look: { robe: '#c8bd9c' } },
  ],

  build({ THREE, scene }) {
    const k = kit(scene);
    const colliders = [], glows = [];
    const RED = '#6e2b1f', GREEN = '#2f5d50', STONE = '#8a867b', GOLD = k.mat('#caa24c', { metalness: 0.65, roughness: 0.35, emissive: '#3a2a08', emissiveIntensity: 0.4 });

    // 땅·마당·길
    const ground = k.ground(260, '#6a6648');
    const yard = k.box(32, 0.04, 30, '#8f8a7c', 0, 0, 6, { shadow: false });
    k.box(3.2, 0.06, 18, '#a39d8f', 0, 0, 7, { shadow: false });

    // 기단과 계단
    const base = k.box(HALL.x1 - HALL.x0, 1, HALL.z1 - HALL.z0, STONE, 0, 0, (HALL.z0 + HALL.z1) / 2);
    const steps = k.box(6, 0.5, 1.6, STONE, 0, 0, -3.2);
    const floor = k.box(20, 0.02, 12, '#5a4632', 0, 1, -10, { shadow: false }); // 마루

    // 기둥
    for (const z of [-4.8, -15]) for (const x of [-8.6, -5, -1.8, 1.8, 5, 8.6]) {
      k.cyl(0.3, 4.2, RED, x, 1, z);
      colliders.push({ x, z, r: 0.35 });
    }
    // 벽 (뒤·양옆)
    k.box(19.4, 4.2, 0.3, '#e8e0cc', 0, 1, -15.5);
    for (const sx of [-1, 1]) k.box(0.3, 4.2, 9.4, '#e8e0cc', sx * 9.6, 1, -10.6);
    colliders.push({ box: [-10.6, -17, 10.6, -15.3] }, { box: [-10.6, -16.5, -9.4, -3.6] }, { box: [9.4, -16.5, 10.6, -3.6] },
      { box: [-10.6, -4.3, -3.2, -3.6] }, { box: [3.2, -4.3, 10.6, -3.6] });
    // 보·지붕
    k.box(19.6, 0.5, 0.5, GREEN, 0, 5.2, -4.8);
    k.box(19.6, 0.18, 0.55, RED, 0, 5.0, -4.8);
    k.box(23, 0.35, 15, '#3b3e40', 0, 5.7, -10);
    k.roof(24.5, 16, 3.4, '#3f4345', 0, 6, -10);
    k.box(10, 0.4, 0.6, '#2f3233', 0, 9.2, -10);
    k.sign('寂光殿', { w: 3.4, h: 1.05, x: 0, y: 4.55, z: -4.55 });

    // 탱화 (뒤벽 그림)
    const painting = k.canvasTex(512, 384, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h / 2, w * 0.6);
      grd.addColorStop(0, '#e2a54a'); grd.addColorStop(0.45, '#9a3c22'); grd.addColorStop(1, '#3d1c15');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(240,210,140,.5)'; g.lineWidth = 3;
      for (let r = 40; r < 300; r += 26) { g.beginPath(); g.arc(w / 2, h * 0.45, r, 0, Math.PI * 2); g.stroke(); }
    });
    k.add(new THREE.PlaneGeometry(7, 4.2), new THREE.MeshStandardMaterial({ map: painting, roughness: 0.9 }), 0, 3.2, -15.3, { shadow: false });

    // 불상: 연꽃 대좌 + 앉은 몸 + 머리 + 광배
    k.cyl(1.4, 0.5, '#7a2f2a', 0, 1, -13);
    k.cyl(1.25, 0.25, GOLD, 0, 1.5, -13, { top: 1.5 });
    k.add(new THREE.CylinderGeometry(1.25, 1.35, 0.5, 24), GOLD, 0, 2.0, -13);
    k.add(new THREE.SphereGeometry(0.95, 24, 18).scale(1, 1.05, 0.8), GOLD, 0, 2.85, -13);
    k.add(new THREE.SphereGeometry(0.5, 24, 18), GOLD, 0, 4.15, -13);
    k.add(new THREE.SphereGeometry(0.2, 16, 12), GOLD, 0, 4.66, -13.05);
    const halo = k.glow(new THREE.TorusGeometry(0.85, 0.05, 8, 48), '#f0c86a', 0, 4.15, -13.6, 0.5, 1.6);
    glows.push(halo);
    colliders.push({ x: 0, z: -13, r: 1.7 });
    // 불단 위 초 두 자루
    k.box(3.6, 0.9, 0.9, '#5b2a1e', 0, 1, -11.3);
    colliders.push({ box: [-1.8, -11.75, 1.8, -10.85] });
    for (const x of [-1.3, 1.3]) {
      k.cyl(0.06, 0.4, '#f3ead6', x, 1.9, -11.3);
      glows.push(k.glow(new THREE.SphereGeometry(0.06, 10, 8).scale(1, 1.8, 1), '#ffcf6a', x, 2.37, -11.3, 1.2, 3));
    }
    // 방석 (두 줄)
    for (const z of [-9, -7.2]) for (const x of [-4.5, -1.5, 1.5, 4.5]) k.cyl(0.42, 0.12, '#7b3a2e', x, 1, z);

    // 처마 연등
    const lanterns = [];
    const lColors = ['#f08aa0', '#f5c66a', '#9fd6a8', '#f3a46d', '#f6e7b0'];
    for (let i = 0; i < 9; i++) {
      const x = -8 + i * 2;
      const l = k.glow(new THREE.SphereGeometry(0.24, 16, 12).scale(1, 1.15, 1), lColors[i % lColors.length], x, 4.25, -4.2, 0.35, 2.4);
      lanterns.push(l); glows.push(l);
    }
    // 석등
    for (const x of [-4, 4]) {
      k.box(0.8, 0.3, 0.8, STONE, x, 0, 1.5);
      k.cyl(0.18, 1.1, STONE, x, 0.3, 1.5);
      glows.push(k.glow(new THREE.BoxGeometry(0.55, 0.5, 0.55), '#ffd58a', x, 1.65, 1.5, 0.2, 2.6));
      k.roof(1.1, 1.1, 0.45, '#77736a', x, 1.9, 1.5);
      colliders.push({ x, z: 1.5, r: 0.55 });
    }
    // 석탑
    let ty = 0;
    for (let i = 0; i < 5; i++) {
      const w = 2.2 - i * 0.32;
      k.box(w, 0.75, w, '#9b968a', -9, ty, 6); ty += 0.75;
      k.box(w + 0.5, 0.18, w + 0.5, '#87837a', -9, ty, 6); ty += 0.18;
    }
    colliders.push({ x: -9, z: 6, r: 1.5 });

    // 소나무 (늘 같은 자리)
    const rnd = k.rng(7);
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, d = 20 + rnd() * 30;
      const x = Math.cos(a) * d, z = 6 + Math.sin(a) * d;
      if (z < -20 && Math.abs(x) < 14) continue;
      const s = 0.8 + rnd() * 0.7;
      k.cyl(0.22 * s, 2.4 * s, '#5a4030', x, 0, z);
      for (let j = 0; j < 3; j++) k.add(new THREE.ConeGeometry((2 - j * 0.5) * s, 2 * s, 9), '#2f4a33', x, (2.6 + j * 1.2) * s, z);
      colliders.push({ x, z, r: 0.5 });
    }
    // 먼 산
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2, d = 120 + rnd() * 20;
      k.add(new THREE.ConeGeometry(30 + rnd() * 25, 26 + rnd() * 22, 7), '#47604a', Math.cos(a) * d, 12, Math.sin(a) * d, { shadow: false });
    }

    // 밤에 켜지는 법당 불빛
    const warm = new THREE.PointLight('#ffb866', 0, 22, 1.6);
    warm.position.set(0, 4, -8);
    scene.add(warm);

    return {
      ground: [ground, yard, base, steps, floor],
      colliders, glows,
      heightAt(x, z) {
        if (x > HALL.x0 && x < HALL.x1 && z > HALL.z0 && z < HALL.z1) return 1;
        if (Math.abs(x) < 3 && z >= HALL.z1 && z < -2.4) return 0.5;
        return 0;
      },
      tick(t, dt, night) {
        warm.intensity = 4 + night * 30;
        lanterns.forEach((l, i) => { l.rotation.z = Math.sin(t * 0.8 + i) * 0.06; });
      },
    };
  },
};
