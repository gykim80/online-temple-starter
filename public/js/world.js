// 렌더러·조명·하늘(낮/밤)·카메라 조작·바닥 클릭 이동을 맡는다. 장소마다 다른 건 place 설정에서 받는다.
import * as THREE from 'three';

const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (x) => x * x * (3 - 2 * x);

// 시각으로 밤 정도(0 낮 ~ 1 밤)를 정한다. 5~7시 새벽, 18~20시 저녁에 천천히 바뀐다
export function nightAmount(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 7 && h < 18) return 0;
  if (h >= 20 || h < 5) return 1;
  return h < 7 ? 1 - smooth((h - 5) / 2) : smooth((h - 18) / 2);
}

export function createWorld(canvas, place) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  const sky = place.sky;
  scene.background = new THREE.Color(sky.day.top);
  scene.fog = new THREE.Fog(sky.day.fog, 40, 170);

  const hemi = new THREE.HemisphereLight(sky.day.top, sky.day.ground, 1.2);
  const sun = new THREE.DirectionalLight('#fff3dc', 2.2);
  sun.position.set(30, 50, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
  sun.shadow.bias = -0.0005;
  scene.add(hemi, sun);

  // 장소가 지은 물체들. ground 는 클릭 판정, glows 는 밤에 켜지는 등불, tick 은 매 프레임 움직임
  const built = place.build({ THREE, scene });

  // ── 카메라 조작 ─────────────────────────────
  const cam = { yaw: place.spawn.yaw ?? 0, pitch: 0.32, dist: 7, target: new THREE.Vector3() };
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let onGroundClick = () => {};
  const pointers = new Map();
  let drag = null, pinch = null;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: cam.dist }; drag = null; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      cam.dist = THREE.MathUtils.clamp(pinch.dist * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 2.5, 18);
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
    cam.yaw -= dx * 0.006;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.004, 0.05, 1.2);
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && !drag.moved && performance.now() - drag.t < 450) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(built.ground, false)[0];
      if (hit) onGroundClick(hit.point);
    }
    drag = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 2.5, 18); }, { passive: false });

  // 클릭한 곳 표시 고리
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.34, 32), new THREE.MeshBasicMaterial({ color: '#fff6d8', transparent: true, opacity: 0.8, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 62 : 50; // 세로 화면은 넓게
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  // ── 낮/밤 ─────────────────────────────────
  const forced = new URLSearchParams(location.search).get('time');
  const cTop = new THREE.Color(), cFog = new THREE.Color(), cGround = new THREE.Color();
  function applyTime() {
    const n = forced === 'night' ? 1 : forced === 'day' ? 0 : nightAmount();
    cTop.set(sky.day.top).lerp(new THREE.Color(sky.night.top), n);
    cFog.set(sky.day.fog).lerp(new THREE.Color(sky.night.fog), n);
    cGround.set(sky.day.ground).lerp(new THREE.Color(sky.night.ground), n);
    scene.background.copy(cTop);
    scene.fog.color.copy(cFog);
    hemi.color.copy(cTop); hemi.groundColor.copy(cGround);
    hemi.intensity = lerp(1.2, 0.8, n);
    sun.intensity = lerp(2.2, 0.5, n);
    sun.color.set(n > 0.5 ? '#9fb2ff' : '#fff3dc');
    renderer.toneMappingExposure = lerp(1.0, 0.85, n);
    for (const g of built.glows || []) g.material.emissiveIntensity = lerp(g.userData.day ?? 0.3, g.userData.night ?? 2.2, n);
    return n;
  }
  let night = applyTime();
  setInterval(() => { night = applyTime(); }, 60_000);

  // ── 이동 가능 여부 ──────────────────────────
  const b = place.bounds;
  function resolve(x, z) {
    x = THREE.MathUtils.clamp(x, b.minX, b.maxX);
    z = THREE.MathUtils.clamp(z, b.minZ, b.maxZ);
    for (const c of built.colliders || []) {
      if (c.r != null) {
        const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.3;
        if (d < min && d > 1e-6) { x = c.x + (dx / d) * min; z = c.z + (dz / d) * min; }
      } else if (c.box) {
        const [x0, z0, x1, z1] = c.box;
        if (x > x0 - 0.3 && x < x1 + 0.3 && z > z0 - 0.3 && z < z1 + 0.3) {
          const push = [[x0 - 0.3 - x, 0], [x1 + 0.3 - x, 0], [0, z0 - 0.3 - z], [0, z1 + 0.3 - z]].sort((p, q) => Math.abs(p[0] + p[1]) - Math.abs(q[0] + q[1]))[0];
          x += push[0]; z += push[1];
        }
      }
    }
    return [x, z];
  }
  const heightAt = (x, z) => (built.heightAt ? built.heightAt(x, z) : 0);

  function follow(pos, dt) {
    cam.target.lerp(new THREE.Vector3(pos.x, pos.y + 1.0, pos.z), 1 - Math.exp(-dt * 8));
    const cp = Math.cos(cam.pitch);
    camera.position.set(
      cam.target.x + Math.sin(cam.yaw) * cp * cam.dist,
      cam.target.y + Math.sin(cam.pitch) * cam.dist,
      cam.target.z + Math.cos(cam.yaw) * cp * cam.dist,
    );
    camera.lookAt(cam.target);
    sun.position.set(pos.x + 30, 50, pos.z + 25);
    sun.target.position.set(pos.x, 0, pos.z);
    sun.target.updateMatrixWorld();
  }

  return {
    THREE, scene, camera, renderer, cam, marker, built,
    get night() { return night; },
    resolve, heightAt, follow,
    onGroundClick(fn) { onGroundClick = fn; },
    render(t, dt) { built.tick?.(t, dt, night); renderer.render(scene, camera); },
  };
}
