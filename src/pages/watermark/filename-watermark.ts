const DEFAULT_PHOTOGRAPHER = '笑谈间气吐霓虹摄';
const ERA = /^(?:旧石器时代|新石器时代|夏|商|商周|西周|东周|春秋|战国|春秋战国|秦|秦汉|汉|西汉|东汉|三国|魏|晋|西晋|东晋|南北朝|北朝|南朝|隋|隋唐|唐|五代|五代十国|宋|北宋|南宋|辽|金|元|明|清|明清|民国|近现代|现代|当代)(?:代|时期)?$/;
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
function splitFields(stem: string) {
    const fields: string[] = [];
    let field = '';
    let depth = 0;
    for (const character of stem) {
        if ('《〈（(【['.includes(character)) depth++;
        if (/[-_－—–]/.test(character) && depth === 0) {
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
    const parts = splitFields(stem);
    if (parts.length < 2 || !/[\u3400-\u9fff]/.test(stem)) return null;

    const era = ERA.test(parts[0]) ? parts.shift()! : '';
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
