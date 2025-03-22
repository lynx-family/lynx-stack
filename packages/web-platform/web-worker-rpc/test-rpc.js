// Script to run the RPC tests
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the examples directory exists
const examplesDir = path.join(__dirname, 'src', 'examples');
if (!fs.existsSync(examplesDir)) {
  fs.mkdirSync(examplesDir, { recursive: true });
}

// Compile TypeScript files first
console.log('Compiling TypeScript files...');
const tsc = spawn('npx', ['tsc'], {
  stdio: 'inherit',
  shell: true,
});

tsc.on('close', (code) => {
  if (code !== 0) {
    console.error(`TypeScript compilation failed with code ${code}`);
    process.exit(code);
  }

  console.log('TypeScript compilation successful. Running tests...');

  // Run our test script
  const node = spawn('node', ['dist/examples/test-rpc.js'], {
    stdio: 'inherit',
    shell: true,
  });

  node.on('close', (code) => {
    if (code !== 0) {
      console.error(`Tests failed with code ${code}`);
      process.exit(code);
    }

    console.log('Tests completed successfully!');
  });
});
