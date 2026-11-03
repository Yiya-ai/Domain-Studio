"""Build allowlisted source/runtime ZIPs and SHA-256 checksums. No dependencies."""
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
OUT = ROOT / 'artifacts'
OUT.mkdir(exist_ok=True)

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def private_path(name):
    parts = name.lower().split('/')
    return any(p in {'.git', 'node_modules', 'data', 'artifacts', 'test-results', 'playwright-report', '.playwright-cli', 'release-stage'} for p in parts) or bool(re.search(r'(^|/)\.env($|\.)|\.(log|pid|db|sqlite|session|cookie|pem|key)$', name, re.I))

files = [name for name in git('ls-files', '-z').decode().split('\0') if name]
if not files:
    raise SystemExit('Stage the reviewed source files before packaging.')
subprocess.run(['git', 'diff', '--exit-code', '--quiet'], cwd=ROOT, check=True)
for name in files:
    if private_path(name):
        raise SystemExit(f'Private/runtime file in source index: {name}')

source = OUT / f'Domain-Studio-v{VERSION}-source.zip'
with zipfile.ZipFile(source, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(ROOT / name, f'Domain-Studio/{name}')

runtime = OUT / f'Domain-Studio-v{VERSION}-windows-x64.zip'
runtime_files = {
    'bin/domain-studio.exe': 'bin/domain-studio.exe',
    'frontend/dist/index.html': 'frontend/dist/index.html',
    'frontend/dist-cli/domain-hunter.mjs': 'frontend/dist-cli/domain-hunter.mjs',
    'frontend/dist-cli/mcp-server.mjs': 'frontend/dist-cli/mcp-server.mjs',
    'frontend/LICENSE': 'licenses/Domain-Hunter-MIT.txt',
    'frontend/src/config/dictionaries/LICENSES.md': 'licenses/dictionaries.md',
}
for name in ['README.md', 'README.en.md', 'LICENSE', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md', 'start-domain-studio.cmd', 'open-domain-studio.url']:
    runtime_files[name] = name
for name in files:
    if name.startswith(('licenses/', 'docs/')) or name in ['scripts/export-browser-data.js', 'scripts/import-browser-data.js']:
        runtime_files[name] = name

with zipfile.ZipFile(runtime, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name, destination in sorted(runtime_files.items()):
        archive.write(ROOT / name, f'Domain-Studio/{destination}')

    # Include installed dependency license files; never package their code/cache.
    modules = ROOT / 'frontend/node_modules'
    for directory, dirs, filenames in os.walk(modules):
        dirs[:] = [d for d in dirs if d not in {'.cache', '.vite', '.bin', '.git'}]
        for filename in filenames:
            if re.fullmatch(r'(LICENSE|LICENCE|COPYING|NOTICE)([.-].*)?', filename, re.I):
                file = Path(directory) / filename
                if file.stat().st_size < 1_000_000:
                    archive.write(file, 'Domain-Studio/licenses/dependencies/npm/' + file.relative_to(modules).as_posix().replace('/node_modules/', '/nested/'))

    portable = ROOT.parent / '.tools/go1.26.8/go/bin/go.exe'
    go = os.environ.get('GO_BINARY') or (str(portable) if portable.exists() else 'go')
    env = os.environ.copy()
    if go == str(portable):
        env['GOPATH'] = str(ROOT.parent / '.tools/gopath')
        env['GOCACHE'] = str(ROOT.parent / '.tools/gocache')
    raw = subprocess.check_output([go, 'list', '-deps', '-json', './cmd/domain-check'], cwd=ROOT, env=env).decode()
    decoder = json.JSONDecoder()
    notices = []
    seen = set()
    while raw.strip():
        package, end = decoder.raw_decode(raw.lstrip())
        raw = raw.lstrip()[end:]
        module = package.get('Module', {})
        if module.get('Main') or not module.get('Dir') or module['Path'] in seen:
            continue
        seen.add(module['Path'])
        notices.append({'module': module['Path'], 'version': module.get('Version')})
        for file in Path(module['Dir']).iterdir():
            if file.is_file() and re.fullmatch(r'(LICENSE|LICENCE|COPYING|NOTICE)([.-].*)?', file.name, re.I):
                archive.write(file, 'Domain-Studio/licenses/dependencies/go/' + module['Path'] + '/' + file.name)
    archive.writestr('Domain-Studio/licenses/dependencies/go-modules.json', json.dumps(notices, indent=2))

for path in [source, runtime]:
    with zipfile.ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise SystemExit(f'Corrupt ZIP: {path.name}')
        for name in archive.namelist():
            if private_path(name):
                raise SystemExit(f'Private/runtime entry in ZIP: {name}')
checksum = ''.join(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n' for path in [source, runtime])
(OUT / 'SHA256SUMS.txt').write_text(checksum, encoding='utf-8')
print(json.dumps({'artifacts': [{'name': p.name, 'bytes': p.stat().st_size} for p in [source, runtime]], 'source_files': len(files)}, indent=2))
