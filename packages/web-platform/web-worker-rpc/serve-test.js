// Simple server to test the RPC system in a browser
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// First compile the TypeScript
console.log('Compiling TypeScript files...');
try {
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('TypeScript compilation successful');
} catch (error) {
  console.error('TypeScript compilation failed');
  process.exit(1);
}

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './src/examples/browser-test.html';
  }

  // Get the file extension
  const extname = path.extname(filePath);
  let contentType = 'text/html';
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
  }

  // Read the file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + error.code);
      }
    } else {
      // Add COOP and COEP headers for SharedArrayBuffer support
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      });
      res.end(content, 'utf-8');
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(
    `Open your browser to http://localhost:${PORT}/ to run the tests`,
  );
});
