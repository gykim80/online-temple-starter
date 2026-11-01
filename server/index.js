// 정적 파일 + WebSocket 서버 하나로 끝나는 구성. npm start → http://localhost:8787
import { loadConfig } from './config.js';
import { Hub } from './hub.js';
import { createApp } from './app.js';

const config = loadConfig();
const hub = new Hub(config);
const app = createApp(hub);

app.server.listen(config.port, () => console.log(`열렸습니다: http://localhost:${app.server.address().port}`));

let stopping = false;
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    if (stopping) return;
    stopping = true;
    setTimeout(() => process.exit(0), 3000).unref(); // 닫히지 않는 연결이 있어도 3초 뒤엔 끝낸다
    await app.close();
    process.exit(0);
  });
}
