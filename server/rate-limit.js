// 1초 창(window) 단위로 메시지 수를 센다.
import { LIMITS } from '../public/shared/protocol.js';

/** 'ok' 받아 줌 · 'drop' 버림 · 'kick' 연결 끊기 */
export function checkRate(peer, now, { perSecond = LIMITS.perSecond, kick = LIMITS.kickPerSecond } = {}) {
  if (now - peer.win >= 1000) { peer.win = now; peer.winCount = 0; }
  peer.winCount++;
  if (peer.winCount > kick) return 'kick';
  return peer.winCount <= perSecond ? 'ok' : 'drop';
}
