import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const requirePackage = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export function createTypeScriptLoader(overrides = {}, globals = {}) {
    const cache = new Map();
    function load(filename) {
        const path = resolve(root, filename);
        if (cache.has(path)) return cache.get(path).exports;
        const module = { exports: {} };
        cache.set(path, module);
        const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
        vm.runInNewContext(code, { module, exports: module.exports, File, Blob, setTimeout, clearTimeout, console, ...globals,
            require: name => {
                if (Object.hasOwn(overrides, name)) return overrides[name];
                if (name.startsWith('@/') || name.startsWith('.')) {
                    const base = name.startsWith('@/') ? resolve(root, 'src', name.slice(2)) : resolve(dirname(path), name);
                    const target = [base + '.ts', base + '/index.ts', base].find(value => existsSync(value));
                    if (!target) throw new Error(`Cannot resolve ${name} from ${path}`);
                    return load(target);
                }
                return requirePackage(name);
            },
        }, { filename: path });
        return module.exports;
    }
    return load;
}
