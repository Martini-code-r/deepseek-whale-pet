'use strict';

/**
 * Small launcher used by `npm start`.
 * It removes ELECTRON_RUN_AS_NODE (injected by DSH / other Electron hosts),
 * adds --no-sandbox only when we are running inside such a host, and then
 * starts the local Electron runtime.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const electron = require('electron');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const extra = process.argv.slice(2);
const isSmoke = extra.includes('--smoke');
if (isSmoke) {
  try { fs.rmSync(path.join(root, 'shots'), { recursive: true, force: true }); } catch {}
  try { fs.rmSync(path.join(root, '.userdata'), { recursive: true, force: true }); } catch {}
}

const args = [root, ...extra, '--no-sandbox'];

const child = spawn(electron, args, {
  cwd: root,
  env,
  stdio: 'inherit',
  windowsHide: false
});

child.on('error', (err) => {
  console.error('Failed to launch Electron:', err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code == null ? 0 : code);
});
