// 서버와 브라우저가 같이 쓰는 약속. 서버는 ../public/shared/protocol.js 로, 브라우저는 /shared/protocol.js 로 불러온다.
// 값 하나를 바꾸면 양쪽이 같이 바뀐다.

/** 서버가 받아 주는 자세 이름 */
export const POSES = Object.freeze(['stand', 'walk', 'kneel', 'sit', 'beads']);

export const LIMITS = Object.freeze({
  bound: 90, // 좌표 한계 (m). 이 밖은 잘라 낸다
  yaw: 10, // 방향 값 한계 (rad)
  nameLength: 12, // 이름 글자 수
  messageBytes: 1024, // 메시지 하나의 최대 길이
  perSecond: 40, // 1초에 받아 주는 메시지 수. 넘친 것은 버린다
  kickPerSecond: 200, // 1초에 이만큼 넘게 보내면 연결을 끊는다
});

/** 서버가 움직임을 모아 보내는 간격이자 브라우저가 움직임을 보내는 최소 간격 (ms) */
export const TICK_MS = 100;

export const PLACE_RE = /^[a-z0-9-]{1,24}$/;
export const KIND_RE = /^[a-z]{1,16}$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

/** 이름에서 태그·제어 문자를 빼고 글자 수를 자른다. 비면 '손님' */
export function cleanName(s) {
  const t = String(s ?? '').replace(/[<>&"'`\u0000-\u001f\u007f]/g, '').trim();
  return [...t].slice(0, LIMITS.nameLength).join('') || '손님';
}

export const cleanColor = (c, fallback = '#b9c3c9') => (COLOR_RE.test(String(c)) ? String(c) : fallback);

/** 숫자가 아니면 0, 범위 밖이면 ±lim 으로 자른다 */
export const clampNum = (v, lim) => (Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : 0);

/** 소수 둘째 자리까지. 메시지 크기를 줄인다 */
export const round2 = (v) => Math.round(v * 100) / 100;
