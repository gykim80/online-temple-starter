// 갈 수 있는 곳 계산. bounds 사각형 안으로 자르고 colliders 에서 밀어낸다
const RADIUS = 0.3; // 캐릭터 몸 반지름 (m)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * colliders: { x, z, r } 원 또는 { box: [x0, z0, x1, z1] } 상자
 * @returns {(x: number, z: number) => [number, number]}
 */
export function createResolver(bounds, colliders = []) {
  const circles = colliders.filter((c) => c.r != null);
  const boxes = colliders.filter((c) => c.box).map((c) => c.box);
  return function resolve(x, z) {
    x = clamp(x, bounds.minX, bounds.maxX);
    z = clamp(z, bounds.minZ, bounds.maxZ);
    for (const c of circles) {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), min = c.r + RADIUS;
      if (d < min && d > 1e-6) { x = c.x + (dx / d) * min; z = c.z + (dz / d) * min; }
    }
    for (const [x0, z0, x1, z1] of boxes) {
      if (x <= x0 - RADIUS || x >= x1 + RADIUS || z <= z0 - RADIUS || z >= z1 + RADIUS) continue;
      // 네 변 중 가장 가까운 쪽으로 밀어낸다
      const left = x0 - RADIUS - x, right = x1 + RADIUS - x, near = z0 - RADIUS - z, far = z1 + RADIUS - z;
      const m = Math.min(-left, right, -near, far);
      if (m === -left) x += left; else if (m === right) x += right; else if (m === -near) z += near; else z += far;
    }
    return [x, z];
  };
}
