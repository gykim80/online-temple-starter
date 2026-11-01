# 내 장소 만들기: 온라인 도서관 예시

서버와 캐릭터, 연결 코드는 그대로 두고 `public/places/` 에 파일 하나만 더합니다.

## 1. 파일 복사

```bash
cp public/places/temple.js public/places/library.js
```

`public/places/index.js` 목록에 한 줄을 넣습니다.

```js
{ id: 'library', title: '도서관' },
```

## 2. 이름과 분위기

`library.js` 위쪽 설정만 바꿔도 다른 곳이 됩니다.

```js
id: 'library',
title: '밤의 도서관',
tagline: '책장 넘기는 소리만 나는 곳',
sky: { day: { top: '#c9c2b0', fog: '#ddd6c6', ground: '#4a3a2a' }, night: { top: '#120e0a', fog: '#1c1610', ground: '#0e0b08' } },
avatar: { skin: '#e8b48c', sash: null, hair: '#3b2c25', robes: ['#4a5a7a', '#7a4a4a', '#4a6a4a'] },
names: { a: ['조용한', '졸린', '늦은'], b: ['책갈피', '독서등', '페이지'] },
ambient: 'hall',
```

## 3. 할 수 있는 것

`actions` 는 버튼이자 단축키이자 서버가 세는 동작 이름입니다.

| type | 뜻 | 예 |
|---|---|---|
| `gesture` | 한 번 하고 끝 (합장 몸짓) | 인사, 손 흔들기, 초 켜기 |
| `loop` | 켜 두면 `every` 초마다 반복, `bow: true` 면 절하는 몸짓 | 절하기, 기도, 파도 세기 |
| `pose` | 켜 두면 그 자세로 있음 | 앉기 |

```js
actions: [
  { id: 'nod', label: '눈인사', icon: '🙂', key: '1', type: 'gesture', sound: 'chime' },
  { id: 'read', label: '책 읽기', icon: '📖', key: '2', type: 'loop', pose: 'sit', every: 6, counter: '한 쪽 넘겼습니다 · 모두 {n}쪽' },
],
```

`id` 는 영어 소문자만 됩니다(서버가 검사). `counter` 에 `{n}` 을 넣으면 모든 사람의 합계로 바뀝니다.

## 4. 건물 짓기

`build({ THREE, scene })` 안에서 `kit` 도구로 짓고, 몇 가지를 돌려주면 됩니다.

```js
build({ THREE, scene }) {
  const k = kit(scene);
  const ground = k.ground(200, '#4a3a2a');
  const colliders = [], glows = [];
  // 책장: 상자 하나 + 부딪힘
  for (let z = -20; z <= 0; z += 4) {
    k.box(8, 3, 0.6, '#5a3b26', -6, 0, z);
    colliders.push({ box: [-10, z - 0.3, -2, z + 0.3] });
  }
  // 독서등: 밤에 밝아짐
  glows.push(k.glow(new THREE.SphereGeometry(0.2), '#ffd27a', 0, 2, -5));
  return { ground: [ground], colliders, glows };
}
```

| 돌려줄 것 | 쓰임 |
|---|---|
| `ground` | 클릭해서 걸어갈 수 있는 바닥 메시 배열 |
| `colliders` | `{ x, z, r }` 원 또는 `{ box: [x0, z0, x1, z1] }` 상자. 캐릭터가 못 지나감 |
| `glows` | 밤에 밝아지는 물체 |
| `heightAt(x, z)` | 단 위처럼 높이가 다른 곳 (없으면 0) |
| `tick(t, dt, night)` | 매 프레임 움직임 (물결, 흔들리는 등) |
| `onAct(kind)` | 누군가 동작을 했을 때 (초가 하나 켜지는 식) |

`kit` 도구: `box`, `cyl`, `sphere`, `roof`(사각뿔 지붕), `glow`, `sign`(글씨 판), `canvasTex`(그림 텍스처), `rng`(고정 난수), `ground`.

## 5. 확인

```bash
npm start
# http://localhost:8787/?place=library
npm run e2e   # 화면이 test/e2e/out/ 에 저장됨
```

`DEFAULT_PLACE` 를 `'library'` 로 바꾸면 주소에 아무것도 안 붙여도 도서관이 열립니다.

## 다음에 붙여 볼 것

- glb 모델 불러오기 (`GLTFLoader`) 로 도형 대신 진짜 건물
- 같은 음악을 같은 시점에 듣기: 서버가 시작 시각을 알려 주고 각자 `currentTime` 을 맞춤
- 짧은 인사말(정해진 문장만 고르게 하면 욕설 걱정이 없음)
- 구역 나누기: 정원 ↔ 법당처럼 문을 지나면 다른 장면
