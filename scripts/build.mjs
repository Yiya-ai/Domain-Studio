import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const win = process.platform === 'win32';
function run(command, args, cwd = root, env = process.env) {
  const r = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: win && command.endsWith('.cmd') });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}
run(win ? 'npm.cmd' : 'npm', ['run', 'build'], path.join(root, 'frontend'));
run(win ? 'npm.cmd' : 'npm', ['run', 'build:cli'], path.join(root, 'frontend'));
mkdirSync(path.join(root, 'web/studio'), { recursive: true });
mkdirSync(path.join(root, 'bin'), { recursive: true });
copyFileSync(path.join(root, 'frontend/dist/index.html'), path.join(root, 'web/studio/index.html'));
const portable = path.resolve(root, '../.tools/go1.26.8/go/bin/go.exe');
const go = process.env.GO_BINARY || (win && existsSync(portable) ? portable : 'go');
const env = { ...process.env };
if (go === portable) {
  env.GOPATH = path.resolve(root, '../.tools/gopath');
  env.GOCACHE = path.resolve(root, '../.tools/gocache');
}
run(go, ['build', '-trimpath', '-o', `bin/domain-studio${win ? '.exe' : ''}`, './cmd/domain-check'], root, env);
console.log('Built Domain Studio, portable HTML, and CLI/MCP. Run npm start.');
