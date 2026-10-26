export type TransferTarget = "watermark" | "puzzle" | "crop" | "compress";

import { clearFileSession, loadFileSession, saveFileSession } from "@/utils/file-storage";

type PendingTransfer = {
    target: TransferTarget;
    files: File[];
    createdAt: number;
};

let pendingTransfer: PendingTransfer | null = null;

const pendingTransferSessionKey = (target: TransferTarget) =>
    `pending-crop-transfer:${target}`;

export const setPendingCropTransfer = async (target: TransferTarget, files: File[]) => {
    pendingTransfer = {
        target,
        files,
        createdAt: Date.now(),
    };
    await Promise.all(
        (["watermark", "puzzle", "crop", "compress"] as TransferTarget[]).map(
            (candidate) =>
                candidate === target
                    ? saveFileSession(pendingTransferSessionKey(candidate), files)
                    : clearFileSession(pendingTransferSessionKey(candidate))
        )
    );
};

export const consumePendingCropTransfer = async (target: TransferTarget): Promise<File[]> => {
    if (pendingTransfer) {
        if (pendingTransfer.target !== target) {
            return [];
        }

        const files = pendingTransfer.files;
        pendingTransfer = null;
        await clearFileSession(pendingTransferSessionKey(target));
        return files;
    }

    const files = await loadFileSession(pendingTransferSessionKey(target));
    if (!files.length) {
        return [];
    }

    // A persisted transfer is only consumed by the matching destination. The
    // target is kept in memory while the current page is alive; after a full
    // reload the transfer is intended for the page that was opened last.
    await clearFileSession(pendingTransferSessionKey(target));
    return files;
};
