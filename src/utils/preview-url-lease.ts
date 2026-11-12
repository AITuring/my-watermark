/** Owns only local Blob URLs; React effect replay must not invalidate live images. */
export class PreviewUrlLease {
    private urls = new Set<string>();
    private disposal: ReturnType<typeof setTimeout> | undefined;

    retain(urls: Iterable<string>) {
        clearTimeout(this.disposal);
        this.disposal = undefined;
        const next = new Set(Array.from(urls).filter(url => url.startsWith('blob:')));
        for (const url of this.urls) {
            if (!next.has(url)) URL.revokeObjectURL(url);
        }
        this.urls = next;
    }

    release() {
        clearTimeout(this.disposal);
        // StrictMode and Fast Refresh reconnect effects in the same turn.
        this.disposal = setTimeout(() => {
            for (const url of this.urls) URL.revokeObjectURL(url);
            this.urls.clear();
            this.disposal = undefined;
        }, 0);
    }
}

export async function isPreviewUrlAvailable(url: string): Promise<boolean> {
    if (!url.startsWith('blob:')) return true;
    try {
        const response = await fetch(url);
        await response.body?.cancel();
        return response.ok;
    } catch {
        return false;
    }
}

export async function recoverPreviewUrl(url: string, recreate: () => Promise<string>): Promise<string | undefined> {
    return await isPreviewUrlAvailable(url) ? undefined : recreate();
}
