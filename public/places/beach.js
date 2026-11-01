// 온라인 해변. 모래·바다·야자수·파라솔. 바다 물결은 매 프레임 꼭짓점을 움직여 만든다.
import { kit } from './kit.js';

export default {
  id: 'beach',
  title: '해변',
  tagline: '파도 소리 들으며 앉아 있다 가는 바닷가',
  sky: {
    day: { top: '#8ccfee', fog: '#d4ecf3', ground: '#e8d6a8' },
    night: { top: '#0a1530', fog: '#142240', ground: '#1a1a20' },
  },
  spawn: { x: 0, z: 14, yaw: 0 },
  bounds: { minX: -40, maxX: 40, minZ: -6, maxZ: 30 },
  avatar: { skin: '#e9b38a', sash: null, hair: '#2d2420', robes: ['#f28b6b', '#5ab0c9', '#f2c94c', '#7ccf8f', '#e88ab4', '#ffffff'] },
  names: {
    a: ['느긋한', '짭짤한', '햇볕 쬐는', '반짝이는', '졸린', '맨발의'],
    b: ['갈매기', '소라', '모래알', '파도', '조개', '물보라'],
  },
  ambient: 'waves',
  actions: [
    { id: 'wave', label: '손 흔들기', icon: '👋', key: '1', type: 'gesture', sound: 'chime' },
    { id: 'sit', label: '앉기', icon: '🏖', key: '2', type: 'pose', pose: 'sit' },
    { id: 'count', label: '파도 세기', icon: '🌊', key: '3', type: 'loop', pose: 'sit', every: 7, counter: '파도 하나 · 모두 {n}개' },
  ],
  residents: [
    { name: '낚시하는 할아버지', x: 12, z: -3.5, yaw: Math.PI, pose: 'sit', look: { robe: '#6b8f71', hair: '#d8d4cc' } },
  ],

  build({ THREE, scene }) {
    const k = kit(scene);
    const colliders = [], glows = [];

    const sand = k.ground(300, '#e3cf9d');
    // 바다: 촘촘한 판을 깔고 tick 에서 높이를 흔든다
    const seaGeo = new THREE.PlaneGeometry(400, 200, 100, 50);
    seaGeo.rotateX(-Math.PI / 2);
    k.add(seaGeo, k.mat('#2b7d98', { roughness: 0.25, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92 }), 0, 0.15, -108, { shadow: false });
    const base = seaGeo.attributes.position.array.slice();
    const foam = k.add(new THREE.PlaneGeometry(400, 1.6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 }), 0, 0.2, -8, { rx: -Math.PI / 2, shadow: false });
    // 해
    glows.push(k.glow(new THREE.SphereGeometry(9, 24, 16), '#ffd27a', 40, 22, -170, 1.5, 0.1));

    const rnd = k.rng(3);
    // 야자수: 휜 줄기 + 납작한 잎
    for (let i = 0; i < 16; i++) {
      const x = -36 + i * 4.8 + rnd() * 2, z = 18 + rnd() * 10, lean = (rnd() - 0.5) * 0.5;
      let px = x, py = 0;
      for (let s = 0; s < 6; s++) { k.cyl(0.22 - s * 0.02, 1.1, '#8a6a46', px, py, z, { rz: lean * s * 0.2 }); px -= Math.sin(lean * s * 0.2) * 1.1; py += 1.05; }
      for (let l = 0; l < 7; l++) {
        const a = (l / 7) * Math.PI * 2;
        k.add(new THREE.ConeGeometry(0.5, 3.2, 4).scale(1, 1, 0.15), '#3f8f4a', px + Math.cos(a) * 1.3, py - 0.2, z + Math.sin(a) * 1.3, { rz: Math.cos(a) * 1.6, rx: Math.sin(a) * 1.6 });
      }
      colliders.push({ x, z, r: 0.4 });
    }
    // 파라솔과 의자
    const colors = ['#e85d4a', '#2f9ed1', '#f2c14e', '#57b26b'];
    for (let i = 0; i < 7; i++) {
      const x = -24 + i * 8, z = 6 + (i % 2) * 3;
      k.cyl(0.05, 2.4, '#efefef', x, 0, z);
      k.add(new THREE.ConeGeometry(1.7, 0.7, 12, 1, true), k.mat(colors[i % 4], { side: THREE.DoubleSide }), x, 2.5, z);
      k.box(0.8, 0.3, 1.8, '#f6f1e6', x + 1.4, 0, z + 0.5);
      colliders.push({ x, z, r: 0.25 }, { box: [x + 1, z - 0.4, x + 1.8, z + 1.4] });
    }
    // 모닥불 (밤에 밝다)
    k.cyl(0.9, 0.2, '#6d6457', -6, 0, 10);
    glows.push(k.glow(new THREE.ConeGeometry(0.4, 0.9, 8), '#ff8a3a', -6, 0.6, 10, 0.6, 3.5));
    colliders.push({ x: -6, z: 10, r: 1 });
    const fire = new THREE.PointLight('#ff9a4a', 0, 14, 1.5);
    fire.position.set(-6, 1.2, 10);
    scene.add(fire);

    const pos = seaGeo.attributes.position;
    return {
      ground: [sand],
      colliders, glows,
      tick(t, dt, night) {
        for (let i = 0; i < pos.count; i++) {
          const x = base[i * 3], z = base[i * 3 + 2];
          pos.array[i * 3 + 1] = Math.sin(x * 0.08 + t * 0.9) * 0.25 + Math.sin(z * 0.12 + t * 1.3) * 0.2;
        }
        pos.needsUpdate = true; // flatShading 이라 법선은 화면에서 계산된다. computeVertexNormals 는 필요 없다
        foam.position.z = -8 + Math.sin(t * 0.7) * 0.8;
        foam.material.opacity = 0.35 + Math.sin(t * 0.7) * 0.15;
        fire.intensity = night * (12 + Math.sin(t * 13) * 2);
      },
    };
  },
};
