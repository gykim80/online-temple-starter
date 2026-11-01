// 기본 도형으로 만든 2등신 캐릭터. 모델 파일 없이 색만 바꿔 장소마다 다른 옷을 입힌다.
import * as THREE from 'three';

// 모든 캐릭터가 같은 도형과 같은 색 재질을 나눠 쓴다. 사람이 늘어도 GPU 에 올라가는 것은 그대로다
const GEO = {
  torso: new THREE.CylinderGeometry(0.2, 0.3, 0.52, 18),
  sash: new THREE.CylinderGeometry(0.205, 0.305, 0.5, 18, 1, true, -0.4, 2.2),
  head: new THREE.SphereGeometry(0.29, 28, 20),
  hair: new THREE.SphereGeometry(0.3, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.55),
  eye: new THREE.SphereGeometry(0.028, 10, 8),
  arm: new THREE.CapsuleGeometry(0.075, 0.26, 4, 10),
  hand: new THREE.SphereGeometry(0.06, 12, 10),
  leg: new THREE.CylinderGeometry(0.075, 0.08, 0.28, 10),
  foot: new THREE.BoxGeometry(0.12, 0.06, 0.18),
};
const mats = new Map();
const mat = (color, o = {}) => {
  const key = `${color}|${o.side ?? ''}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o }));
  return mats.get(key);
};

// look = { skin, robe, sash, hair } (hair 가 없으면 민머리)
export function makeAvatar(look) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // 절할 때 앞으로 숙는 부분
  root.add(body);
  const robe = mat(look.robe), skin = mat(look.skin);

  const torso = new THREE.Mesh(GEO.torso, robe);
  torso.position.y = 0.56;
  body.add(torso);
  if (look.sash) {
    const sash = new THREE.Mesh(GEO.sash, mat(look.sash, { side: THREE.DoubleSide }));
    sash.position.y = 0.56;
    body.add(sash);
  }
  const head = new THREE.Mesh(GEO.head, skin);
  head.position.y = 1.08;
  body.add(head);
  if (look.hair) {
    const hair = new THREE.Mesh(GEO.hair, mat(look.hair));
    hair.position.y = 1.1;
    hair.rotation.x = -0.25;
    body.add(hair);
  }
  // 눈 두 개 (앞 = +z)
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(GEO.eye, mat('#2a2522'));
    eye.position.set(sx * 0.1, 1.1, 0.265);
    body.add(eye);
  }
  // 팔: 어깨에서 돌아가도록 피벗 그룹 안에 넣는다
  const arms = [-1, 1].map((sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.25, 0.76, 0);
    const arm = new THREE.Mesh(GEO.arm, robe);
    arm.position.y = -0.17;
    const hand = new THREE.Mesh(GEO.hand, skin);
    hand.position.y = -0.36;
    pivot.add(arm, hand);
    body.add(pivot);
    return pivot;
  });
  const legs = [-1, 1].map((sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.1, 0.32, 0);
    const leg = new THREE.Mesh(GEO.leg, robe);
    leg.position.y = -0.14;
    const foot = new THREE.Mesh(GEO.foot, mat('#f1ece0'));
    foot.position.set(0, -0.29, 0.03);
    pivot.add(leg, foot);
    root.add(pivot);
    return pivot;
  });
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  const state = { phase: Math.random() * 10, gesture: null, bowAt: null };

  // pose: stand | walk | kneel | sit | beads, t: 초
  function animate(t, dt, pose) {
    state.phase += dt * (pose === 'walk' ? 9 : 1.6);
    const s = Math.sin(state.phase);
    const [aL, aR] = arms, [lL, lR] = legs;
    let bodyY = 0, bodyPitch = 0, armX = 0, armZ = 0.12, legX = [0, 0];

    if (pose === 'walk') {
      bodyY = Math.abs(s) * 0.04;
      legX = [s * 0.6, -s * 0.6];
      aL.rotation.x = -s * 0.5; aR.rotation.x = s * 0.5;
    } else if (pose === 'kneel' || pose === 'sit' || pose === 'beads') {
      bodyY = pose === 'sit' ? -0.28 : -0.24;
      legX = [-1.45, -1.45];
    } else {
      bodyY = Math.sin(t * 1.4 + state.phase) * 0.008;
    }

    if (pose !== 'walk') {
      armX = -0.1; armZ = 0.12;
      if (pose === 'kneel') { armX = -0.9; armZ = 0.45; }
      if (pose === 'sit') { armX = -0.5; armZ = 0.15; }
      if (pose === 'beads') { armX = -1.1 + Math.sin(t * 3) * 0.05; armZ = 0.5; }
    }

    // 절: bowAt 부터 3초 동안 숙였다가 일어난다
    if (state.bowAt != null) {
      const k = (t - state.bowAt) / 3;
      if (k >= 1) state.bowAt = null;
      else { const w = Math.sin(Math.PI * k); bodyPitch = w * 1.05; armX = -0.9 - w * 0.9; armZ = 0.45 - w * 0.3; }
    }
    // 합장 같은 짧은 몸짓: 2.2초
    if (state.gesture != null) {
      const k = (t - state.gesture) / 2.2;
      if (k >= 1) state.gesture = null;
      else { const w = Math.min(1, Math.sin(Math.PI * k) * 1.6); armX = -1.25 * w + armX * (1 - w); armZ = 0.62 * w + armZ * (1 - w); bodyPitch = Math.max(bodyPitch, Math.sin(Math.PI * k) * 0.3); }
    }

    body.position.y = bodyY;
    body.rotation.x = bodyPitch;
    if (pose !== 'walk' || state.gesture != null) {
      aL.rotation.x = armX; aR.rotation.x = armX;
    }
    aL.rotation.z = -armZ; aR.rotation.z = armZ;
    lL.rotation.x = legX[0]; lR.rotation.x = legX[1];
    lL.position.y = lR.position.y = 0.32 + (legX[0] < -1 ? bodyY + 0.02 : 0);
  }

  return {
    root,
    animate,
    gesture(t) { state.gesture = t; },
    bow(t) { state.bowAt = t; },
    // 도형·재질은 다른 캐릭터와 나눠 쓰므로 지우지 않는다. 장면에서 빼기만 하면 된다
    dispose() { root.removeFromParent(); },
  };
}
