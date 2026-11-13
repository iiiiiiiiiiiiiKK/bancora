import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.E2E_PORT || 4187);
const baseUrl = process.env.BASE_URL || `http://127.0.0.1:${port}`;
const localChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = process.platform === 'win32' && command.toLowerCase().endsWith('node.exe')
      ? spawn(command, args, { cwd: root, stdio: 'inherit', ...options })
      : spawn(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...options });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolveRun() : reject(new Error(`${command} exited ${code ?? signal}`)));
  });
}

const env = { ...process.env, BASE_URL: baseUrl };
let server;
try {
  if (!process.env.BASE_URL) {
    await run('npm', ['run', 'build'], { env });
    server = spawn(process.execPath, ['scripts/serve-dist.mjs', String(port), 'dist'], { cwd: root, stdio: 'inherit' });
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const response = await fetch(baseUrl);
        if (response.ok) { ready = true; break; }
      } catch { /* wait for local server startup */ }
      await delay(250);
    }
    if (!ready) throw new Error(`Local dist server did not start at ${baseUrl}`);
  }
  const chromePath = process.env.CHROME_PATH || localChrome;
  if (!(await exists(chromePath))) throw new Error(`Chrome was not found at ${chromePath}; set CHROME_PATH or BASE_URL and run tests/e2e/run.mjs directly.`);
  await run(process.execPath, ['tests/e2e/run.mjs'], { env });
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([new Promise((resolveExit) => server.once('exit', resolveExit)), delay(3000)]);
    if (server.exitCode === null) server.kill('SIGKILL');
  }
}
