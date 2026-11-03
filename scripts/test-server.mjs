import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const executable = fileURLToPath(new URL(`../bin/domain-studio${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url));
const child = spawn(executable, ['serve', '--addr', '127.0.0.1:18082', '--enable-watch', '--watch-db-path', 'data/test-watches.db', '--watch-poll-interval', '24h', '--crash-dump-dir', 'data/test-crashes'], { cwd: root, stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error(error); process.exit(1); });
child.on('exit', code => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
