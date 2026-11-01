// 장소별 동작 수 ({ temple: { bow: 12 } }). 메모리에서 세고 가끔 파일로 저장한다.
import fs from 'node:fs';
import path from 'node:path';

export class StatsStore {
  constructor(file = null) {
    this.file = file;
    this.data = {};
    this.dirty = false;
    if (file && fs.existsSync(file)) {
      try { this.data = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch { this.data = {}; }
    }
  }

  of(place) { return this.data[place] ?? {}; }

  /** 하나 더하고 새 합계를 돌려준다 */
  add(place, kind) {
    const s = (this.data[place] ??= {});
    s[kind] = (s[kind] ?? 0) + 1;
    this.dirty = true;
    return s[kind];
  }

  // 임시 파일에 쓰고 이름을 바꾼다. 쓰는 도중에 꺼져도 예전 파일이 깨지지 않는다
  save() {
    if (!this.file || !this.dirty) return;
    this.dirty = false;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }
}
