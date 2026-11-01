import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResolver } from '../public/js/world/collision.js';

const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };

test('경계 밖은 경계로 자른다', () => {
  assert.deepEqual(createResolver(bounds)(50, -50), [10, -10]);
});

test('원 안으로 들어가면 바깥으로 밀어낸다', () => {
  const [x, z] = createResolver(bounds, [{ x: 0, z: 0, r: 1 }])(0.5, 0);
  assert.ok(Math.hypot(x, z) >= 1.3 - 1e-9);
});

test('상자 안으로 들어가면 가장 가까운 변으로 밀어낸다', () => {
  const resolve = createResolver(bounds, [{ box: [-2, -0.3, 2, 0.3] }]);
  assert.deepEqual(resolve(0, 0.2), [0, 0.6]);
  assert.deepEqual(resolve(1.9, 0), [2.3, 0]);
  assert.deepEqual(resolve(5, 5), [5, 5]); // 상자 밖은 그대로
});
