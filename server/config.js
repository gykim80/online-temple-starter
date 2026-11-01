// 환경 변수를 읽어 검사한다. 잘못된 값은 시작할 때 바로 알린다.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function int(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name}=${raw} 은 ${min}~${max} 사이 정수여야 합니다`);
  return n;
}

export function loadConfig() {
  return {
    port: int('PORT', 8787, 0, 65535),
    capacity: int('ROOM_CAPACITY', 50, 1, 1000),
    maxRooms: int('MAX_ROOMS', 100, 1, 10000),
    statsFile: process.env.STATS_FILE || path.join(ROOT, 'data/stats.json'),
  };
}
