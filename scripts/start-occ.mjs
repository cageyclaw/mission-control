#!/usr/bin/env node
/**
 * OCC Startup Script — Phase 7 (Deprecated)
 *
 * This script previously managed the proxy server along with Vite.
 * In Phase 7, the proxy server has been removed.
 *
 * This file is kept for backward compatibility but simply delegates
 * to `vite` directly. The `npm run dev` and `npm run preview` scripts
 * now call `vite` directly.
 *
 * @deprecated Use `npm run dev` or `npm run preview` directly
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const mode = process.argv[2] || 'dev';
const viteCommand = mode === 'preview' ? ['run', 'preview:vite'] : ['run', 'dev:vite'];

console.warn('[occ-runner] This script is deprecated in Phase 7. Use npm run dev or vite directly.');

const viteProc = spawn(npmCmd, viteCommand, {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

process.on('SIGINT', () => {
  viteProc.kill('SIGTERM');
});

process.on('SIGTERM', () => {
  viteProc.kill('SIGTERM');
});

viteProc.on('exit', (code) => {
  process.exit(code ?? 0);
});
