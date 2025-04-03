// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';
import { fileURLToPath } from 'node:url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate a nonce for CSP
function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Parse URL
  const parsedUrl = url.parse(req.url, true);

  // Generate a nonce for this request
  const nonce = generateNonce();

  // Set security headers
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'unsafe-inline'; style-src 'self' 'unsafe-inline';`,
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Check if the path is the root path
  if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html') {
    // Read the HTML file
    fs.readFile(path.join(__dirname, 'index.html'), 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        return;
      }

      // Set CSP headers
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Security-Policy':
          `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self';`,
      });

      // Replace module script tag with nonce version
      // This ensures the script will run with CSP enabled
      const htmlContent = data.replace(
        /<script type="module">/g,
        `<script type="module" nonce="${nonce}">`,
      );

      res.end(htmlContent);
    });
  } // Handle simple API requests for the demo
  else if (parsedUrl.pathname === '/api/csrf-check') {
    const csrfToken = parsedUrl.query.token;
    const validToken = '12345'; // In a real app, this would be validated against a stored token

    res.writeHead(200, { 'Content-Type': 'application/json' });

    if (csrfToken === validToken) {
      res.end(JSON.stringify({ success: true, message: 'CSRF check passed!' }));
    } else {
      res.end(
        JSON.stringify({ success: false, message: 'Invalid CSRF token!' }),
      );
    }
  } // Handle sanitization API
  else if (parsedUrl.pathname === '/api/sanitize' && req.method === 'POST') {
    let body = '';

    // Collect request data
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      let inputHtml = '';

      try {
        const data = JSON.parse(body);
        inputHtml = data.html || '';
      } catch (_e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      // Very simple sanitization (for demo purposes only)
      // In a real app, use a proper library like DOMPurify
      const sanitized = inputHtml
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/g, '')
        .replace(/on\w+='[^']*'/g, '')
        .replace(/javascript:/g, '');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        original: inputHtml,
        sanitized: sanitized,
      }));
    });
  } // Serve static files
  else {
    const filePath = path.join(__dirname, parsedUrl.pathname);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File Not Found');
        return;
      }

      // Set content type based on file extension
      const ext = path.extname(filePath);
      let contentType = 'text/plain';

      switch (ext) {
        case '.html':
          contentType = 'text/html';
          break;
        case '.css':
          contentType = 'text/css';
          break;
        case '.js':
          contentType = 'text/javascript';
          break;
        case '.json':
          contentType = 'application/json';
          break;
        case '.png':
          contentType = 'image/png';
          break;
        case '.jpg':
          contentType = 'image/jpeg';
          break;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  }
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
  console.info(`Server running at http://localhost:${PORT}/`);
  console.info('Open this URL in your browser to view the demo.');
  console.info('Press Ctrl+C to stop the server.');
});
