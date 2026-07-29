export function debounce<TArgs extends unknown[]>(
    func: (...args: TArgs) => void,
    wait: number
) {
    let timeout: number | undefined;

    return function executedFunction(...args: TArgs) {
        const later = () => {
            if (timeout !== undefined) {
                window.clearTimeout(timeout);
            }
            func(...args);
        };

        if (timeout !== undefined) {
            window.clearTimeout(timeout);
        }
        timeout = window.setTimeout(later, wait);
    };
}

interface ExtendedNavigator extends Navigator {
    deviceMemory?: number;
}

function getDevicePerformance(): { cores: number; memory: number } {
    const extendedNavigator = navigator as ExtendedNavigator;
    const cores = navigator.hardwareConcurrency || 4;
    const memory = extendedNavigator.deviceMemory || 4;
    return { cores, memory };
}

export function adjustBatchSizeAndConcurrency(images: { file: File }[]): {
    batchSize: number;
    globalConcurrency: number;
} {
    const { cores, memory } = getDevicePerformance();
    const totalSize = images.reduce((sum, img) => sum + img.file.size, 0);
    const avgSize = totalSize / images.length / 1024 / 1024;

    const batchSize = Math.max(1, Math.min(Math.floor(cores / 2), 5));
    const globalConcurrency = Math.max(
        1,
        Math.min(Math.floor(memory * 2), 10)
    );

    if (avgSize > 5) {
        return {
            batchSize: Math.max(1, batchSize - 1),
            globalConcurrency: Math.max(1, globalConcurrency - 2),
        };
    }

    return { batchSize, globalConcurrency };
}
