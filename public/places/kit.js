// 장소를 지을 때 쓰는 작은 도구 모음. 새 장소도 이것만으로 대부분 지을 수 있다.
import * as THREE from 'three';

export function kit(scene) {
  const mats = new Map();
  // 같은 색 재질은 하나만 만든다
  const mat = (color, o = {}) => {
    const key = color + JSON.stringify(o);
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o }));
    return mats.get(key);
  };
  const add = (geo, material, x = 0, y = 0, z = 0, o = {}) => {
    const m = new THREE.Mesh(geo, typeof material === 'string' ? mat(material) : material);
    m.position.set(x, y, z);
    if (o.ry) m.rotation.y = o.ry;
    if (o.rx) m.rotation.x = o.rx;
    if (o.rz) m.rotation.z = o.rz;
    m.castShadow = o.shadow !== false;
    m.receiveShadow = true;
    (o.parent || scene).add(m);
    return m;
  };
  return {
    mat, add,
    // 가운데 아래가 (x, y, z) 인 상자
    box: (w, h, d, color, x, y, z, o) => add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, o),
    cyl: (r, h, color, x, y, z, o = {}) => add(new THREE.CylinderGeometry(o.top ?? r, r, h, o.seg ?? 20), color, x, y + h / 2, z, o),
    sphere: (r, color, x, y, z, o) => add(new THREE.SphereGeometry(r, 24, 16), color, x, y, z, o),
    // 사각뿔 지붕: 밑면 w×d, 높이 h
    roof(w, d, h, color, x, y, z) {
      const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
      g.rotateY(Math.PI / 4);
      g.scale(w, h, d);
      return add(g, color, x, y + h / 2, z);
    },
    // 밤에 빛나는 물체 (world 가 밤 정도에 맞춰 밝기를 바꾼다)
    glow(geo, color, x, y, z, day = 0.25, night = 2.4) {
      const m = add(geo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: day, roughness: 0.6 }), x, y, z, { shadow: false });
      m.userData = { day, night };
      return m;
    },
    // 글자를 그린 판 (현판·간판)
    sign(text, { w = 3, h = 1, bg = '#233b33', fg = '#d8bf7f', font = '600 150px serif', x = 0, y = 0, z = 0, ry = 0 } = {}) {
      const c = document.createElement('canvas');
      c.width = 1024; c.height = Math.round(1024 * h / w);
      const g = c.getContext('2d');
      g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(14, 14, c.width - 28, c.height - 28);
      g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, c.width / 2, c.height / 2, c.width - 80);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return add(new THREE.BoxGeometry(w, h, 0.12), [mat(bg), mat(bg), mat(bg), mat(bg), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), mat(bg)], x, y, z, { ry });
    },
    // 그라데이션·무늬를 캔버스로 그린 텍스처
    canvasTex(w, h, draw) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    },
    // 늘 같은 배치가 나오는 난수 (새로고침해도 나무 자리가 그대로)
    rng(seed = 1) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; },
    // 넓은 바닥 (클릭 판정용으로 돌려준다)
    ground(size, color, tex) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color, map: tex || null, roughness: 1 }));
      m.rotation.x = -Math.PI / 2;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    },
  };
}
