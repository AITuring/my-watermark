export type TransferTarget = "watermark" | "puzzle";

type PendingTransfer = {
    target: TransferTarget;
    files: File[];
    createdAt: number;
};

let pendingTransfer: PendingTransfer | null = null;

export const setPendingCropTransfer = (target: TransferTarget, files: File[]) => {
    pendingTransfer = {
        target,
        files,
        createdAt: Date.now(),
    };
};

export const consumePendingCropTransfer = (target: TransferTarget): File[] => {
    if (!pendingTransfer || pendingTransfer.target !== target) {
        return [];
    }
    const files = pendingTransfer.files;
    pendingTransfer = null;
    return files;
};
