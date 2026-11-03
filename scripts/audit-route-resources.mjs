// Static startup dependency budget; excludes lazy imports, data and images.
// Usage: node scripts/audit-route-resources.mjs [build-directory]
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
const directory = path.resolve(process.argv[2] || 'dist');
const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
const catalog = (await readFile(new URL('../src/app/catalog.ts', import.meta.url), 'utf8')).replace(/^\s*\/\/.*$/gm, '');
const routes = [['/', 'src/pages/landing/index.tsx'], ...Array.from(catalog.matchAll(/url:\s*"([^"]+)"[\s\S]*?component:\s*\(\)\s*=>\s*import\("\.\.\/(.*?)"\)/g), ([, route, module]) => [route, module.endsWith('/personal') ? `src/${module}.tsx` : `src/${module}/index.tsx`])];
const rows = [];
for (const [route, candidate] of routes) {
    const entry = [candidate, candidate.replace(/\.tsx$/, ".ts")].find(key => manifest[key]);
    if (!entry) { rows.push({route, note: "Route merged into a shared chunk; inspect prerender-manifest or browser requests."}); continue; }
    const visited = new Set();
    function visit(key) {
        if (visited.has(key)) return;
        visited.add(key);
        for (const dependency of manifest[key]?.imports || []) visit(dependency);
    }
    visit('index.html'); visit(entry);
    const files = [...new Set([...visited].map(key => manifest[key].file))];
    let bytes = 0, gzipBytes = 0;
    for (const file of files) { const data = await readFile(path.join(directory, file)); bytes += data.length; gzipBytes += gzipSync(data).length; }
    rows.push({route, scriptRequests: files.length, bytes, gzipBytes, files});
}
console.log(JSON.stringify(rows, null, 2));
