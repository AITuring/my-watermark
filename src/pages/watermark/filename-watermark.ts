const DEFAULT_PHOTOGRAPHER = '笑谈间气吐霓虹摄';
// Recognize the complete leading era BEFORE splitting filename separators.
// Both numeric ranges and compound Chinese eras may contain those separators.
const DATE_NUMBER = '[0-9０-９一二三四五六七八九十百千万〇零]{1,6}';
const DATE_POINT = `(?:公元前|公元后|公元|距今|前)?\\s*(?:第\\s*)?${DATE_NUMBER}`;
const DATE_QUALIFIER = '(?:早期|中期|晚期|前期|后期|初期|末期|初|中|末)?';
const DATE_RANGE = '\\s*[-－—–−~～至到]{1,2}\\s*';
const DATE_EXPRESSION = ['世纪', '年代', '年'].map(unit =>
    `${DATE_POINT}(?:${unit}${DATE_QUALIFIER})?${DATE_RANGE}${DATE_POINT}${unit}${DATE_QUALIFIER}|${DATE_POINT}${unit}${DATE_QUALIFIER}`
).join('|');
const FIELD_BOUNDARY = '(?=\\s*(?:[-_－—–]|$))';
// Only recognize date syntax here. Region/culture text is opaque metadata;
// its role is established by the following artwork field, not a place list.
const LEADING_DATE = new RegExp(`^(?:约|大约)?\\s*(?:${DATE_EXPRESSION})`);
const NAMED_PERIOD = /^[^《〈「『]*?(?:时期|时代|文化|文明|帝国|王国|王朝)/;
const CHINESE_ERAS = `旧石器时代 新石器时代 夏 商 商周 西周 东周 春秋 战国 春秋战国 秦 秦汉 汉 西汉 东汉 三国 曹魏 蜀汉 孙吴 魏 晋 西晋 东晋 十六国 南北朝 北朝 南朝 北魏 东魏 西魏 北齐 北周 刘宋 南齐 萧梁 南陈 隋 隋唐 唐 唐宋 五代 五代十国 后梁 后唐 后晋 后汉 后周 十国 杨吴 南唐 吴越 前蜀 后蜀 南汉 北汉 南平 马楚 闽 宋 北宋 南宋 宋元 辽 金 西夏 元 元明 明 清 明清 民国 近代 近现代 现代 当代`
    .split(' ').sort((a, b) => b.length - a.length).join('|');
const ERA_JOIN = '\\s*[-_－—–−~～至到]{1,2}\\s*';
// State names are subdivisions only after a matching historical period, so
// e.g. 赵国铜镜 remains an artwork name rather than being partly consumed.
const STATE_ERA = `(?:春秋战国|战国|春秋|东周)(?:时期)?${ERA_JOIN}(?:齐国|楚国|燕国|韩国|赵国|魏国|秦国|鲁国|郑国|晋国|吴国|越国|宋国|卫国)`;
const THREE_KINGDOMS_ERA = `三国(?:时期)?${ERA_JOIN}(?:魏国|蜀国|吴国)`;
const CHINESE_ERA_POINT = `(?:${STATE_ERA}|${THREE_KINGDOMS_ERA}|(?:${CHINESE_ERAS})(?:代|时期)?)`;
const LEADING_CHINESE_ERA = new RegExp(`^${CHINESE_ERA_POINT}(?:${ERA_JOIN}${CHINESE_ERA_POINT})*${FIELD_BOUNDARY}`);
const COLLECTION = /(?:博物馆|博物院|美术馆|艺术馆|纪念馆|图书馆|藏)$/;
const PLACEHOLDER = /^(?:未标题|未命名|无标题|副本|拷贝)(?:\s*\d+)?$/;
const PROVENANCE = /(?:出土|出水|发掘|发现|采集|征集|捐赠)(?:[（(].*[）)])?$/;
const CAMERA_NAME = /^(?:DSC[FN]?|IMG|PXL|_?MG|RIMG|DCIM|DJI)[_ -]?\d/i;
const TITLE_CONTEXT = /墓|壁|窟|殿|寺|塔|图|卷|册|页|轴|屏|器|俑|瓷|瓶|盘|像|局部|残片|拓本|摹本/;
// Prefix matching is only a fallback for unquoted names such as 马远梅石溪凫图.
// The Song artists come from the existing song-paintings/catalog.json; quoted
// titles and separately delimited authors do not depend on this list.
const ARTIST_PREFIXES = `
艳艳女史 太古遗民 李成王晓 周文矩 顾闳中 王居正 李公麟 赵士雷 梁师闵 张择端 王希孟 刘履中 米友仁 扬无咎 马和之 赵伯驹 赵伯骕 刘松年 陈居中 朱绍宗 赵孟坚 陈清波 陈及之 杨世昌 赵大亨 徐禹功 朱惟德 郭忠恕 黄居寀 徐崇嗣 高克明 燕文贵 许道宁 易元吉 牟仲甫 赵令穰 李安忠 冯大有 苏汉臣 王定国 贾师古 阎次平 范安仁 叶肖岩 李赞华 武元直 杨婕妤 王齐翰 翟院深 鲁宗贵 周季常 赵光辅 赵克复 阎次于 金处士 乔仲常 王利用 李公年 宋汝志 金大受 李尧夫 陆信忠 胡舜臣 郑思肖 宫素然 胡直夫 於子明 门无关 马公显 陆仲涧 丁野夫 林庭珪 张敦礼 张思恭
黄筌 董源 卫贤 阮郜 张先 燕肃 赵昌 崔白 郭熙 王诜 祁序 赵佶 李唐 李迪 赵芾 毛益 林椿 李嵩 张茂 马远 夏珪 梁楷 马麟 牧溪 李东 陈容 何筌 佚名 胡瓌 赵霖 张珪 巨然 朱锐 吴炳 赵葵 李成 惠崇 张激 萧照 杨微 赵喦 荆浩 关仝 徐熙 赵干 范宽 崔悫 文同 徽宗 高宗 许迪 江参 韩祐 卫升 法常 牟益 宋人 苏轼 张瑀 赵璚 夏森 李永 李氏 高焘 屈鼎 李结 直翁 岩叟 龚开 李山 王洪 刘寀 石恪 毛松 萝窗 玉涧 普悦 李确 徐祚 贯休 阎仲 马贲 李早
顾恺之 陆探微 张僧繇 展子虔 阎立本 吴道子 李思训 李昭道 张萱 周昉 韩滉 韩干 王维 赵孟頫 钱选 黄公望 王蒙 倪瓒 吴镇 王冕 沈周 文徵明 唐寅 仇英 董其昌 陈淳 徐渭 八大山人 朱耷 石涛 王时敏 王鉴 王翚 王原祁 恽寿平 郑燮 金农 任伯年 吴昌硕 齐白石 张大千 徐悲鸿 傅抱石 潘天寿 黄宾虹 李可染 无名氏 匿名
`.trim().split(/\s+/).sort((a, b) => b.length - a.length);

function isAuthor(value: string) {
    const name = value.replace(/[（(](?:传|款|旧传.*?)[）)]$/, '').trim();
    return ARTIST_PREFIXES.includes(name) || /^[\u3400-\u9fff]{2,4}$/.test(name) && !TITLE_CONTEXT.test(name);
}

function splitArtistTitle(value: string) {
    const quote = value.indexOf('《');
    if (quote > 0 && isAuthor(value.slice(0, quote).trim())) {
        return {author: value.slice(0, quote).trim(), title: value.slice(quote)};
    }
    // Context such as 韩休墓北壁《山水图》 is part of the artwork name.
    if (quote >= 0) return {author: '', title: value};
    for (const name of ARTIST_PREFIXES) {
        if (!value.startsWith(name)) continue;
        const attribution = value.slice(name.length).match(/^[（(](?:传|款|旧传.*?)[）)]/)?.[0] || '';
        const title = value.slice(name.length + attribution.length).trim();
        if (title) return {author: name + attribution, title};
    }
    return {author: '', title: value};
}

function isNonTitle(value: string) {
    return CAMERA_NAME.test(value) || /^(?:DSC[FN]?|IMG|PXL|MG|RIMG|DCIM|DJI)$/i.test(value)
        || /^\d+(?:\s*[（(]\d+[）)])?$/.test(value)
        || PLACEHOLDER.test(value) || PROVENANCE.test(value)
        || /^(?:出土|出水|发掘|采集|征集|捐赠)(?:时间|地点|地)?[：:]/.test(value)
        || /^(?:合成图层|清晰度|\d*logo(?:\b|$)|split\b)/i.test(value);
}

/** Split filename fields while preserving punctuation inside artwork titles. */
function splitFields(stem: string, protectedPrefixLength = 0) {
    const fields: string[] = [];
    let field = '';
    let depth = 0;
    for (let index = 0; index < stem.length; index++) {
        const character = stem[index];
        if ('《〈（(【['.includes(character)) depth++;
        if (/[-_－—–]/.test(character) && depth === 0 && index >= protectedPrefixLength) {
            if (field.trim()) fields.push(field.trim());
            field = '';
        } else {
            field += character;
        }
        if ('》〉）)】]'.includes(character)) depth = Math.max(0, depth - 1);
    }
    if (field.trim()) fields.push(field.trim());
    return fields;
}

/** Parse era → [artist] title → collection → [notes] → original photo name. */
export function extractWatermarkCaption(filename: string) {
    const stem = filename.replace(/\.[^.]+$/, '').trim();
    if (CAMERA_NAME.test(stem) || /^[0-9_ -]+$/.test(stem)) return null;
    const datePrefix = stem.match(LEADING_DATE)?.[0] || '';
    const chinesePrefix = stem.match(LEADING_CHINESE_ERA)?.[0] || '';
    const parts = splitFields(stem, Math.max(datePrefix.length, chinesePrefix.length));
    let era = '';
    const first = parts[0] || '';
    if (first && (first === datePrefix.trim() || first === chinesePrefix.trim())) {
        era = parts.shift()!;
    } else if (datePrefix || NAMED_PERIOD.test(first)) {
        const boundary = parts.findIndex(part => COLLECTION.test(part));
        const following = parts.slice(1, boundary < 0 ? undefined : boundary);
        const hasArtwork = following.some(part => !isNonTitle(part)
            && !/^(?:局部|细节|正面|背面|侧面|底部|备注)$/.test(part)
            && !/^(?:作者|绘者|画家|摄影|拍摄)[：:\s]+|(?:摄影|拍摄|摄)$/.test(part));
        // Schema: [date + unrestricted context] → artwork → collection.
        // Without an artwork field, don't turn uncertain context into a name.
        // An explicit title or style-based artwork name remains intact.
        if (hasArtwork) era = parts.shift()!;
        else if (!/《|〈|风格/.test(first)) return null;
    }
    if ((!era && parts.length < 2) || !parts.length || !/[\u3400-\u9fff]/.test(stem)) return null;
    const collectionIndex = parts.findIndex(part => COLLECTION.test(part));
    const collection = collectionIndex < 0 ? '' : parts[collectionIndex];
    // The collection is a boundary, not just another removable token. Nothing
    // after it can become a title, regardless of how a note/photo is named.
    const artworkFields = (collectionIndex < 0 ? parts : parts.slice(0, collectionIndex));
    const candidates: string[] = [];
    let author = '';
    let photographer = DEFAULT_PHOTOGRAPHER;
    for (const part of parts) {
        const credit = part.match(/^(?:摄影|拍摄)[：:\s]+(.+)$/)
            || part.match(/^(.+?)(?:摄影|拍摄|摄)$/);
        if (credit) photographer = `${credit[1].trim()}摄`;
    }
    for (const part of artworkFields) {
        if (isNonTitle(part) || /^(?:摄影|拍摄)[：:\s]+|(?:摄影|拍摄|摄)$/.test(part)) continue;
        const explicitAuthor = part.match(/^(?:作者|绘者|画家)[：:\s]+(.+)$/);
        if (explicitAuthor) author = explicitAuthor[1].trim();
        else candidates.push(part);
    }
    if (!candidates.length) return null;
    // Also support era-author-title-collection without requiring a known name.
    if (!author && candidates.length > 1 && isAuthor(candidates[0])
        && (ARTIST_PREFIXES.includes(candidates[0]) || /^《/.test(candidates[1]) || /[图卷册轴帖赋]$/.test(candidates[1]))) {
        author = candidates.shift()!;
    }
    const artwork = splitArtistTitle(candidates[0]);
    author ||= artwork.author;
    const title = artwork.title;
    if (!title || ARTIST_PREFIXES.includes(title.replace(/[（(](?:传|款|旧传.*?)[）)]$/, '').trim())) return null;
    const details = [era, author, collection].filter(Boolean).join('·');
    return {
        textLine1: title,
        textLine2: [details, photographer].filter(Boolean).join(' / '),
    };
}

export type CaptionConfidence = 'high' | 'review' | 'none';
export type WatermarkCaptionAnalysis = {
    caption: ReturnType<typeof extractWatermarkCaption>;
    confidence: CaptionConfidence;
    issues: string[];
    fields: string[];
};

/** Explain why a filename was accepted so the UI can surface only ambiguous cases. */
export function analyzeWatermarkCaption(filename: string): WatermarkCaptionAnalysis {
    const stem = filename.replace(/\.[^.]+$/, '').trim();
    const datePrefix = stem.match(LEADING_DATE)?.[0] || '';
    const chinesePrefix = stem.match(LEADING_CHINESE_ERA)?.[0] || '';
    const protectedLength = Math.max(datePrefix.length, chinesePrefix.length);
    const fields = splitFields(stem, protectedLength);
    const caption = extractWatermarkCaption(filename);
    const issues: string[] = [];
    const collectionIndex = fields.findIndex(field => COLLECTION.test(field));
    const firstField = fields[0] || '';
    const titleFields = fields
        .slice((datePrefix || chinesePrefix || NAMED_PERIOD.test(firstField)) ? 1 : 0,
            collectionIndex < 0 ? undefined : collectionIndex)
        .filter(field => !isNonTitle(field)
            && !/^(?:作者|绘者|画家)[：:\s]+/.test(field)
            && !/^(?:局部|细节|正面|背面|侧面|底部|备注)$/.test(field));

    if (!caption) {
        issues.push('没有识别出可靠的作品名称');
    } else {
        if (collectionIndex < 0) issues.push('没有找到明确的馆藏字段');
        if (!datePrefix && !chinesePrefix && !NAMED_PERIOD.test(firstField)) issues.push('年代字段未明确识别');
        if (titleFields.length > 1) issues.push('年代与名称之间存在多个候选字段');
        if (caption.textLine1.length <= 1) issues.push('作品名称过短，请确认是否为完整名称');
    }
    return {caption, confidence: !caption ? 'none' : issues.length ? 'review' : 'high', issues, fields};
}
