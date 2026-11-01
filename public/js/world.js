// 렌더러·조명·카메라를 만들고 장소를 짓는다. 장소마다 다른 건 place 설정에서 받는다.
import * as THREE from 'three';
import { createDaylight } from './world/daylight.js';
import { createResolver } from './world/collision.js';
import { createControls } from './world/controls.js';

export { nightAmount } from './world/daylight.js';

const DAYLIGHT_MS = 60_000;

export function createWorld(canvas, place, { time = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  scene.background = new THREE.Color(place.sky.day.top);
  scene.fog = new THREE.Fog(place.sky.day.fog, 40, 170);

  const hemi = new THREE.HemisphereLight(place.sky.day.top, place.sky.day.ground, 1.2);
  const sun = new THREE.DirectionalLight('#fff3dc', 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
  sun.shadow.bias = -0.0005;
  scene.add(hemi, sun, sun.target);

  // 장소가 지은 물체들. ground 는 클릭 판정, glows 는 밤에 켜지는 등불, tick 은 매 프레임 움직임
  const built = place.build({ THREE, scene });

  // ── 카메라 ──
  const cam = { yaw: place.spawn.yaw ?? 0, pitch: 0.32, dist: 7, target: new THREE.Vector3() };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), want = new THREE.Vector3();
  let onGroundClick = () => {};
  createControls(canvas, cam, (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(built.ground, false)[0];
    if (hit) onGroundClick(hit.point);
  });

  // 클릭한 곳 표시 고리
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.34, 32), new THREE.MeshBasicMaterial({ color: '#fff6d8', transparent: true, opacity: 0.8, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 62 : 50; // 세로 화면은 넓게
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // ── 낮/밤 ──
  const daylight = createDaylight({ scene, renderer, hemi, sun, sky: place.sky, glows: built.glows, forced: time });
  let night = daylight();
  setInterval(() => { night = daylight(); }, DAYLIGHT_MS);

  const resolve = createResolver(place.bounds, built.colliders);
  const heightAt = built.heightAt ?? (() => 0);

  function follow(pos, dt) {
    want.set(pos.x, pos.y + 1.0, pos.z);
    cam.target.lerp(want, 1 - Math.exp(-dt * 8));
    const cp = Math.cos(cam.pitch);
    camera.position.set(
      cam.target.x + Math.sin(cam.yaw) * cp * cam.dist,
      cam.target.y + Math.sin(cam.pitch) * cam.dist,
      cam.target.z + Math.cos(cam.yaw) * cp * cam.dist,
    );
    camera.lookAt(cam.target);
    // 그림자는 캐릭터 주변 80m 만 그린다. 해를 캐릭터와 같이 옮긴다
    sun.position.set(pos.x + 30, 50, pos.z + 25);
    sun.target.position.set(pos.x, 0, pos.z);
  }

  return {
    THREE, scene, camera, renderer, cam, marker, built,
    get night() { return night; },
    resolve, heightAt, follow,
    onGroundClick(fn) { onGroundClick = fn; },
    render(t, dt) { built.tick?.(t, dt, night); renderer.render(scene, camera); },
  };
}
