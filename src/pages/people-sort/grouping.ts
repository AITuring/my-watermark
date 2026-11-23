export interface FaceSample { id: string; descriptor?: number[] }
export interface PersonGroup { id: string; name: string; photoIds: string[] }
export const REVIEW = 'review';
export function distance(a: number[], b: number[]) {
    if (!a.length || a.length !== b.length) return Infinity;
    return Math.sqrt(a.reduce((sum, n, i) => sum + (n - b[i]) ** 2, 0));
}
// Compare every member: avoid chaining two different people through one ambiguous photo.
export function groupFaces(samples: FaceSample[], threshold: number): PersonGroup[] {
    const groups: { group: PersonGroup; descriptors: number[][] }[] = [];
    const review: string[] = [];
    for (const sample of samples) {
        if (!sample.descriptor) { review.push(sample.id); continue; }
        const descriptor = sample.descriptor;
        const candidates = groups.map((entry) => ({ entry, score: Math.max(...entry.descriptors.map(d => distance(d, descriptor))) }))
            .filter(c => c.score < threshold).sort((a, b) => a.score - b.score);
        if (candidates.length > 1 && candidates[1].score - candidates[0].score < 0.06) {
            review.push(sample.id);
        } else if (candidates.length) {
            candidates[0].entry.group.photoIds.push(sample.id);
            candidates[0].entry.descriptors.push(descriptor);
        } else {
            const n = groups.length + 1;
            groups.push({ group: { id: `person-${n}`, name: `人物 ${n}`, photoIds: [sample.id] }, descriptors: [descriptor] });
        }
    }
    return [...groups.map(g => g.group), { id: REVIEW, name: '待确认', photoIds: review }];
}
export function safeName(name: string) {
    // eslint-disable-next-line no-control-regex
    const value = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').trim().slice(0, 100);
    return !value || value === '.' || value === '..' ? '未命名' : value;
}
export function uniqueName(name: string, used: Set<string>) {
    const safe = safeName(name);
    const dot = safe.lastIndexOf('.');
    const stem = dot > 0 ? safe.slice(0, dot) : safe;
    const ext = dot > 0 ? safe.slice(dot) : '';
    let result = safe;
    let n = 2;
    while (used.has(result.toLowerCase())) result = `${stem} (${n++})${ext}`;
    used.add(result.toLowerCase());
    return result;
}

export function matchReferences(sample: FaceSample, references: { groupId: string; descriptors: number[][] }[], threshold: number): string | undefined {
    if (!sample.descriptor) return undefined;
    const candidates = references.map(reference => {
        const distances = reference.descriptors.map(d => distance(d, sample.descriptor!)).sort((a, b) => a - b).slice(0, 3);
        return { groupId: reference.groupId, score: distances.length ? distances.reduce((sum, n) => sum + n, 0) / distances.length : Infinity };
    }).sort((a, b) => a.score - b.score);
    if (!candidates.length || candidates[0].score >= threshold) return undefined;
    if (candidates[1] && candidates[1].score - candidates[0].score < 0.1) return undefined;
    return candidates[0].groupId;
}
