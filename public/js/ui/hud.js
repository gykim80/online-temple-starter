// 입장 화면과 들어온 뒤 화면(버튼·알림·대화상자). 3D 와 서버는 모르고 콜백만 부른다.
import { $, fmt, esc } from './dom.js';
import { PLACES } from '../../places/index.js';
import { LIMITS } from '../../shared/protocol.js';

export function createHud(place, placeId) {
  // ── 입장 화면 ──
  document.title = `${place.title}, 잠깐 쉬어가요`;
  $('#gate-title').textContent = place.title;
  $('#gate-tagline').textContent = place.tagline;
  $('#place-name').textContent = place.title;
  $('#gate-name').maxLength = LIMITS.nameLength;
  $('#gate-places').innerHTML = PLACES.length > 1
    ? PLACES.map((p) => `<a href="?place=${esc(p.id)}"${p.id === placeId ? ' aria-current="page"' : ''}>${esc(p.title)}</a>`).join('') : '';

  // ── 할 수 있는 것 ──
  $('#actions').innerHTML = place.actions.map((a) => `
  <button class="act" data-act="${esc(a.id)}" ${a.type === 'gesture' ? '' : 'aria-pressed="false"'} aria-keyshortcuts="${esc(a.key)}" title="${esc(a.label)} · ${esc(a.key)}">
    <span class="ico" aria-hidden="true">${a.icon}</span><span>${esc(a.label)}</span><kbd>${esc(a.key)}</kbd><span class="count" data-count="${esc(a.id)}"></span>
  </button>`).join('');
  const btn = new Map(place.actions.map((a) => [a.id, $(`[data-act="${a.id}"]`)]));
  const countEl = new Map(place.actions.filter((a) => a.counter).map((a) => [a.id, $(`[data-count="${a.id}"]`)]));

  let toastTimer;
  for (const d of document.querySelectorAll('dialog')) d.querySelector('.close').addEventListener('click', () => d.close());

  return {
    /** 들어가기 버튼. onEnter(이름) */
    gate(defaultName, onEnter) {
      const input = $('#gate-name'), enter = $('#gate-enter');
      input.value = defaultName;
      enter.disabled = false;
      enter.textContent = '들어가기';
      enter.addEventListener('click', () => {
        $('#gate').hidden = true;
        for (const el of ['.hud-top', '#actions', '#hint']) $(el).hidden = false;
        setTimeout(() => { $('#hint').style.opacity = 0; }, 9000);
        onEnter(input.value.trim() || defaultName);
      }, { once: true });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') enter.click(); });
    },
    onAction(fn) { $('#actions').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) fn(b.dataset.act); }); },
    /** 켜고 끄는 동작(loop·pose) 중 지금 켜진 것을 표시한다 */
    setMode(id) { for (const a of place.actions) if (a.type !== 'gesture') btn.get(a.id).setAttribute('aria-pressed', String(a.id === id)); },
    showTotals(totals) { for (const [id, el] of countEl) el.textContent = totals[id] ? fmt(totals[id]) : ''; },
    toast(text) {
      const el = $('#toast');
      el.textContent = text;
      el.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
    },
    setRoom(no) { $('#room-no').textContent = no; },
    setPeopleCount(n) {
      $('#people-count').textContent = n;
      $('#people-btn').setAttribute('aria-label', `같이 있는 사람 ${n}명 보기`);
    },
    /** rows: () => [[이름, 색]] */
    onPeople(rows) {
      $('#people-btn').addEventListener('click', () => {
        $('#people-list').innerHTML = rows().map(([n, c]) => `<li><i class="dot" style="background:${esc(c)}"></i>${esc(n)}</li>`).join('');
        $('#people-dlg').showModal();
      });
    },
    /** current: () => 지금 방 번호, onPick(번호) */
    onRooms(current, onPick) {
      $('#room-btn').addEventListener('click', async () => {
        let res;
        try { res = await fetch(`/api/rooms?place=${encodeURIComponent(place.id)}`).then((r) => r.json()); } catch { return this.toast('방 목록을 불러오지 못했습니다'); }
        const used = new Set(res.rooms.map((r) => r.room));
        let empty = 1; while (used.has(empty)) empty++;
        const now = current();
        const rows = [...res.rooms, { room: empty, count: 0 }].sort((a, b) => a.room - b.room);
        $('#room-list').innerHTML = rows.map((r) => `<li><button data-room="${r.room}" ${r.room === now ? 'aria-current="true"' : ''}>
    <span>${r.room}번 방${r.room === now ? ' · 지금 있는 곳' : ''}</span><span>${r.count}/${res.capacity}</span></button></li>`).join('');
        $('#room-dlg').showModal();
      });
      $('#room-list').addEventListener('click', (e) => {
        const b = e.target.closest('[data-room]');
        if (!b) return;
        $('#room-dlg').close();
        onPick(Number(b.dataset.room));
      });
    },
    /** toggle: () => 켜졌는지 */
    onSound(toggle) {
      const b = $('#sound-btn');
      const sync = (on) => { b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? '소리 끄기' : '소리 켜기'); };
      b.addEventListener('click', () => sync(toggle()));
      return sync;
    },
  };
}
