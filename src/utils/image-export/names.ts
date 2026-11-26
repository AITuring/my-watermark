/** Flatten paths, preserve extensions and never replace an earlier output. */
export function uniqueExportName(filename: string, used: Set<string>) {
    const safe = Array.from(filename, character => character.charCodeAt(0) < 32 ? "_" : character).join("").replace(/[\\/]/g, "_").trim();
    const base = !safe || /^\.+$/.test(safe) ? "image" : safe;
    const dot = base.lastIndexOf(".");
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const extension = dot > 0 ? base.slice(dot) : "";
    let name = base, count = 2;
    while (used.has(name)) name = `${stem} (${count++})${extension}`;
    used.add(name);
    return name;
}
