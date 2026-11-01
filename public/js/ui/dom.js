// 화면 쪽에서 두루 쓰는 작은 도구
export const $ = (s, root = document) => root.querySelector(s);
export const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** innerHTML 에 넣을 글자를 안전하게 바꾼다 */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
