import type { RequestHandler } from '@rsbuild/core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot: string = (() => {
  let currentDir = __dirname;
  while (
    currentDir.length && currentDir !== '/'
    && fs.existsSync(path.join(currentDir, 'package.json')) === false
  ) {
    currentDir = path.dirname(currentDir);
  }
  if (currentDir.length === 0) {
    throw new Error('Cannot find package root');
  }
  return currentDir;
})();
const WEB_CORE_DIST: string = path.join(packageRoot, 'www');
const fileCache = new Map<string, string | Buffer>();
export function createWebVirtualFilesMiddleware(
  subPath: string,
): RequestHandler {
  if (subPath.endsWith('/')) {
    subPath = subPath.slice(0, -1);
  }
  return (req, res, next) => {
    if (req.url) {
      let url = req.url;
      if (url.startsWith('//')) {
        url = url.slice(1);
      }
      if (url.startsWith(subPath)) {
        // get the relative path by removing origin and query
        // http://example.com:port/path/to/web/file.js -> /web/file.js
        if (url.includes('?')) url = url.split('?')[0]!;
        let relativePath = path.posix.relative(subPath, url);
        if (relativePath === '') {
          relativePath = 'index.html';
        }
        try {
          const filePath = path.join(
            WEB_CORE_DIST,
            ...relativePath.split(path.posix.sep),
          );
          const extname = path.extname(filePath);
          let fileContent: string | Buffer;
          if (fileCache.has(filePath)) {
            fileContent = fileCache.get(filePath)!;
          } else {
            fileContent = extname === '.wasm'
              ? fs.readFileSync(filePath)
              : fs.readFileSync(filePath, 'utf-8');
            if (typeof fileContent === 'string') {
              fileContent = fileContent.replaceAll(
                'http://lynx-web-core-mocked.localhost/',
                subPath + '/',
              );
            }
            fileCache.set(filePath, fileContent);
          }
          const contextType = extname === '.js'
            ? 'application/javascript; charset=utf-8'
            : extname === '.css'
            ? 'text/css; charset=utf-8'
            : extname === '.html'
            ? 'text/html; charset=utf-8'
            : extname === '.wasm'
            ? 'application/wasm'
            : extname === '.json'
            ? 'application/json'
            : 'text/plain';
          res.setHeader('Content-Length', Buffer.byteLength(fileContent));
          res.setHeader('Content-Type', contextType);
          // enable cross-origin-isolate to enable SAB
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
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
