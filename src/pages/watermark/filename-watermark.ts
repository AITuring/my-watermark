/** Extract descriptive fields without inventing information for camera filenames. */
export function extractWatermarkCaption(filename: string) {
    const stem = filename.replace(/\.[^.]+$/, '')
        .replace(/[-_ ]+(?:\d*logo(?:[-_ ]*split)?|split|DSC|IMG|DSC_)[-_ ]*\d*.*$/i, '')
        .replace(/[-_ ]+\d+$/, '');
    if (/^(?:DSC|IMG|PXL|DSCF|[0-9_-]+)\d*/i.test(stem)) return null;
    const parts = stem.split(/[-－—]+/).map(part => part.trim()).filter(Boolean);
    if (parts.length < 2 || !/[\u3400-\u9fff]/.test(stem)) return null;
    const collectionIndex = parts.findIndex(part => /(?:博物馆|博物院|美术馆|纪念馆|藏)$/.test(part));
    const era = /^(?:新石器时代|商|西周|东周|春秋|战国|秦|汉|西汉|东汉|三国|魏|晋|西晋|东晋|南北朝|隋|唐|五代|宋|北宋|南宋|辽|金|元|明|清|民国|近现代|现代)(?:代|时期)?$/.test(parts[0]) ? parts[0] : '';
    const title = parts.filter((_, index) => index !== collectionIndex && !(era && index === 0)).join(' · ');
    if (!title) return null;
    return { textLine1: title, textLine2: [era, collectionIndex >= 0 ? parts[collectionIndex] : ''].filter(Boolean).join(' · ') };
}
