// 카메라 조작: 드래그로 돌리기, 휠·두 손가락으로 확대, 짧게 누르면 바닥 클릭
import * as THREE from 'three';

const { clamp } = THREE.MathUtils;
const DIST = [2.5, 18], PITCH = [0.05, 1.2];
const TAP_MS = 450, TAP_PX = 6;

export function createControls(canvas, cam, onTap) {
  const pointers = new Map();
  let drag = null, pinch = null;
  const spread = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
    if (pointers.size === 2) { pinch = { d: spread(), dist: cam.dist }; drag = null; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) { cam.dist = clamp(pinch.dist * pinch.d / Math.max(20, spread()), ...DIST); return; }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > TAP_PX) drag.moved = true;
    cam.yaw -= dx * 0.006;
    cam.pitch = clamp(cam.pitch + dy * 0.004, ...PITCH);
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (e.type === 'pointerup' && drag && !drag.moved && performance.now() - drag.t < TAP_MS) onTap(e.clientX, e.clientY);
    drag = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), ...DIST); }, { passive: false });
}
