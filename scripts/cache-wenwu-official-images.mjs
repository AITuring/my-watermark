import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const artifactImageDir = path.join(projectRoot, "public/wenwu/artifacts");

const OFFICIAL_IMAGE_PAGES = [
    {
        id: 18,
        name: "韩滉《五牛图》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/paint/234599.html",
    },
    {
        id: 19,
        name: "周昉《挥扇仕女图》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/paint/228711.html",
    },
    {
        id: 24,
        name: "黄筌《写生珍禽图》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/paint/228361.html",
    },
    {
        id: 33,
        name: "步辇图",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/paint/234620.html",
    },
    {
        id: 35,
        name: "王珣《伯远帖》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/handwriting/228199.html",
    },
    {
        id: 37,
        name: "国诠书《善见律》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/handwriting/231479.html",
    },
    {
        id: 40,
        name: "林逋《自书诗》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/handwriting/228219.html",
    },
    {
        id: 41,
        name: "蔡襄《自书诗》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/handwriting/228526.html",
    },
    {
        id: 42,
        name: "文彦博《三帖卷》",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/handwriting/259371.html",
    },
    {
        id: 20,
        name: "周文矩《重屏会棋图》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/paint/230460.html",
    },
    {
        id: 21,
        name: "胡瓌《卓歇图》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/paint/234629.html",
    },
    {
        id: 23,
        name: "卫贤《高士图》轴",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/paint/234557.html",
    },
    {
        id: 25,
        name: "王诜《渔村小雪图》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/paint/234606.html",
    },
    {
        id: 26,
        name: "梁师闵《芦汀密雪图》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/paint/231254.html",
    },
    {
        id: 27,
        name: "祁序《江山牧放图》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/paint/230445.html",
    },
    {
        id: 28,
        name: "李公麟《摹韦偃牧放图》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/paint/234609.html",
    },
    {
        id: 31,
        name: "马和之《后赤壁赋图》卷",
        museum: "minghuaji",
        pageUrl: "https://minghuaji.dpm.org.cn/paint/detail?id=f62c6cd02cba4ab5a151a79e3a82d906",
    },
    {
        id: 39,
        name: "杨凝式《神仙起居法帖》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/handwriting/228201.html",
    },
    {
        id: 43,
        name: "黄庭坚《诸上座》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/handwriting/228218.html",
    },
    {
        id: 44,
        name: "米芾《苕溪诗》卷",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/handwriting/228246.html",
    },
    {
        id: 46,
        name: "“永安三年”款青釉堆塑谷仓罐",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/ceramic/226707.html",
    },
    {
        id: 47,
        name: "青釉凤首龙柄壶",
        museum: "intl",
        pageUrl: "https://intl.dpm.org.cn/Ceramicsis/1203.html",
    },
    {
        id: 48,
        name: "鲁山窑黑釉蓝斑腰鼓",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/ceramic/226730.html",
    },
    {
        id: 49,
        name: "汝窑天青釉弦纹樽",
        museum: "intl",
        pageUrl: "https://intl.dpm.org.cn/Ceramicsis/697.html",
    },
    {
        id: 50,
        name: "官窑弦纹瓶",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/ceramic/226843.html",
    },
    {
        id: 51,
        name: "钧窑月白釉出戟尊",
        museum: "palace",
        pageUrl: "https://www.dpm.org.cn/collection/ceramic/227008.html",
    },
    {
        id: 160,
        name: "莲鹤铜方壶",
        museum: "intl",
        pageUrl: "https://intl.dpm.org.cn/BronzeBrassandCopper/63701.html",
    },
    {
        id: 123,
        name: "耀州窑青釉刻花提梁倒流壶",
        museum: "shaanxi",
        pageUrl: "https://www.sxhm.com/collections/detail/508.html",
    },
    {
        id: 124,
        name: "三彩骆驼载乐俑",
        museum: "shaanxi",
        pageUrl: "https://www.sxhm.com/collections/detail/509.html",
    },
    {
        id: 125,
        name: "“皇后之玺”玉玺",
        museum: "shaanxi",
        pageUrl: "https://www.sxhm.com/collections/detail/466.html",
    },
    {
        id: 126,
        name: "章怀太子墓打马球图壁画",
        museum: "shaanxi",
        pageUrl: "https://www.sxhm.com/collections/detail/507.html",
    },
    {
        id: 127,
        name: "章怀太子墓狩猎出行图壁画",
        museum: "shaanxi",
        pageUrl: "https://www.sxhm.com/collections/detail/515.html",
    },
    {
        id: 128,
        name: "懿德太子墓阙楼仪仗图",
        museum: "shaanxi",
        pageUrl: "https://www.sxhm.com/collections/detail/513.html",
    },
    {
        id: 129,
        name: "永泰公主墓宫女图壁画",
        museum: "shaanxi",
        pageUrl: "https://www.sxhm.com/collections/detail/510.html",
    },
    {
        id: 114,
        name: "大汶口文化象牙梳",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202008/t20200824_247245.shtml",
    },
    {
        id: 168,
        name: "青釉仰覆莲花尊",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202112/t20211203_252540.shtml",
    },
    {
        id: 169,
        name: "包金镶玉嵌琉璃银带钩",
        museum: "national_article",
        pageUrl: "https://www.chnmuseum.cn/zx/gbxw/202508/t20250808_272334.shtml",
        imageCaption: "包金镶玉嵌琉璃银带钩（复制件）",
    },
    {
        id: 170,
        name: "四羊方尊",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202108/t20210806_250991.shtml",
    },
    {
        id: 171,
        name: "“赤乌十四年”款青釉虎子",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202203/t20220307_254180.shtml",
    },
    {
        id: 172,
        name: "红山文化玉龙",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/portals/0/web/zt/202012yulongzt/",
    },
    {
        id: 173,
        name: "马家窑文化彩陶舞蹈纹盆",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202008/t20200824_247247.shtml",
    },
    {
        id: 174,
        name: "马家窑文化彩陶贴塑人纹双系壶",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202008/t20200824_247239.shtml",
    },
    {
        id: 175,
        name: "仰韶文化彩陶网纹船形壶",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202008/t20200824_247229.shtml",
    },
    {
        id: 176,
        name: "仰韶文化彩陶人面鱼纹盆",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202008/t20200824_247218.shtml",
    },
    {
        id: 177,
        name: "绿玻璃盖罐",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202203/t20220322_254466.shtml",
    },
    {
        id: 178,
        name: "绿玻璃小瓶",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202111/t20211116_252162.shtml",
    },
    {
        id: 179,
        name: "陶骆驼载乐舞三彩俑",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202008/t20200824_247230.shtml",
    },
    {
        id: 180,
        name: "诅盟场面贮贝器",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202110/t20211028_251980.shtml",
    },
    {
        id: 181,
        name: "“滇王之印”金印",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202110/t20211028_251978.shtml",
    },
    {
        id: 182,
        name: "天亡簋",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/csp/202008/t20200826_247369.shtml",
    },
    {
        id: 183,
        name: "子龙鼎",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/csp/202008/t20200826_247355.shtml",
    },
    {
        id: 184,
        name: "孝端皇后凤冠",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202111/t20211126_252409.shtml",
    },
    {
        id: 186,
        name: "彩绘鹤鱼石斧图陶缸",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202008/t20200824_247232.shtml",
    },
    {
        id: 187,
        name: "大盂鼎",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/Portals/0/web/zt/100n/guobao_content-1.html?id=23",
    },
    {
        id: 188,
        name: "虢季子白盘",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/csp/202008/t20200826_247376.shtml",
    },
    {
        id: 189,
        name: "陶鹰鼎",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202008/t20200824_247248.shtml",
    },
    {
        id: 190,
        name: "利簋",
        museum: "national",
        pageUrl: "https://www.chnmuseum.cn/zp/zpml/kgfjp/202108/t20210802_250931.shtml",
    },
];

const fetchText = async (url) => {
    const response = await fetch(url, {
        headers: {
            "User-Agent": "my-watermark-official-cache/1.0",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    });

    if (!response.ok) {
        throw new Error(`page ${response.status}`);
    }

    return response.text();
};

const resolvePalaceImageUrl = (html) => {
    const dataImgMatch = html.match(/data-img="(https:\/\/img\.dpm\.org\.cn\/Uploads\/Picture\/[^"]+)"/);
    if (dataImgMatch) return dataImgMatch[1];

    const metaImageMatch = html.match(/<meta name="Image" content="([^"]+)"/);
    if (metaImageMatch) {
        const metaPath = metaImageMatch[1];
        if (metaPath.startsWith("http")) return metaPath;
        return `https://www.dpm.org.cn/Uploads/${metaPath}`;
    }

    return null;
};

const resolveNationalImageUrl = (html, pageUrl) => {
    const fullMatch = html.match(/data-src='(\.\/P[^']+\.(?:jpg|jpeg|png|webp))'/i);
    if (fullMatch) {
        return new URL(fullMatch[1], pageUrl).toString();
    }

    const imgMatch = html.match(/<img src='(\.\/P[^']+\.(?:jpg|jpeg|png|webp))'/i);
    if (imgMatch) {
        return new URL(imgMatch[1], pageUrl).toString();
    }

    const legacyUploadMatch = html.match(
        /<img[^>]+src="(sto\/uploads\/image_fck\/[^"]+\.(?:jpg|jpeg|png|webp))"/i
    );
    if (legacyUploadMatch) {
        return new URL(legacyUploadMatch[1], pageUrl).toString();
    }

    const specialTopicMatch = html.match(/<dt><img src="(images\/yl_jspic01\.jpg)"/i);
    if (specialTopicMatch) {
        return new URL(specialTopicMatch[1], pageUrl).toString();
    }

    return null;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveNationalArticleImageUrl = (html, pageUrl, imageCaption) => {
    if (!imageCaption) return null;

    const captionPattern = escapeRegExp(imageCaption);
    const match = html.match(
        new RegExp(
            `<img[^>]+oldsrc="([^"]+)"[^>]*>\\s*<\\/p>\\s*<p[^>]*>\\s*(?:<font[^>]*>)?${captionPattern}(?:<\\/font>)?\\s*<\\/p>`,
            "i"
        )
    );

    if (!match) return null;

    return new URL(match[1], pageUrl).toString();
};

const resolveIntlImageUrl = (html) => {
    const match = html.match(
        /<img[^>]+src="(https:\/\/shuziwenwu-1259446244\.cos\.ap-beijing\.myqcloud\.com\/relic\/[^"]+\.(?:jpg|jpeg|png|webp))"/i
    );
    return match?.[1] || null;
};

const resolveMinghuajiImageUrl = (html) => {
    const styleMatch = html.match(
        /background:\s*url\((https:\/\/minghuaji-1259446244\.cos\.ap-beijing\.myqcloud\.com\/paint\/[^)]+\.(?:jpg|jpeg|png|webp))\)/i
    );
    if (styleMatch) return styleMatch[1];

    const imgMatch = html.match(
        /<img[^>]+src="(https:\/\/minghuaji-1259446244\.cos\.ap-beijing\.myqcloud\.com\/paint\/[^"]+\.(?:jpg|jpeg|png|webp))"/i
    );
    return imgMatch?.[1] || null;
};

const resolveShaanxiImageUrl = (html, pageUrl) => {
    const match = html.match(/<div class="pic">\s*<div class="img"><img src="([^"]+)"/);
    if (!match) return null;

    return new URL(match[1], pageUrl).toString();
};

const resolveOfficialImageUrl = (entry, html) => {
    if (entry.museum === "palace") return resolvePalaceImageUrl(html);
    if (entry.museum === "national") return resolveNationalImageUrl(html, entry.pageUrl);
    if (entry.museum === "national_article") {
        return resolveNationalArticleImageUrl(html, entry.pageUrl, entry.imageCaption);
    }
    if (entry.museum === "intl") return resolveIntlImageUrl(html);
    if (entry.museum === "minghuaji") return resolveMinghuajiImageUrl(html);
    if (entry.museum === "shaanxi") return resolveShaanxiImageUrl(html, entry.pageUrl);
    return null;
};

const getFileExtension = (url, contentType) => {
    const normalizedType = contentType?.split(";")[0]?.trim().toLowerCase();
    if (normalizedType === "image/png") return "png";
    if (normalizedType === "image/webp") return "webp";

    const pathname = new URL(url).pathname;
    const extension = path.extname(pathname).replace(".", "").toLowerCase();
    return extension || "jpg";
};

const downloadBinary = async (url, referer) => {
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "image/*,*/*;q=0.8",
            Referer: referer,
        },
    });

    if (!response.ok) {
        throw new Error(`image ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
        buffer: Buffer.from(arrayBuffer),
        contentType: response.headers.get("content-type") || undefined,
    };
};

const run = async () => {
    await mkdir(artifactImageDir, { recursive: true });

    for (const entry of OFFICIAL_IMAGE_PAGES) {
        try {
            const html = await fetchText(entry.pageUrl);
            const imageUrl = resolveOfficialImageUrl(entry, html);

            if (!imageUrl) {
                console.warn(`skip ${entry.id} ${entry.name}: no image url`);
                continue;
            }

            const { buffer, contentType } = await downloadBinary(imageUrl, entry.pageUrl);
            const extension = getFileExtension(imageUrl, contentType);
            const fileName = `${entry.id}-official.${extension}`;
            const filePath = path.join(artifactImageDir, fileName);

            await writeFile(filePath, buffer);
            console.log(`downloaded ${entry.id} ${entry.name} -> ${fileName}`);
        } catch (error) {
            console.warn(
                `failed ${entry.id} ${entry.name}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }
};

run().catch((error) => {
    console.error("[wenwu-official-cache] failed");
    console.error(error);
    process.exitCode = 1;
});
