import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';

const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(cookieParser());

// Security middleware
app.use((_req, res, next) => {
  // Generate a nonce for CSP
  const nonce = crypto.randomBytes(16).toString('base64');

  // Set Content Security Policy header
  res.setHeader(
    'Content-Security-Policy',
    `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data:;
  `,
  );

  // Set other security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');

  // Pass the nonce to templates
  res.locals.nonce = nonce;

  next();
});

// Generate CSRF token
app.use((req, res, next) => {
  if (!req.cookies.csrfToken) {
    const csrfToken = crypto.randomBytes(16).toString('hex');
    res.cookie('csrfToken', csrfToken, {
      httpOnly: true,
      sameSite: 'strict',
    });
    res.locals.csrfToken = csrfToken;
  } else {
    res.locals.csrfToken = req.cookies.csrfToken;
  }
  next();
});

// Simple HTML page with security demo
app.get('/', (_req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Demo</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
      }
      .section {
        margin-bottom: 30px;
        padding: 20px;
        border: 1px solid #ddd;
        border-radius: 5px;
      }
      h2 {
        margin-top: 0;
      }
      button {
        padding: 10px 15px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        margin-right: 10px;
        margin-bottom: 10px;
      }
      textarea {
        width: 100%;
        height: 100px;
        margin-bottom: 10px;
      }
      pre {
        background-color: #f5f5f5;
        padding: 10px;
        border-radius: 4px;
        overflow-x: auto;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>Web Security Demo</h1>
      <p>Demonstrating Content Security Policy, CSRF Protection, and Input Sanitization</p>
    </div>
    
    <div class="section">
      <h2>Content Security Policy (CSP)</h2>
      <p>CSP controls which scripts can execute in your page by requiring a nonce or hash.</p>
      <p>Current nonce: <code>${res.locals.nonce}</code></p>
      <button id="safeScriptBtn">Execute Safe Script</button>
      <button id="unsafeScriptBtn">Execute Unsafe Script</button>
      <pre id="cspResult"></pre>
      
      <script nonce="${res.locals.nonce}">
        // This script will execute because it has the correct nonce
        document.getElementById('safeScriptBtn').addEventListener('click', function() {
          document.getElementById('cspResult').textContent = 'Safe script executed successfully with nonce!';
        });
        
        document.getElementById('unsafeScriptBtn').addEventListener('click', function() {
          try {
            // Create a script without a nonce (this should be blocked by CSP)
            const script = document.createElement('script');
            script.textContent = "document.getElementById('cspResult').textContent = 'Unsafe script executed (CSP FAILED!)';";
            document.body.appendChild(script);
          } catch (e) {
            document.getElementById('cspResult').textContent = 'Error trying to inject script: ' + e.message;
          }
        });
      </script>
    </div>
    
    <div class="section">
      <h2>CSRF Protection</h2>
      <p>CSRF tokens prevent cross-site request forgery attacks.</p>
      <p>Current CSRF token: <code>${res.locals.csrfToken}</code></p>
      <button id="validRequestBtn">Make Valid Request</button>
      <button id="invalidRequestBtn">Make Invalid Request</button>
      <pre id="csrfResult"></pre>
      
      <script nonce="${res.locals.nonce}">
        document.getElementById('validRequestBtn').addEventListener('click', async function() {
          const response = await fetch('/api/data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'CSRF-Token': '${res.locals.csrfToken}'
            },
            body: JSON.stringify({ action: 'getData' })
          });
          
          const result = await response.json();
          document.getElementById('csrfResult').textContent = JSON.stringify(result, null, 2);
        });
        
        document.getElementById('invalidRequestBtn').addEventListener('click', async function() {
          const response = await fetch('/api/data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'CSRF-Token': 'invalid-token'
            },
            body: JSON.stringify({ action: 'getData' })
          });
          
          const result = await response.json();
          document.getElementById('csrfResult').textContent = JSON.stringify(result, null, 2);
        });
      </script>
    </div>
    
    <div class="section">
      <h2>Input Sanitization</h2>
      <p>Sanitization prevents XSS attacks by cleaning potentially dangerous HTML.</p>
      <textarea id="htmlInput" placeholder="Enter HTML with potential XSS (e.g. <script>alert('xss')</script>)"><script>alert('XSS Attack!')</script></textarea>
      <button id="sanitizeBtn">Sanitize Input</button>
      <div>
        <h3>Original Input:</h3>
        <pre id="originalHtml"></pre>
        <h3>Sanitized Output:</h3>
        <pre id="sanitizedHtml"></pre>
        <h3>Rendered Result:</h3>
        <div id="outputContainer" style="border: 1px dashed #ccc; padding: 10px; margin-top: 10px;"></div>
      </div>
      
      <script nonce="${res.locals.nonce}">
        document.getElementById('sanitizeBtn').addEventListener('click', async function() {
          const input = document.getElementById('htmlInput').value;
          document.getElementById('originalHtml').textContent = input;
          
          const response = await fetch('/api/sanitize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'CSRF-Token': '${res.locals.csrfToken}'
            },
            body: JSON.stringify({ html: input })
          });
          
          const result = await response.json();
          document.getElementById('sanitizedHtml').textContent = result.sanitized;
          document.getElementById('outputContainer').innerHTML = result.sanitized;
        });
      </script>
    </div>
  </body>
  </html>
  `);
});

// API endpoints
app.post('/api/data', (req, res) => {
  const token = req.headers['csrf-token'];

  if (token !== res.locals.csrfToken) {
    return res.json({
      success: false,
      message: 'CSRF token validation failed',
    });
  }

  res.json({
    success: true,
    message: 'Data fetched successfully with valid CSRF token',
    data: {
      id: 123,
      name: 'Secure Data',
      timestamp: new Date().toISOString(),
    },
  });
});

app.post('/api/sanitize', (req, res) => {
  const token = req.headers['csrf-token'];

  if (token !== res.locals.csrfToken) {
    return res.json({
      success: false,
      message: 'CSRF token validation failed',
    });
  }

  // Very simple sanitization for demo purposes
  // In a real app, use a proper sanitization library like DOMPurify
  const sanitized = req.body.html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/on\w+='[^']*'/g, '')
    .replace(/javascript:/g, 'blocked:');

  res.json({
    success: true,
    sanitized,
  });
});

// Start server
app.listen(port, () => {
  console.info(`Security demo server running at http://localhost:${port}`);
  console.info('Press Ctrl+C to stop the server');
});
