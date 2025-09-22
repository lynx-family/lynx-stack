import type { RequestHandler } from '@rsbuild/core';
import path from 'node:path';
import fs from 'node:fs';
const __dirname = path.posix.dirname(new URL(import.meta.url).pathname);
const packageRoot = (() => {
  let currentDir = __dirname;
  while (fs.existsSync(path.posix.join(currentDir, 'package.json')) === false) {
    currentDir = path.posix.dirname(currentDir);
  }
  return currentDir;
})();
const WEB_CORE_DIST = path.posix.join(packageRoot, 'www');

export function createWebVirtualFilesMiddleware(
  subPath: string,
): RequestHandler {
  return (req, res, next) => {
    if (req.url) {
      let url = req.url;
      if (url.startsWith('//')) {
        url = url.slice(1);
      }
      if (url.startsWith(subPath)) {
        // get the relative path by removing origin
        // http://example.com:port/path/to/web/file.js -> /web/file.js
        let relativePath = path.posix.relative(subPath, req.url);
        if (relativePath === '') {
          relativePath = 'index.html';
        }
        try {
          const filePath = path.posix.join(WEB_CORE_DIST, relativePath);
          const fileName = path.posix.basename(filePath);
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const mimeType = fileName.endsWith('.js')
            ? 'application/javascript'
            : fileName.endsWith('.css')
            ? 'text/css'
            : fileName.endsWith('.html')
            ? 'text/html'
            : 'text/plain';
          res.setHeader('Content-Length', Buffer.byteLength(fileContent));
          res.setHeader('Content-Type', mimeType + '; charset=utf-8');
          // enable cross-origin-isolate to enable SAB
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          // loosen CORS for easier testing
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 200;
          res.end(fileContent);
          return;
        } catch {
          // file not found, continue to next middleware
        }
      }
    }
    next();
  };
}
