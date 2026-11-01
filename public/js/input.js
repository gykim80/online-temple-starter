// 키보드: 누르고 있는 이동 키와 한 번 누르는 동작 키
const MOVE = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };

/** onKey(key) 가 true 를 돌려주면 그 키는 이동으로 쓰지 않는다 */
export function createKeyboard(onKey) {
  const held = new Set();
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, dialog')) return;
    if (!e.repeat && onKey(e.key)) return;
    held.add(e.key.toLowerCase());
  });
  addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
  addEventListener('blur', () => held.clear());
  return {
    /** 화면 기준 이동 방향 [x, z] (오른쪽 +x, 아래 +z) */
    axis() {
      let x = 0, z = 0;
      for (const k of held) { const m = MOVE[k]; if (m) { x += m[0]; z += m[1]; } }
      return [Math.sign(x), Math.sign(z)];
    },
  };
}
