// 정적 파일. 빌드 단계가 없으니 여기서 캐시(ETag)와 압축(gzip)을 맡는다.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg']);

/**
 * mounts: [[URL 앞부분, 폴더, { maxAge }]] — 앞에서부터 처음 맞는 곳을 쓴다.
 * maxAge 를 주지 않으면 매번 ETag 로 바뀌었는지 확인한다(no-cache).
 */
export function createStatic(mounts) {
  const roots = mounts.map(([prefix, dir, opt = {}]) => ({ prefix, dir: path.resolve(dir) + path.sep, ...opt }));
  const gzCache = new Map(); // 파일 경로 → { etag, buf }. 같은 파일을 매번 다시 압축하지 않는다

  function find(urlPath) {
    for (const r of roots) {
      if (!urlPath.startsWith(r.prefix)) continue;
      const file = path.resolve(r.dir, '.' + path.posix.sep + urlPath.slice(r.prefix.length));
      if (!file.startsWith(r.dir)) return null; // ../ 로 폴더 밖을 읽지 못하게
      let st;
      try { st = fs.statSync(file); } catch { continue; }
      if (st.isFile()) return { file, st, root: r };
    }
    return null;
  }

  return function serve(req, res) {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
    if (p.includes('\0')) { res.writeHead(400); return res.end(); }
    if (p.endsWith('/')) p += 'index.html';
    const hit = find(p);
    if (!hit) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('없는 페이지입니다');
    }
    const { file, st, root } = hit;
    const ext = path.extname(file).toLowerCase();
    const etag = `W/"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
    const headers = {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': root.maxAge ? `public, max-age=${root.maxAge}` : 'no-cache',
      etag,
      'x-content-type-options': 'nosniff',
      vary: 'accept-encoding',
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }

    const gzip = COMPRESSIBLE.has(ext) && st.size > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (!gzip) {
      res.writeHead(200, { ...headers, 'content-length': st.size });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    }
    let c = gzCache.get(file);
    if (!c || c.etag !== etag) {
      c = { etag, buf: zlib.gzipSync(fs.readFileSync(file), { level: 6 }) };
      gzCache.set(file, c);
    }
    res.writeHead(200, { ...headers, 'content-encoding': 'gzip', 'content-length': c.buf.length });
    res.end(req.method === 'HEAD' ? undefined : c.buf);
  };
}
