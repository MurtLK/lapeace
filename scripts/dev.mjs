import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const children = [
  spawn('npm', ['--prefix', 'backend', 'start'], { cwd: root, stdio: 'inherit' }),
  spawn('npm', ['--prefix', 'web', 'run', 'dev'], { cwd: root, stdio: 'inherit' }),
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  children.forEach(child => child.kill('SIGTERM'));
  process.exitCode = code;
}
children.forEach(child => {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code ?? 1));
});
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
