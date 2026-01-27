#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve the path to index.ts relative to this script
const indexPath = resolve(__dirname, 'index.ts');

// Spawn npx tsx with the index.ts file and pass through all arguments
const child = spawn('npx', ['tsx', indexPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

