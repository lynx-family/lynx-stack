import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the port to use
const PORT = 3000;

// Compile TypeScript files
console.log('Compiling TypeScript files...');
exec(
  'cd ../../../.. && npx tsc -p packages/web-platform/web-elements/tsconfig.json',
  (error, stdout, stderr) => {
    if (error) {
      console.error(`Error compiling TypeScript: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`TypeScript compilation stderr: ${stderr}`);
    }
    if (stdout) {
      console.log(`TypeScript compilation stdout: ${stdout}`);
    }
    console.log('TypeScript compilation completed.');
  },
);

// MIME types for different file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
};

// Create HTTP server
const server = http.createServer((req, res) => {
  // Get the request URL
  let url = req.url;

  // Default to index.html for root requests
  if (url === '/') {
    url = '/example-usage.html';
  }

  // Determine file path - start in the examples directory for HTML files
  let filePath;
  if (url.endsWith('.html')) {
    filePath = path.join(__dirname, url);
  } else if (url.includes('/common/')) {
    // For common files, look in the compiled output directory
    const relativePath = url.replace('/common/', '/../dist/common/');
    filePath = path.join(__dirname, relativePath);
  } else if (url.endsWith('.js')) {
    // For other JS files, first check if they exist in examples directory
    const examplesPath = path.join(__dirname, url);
    if (fs.existsSync(examplesPath)) {
      filePath = examplesPath;
    } else {
      // Otherwise look in the compiled output directory
      const compiledPath = path.join(__dirname, '../dist', url);
      filePath = compiledPath;
    }
  } else {
    // For other files, serve from the current directory
    filePath = path.join(__dirname, url);
  }

  // Get file extension
  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || 'text/plain';

  // Read file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found
        console.error(`File not found: ${filePath}`);
        res.writeHead(404);
        res.end('File not found');
      } else {
        // Server error
        console.error(`Server error: ${error.code}`);
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success - set appropriate headers and serve content
      const headers = {
        'Content-Type': contentType,
        // Add headers for cross-origin isolation (needed for SharedArrayBuffer)
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      };

      res.writeHead(200, headers);
      res.end(content, 'utf-8');
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(
    `Open your browser and navigate to http://localhost:${PORT}/example-usage.html`,
  );
});
