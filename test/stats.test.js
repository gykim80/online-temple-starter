import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StatsStore } from '../server/stats.js';

test('동작 수를 저장하고 다시 읽는다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-'));
  const file = path.join(dir, 'sub/stats.json');
  const a = new StatsStore(file);
  assert.equal(a.add('temple', 'bow'), 1);
  assert.equal(a.add('temple', 'bow'), 2);
  a.save();
  assert.deepEqual(new StatsStore(file).of('temple'), { bow: 2 });
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['stats.json']); // 임시 파일이 남지 않는다
  fs.rmSync(dir, { recursive: true });
});

test('깨진 파일이면 0부터 센다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-'));
  const file = path.join(dir, 'stats.json');
  fs.writeFileSync(file, '{깨짐');
  assert.deepEqual(new StatsStore(file).of('temple'), {});
  fs.rmSync(dir, { recursive: true });
});
