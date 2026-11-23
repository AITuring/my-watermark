import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.PEOPLE_PYTHON || `${root}backend/venv/bin/python`;
if (!existsSync(python)) {
    console.error('请先创建 backend/venv 并安装 backend/requirements-people.txt，详见 docs/people-sort-local.md');
    process.exit(1);
}
const setup = process.argv.includes('--setup');
const child = spawn(python, setup ? ['backend/download_people_models.py'] :
    ['-m', 'uvicorn', 'people_service:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', '8131', '--no-access-log'],
{ cwd: root, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exit(1); });
child.on('exit', code => { process.exitCode = code ?? 1; });
