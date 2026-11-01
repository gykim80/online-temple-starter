// 캐릭터 머리 위 이름표. 3D 위치를 화면 좌표로 바꿔 HTML 로 띄운다 (글자가 선명하고 접근성 도구가 읽을 수 있다)
import * as THREE from 'three';

const MAX_DIST = 28; // 이보다 멀면 숨긴다 (m)

export function createLabels(container, camera) {
  const v = new THREE.Vector3();
  return {
    add(text, cls = '') {
      const el = document.createElement('div');
      el.className = cls ? `tag ${cls}` : 'tag';
      el.textContent = text;
      container.append(el);
      return el;
    },
    /** obj 머리 위(h m)에 el 을 둔다. 바뀐 값만 DOM 에 쓴다 */
    place(el, obj, h = 1.62) {
      v.set(obj.position.x, obj.position.y + h, obj.position.z);
      const show = v.distanceTo(camera.position) < MAX_DIST && v.project(camera).z < 1;
      if (show !== !el.hidden) el.hidden = !show;
      if (!show) return;
      const tf = `translate(${Math.round((v.x * 0.5 + 0.5) * innerWidth)}px, ${Math.round((-v.y * 0.5 + 0.5) * innerHeight)}px) translate(-50%, -100%)`;
      if (el._tf !== tf) { el.style.transform = tf; el._tf = tf; }
    },
  };
}
