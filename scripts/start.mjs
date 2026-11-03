import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const exe = fileURLToPath(new URL(`../bin/domain-studio${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url));
const child = spawn(exe, ['serve', '--addr', '127.0.0.1:8082', '--enable-watch', '--cors-origins', 'http://127.0.0.1:8082', '--log-format', 'text'], { cwd: root, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
console.log('Domain Studio: http://127.0.0.1:8082/');
