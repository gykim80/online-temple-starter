// 시각에 따라 하늘·안개·빛·등불 밝기를 바꾼다
import * as THREE from 'three';

const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (x) => x * x * (3 - 2 * x);
const SUN_DAY = new THREE.Color('#fff3dc'), SUN_NIGHT = new THREE.Color('#9fb2ff');

/** 밤 정도(0 낮 ~ 1 밤). 5~7시 새벽, 18~20시 저녁에 천천히 바뀐다 */
export function nightAmount(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 7 && h < 18) return 0;
  if (h >= 20 || h < 5) return 1;
  return h < 7 ? 1 - smooth((h - 5) / 2) : smooth((h - 18) / 2);
}

/** ?time=day|night 로 고정할 수 있다 */
export function createDaylight({ scene, renderer, hemi, sun, sky, glows = [], forced = null }) {
  const day = { top: new THREE.Color(sky.day.top), fog: new THREE.Color(sky.day.fog), ground: new THREE.Color(sky.day.ground) };
  const night = { top: new THREE.Color(sky.night.top), fog: new THREE.Color(sky.night.fog), ground: new THREE.Color(sky.night.ground) };

  return function apply(date) {
    const n = forced === 'night' ? 1 : forced === 'day' ? 0 : nightAmount(date);
    scene.background.lerpColors(day.top, night.top, n);
    scene.fog.color.lerpColors(day.fog, night.fog, n);
    hemi.color.copy(scene.background);
    hemi.groundColor.lerpColors(day.ground, night.ground, n);
    hemi.intensity = lerp(1.2, 0.8, n);
    sun.intensity = lerp(2.2, 0.5, n);
    sun.color.copy(n > 0.5 ? SUN_NIGHT : SUN_DAY);
    renderer.toneMappingExposure = lerp(1.0, 0.85, n);
    for (const g of glows) g.material.emissiveIntensity = lerp(g.userData.day ?? 0.3, g.userData.night ?? 2.2, n);
    return n;
  };
}
