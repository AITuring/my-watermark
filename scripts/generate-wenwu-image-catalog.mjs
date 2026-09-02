import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { artifactImageCatalog as existingArtifactImageCatalog } from "../src/pages/wenwu/artifactImageCatalog.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const dataFile = path.join(projectRoot, "public/data/195.json");
const artifactImageDir = path.join(projectRoot, "public/wenwu/artifacts");
const outputFile = path.join(
    projectRoot,
    "src/pages/wenwu/artifactImageCatalog.ts"
);

const MANUAL_TITLE_ALIASES = {
    "铸客大鼎": "鑄客銅鼎",
    "彩绘季札挂剑图漆盘": "吴彩绘季札挂剑图漆盘",
    "皮胎犀皮漆金铜扣耳杯（2件）": "吴皮胎犀皮漆鎏金铜釦耳杯（2件）",
    "太阳神鸟金箔片": "商太阳神鸟金箔片",
    "定窑白釉刻莲花瓣纹龙首净瓶": "北宋定窑白釉刻莲花瓣纹龙首净瓶",
    "刺绣佛像供养人": "北魏刺绣佛像供养人",
    "鎏金铜浮屠": "铜浮屠",
    "仰韶文化彩陶人形双系瓶": "新石器时代仰韶文化彩陶人形双系瓶",
    "韩滉《五牛图》卷": "五牛圖",
    "王珣《伯远帖》卷": "伯遠帖",
    "冯承素摹王羲之《兰亭序》卷": "兰亭集序神龙本",
    "杜牧《张好好诗》卷": "張好好詩",
    "永安三年”款青釉堆塑谷仓罐": "吴“永安三年”款青釉堆塑谷仓罐",
    "青釉凤首龙柄壶": "唐青釉凤首龙柄壶",
    "鲁山窑黑釉蓝斑腰鼓": "唐鲁山窑黑釉蓝斑腰鼓",
    "汝窑天青釉弦纹樽": "北宋汝窑天青釉弦纹樽",
    "官窑弦纹瓶": "北宋官窑弦纹瓶",
    "钧窑月白釉出戟尊": "北宋钧窑月白釉出戟尊",
    "拓西岳华山庙碑册 (华阴本)": "宋拓西岳华山庙碑册",
    "铜立人像": "商铜立人像",
    "金杖": "三星堆金杖",
    "韩琦《行楷信礼卷》": "行楷信札卷",
    "战国水晶杯": "水晶杯",
    "错金银镶松石狩猎纹铜伞铤": "西汉错金银镶松石狩猎纹铜伞铤",
    "错金银四龙四凤铜方案": "铜错金银四龙四凤方案",
    "白釉绿彩长颈瓶": "北齐白釉绿彩长颈瓶",
    "多节活环套练玉佩": "战国多节活环套练玉佩",
    "彩绘乐舞图鸳鸯形漆盒": "战国彩绘乐舞图鸳鸯形漆盒",
    "云梦睡虎地秦简《语书》": "秦云梦睡虎地秦简《语书》",
    "长沙窑青釉褐彩贴花人物纹壶": "唐长沙窑青釉褐彩贴花人物纹壶",
    "马王堆汉慕帛书《周易》": "西汉马王堆汉墓帛书《周易》",
    "直裾素纱禅衣": "直裾素紗襌衣",
    "官窑贯耳尊": "北宋官窑贯耳尊",
    "郭店楚简《老子 (甲、乙、丙) 》": "战国郭店楚简《老子（甲、乙、丙）》",
    "赵佶《草书千字文》卷": "趙佶《草書千字文》",
    "耀州窑摩羯形水孟": "五代耀州窑摩羯形水盂",
    "越窑青釉褐彩云纹五足炉": "唐越窑青釉褐彩云纹五足炉",
    "摇钱树": "搖錢樹",
    "青釉神兽尊": "西晋青釉神兽尊",
    "青釉褐彩羽人纹双系壶": "吴青釉褐彩羽人纹双系壶",
    "青花萧何月下追韩信图梅瓶": "元青花萧何月下追韩信图梅瓶",
    "简《金滕》": "清华简《金滕》",
    "大汶口文化彩陶八角星纹豆": "新石器时代大汶口文化彩陶八角星纹豆",
    "晋侯夫人组玉佩": "西周晋侯夫人组玉佩",
    "龙纹兜觥": "商龙纹兜觥",
    "司马金龙墓出土漆屏": "北魏司马金龙墓漆屏",
    "涅槃变相碑": "北齐涅槃变相碑",
    "常阳天尊石像": "北齐常阳天尊造像",
    "娄睿墓鞍马出行图壁画": "北齐娄叡墓鞍马出行图",
    "耀州窑青釉刻花提梁倒流壶": "五代耀州窑青釉刻花提梁倒流壶",
    "三彩骆驼载乐俑": "唐三彩骆驼载乐俑",
    "“皇后之玺”玉玺": "“皇后之玺”玉印",
    "章怀太子墓打马球图壁画": "唐章怀太子墓打马球图",
    "章怀太子墓狩猎出行图壁画": "唐章怀太子墓狩猎出行图",
    "懿德太子墓阙楼仪仗图": "唐懿德太子墓阙楼仪仗图",
    "永泰公主墓宫女图壁画": "唐永泰公主墓宫女图",
    "镶金兽首玛瑙杯": "唐兽首玛瑙杯",
    "曹全碑初拓本 (“因”字不损本)": "明初拓曹全碑册",
    "楚简《孔子诗论》": "战国上博楚竹书《孔子诗论》",
    "西周晋侯苏钟 (一套16件）": "西周晋侯苏钟",
    "越窑莲花式托盏": "五代越窑莲花式托盏",
    "木雕真珠舍利宝幢 (含木函）": "木雕真珠舍利宝幢",
    "白釉龙柄双联传瓶": "北齐白釉龙柄双联传瓶",
    "唐昭陵六骏石刻 (什伐赤、白蹄乌、特勒骠、青骓4幅)": "昭陵六骏",
    "彩绘人物车马镜": "战国彩绘人物车马镜",
    "“统领释教大元国师之印”龙钮玉印": "统领释教大元国师之印",
    "方格兽纹锦": "北朝方格兽纹锦",
    "长沙窑青釉褐蓝彩双系罐": "唐长沙窑青釉褐蓝彩双系罐",
    "蓝釉白龙纹梅瓶": "元蓝釉白龙纹梅瓶",
    "莲鹤铜方壶": "春秋莲鹤方壶",
    "河姆渡文化双鸟朝阳纹象牙雕刻器": "河姆渡遗址双鸟朝阳纹牙雕",
    "良渚出土玉琮王": "良渚玉琮王",
    "龟负论语玉烛酒筹銮金银筒": "清龟负“论语玉烛”酒筹鎏金银筒",
    "青釉仰覆莲花尊": "北朝青釉仰覆莲花尊",
    "包金镶玉嵌琉璃银带钩": "包金镶玉嵌琉璃银带钩",
    "“赤乌十四年”款青釉虎子": "吴“赤乌十四年”款青釉虎子",
    "马家窑文化彩陶舞蹈纹盆": "新石器时代马家窑文化彩陶舞蹈纹盆",
    "马家窑文化彩陶贴塑人纹双系壶": "新石器时代马家窑文化彩陶贴塑人纹双系壶",
    "仰韶文化彩陶网纹船形壶": "新石器时代仰韶文化彩陶网纹船形壶",
    "仰韶文化彩陶人面鱼纹盆": "新石器时代仰韶文化彩陶人面鱼纹盆",
    "绿玻璃盖罐": "战国绿玻璃盖罐",
    "绿玻璃小瓶": "战国绿玻璃小瓶",
    "陶骆驼载乐舞三彩俑": "唐三彩骆驼载乐俑",
    "“滇王之印”金印": "“滇王之印”金印",
    "孝端皇后凤冠": "孝端皇后凤冠",
    "后母戊鼎 (旧称司母戊鼎）": "后母戊鼎",
    "彩绘鹤鱼石斧图陶缸": "新石器时代仰韶文化彩绘鹳鱼石斧图陶缸",
    "刻开宝藏本《阿惟越致经》 (1卷)": "西晋刻本《阿惟越致经》",
    "刻本《范仲淹文集》 (30卷)": "北宋刻本《范仲淹文集》"
};

const MANUAL_REMOTE_IMAGES = {
    "国诠书《善见律》卷":
        "https://www.dpm.org.cn/Uploads/Picture/dc/25994.jpg",
    "林逋《自书诗》卷":
        "https://www.dpm.org.cn/Uploads/Picture/dc/797.jpg",
    "蔡襄《自书诗》卷":
        "https://www.dpm.org.cn/Uploads/Picture/dc/27511.jpg",
    "文彦博《三帖卷》":
        "https://www.dpm.org.cn/Uploads/Picture/2023/05/15/s6461d6d6dc38c.jpg",
};

const MANUAL_LOCAL_IMAGES = {
    "何尊": "4-hezun-official.png",
    "透雕神仙故事玉座屏": "10-dingzhou-yuzuoping.jpg",
    "韩滉《五牛图》卷": "18-official.jpg",
    "周昉《挥扇仕女图》卷": "19-official.jpg",
    "黄筌《写生珍禽图》卷": "24-official.jpg",
    "步辇图": "33-official.jpg",
    "王珣《伯远帖》卷": "35-official.jpg",
    "国诠书《善见律》卷": "37-official.jpg",
    "林逋《自书诗》卷": "40-official.jpg",
    "蔡襄《自书诗》卷": "41-official.jpg",
    "文彦博《三帖卷》": "42-official.jpg",
    "直裾素纱禅衣": "85-plain-gauze-gown-official.jpg",
    "耀州窑青釉刻花提梁倒流壶": "123-official.png",
    "“皇后之玺”玉玺": "125-official.png",
    "镶金兽首玛瑙杯": "131-agate-cup-official.png",
    "四羊方尊": "170-official.jpg",
    "后母戊鼎 (旧称司母戊鼎）": "185-houmuwuding-official.jpg",
    "利簋": "190-official.jpg",
};

const escapeString = (value) =>
    JSON.stringify(value).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

const normalizeTitle = (value = "") =>
    value
        .replace(/（[^）]*）/g, "")
        .replace(/\([^)]*\)/g, "")
        .replace(/[《》“”"'`]/g, "")
        .replace(/[·•]/g, "")
        .replace(/卷$|轴$|帖$|册$|页$|屏$|图卷$/g, "")
        .replace(/\s+/g, "")
        .toLowerCase();

const extractInnerTitle = (value = "") =>
    (value.match(/《([^》]+)》/) || [])[1]?.trim() || "";

const getLocalImageFile = (imagePath) => imagePath?.split("/").pop() || undefined;

const getCachedLocalImageMap = async () => {
    const files = await readdir(artifactImageDir).catch(() => []);
    const cacheMap = new Map();

    for (const fileName of files) {
        const matched = fileName.match(/^(\d+)-/);
        if (!matched) continue;

        const artifactId = Number(matched[1]);
        if (!Number.isFinite(artifactId) || cacheMap.has(artifactId)) continue;

        cacheMap.set(artifactId, fileName);
    }

    return cacheMap;
};

const fetchProhibitedArtifactLinks = async () => {
    const response = await fetch(
        "https://zh.wikipedia.org/w/api.php?action=parse&page=%E7%A6%81%E6%AD%A2%E5%87%BA%E5%A2%83%E5%B1%95%E8%A7%88%E6%96%87%E7%89%A9&format=json&prop=links"
    );

    if (!response.ok) {
        throw new Error(`Failed to load wikipedia links: ${response.status}`);
    }

    const payload = await response.json();
    return (payload?.parse?.links || [])
        .map((item) => item?.["*"])
        .filter(Boolean);
};

const buildCatalogEntry = (
    artifact,
    titleLookup,
    cachedLocalImageMap,
    existingEntry
) => {
    const localImage = getLocalImageFile(artifact.image);
    if (localImage) {
        return {
            id: artifact.id,
            name: artifact.name,
            localImage,
            status: "ready",
        };
    }

    const manualLocalImage = MANUAL_LOCAL_IMAGES[artifact.name];
    if (manualLocalImage) {
        return {
            id: artifact.id,
            name: artifact.name,
            localImage: manualLocalImage,
            status: "ready",
        };
    }

    const cachedLocalImage = cachedLocalImageMap.get(artifact.id);
    if (cachedLocalImage) {
        return {
            id: artifact.id,
            name: artifact.name,
            localImage: cachedLocalImage,
            status: "ready",
        };
    }

    const manualTitle = MANUAL_TITLE_ALIASES[artifact.name];
    if (manualTitle) {
        return {
            id: artifact.id,
            name: artifact.name,
            wikipediaTitle: manualTitle,
            status: "ready",
        };
    }

    const manualRemoteImage = MANUAL_REMOTE_IMAGES[artifact.name];
    if (manualRemoteImage) {
        return {
            id: artifact.id,
            name: artifact.name,
            remoteImage: manualRemoteImage,
            status: "ready",
        };
    }

    if (existingEntry?.remoteImage) {
        return {
            id: artifact.id,
            name: artifact.name,
            remoteImage: existingEntry.remoteImage,
            status: "ready",
        };
    }

    if (existingEntry?.wikipediaTitle) {
        return {
            id: artifact.id,
            name: artifact.name,
            wikipediaTitle: existingEntry.wikipediaTitle,
            status: "ready",
        };
    }

    const candidates = [
        normalizeTitle(artifact.name),
        normalizeTitle(extractInnerTitle(artifact.name)),
        normalizeTitle(
            artifact.name.replace(/^[^《]+《/, "").replace(/》.*$/, "").trim()
        ),
    ].filter(Boolean);

    for (const candidate of candidates) {
        const matchedTitle = titleLookup.get(candidate);
        if (matchedTitle) {
            return {
                id: artifact.id,
                name: artifact.name,
                wikipediaTitle: matchedTitle,
                status: "ready",
            };
        }
    }

    return {
        id: artifact.id,
        name: artifact.name,
        status: "missing",
    };
};

const renderCatalogFile = (entries) => {
    const body = entries
        .map((entry) => {
            const lines = [
                `    ${entry.id}: {`,
                `        id: ${entry.id},`,
                `        name: ${escapeString(entry.name)},`,
            ];

            if (entry.localImage) {
                lines.push(`        localImage: ${escapeString(entry.localImage)},`);
            }

            if (entry.wikipediaTitle) {
                lines.push(
                    `        wikipediaTitle: ${escapeString(entry.wikipediaTitle)},`
                );
            }

            if (entry.remoteImage) {
                lines.push(
                    `        remoteImage: ${escapeString(entry.remoteImage)},`
                );
            }

            lines.push(`        status: ${escapeString(entry.status)},`);
            lines.push("    },");

            return lines.join("\n");
        })
        .join("\n");

    return `export interface ArtifactImageCatalogEntry {
    id: number;
    name: string;
    localImage?: string;
    wikipediaTitle?: string;
    remoteImage?: string;
    status: "ready" | "pending" | "missing";
}

export const artifactImageCatalog: Record<number, ArtifactImageCatalogEntry> = {
${body}
};
`;
};

const main = async () => {
    const rawData = await readFile(dataFile, "utf8");
    const artifacts = JSON.parse(rawData);
    const links = await fetchProhibitedArtifactLinks().catch(() => []);
    const titleLookup = new Map();
    const cachedLocalImageMap = await getCachedLocalImageMap();

    for (const title of links) {
        const normalized = normalizeTitle(title);
        if (normalized && !titleLookup.has(normalized)) {
            titleLookup.set(normalized, title);
        }
    }

    const entries = artifacts
        .map((artifact) =>
            buildCatalogEntry(
                artifact,
                titleLookup,
                cachedLocalImageMap,
                existingArtifactImageCatalog[artifact.id]
            )
        )
        .sort((a, b) => a.id - b.id);

    await mkdir(path.dirname(outputFile), { recursive: true });
    await writeFile(outputFile, renderCatalogFile(entries), "utf8");

    const readyCount = entries.filter((entry) => entry.status === "ready").length;
    const pendingCount = entries.filter(
        (entry) => entry.status === "pending"
    ).length;
    const missingCount = entries.filter(
        (entry) => entry.status === "missing"
    ).length;

    console.log(
        `[wenwu-image-catalog] generated ${entries.length} entries (${readyCount} ready, ${pendingCount} pending, ${missingCount} missing)`
    );
    if (pendingCount || missingCount) {
        console.log(
            entries
                .filter((entry) => entry.status !== "ready")
                .map((entry) => `${entry.status}: ${entry.name}`)
                .join("\n")
        );
    }
};

main().catch((error) => {
    console.error("[wenwu-image-catalog] generation failed");
    console.error(error);
    process.exitCode = 1;
});
