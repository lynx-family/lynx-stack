import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the port
const PORT = 8080;

// MIME types for different file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
};

// Create server
const server = http.createServer((req, res) => {
  // Get URL path
  let url = req.url;

  // Default to standalone-test.html
  if (url === '/') {
    url = '/standalone-test.html';
  }

  // Construct file path
  const filePath = path.join(__dirname, url);
  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || 'text/plain';

  // Read file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        console.error(`File not found: ${filePath}`);
        res.writeHead(404);
        res.end('File not found');
      } else {
        console.error(`Server error: ${error.code}`);
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(
    `Open your browser to test the Web Elements lifecycle implementation`,
  );
});
