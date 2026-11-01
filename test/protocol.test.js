// 서버·브라우저 공통 검사 함수
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, cleanColor, clampNum, round2, LIMITS } from '../public/shared/protocol.js';

test('이름: 태그·제어 문자를 지우고 글자 수를 자른다', () => {
  assert.equal(cleanName('<b>안녕</b>'), 'b안녕/b');
  assert.equal(cleanName('a\u0000b\u001fc\u007f'), 'abc');
  assert.equal([...cleanName('😀'.repeat(20))].length, LIMITS.nameLength); // 이모지도 한 글자로 센다
  assert.equal(cleanName(null), '손님');
});

test('색: #rrggbb 만 받는다', () => {
  assert.equal(cleanColor('#A1b2C3'), '#A1b2C3');
  assert.equal(cleanColor('red'), '#b9c3c9');
  assert.equal(cleanColor('#fff;background:url(x)'), '#b9c3c9');
});

test('숫자: 범위 밖은 자르고 숫자가 아니면 0', () => {
  assert.equal(clampNum(1e9, 90), 90);
  assert.equal(clampNum(NaN, 90), 0);
  assert.equal(clampNum('3', 90), 0);
  assert.equal(round2(1.23456), 1.23);
});
