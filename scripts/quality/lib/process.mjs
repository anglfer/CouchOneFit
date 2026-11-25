// Ejecución de procesos hijos con registro, tiempo límite y cierre seguro.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export function killTree(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  if (process.platform === 'win32' && child.pid) {
    // Con shell:true (flutter.bat) kill() no alcanza a los nietos.
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
  } else {
    child.kill('SIGKILL');
  }
}

export function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Ejecuta un comando, replica su salida (consola + archivo de log) y devuelve
// el resultado. `onStdoutLine` recibe cada línea de stdout; `echo(line)`
// decide qué se imprime en consola (por defecto todo).
export function runLogged({
  command,
  args,
  cwd,
  env,
  shell = false,
  logFile,
  timeoutMs,
  onStdoutLine = null,
  echoStdout = true,
}) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const log = fs.createWriteStream(logFile, { flags: 'a' });
  return new Promise((resolve) => {
    const started = Date.now();
    const tail = [];
    const stderrTail = [];
    let timedOut = false;
    let buffer = '';
    let spawnError = null;
    const child = spawn(command, args, {
      cwd,
      env,
      shell,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);
    const remember = (list, text) => {
      list.push(...text.split(/\r?\n/).filter(Boolean));
      if (list.length > 40) list.splice(0, list.length - 40);
    };
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      log.write(text);
      remember(tail, text);
      if (echoStdout) process.stdout.write(text);
      if (onStdoutLine) {
        buffer += text;
        let index = buffer.indexOf('\n');
        while (index >= 0) {
          onStdoutLine(buffer.slice(0, index));
          buffer = buffer.slice(index + 1);
          index = buffer.indexOf('\n');
        }
      }
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      log.write(text);
      remember(stderrTail, text);
      remember(tail, text);
      process.stderr.write(text);
    });
    let finished = false;
    const finish = (code, signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (onStdoutLine && buffer) onStdoutLine(buffer);
      log.end(() =>
        resolve({
          code: spawnError ? 127 : code,
          signal,
          timedOut,
          durationMs: Date.now() - started,
          stderrTail: stderrTail.slice(-20),
          outputTail: tail.slice(-20),
          spawnError: spawnError?.message ?? null,
        })
      );
    };
    child.on('error', (error) => {
      spawnError = error;
      finish(null, null);
    });
    child.on('close', finish);
  });
}
