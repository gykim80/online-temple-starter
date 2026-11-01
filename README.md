# online-temple-starter

여러 사람이 브라우저로 들어와 같은 공간에 말없이 머물다 가는 3D 사이트의 뼈대입니다.
온라인 절을 기본으로 넣었고, 같은 코드에 설정 파일만 바꾼 성당과 해변이 함께 들어 있습니다.

| 산사 | 성당 | 해변 |
|---|---|---|
| ![산사](docs/img/temple.png) | ![성당](docs/img/cathedral.png) | ![해변](docs/img/beach.png) |

## 바로 실행

```bash
git clone https://github.com/gykim80/online-temple-starter.git
cd online-temple-starter
npm install
npm start            # http://localhost:8787
```

브라우저 창을 두 개 열어 보면 서로의 캐릭터가 보입니다.
`?place=cathedral`, `?place=beach` 를 붙이면 다른 장소, `?time=night` 를 붙이면 밤 화면입니다.

## 들어 있는 것

- 바닥 클릭·WASD 로 걷기, 드래그로 둘러보기, 휠·두 손가락으로 확대
- 방 나누기: 방마다 정원(기본 50명)이 차면 다음 방으로 보냄, 방 목록에서 옮기기
- 동작: 합장(한 번), 절하기·염주(켜 두면 반복), 모든 사람의 동작 수 합계
- 늘 앉아 있는 NPC, 현재 시각에 따라 바뀌는 낮·밤, 밤에 켜지는 등불
- 음원 파일 없이 합성한 바람·파도 소리와 목탁·종소리
- 모델 파일 없이 기본 도형으로만 지은 건물과 캐릭터

## 구조

```
server/
  index.js        정적 파일 + WebSocket(/ws) + /api/rooms
  hub.js          방 배정, 메시지 검사, 0.1초마다 움직임 모아 보내기, 동작 수 세기
public/
  index.html      입장 화면, 상단·하단 버튼, 대화상자
  js/main.js      내 캐릭터 조작, 다른 사람 그리기, 버튼·키보드
  js/world.js     렌더러, 낮·밤, 카메라 조작, 충돌
  js/avatar.js    도형 캐릭터와 자세(걷기·꿇어앉기·앉기·절·합장)
  js/net.js       서버 연결, 끊기면 다시 붙기
  js/sound.js     소리 합성
  places/         장소 설정 (temple.js · cathedral.js · beach.js · index.js · kit.js)
test/
  hub.test.js     서버 로직 단위 테스트 (npm test)
  e2e/run.mjs     브라우저 4개로 접속·이동·동작·방 나누기 확인 (npm run e2e)
```

## 주고받는 메시지

| 방향 | 메시지 | 내용 |
|---|---|---|
| 접속 → 서버 | `join` | place, room, name, color, 처음 위치 |
| 접속 → 서버 | `move` | x, z, yaw, pose (바뀌었을 때만, 0.1초에 한 번까지) |
| 접속 → 서버 | `act` | kind (hello, bow, bead …) |
| 서버 → 접속 | `welcome` | 내 id, 배정된 방, 먼저 와 있던 사람, 동작 수 |
| 서버 → 접속 | `join` / `leave` | 들어오고 나간 사람 |
| 서버 → 접속 | `moves` | 0.1초 동안 움직인 사람들 `[id, x, z, yaw, pose]` |
| 서버 → 접속 | `act` | 누가 무슨 동작을 했는지와 합계 |

서버는 좌표를 ±90m 로 자르고, 자세 이름과 동작 이름을 검사하고, 이름에서 태그 문자를 지웁니다.
1초에 40개 넘는 메시지는 버리고 200개를 넘기면 연결을 끊습니다.

## 내 장소 만들기

[docs/MAKE-YOUR-OWN.md](docs/MAKE-YOUR-OWN.md) 에 온라인 도서관을 예로 들어 순서대로 적었습니다.
`public/places/temple.js` 를 복사해 이름, 하늘색, 건물, 동작만 바꾸면 됩니다.

## 배포

Node 20 이상이 돌아가는 곳이면 어디든 됩니다. WebSocket 을 지원하는 호스팅(Render, Railway, Fly.io 등)에 올리고 시작 명령을 `npm start` 로 둡니다.

| 환경 변수 | 기본값 | 뜻 |
|---|---|---|
| `PORT` | 8787 | 서버 포트 |
| `ROOM_CAPACITY` | 50 | 방 하나 정원 |
| `STATS_FILE` | data/stats.json | 동작 수를 저장할 파일 |

## 참고한 곳

[산사](https://sansatemple.com/) 의 공개된 화면과 동작을 보고 처음부터 다시 만들었습니다. 산사의 코드·모델·음원은 쓰지 않았습니다. 분석 내용은 [docs/ANALYSIS.md](docs/ANALYSIS.md) 에 있습니다.

## 라이선스

MIT
