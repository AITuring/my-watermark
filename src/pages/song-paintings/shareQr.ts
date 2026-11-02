/**
 * Render a QR code locally, leaving a transparent four-module quiet zone.
 * Draw this canvas at its native size in the poster to keep modules pixel-aligned.
 */
export async function createShareQr(value: string, ink = "#263a31"): Promise<{ canvas: HTMLCanvasElement; padding: number }> {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("分享二维码需要有效的 HTTPS 网站地址。");
    }

    const { default: qrcode } = await import("qrcode-generator");
    const code = qrcode(0, "M");
    // URL serialisation percent-encodes non-ASCII paths, avoiding charset ambiguity.
    code.addData(url.href, "Byte");
    code.make();

    const modules = code.getModuleCount();
    const quietZone = 4;
    const cellSize = Math.floor(260 / (modules + quietZone * 2));
    if (cellSize < 3) throw new Error("分享链接过长，请使用简短的网站地址。");
    const size = (modules + quietZone * 2) * cellSize;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法生成分享二维码。");

    context.imageSmoothingEnabled = false;
    context.fillStyle = ink;
    for (let row = 0; row < modules; row += 1) {
        for (let column = 0; column < modules; column += 1) {
            if (code.isDark(row, column)) {
                context.fillRect((column + quietZone) * cellSize, (row + quietZone) * cellSize, cellSize, cellSize);
            }
        }
    }
    return { canvas, padding: quietZone * cellSize };
}
