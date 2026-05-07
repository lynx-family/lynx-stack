import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const rspeedy = process.platform === 'win32' ? 'rspeedy.cmd' : 'rspeedy';

const producer = spawn(
  rspeedy,
  ['dev', '--config', 'lynx.config.producer.js'],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);

const prefix = (stream, label) => {
  const rl = createInterface({ input: stream });
  rl.on('line', (line) => {
    process.stdout.write(`[${label}] ${line}\n`);
  });
};
prefix(producer.stdout, 'producer');
prefix(producer.stderr, 'producer');

const consumer = spawn(
  rspeedy,
  ['dev', '--config', 'lynx.config.consumer.js'],
  { stdio: 'inherit' },
);

const shutdown = (code) => {
  if (typeof code === 'number') process.exitCode = code;
  if (!producer.killed) producer.kill('SIGTERM');
  if (!consumer.killed) consumer.kill('SIGTERM');
};

consumer.on('exit', (code) => shutdown(code ?? 0));
producer.on('exit', (code) => {
  if (code !== 0 && code !== null) shutdown(code);
});
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
