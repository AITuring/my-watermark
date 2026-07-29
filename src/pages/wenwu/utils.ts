import { eraIcons } from "./assets";
import {
    BATCH_COLOR_MAP,
    COMMON_REGIONS,
    DEFAULT_BATCH_COLOR,
    DEFAULT_ERA_COLOR,
    DEFAULT_TYPE_COLOR,
    ERA_COLOR_MAP,
    EXCLUDED_KEYWORDS,
    PROVINCE_MUSEUM_KEYWORDS,
    TYPE_COLOR_MAP,
} from "./constants";
import type { Artifact } from "./types";

export const normalizeProvince = (name: string) =>
    (name || "").replace(/(省|市|自治区|特别行政区)$/, "");

export const belongsToProvince = (
    item: Pick<Artifact, "collectionLocation" | "excavationLocation">,
    provinceRaw: string
) => {
    if (!provinceRaw) return true;
    const province = normalizeProvince(provinceRaw);
    const candidates = [province, `${province}市`, `${province}省`];

    const hitsText = (text?: string) =>
        !!text && candidates.some((keyword) => text.includes(keyword));

    if (hitsText(item.collectionLocation) || hitsText(item.excavationLocation)) {
        return true;
    }

    const museums = PROVINCE_MUSEUM_KEYWORDS[province] || [];
    return museums.some((museum) => item.collectionLocation?.includes(museum));
};

export const extractMuseumNames = (collectionLocation: string): string[] => {
    const museums = new Set<string>();
    if (!collectionLocation) return [];

    const raw = collectionLocation
        .replace(/（[^）]*）/g, "")
        .replace(/\([^)]*\)/g, "")
        .replace(/各(馆|博物馆)?(收藏|收藏一半|分藏|各藏).*/g, "")
        .replace(/(等)?(单位|博物馆)?(共同)?(收藏|保管).*/g, "");

    const parts = raw
        .split(/[、，,；;\/\|]|和|与|及/g)
        .map((item) => item.trim())
        .filter(Boolean);

    for (const part of parts) {
        if (part === "原物为一对，一件藏于北京故宫博物院，另一件藏于河南博物院") {
            museums.add("故宫博物院");
            museums.add("河南博物院");
            continue;
        }
        if (part === "上海博物馆、山西博物馆各收藏一半") {
            museums.add("上海博物馆");
            museums.add("山西博物馆");
            continue;
        }
        museums.add(part);
    }

    return Array.from(museums).sort();
};

export const normalizeEraText = (text: string) =>
    (text || "")
        .replace(/\s+/g, "")
        .replace(/（.*?）/g, "")
        .replace(/\(.*?\)/g, "")
        .replace(/[·•，,、]/g, "");

export const resolveEraIconKey = (eraRaw: string) => {
    const era = normalizeEraText(eraRaw);

    if ((era.includes("三国") || /魏|蜀|吴/.test(era)) && eraIcons["三国"]) {
        return "三国";
    }

    const keys = [
        "新石器时代",
        "夏",
        "商",
        "西周",
        "东周",
        "春秋",
        "战国",
        "秦",
        "西汉",
        "东汉",
        "西晋",
        "东晋",
        "北魏",
        "北燕",
        "北齐",
        "北朝",
        "南朝",
        "隋",
        "唐",
        "五代",
        "北宋",
        "南宋",
        "西夏",
        "元",
        "明",
        "清",
    ];

    for (const key of keys) {
        if (era.includes(key) && eraIcons[key]) return key;
    }

    if (eraIcons[era]) return era;
    return undefined;
};

export const getEraIcon = (eraRaw: string) => {
    const key = resolveEraIconKey(eraRaw);
    return key ? eraIcons[key] : undefined;
};

export const getEraRank = (eraRaw: string) => {
    const era = normalizeEraText(eraRaw);

    const specific: Array<[RegExp, number]> = [
        [/^新石器时代/, 100],
        [/^秦/, 600],
        [/^西汉/, 710],
        [/^东汉/, 720],
        [/^西晋/, 880],
        [/^东晋/, 900],
        [/^北魏/, 1010],
        [/^北燕/, 1020],
        [/^北齐/, 1030],
        [/^北朝/, 1040],
        [/^南朝/, 1050],
        [/^隋/, 1100],
        [/^唐/, 1200],
        [/^五代/, 1300],
        [/^北宋/, 1410],
        [/^南宋/, 1420],
        [/^西夏/, 1430],
        [/^宋/, 1400],
        [/^元/, 1500],
        [/^明/, 1600],
        [/^清/, 1700],
        [/^近现代/, 1800],
        [/^现代/, 1900],
        [/^西周/, 400],
        [/^东周/, 500],
        [/^春秋/, 510],
        [/^战国/, 520],
    ];

    for (const [re, rank] of specific) {
        if (re.test(era)) return rank;
    }

    const generic: Array<[string, number]> = [
        ["夏", 200],
        ["商", 300],
        ["汉", 700],
        ["三国", 800],
        ["魏", 810],
        ["蜀", 820],
        ["吴", 830],
        ["南北朝", 1030],
    ];

    for (const [keyword, rank] of generic) {
        if (era.includes(keyword)) return rank;
    }

    return Number.MAX_SAFE_INTEGER;
};

export const normalizeMuseumQuery = (name: string) => {
    let query = (name || "").trim();

    const aliases: Record<string, string> = {
        故宫: "故宫博物院",
        紫禁城: "故宫博物院",
        国博: "中国国家博物馆",
        国家博物馆: "中国国家博物馆",
        中国国博: "中国国家博物馆",
        上博: "上海博物馆",
        上历博: "上海历史博物馆",
        陕历博: "陕西历史博物馆",
        山西博物馆: "山西博物院",
        河南省博物馆: "河南博物院",
        浙博: "浙江省博物馆之江馆区",
        浙江省博物馆: "浙江省博物馆之江馆区",
        浙江博物馆: "浙江省博物馆之江馆区",
        敦煌研究院: "敦煌研究院",
        天博: "天津博物馆",
    };

    if (aliases[query]) return aliases[query];

    if (!query.includes("博物") && !query.includes("博物院")) {
        query = `${query} 博物馆`;
    }

    return query;
};

export const deduceCityFromName = (name: string): string | null => {
    const normalized = (name || "").trim();
    for (const region of COMMON_REGIONS) {
        if (normalized.includes(region)) return region;
    }
    return null;
};

export const normalizeForCompare = (value: string) =>
    (value || "")
        .replace(/\\s+/g, "")
        .replace(/博物院/g, "博物馆")
        .toLowerCase();

export const scorePoi = (poi: any, query: string, cityHint?: string) => {
    const name = poi?.name || "";
    const type = poi?.type || "";
    const cityname = poi?.cityname || "";
    const adname = poi?.adname || "";

    for (const keyword of EXCLUDED_KEYWORDS) {
        if (name.includes(keyword)) return -Infinity;
    }

    const qn = normalizeForCompare(query);
    const pn = normalizeForCompare(name);

    let score = 0;
    if (pn === qn) score += 100;
    else if (pn.includes(qn) || qn.includes(pn)) score += 60;

    if (type.includes("博物馆") || type.includes("博物院")) score += 40;

    if (cityHint && (cityname.includes(cityHint) || adname.includes(cityHint))) {
        score += 25;
    }

    if (cityHint && name.includes(cityHint)) score += 10;

    return score;
};

export const getBatchColor = (batch: string) =>
    BATCH_COLOR_MAP[batch] || DEFAULT_BATCH_COLOR;

export const getTypeColor = (type: string) =>
    TYPE_COLOR_MAP[type] || DEFAULT_TYPE_COLOR;

export const getEraColor = (era: string) =>
    ERA_COLOR_MAP[era] || DEFAULT_ERA_COLOR;
