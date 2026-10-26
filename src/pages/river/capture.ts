/** Keep the download inside the user's click gesture for WebKit-based viewers. */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
    const link=document.createElement('a');
    link.href=canvas.toDataURL('image/png');
    link.download=filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
}
