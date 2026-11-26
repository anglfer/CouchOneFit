import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { killTree } from '../lib/process.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Regresión del CI colgado 40 min: tsx ejecuta la API en un nieto que hereda
// stdout/stderr; matar solo al hijo dejaba las tuberías abiertas y 'close'
// nunca llegaba en Linux.
test('killTree ends a grandchild that inherits the pipes, so close fires', async () => {
  const grandchild = `require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit' }); console.log('ready'); setInterval(() => {}, 1000);`;
  const child = spawn(process.execPath, ['-e', grandchild], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  await once(child.stdout, 'data');
  await sleep(300);

  killTree(child);
  const closed = await Promise.race([
    once(child, 'close').then(() => true),
    sleep(5000).then(() => false),
  ]);
  assert.equal(closed, true, 'close must fire once the whole tree is killed');
});
