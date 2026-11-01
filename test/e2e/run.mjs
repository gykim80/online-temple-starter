// 브라우저 두 개로 들어가서 서로 보이는지, 동작이 전달되는지 확인하고 장소마다 화면을 찍는다.
// 사용: npm run e2e  (서버를 직접 띄우고 끝나면 끈다)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'test/e2e/out');
const PORT = 8790 + Math.floor(Math.random() * 100);
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), ROOM_CAPACITY: '3', STATS_FILE: path.join(OUT, 'stats.json') }, stdio: process.env.DEBUG ? 'inherit' : 'ignore' });
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? '✓' : '✗'} ${name}${info ? ` (${info})` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function enter(browser, url, name) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || process.env.DEBUG) errors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('#gate-enter:not([disabled])', { timeout: 90000 });
  await page.fill('#gate-name', name);
  await page.click('#gate-enter');
  await page.waitForFunction(() => document.querySelector('#room-no').textContent !== '—');
  return { page, errors };
}

try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch {} await wait(100); }
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // 1. 두 사람이 같은 방에 들어온다
  const a = await enter(browser, `${BASE}/?place=temple&room=1&time=day`, '첫손님');
  const b = await enter(browser, `${BASE}/?place=temple&room=1&time=day`, '둘째손님');
  await wait(600);
  check('두 사람이 같은 방에 보인다', (await a.page.textContent('#people-count')) === '2' && (await b.page.textContent('#people-count')) === '2');
  check('상대 이름표가 뜬다', (await a.page.locator('.tag', { hasText: '둘째손님' }).count()) === 1);

  // 2. 바닥 클릭으로 걸으면 상대 화면에서도 움직인다
  const before = await a.page.evaluate(() => { const r = [...window.__place.remotes.values()][0]; return [r.tx, r.tz]; });
  await b.page.mouse.click(480, 170); // 캐릭터 앞쪽 바닥
  await wait(2500);
  const after = await a.page.evaluate(() => { const r = [...window.__place.remotes.values()][0]; return [r.tx, r.tz]; });
  check('클릭 이동이 상대에게 전달된다', Math.hypot(after[0] - before[0], after[1] - before[1]) > 0.5, `${before} → ${after}`);

  // 3. 절하기: 수가 올라가고 상대에게도 보인다
  await b.page.keyboard.press('2');
  await wait(2500);
  const bowA = await a.page.textContent('[data-count="bow"]');
  check('절하기 수가 모두에게 올라간다', Number(bowA.replace(/,/g, '')) >= 1, `A 화면: ${bowA}`);
  check('절하기 버튼이 눌린 상태다', (await b.page.getAttribute('[data-act="bow"]', 'aria-pressed')) === 'true');
  await b.page.screenshot({ path: path.join(OUT, 'temple-bow.png') });
  await b.page.keyboard.press('2');

  // 4. 정원(3명)이 넘으면 다음 방으로 간다
  const c = await enter(browser, `${BASE}/?place=temple&room=1`, '셋째');
  const d = await enter(browser, `${BASE}/?place=temple&room=1`, '넷째');
  check('방이 차면 다음 방으로 보낸다', (await c.page.textContent('#room-no')) === '1' && (await d.page.textContent('#room-no')) === '2');
  const rooms = await (await fetch(`${BASE}/api/rooms?place=temple`)).json();
  check('방 목록 API', rooms.rooms.length === 2 && rooms.rooms[0].count === 3, JSON.stringify(rooms.rooms));

  // 4-1. 방 옮기기: 예전 방에 내 캐릭터가 남지 않고, 연결이 하나만 생긴다
  await d.page.click('#room-btn');
  await d.page.click('#room-list [data-room="3"]');
  await d.page.waitForFunction(() => document.querySelector('#room-no').textContent === '3');
  await wait(2500); // 예전 소켓이 늦게 닫혀도 다시 붙지 않는지 기다려 본다
  const moved = await (await fetch(`${BASE}/api/rooms?place=temple`)).json();
  check('방을 옮기면 예전 방에서 빠지고 한 번만 들어간다', JSON.stringify(moved.rooms) === JSON.stringify([{ room: 1, count: 3 }, { room: 3, count: 1 }]), JSON.stringify(moved.rooms));

  // 5. 나가면 상대 화면에서 사라진다
  await c.page.close(); await d.page.close();
  await b.page.close();
  await wait(600);
  check('나간 사람은 사라진다', (await a.page.textContent('#people-count')) === '1');

  // 6. 장소마다 낮·밤 화면
  for (const place of ['temple', 'cathedral', 'beach']) {
    for (const time of ['day', 'night']) {
      const p = await enter(browser, `${BASE}/?place=${place}&time=${time}`, '사진사');
      await wait(1500);
      await p.page.screenshot({ path: path.join(OUT, `${place}-${time}.png`) });
      check(`${place} ${time} 오류 없음`, p.errors.length === 0, p.errors.slice(0, 2).join(' | '));
      await p.page.close();
    }
  }
  // 7. 모바일 화면
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await m.goto(`${BASE}/?place=temple&time=day`);
  await m.waitForSelector('#gate-enter:not([disabled])');
  await m.screenshot({ path: path.join(OUT, 'mobile-gate.png') });
  await m.click('#gate-enter');
  await wait(1500);
  await m.screenshot({ path: path.join(OUT, 'mobile-in.png') });
  check('모바일 버튼이 화면 안에 있다', await m.evaluate(() => { const r = document.querySelector('#actions').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));

  check('A 화면 오류 없음', a.errors.length === 0, a.errors.slice(0, 2).join(' | '));
  await browser.close();
} catch (e) {
  console.error(e);
  results.push({ name: 'exception', ok: false });
} finally {
  server.kill();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} 통과 · 화면: test/e2e/out/`);
process.exit(failed ? 1 : 0);
